/**
 * Smut Wrapped - Stats Analyzer Module
 *
 * Calculates all statistics from scraped AO3 reading history data.
 */

const StatsAnalyzer = (function () {
  /**
   * Counts occurrences of items in an array
   * @param {string[]} items - Array of strings to count
   * @returns {Map<string, number>} Map of item to count
   */
  function countOccurrences(items) {
    const counts = new Map();
    items.forEach(item => {
      if (item) {
        counts.set(item, (counts.get(item) || 0) + 1);
      }
    });
    return counts;
  }

  /**
   * Sorts a Map by value (descending) and returns top N
   * @param {Map} map - Map to sort
   * @param {number} limit - Maximum items to return
   * @returns {Array} Array of [key, value] pairs
   */
  function getTopN(map, limit = 10) {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Formats a number with commas
   * @param {number} num - Number to format
   * @returns {string}
   */
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return num.toLocaleString();
  }

  /**
   * Converts word count to approximate book count
   * @param {number} words - Total word count
   * @returns {number} Approximate number of novels
   */
  function wordsToBooks(words) {
    // Average novel is ~90,000 words
    return Math.round(words / 90000);
  }

  /**
   * Analyzes reading history to generate all statistics
   * @param {Object[]} works - Array of work objects with metadata
   * @returns {Object} Complete statistics object
   */
  function analyze(works) {
    if (!works || works.length === 0) {
      return {
        isEmpty: true,
        totalWorks: 0
      };
    }

    const stats = {};

    // ==================
    // BASIC STATS
    // ==================

    // Total works
    stats.totalWorks = works.length;

    // Total words
    const wordsArray = works.map(w => w.wordCount || 0);
    stats.totalWords = wordsArray.reduce((sum, w) => sum + w, 0);
    stats.totalWordsFormatted = formatNumber(stats.totalWords);
    stats.approximateBooks = wordsToBooks(stats.totalWords);

    // Average words per work
    stats.averageWords = Math.round(stats.totalWords / stats.totalWorks);
    stats.averageWordsFormatted = formatNumber(stats.averageWords);

    // Total visits (re-reads)
    stats.totalVisits = works.reduce((sum, w) => sum + (w.visitCount || 1), 0);

    // ==================
    // TOP FANDOMS
    // ==================

    const allFandoms = works.flatMap(w => w.fandoms || []);
    const fandomCounts = countOccurrences(allFandoms);
    stats.topFandoms = getTopN(fandomCounts, 10);
    stats.topFandom = stats.topFandoms[0] || ['Unknown', 0];
    stats.uniqueFandomCount = fandomCounts.size;

    // ==================
    // TOP SHIPS/PAIRINGS
    // ==================

    const allShips = works.flatMap(w => w.relationships || []);
    const shipCounts = countOccurrences(allShips);
    stats.topShips = getTopN(shipCounts, 10);
    stats.topShip = stats.topShips[0] || ['Unknown', 0];

    // ==================
    // TOP CHARACTERS
    // ==================

    const allCharacters = works.flatMap(w => w.characters || []);
    const characterCounts = countOccurrences(allCharacters);
    stats.topCharacters = getTopN(characterCounts, 10);
    stats.topCharacter = stats.topCharacters[0] || ['Unknown', 0];

    // ==================
    // TOP TAGS (FREEFORM)
    // ==================

    // Filter out non-meaningful tags
    const tagsToExclude = ['HTML', 'html', 'http', 'https', 'www'];
    const allTags = works.flatMap(w => w.freeformTags || [])
      .filter(tag => !tagsToExclude.includes(tag));
    const tagCounts = countOccurrences(allTags);
    stats.topTags = getTopN(tagCounts, 30);
    stats.topTag = stats.topTags[0] || ['Unknown', 0];

    // ==================
    // TOP AUTHORS
    // ==================

    const allAuthors = works.flatMap(w => w.authors || []);
    const authorCounts = countOccurrences(allAuthors);
    stats.topAuthors = getTopN(authorCounts, 10);
    stats.topAuthor = stats.topAuthors[0] || ['Unknown', 0];

    // ==================
    // RATING BREAKDOWN
    // ==================

    const ratings = works.map(w => w.rating || 'Unknown');
    const ratingCounts = countOccurrences(ratings);

    const ratingOrder = ['Explicit', 'Mature', 'Teen And Up Audiences', 'General Audiences', 'Not Rated'];
    stats.ratingBreakdown = ratingOrder.map(rating => {
      const count = ratingCounts.get(rating) || 0;
      const percent = stats.totalWorks > 0 ? Math.round((count / stats.totalWorks) * 100) : 0;
      return {
        rating: rating,
        shortName: rating === 'Teen And Up Audiences' ? 'Teen' :
                   rating === 'General Audiences' ? 'General' :
                   rating === 'Not Rated' ? 'Unrated' : rating,
        count,
        percent
      };
    });

    stats.favoriteRating = stats.ratingBreakdown.reduce((max, r) =>
      r.count > max.count ? r : max, stats.ratingBreakdown[0]);

    // Smut percentage (Explicit works)
    const explicitCount = ratingCounts.get('Explicit') || 0;
    stats.smutPercentage = Math.round((explicitCount / stats.totalWorks) * 100);

    // ==================
    // COMPLETION STATUS
    // ==================

    const completeWorks = works.filter(w => w.complete === true).length;
    const wipWorks = works.filter(w => w.complete === false).length;
    const unknownCompletion = stats.totalWorks - completeWorks - wipWorks;

    stats.completionStats = {
      complete: completeWorks,
      wip: wipWorks,
      unknown: unknownCompletion,
      completePercent: Math.round((completeWorks / stats.totalWorks) * 100),
      wipPercent: Math.round((wipWorks / stats.totalWorks) * 100)
    };

    // ==================
    // LONGEST WORK
    // ==================

    const sortedByLength = [...works].sort((a, b) =>
      (b.wordCount || 0) - (a.wordCount || 0));
    stats.longestWork = sortedByLength[0] || null;

    // ==================
    // MOST RE-READ
    // ==================

    const sortedByVisits = [...works].sort((a, b) =>
      (b.visitCount || 1) - (a.visitCount || 1));
    stats.mostReRead = sortedByVisits[0] || null;

    // ==================
    // MOST KUDOS'D WORK YOU READ
    // ==================

    const sortedByKudos = [...works].sort((a, b) =>
      (b.kudos || 0) - (a.kudos || 0));
    stats.mostKudosedWork = sortedByKudos[0] || null;

    // ==================
    // HIDDEN GEM
    // Finding works with low kudos but high visit count from user
    // ==================

    const potentialGems = works.filter(w =>
      (w.kudos || 0) < 100 && (w.visitCount || 1) >= 2
    ).sort((a, b) => (b.visitCount || 1) - (a.visitCount || 1));

    stats.hiddenGem = potentialGems[0] || null;

    // ==================
    // RAREST PAIR
    // Ships with lowest work count that user read
    // Since we don't have global AO3 stats, use ships with fewest occurrences in user's history
    // ==================

    const rareShips = Array.from(shipCounts.entries())
      .filter(([ship, count]) => count === 1)
      .map(([ship]) => ship);

    // Pick a random rare ship if there are any
    stats.rarestPair = rareShips.length > 0
      ? rareShips[Math.floor(Math.random() * rareShips.length)]
      : (stats.topShips[stats.topShips.length - 1]?.[0] || null);

    // ==================
    // FLUFF VS ANGST
    // Based on presence of common tags
    // ==================

    const fluffTags = ['Fluff', 'Tooth-Rotting Fluff', 'Domestic Fluff', 'Romantic Fluff'];
    const angstTags = ['Angst', 'Heavy Angst', 'Angst with a Happy Ending', 'Angst and Hurt/Comfort'];

    let fluffCount = 0;
    let angstCount = 0;

    works.forEach(w => {
      const tags = w.freeformTags || [];
      const hasFluff = tags.some(t => fluffTags.some(f => t.toLowerCase().includes(f.toLowerCase())));
      const hasAngst = tags.some(t => angstTags.some(a => t.toLowerCase().includes(a.toLowerCase())));
      if (hasFluff) fluffCount++;
      if (hasAngst) angstCount++;
    });

    stats.moodStats = {
      fluff: fluffCount,
      angst: angstCount,
      fluffPercent: Math.round((fluffCount / stats.totalWorks) * 100),
      angstPercent: Math.round((angstCount / stats.totalWorks) * 100),
      preference: fluffCount > angstCount ? 'Fluff' : angstCount > fluffCount ? 'Angst' : 'Balanced'
    };

    // ==================
    // WORD COUNT DISTRIBUTION
    // ==================

    const lengthBuckets = {
      'Drabbles (<1K)': works.filter(w => (w.wordCount || 0) < 1000).length,
      'Short (1K-5K)': works.filter(w => (w.wordCount || 0) >= 1000 && (w.wordCount || 0) < 5000).length,
      'Medium (5K-20K)': works.filter(w => (w.wordCount || 0) >= 5000 && (w.wordCount || 0) < 20000).length,
      'Long (20K-50K)': works.filter(w => (w.wordCount || 0) >= 20000 && (w.wordCount || 0) < 50000).length,
      'Epic (50K-100K)': works.filter(w => (w.wordCount || 0) >= 50000 && (w.wordCount || 0) < 100000).length,
      'Novel+ (100K+)': works.filter(w => (w.wordCount || 0) >= 100000).length
    };

    stats.lengthDistribution = Object.entries(lengthBuckets).map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / stats.totalWorks) * 100)
    }));

    // Find preferred length
    stats.preferredLength = Object.entries(lengthBuckets)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // ==================
    // READING TIMELINE (if dates available)
    // ==================

    // Group by month based on lastVisited dates
    const monthCounts = new Map();
    works.forEach(w => {
      if (w.lastVisited) {
        // Parse date like "15 Mar 2024"
        const date = new Date(w.lastVisited);
        if (!isNaN(date)) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
        }
      }
    });

    stats.monthlyActivity = Array.from(monthCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    // ==================
    // WARNING TAGS
    // ==================

    const allWarnings = works.flatMap(w => w.warnings || []);
    const warningCounts = countOccurrences(allWarnings);
    stats.warningBreakdown = getTopN(warningCounts, 10);

    // ==================
    // SUMMARY OBJECT FOR EASY ACCESS
    // ==================

    stats.summary = {
      works: stats.totalWorks,
      words: stats.totalWordsFormatted,
      books: stats.approximateBooks,
      fandoms: stats.uniqueFandomCount,
      topFandom: stats.topFandom[0],
      topShip: stats.topShip[0],
      topAuthor: stats.topAuthor[0],
      smutPercent: stats.smutPercentage
    };

    stats.isEmpty = false;

    return stats;
  }

  // Public API
  return {
    analyze,
    formatNumber,
    wordsToBooks
  };
})();

// Make available globally
window.StatsAnalyzer = StatsAnalyzer;
