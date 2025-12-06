/**
 * Smut Wrapped - AO3 Scraper Module
 *
 * Handles all scraping of AO3 reading history and work metadata.
 * Implements respectful rate limiting (5 seconds between requests).
 */

const AO3Scraper = (function () {
  // Constants
  const AO3_BASE_URL = 'https://archiveofourown.org';
  const RATE_LIMIT_MS = 5000; // 5 seconds between requests
  const ITEMS_PER_PAGE = 20; // AO3 shows 20 items per history page

  // State
  let cancelRequested = false;

  /**
   * Delays execution for rate limiting
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parses HTML string into a DOM document
   * @param {string} html - HTML string to parse
   * @returns {Document}
   */
  function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  /**
   * Extracts text content from an element, trimmed
   * @param {Element} element - DOM element
   * @param {string} selector - CSS selector
   * @returns {string|null}
   */
  function getText(element, selector) {
    const el = element.querySelector(selector);
    return el ? el.textContent.trim() : null;
  }

  /**
   * Extracts all text content from matching elements
   * @param {Element} element - DOM element
   * @param {string} selector - CSS selector
   * @returns {string[]}
   */
  function getAllText(element, selector) {
    const elements = element.querySelectorAll(selector);
    return Array.from(elements).map(el => el.textContent.trim());
  }

  /**
   * Requests cancellation of the current scraping operation
   */
  function requestCancel() {
    cancelRequested = true;
  }

  /**
   * Resets the cancellation flag
   */
  function resetCancel() {
    cancelRequested = false;
  }

  /**
   * Checks if cancellation was requested
   * @returns {boolean}
   */
  function isCancelled() {
    return cancelRequested;
  }

  /**
   * Fetches the total number of history pages for a user
   * @param {string} username - AO3 username
   * @returns {Promise<number>} Total number of pages
   */
  async function getHistoryPageCount(username) {
    const url = `${AO3_BASE_URL}/users/${username}/readings`;
    const result = await window.electronAPI.fetchUrl(url);

    if (!result.success) {
      throw new Error(`Failed to fetch history: ${result.error}`);
    }

    const doc = parseHTML(result.html);

    // Find pagination - look for the last page number
    const pagination = doc.querySelector('ol.pagination');
    if (!pagination) {
      // No pagination means only one page
      return 1;
    }

    // Find the last numbered page link
    const pageLinks = pagination.querySelectorAll('li a');
    let maxPage = 1;

    pageLinks.forEach(link => {
      const pageNum = parseInt(link.textContent, 10);
      if (!isNaN(pageNum) && pageNum > maxPage) {
        maxPage = pageNum;
      }
    });

    return maxPage;
  }

  /**
   * Parses a single history item from the reading history page
   * @param {Element} item - DOM element representing a history item
   * @returns {Object} Parsed history item
   */
  function parseHistoryItem(item) {
    // Get work link and ID
    const titleLink = item.querySelector('h4.heading a');
    if (!titleLink) return null;

    const workUrl = titleLink.getAttribute('href');
    const workIdMatch = workUrl.match(/\/works\/(\d+)/);
    if (!workIdMatch) return null;

    const workId = workIdMatch[1];
    const title = titleLink.textContent.trim();

    // Get author(s)
    const authorLinks = item.querySelectorAll('a[rel="author"]');
    const authors = Array.from(authorLinks).map(a => a.textContent.trim());

    // Get fandoms
    const fandomLinks = item.querySelectorAll('h5.fandoms a.tag');
    const fandoms = Array.from(fandomLinks).map(a => a.textContent.trim());

    // Get visit count and last visited from user status
    const visitedElement = item.querySelector('.user-status .visited');
    let visitCount = 1;
    let lastVisited = null;

    if (visitedElement) {
      const visitText = visitedElement.textContent;
      const countMatch = visitText.match(/Visited\s+(\d+)\s+times?/i);
      if (countMatch) {
        visitCount = parseInt(countMatch[1], 10);
      }

      const dateElement = item.querySelector('.user-status .datetime');
      if (dateElement) {
        lastVisited = dateElement.textContent.trim();
      }
    }

    // Get basic tags visible on history page
    const warningTags = getAllText(item, '.warnings.tags .tag');
    const relationshipTags = getAllText(item, '.relationships.tags .tag');
    const characterTags = getAllText(item, '.characters.tags .tag');
    const freeformTags = getAllText(item, '.freeforms.tags .tag');

    // Get word count if visible
    const wordCountEl = item.querySelector('dd.words');
    let wordCount = null;
    if (wordCountEl) {
      const wcText = wordCountEl.textContent.replace(/,/g, '');
      wordCount = parseInt(wcText, 10);
    }

    return {
      workId,
      title,
      authors,
      fandoms,
      visitCount,
      lastVisited,
      warnings: warningTags,
      relationships: relationshipTags,
      characters: characterTags,
      freeformTags,
      wordCount,
      // These will be populated when we fetch individual work pages
      rating: null,
      kudos: null,
      bookmarks: null,
      chapters: null,
      complete: null,
      datePublished: null
    };
  }

  /**
   * Scrapes a single page of reading history
   * @param {string} username - AO3 username
   * @param {number} pageNum - Page number to fetch
   * @returns {Promise<Object[]>} Array of history items
   */
  async function scrapeHistoryPage(username, pageNum) {
    const url = `${AO3_BASE_URL}/users/${username}/readings?page=${pageNum}`;
    const result = await window.electronAPI.fetchUrl(url);

    if (!result.success) {
      throw new Error(`Failed to fetch history page ${pageNum}: ${result.error}`);
    }

    const doc = parseHTML(result.html);
    const items = doc.querySelectorAll('.reading.work.blurb');
    const parsed = [];

    items.forEach(item => {
      const historyItem = parseHistoryItem(item);
      if (historyItem) {
        parsed.push(historyItem);
      }
    });

    return parsed;
  }

  /**
   * Fetches detailed metadata for a single work
   * @param {string} workId - AO3 work ID
   * @returns {Promise<Object>} Work metadata
   */
  async function fetchWorkMetadata(workId) {
    const url = `${AO3_BASE_URL}/works/${workId}?view_adult=true`;
    const result = await window.electronAPI.fetchUrl(url);

    if (!result.success) {
      throw new Error(`Failed to fetch work ${workId}: ${result.error}`);
    }

    const doc = parseHTML(result.html);

    // Parse rating
    const ratingTag = doc.querySelector('.rating.tags .tag');
    const rating = ratingTag ? ratingTag.textContent.trim() : 'Unknown';

    // Parse warnings
    const warnings = getAllText(doc, '.warning.tags .tag');

    // Parse fandoms
    const fandoms = getAllText(doc, '.fandom.tags .tag');

    // Parse relationships
    const relationships = getAllText(doc, '.relationship.tags .tag');

    // Parse characters
    const characters = getAllText(doc, '.character.tags .tag');

    // Parse freeform tags
    const freeformTags = getAllText(doc, '.freeform.tags .tag');

    // Parse stats
    const statsBlock = doc.querySelector('dl.stats');
    let wordCount = null;
    let chapters = null;
    let kudos = null;
    let bookmarks = null;
    let hits = null;
    let datePublished = null;
    let dateUpdated = null;
    let complete = null;

    if (statsBlock) {
      // Word count
      const wordCountEl = statsBlock.querySelector('dd.words');
      if (wordCountEl) {
        wordCount = parseInt(wordCountEl.textContent.replace(/,/g, ''), 10);
      }

      // Chapters
      const chaptersEl = statsBlock.querySelector('dd.chapters');
      if (chaptersEl) {
        const chapText = chaptersEl.textContent.trim();
        chapters = chapText;
        // Check if complete (e.g., "5/5" vs "3/?")
        complete = !chapText.includes('?');
      }

      // Kudos
      const kudosEl = statsBlock.querySelector('dd.kudos');
      if (kudosEl) {
        kudos = parseInt(kudosEl.textContent.replace(/,/g, ''), 10);
      }

      // Bookmarks
      const bookmarksEl = statsBlock.querySelector('dd.bookmarks');
      if (bookmarksEl) {
        bookmarks = parseInt(bookmarksEl.textContent.replace(/,/g, ''), 10);
      }

      // Hits
      const hitsEl = statsBlock.querySelector('dd.hits');
      if (hitsEl) {
        hits = parseInt(hitsEl.textContent.replace(/,/g, ''), 10);
      }

      // Date published
      const publishedEl = statsBlock.querySelector('dd.published');
      if (publishedEl) {
        datePublished = publishedEl.textContent.trim();
      }

      // Date updated (if different from published)
      const updatedEl = statsBlock.querySelector('dd.status');
      if (updatedEl) {
        dateUpdated = updatedEl.textContent.trim();
      }
    }

    return {
      workId,
      rating,
      warnings,
      fandoms,
      relationships,
      characters,
      freeformTags,
      wordCount,
      chapters,
      kudos,
      bookmarks,
      hits,
      datePublished,
      dateUpdated,
      complete
    };
  }

  /**
   * Scrapes all reading history for a user
   * @param {string} username - AO3 username
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object[]>} Array of all history items
   */
  async function scrapeReadingHistory(username, onProgress) {
    resetCancel();
    const allItems = [];

    // Get total page count
    onProgress({
      phase: 'init',
      message: 'Checking your reading history size...',
      percent: 0
    });

    const totalPages = await getHistoryPageCount(username);

    onProgress({
      phase: 'history',
      message: `Found ${totalPages} pages of reading history`,
      percent: 5
    });

    // Scrape each history page
    for (let page = 1; page <= totalPages; page++) {
      if (isCancelled()) {
        throw new Error('Scraping cancelled by user');
      }

      onProgress({
        phase: 'history',
        message: `Fetching reading history... Page ${page}/${totalPages}`,
        detail: `Respecting AO3's servers - please wait`,
        percent: 5 + (page / totalPages) * 25
      });

      const items = await scrapeHistoryPage(username, page);
      allItems.push(...items);

      // Rate limit between pages
      if (page < totalPages) {
        await delay(RATE_LIMIT_MS);
      }
    }

    return allItems;
  }

  /**
   * Enriches history items with detailed work metadata
   * @param {Object[]} historyItems - Array of history items
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object[]>} Enriched history items
   */
  async function enrichWithMetadata(historyItems, onProgress) {
    const total = historyItems.length;
    let completed = 0;
    let failed = 0;

    for (const item of historyItems) {
      if (isCancelled()) {
        throw new Error('Scraping cancelled by user');
      }

      onProgress({
        phase: 'metadata',
        message: `Analyzing works... ${completed + 1}/${total}`,
        detail: `"${item.title}"`,
        percent: 30 + ((completed / total) * 60),
        failedCount: failed
      });

      try {
        const metadata = await fetchWorkMetadata(item.workId);

        // Merge metadata into item
        Object.assign(item, metadata);
      } catch (error) {
        console.error(`Failed to fetch metadata for work ${item.workId}:`, error);
        failed++;
        // Continue with partial data - don't stop the whole process
      }

      completed++;

      // Rate limit between work fetches
      if (completed < total) {
        await delay(RATE_LIMIT_MS);
      }
    }

    return {
      items: historyItems,
      failed
    };
  }

  /**
   * Main scraping function - orchestrates the entire process
   * @param {string} username - AO3 username
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Complete scraping results
   */
  async function scrapeAll(username, onProgress) {
    resetCancel();

    try {
      // Phase 1: Get reading history
      const historyItems = await scrapeReadingHistory(username, onProgress);

      if (historyItems.length === 0) {
        return {
          success: true,
          items: [],
          totalWorks: 0,
          failed: 0,
          message: 'No reading history found'
        };
      }

      // Phase 2: Enrich with metadata
      onProgress({
        phase: 'metadata',
        message: 'Starting to analyze individual works...',
        detail: `${historyItems.length} works to process`,
        percent: 30
      });

      await delay(RATE_LIMIT_MS);

      const { items, failed } = await enrichWithMetadata(historyItems, onProgress);

      // Phase 3: Complete
      onProgress({
        phase: 'complete',
        message: 'Calculating your stats...',
        percent: 95
      });

      return {
        success: true,
        items,
        totalWorks: items.length,
        failed,
        message: failed > 0
          ? `Completed with ${failed} works that couldn't be fully loaded`
          : 'All works processed successfully'
      };

    } catch (error) {
      if (error.message.includes('cancelled')) {
        return {
          success: false,
          cancelled: true,
          message: 'Scraping was cancelled'
        };
      }

      return {
        success: false,
        error: error.message,
        message: `Scraping failed: ${error.message}`
      };
    }
  }

  // Public API
  return {
    scrapeAll,
    scrapeReadingHistory,
    fetchWorkMetadata,
    requestCancel,
    resetCancel,
    isCancelled,
    getHistoryPageCount
  };
})();

// Make available globally
window.AO3Scraper = AO3Scraper;
