/**
 * Smut Wrapped - Visualizer Module
 *
 * Generates the Wrapped slide presentation from calculated statistics.
 */

const Visualizer = (function () {
  /**
   * Truncates text to a maximum length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string}
   */
  function truncate(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Escapes HTML special characters
   * @param {string} text - Text to escape
   * @returns {string}
   */
  function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Creates the HTML for a basic number slide
   * @param {Object} config - Slide configuration
   * @returns {string} HTML string
   */
  function createNumberSlide(config) {
    const { label, number, unit, subtitle, small } = config;
    return `
      <div class="slide-content">
        ${label ? `<p class="slide-label">${escapeHTML(label)}</p>` : ''}
        <p class="slide-number">${escapeHTML(String(number))}</p>
        ${unit ? `<p class="slide-unit">${escapeHTML(unit)}</p>` : ''}
        ${subtitle ? `<p class="slide-subtitle">${escapeHTML(subtitle)}</p>` : ''}
        ${small ? `<p class="slide-small">${escapeHTML(small)}</p>` : ''}
      </div>
    `;
  }

  /**
   * Creates the HTML for a title/name slide
   * @param {Object} config - Slide configuration
   * @returns {string} HTML string
   */
  function createTitleSlide(config) {
    const { label, title, subtitle, small } = config;
    return `
      <div class="slide-content">
        ${label ? `<p class="slide-label">${escapeHTML(label)}</p>` : ''}
        <h2 class="slide-title">${escapeHTML(title)}</h2>
        ${subtitle ? `<p class="slide-subtitle">${escapeHTML(subtitle)}</p>` : ''}
        ${small ? `<p class="slide-small">${escapeHTML(small)}</p>` : ''}
      </div>
    `;
  }

  /**
   * Creates the HTML for a list slide
   * @param {Object} config - Slide configuration
   * @returns {string} HTML string
   */
  function createListSlide(config) {
    const { title, items } = config;
    const listHTML = items.map((item, index) => `
      <div class="slide-list-item">
        <span class="slide-list-rank">${index + 1}.</span>
        <span class="slide-list-name">${escapeHTML(truncate(item.name, 40))}</span>
        <span class="slide-list-count">(${item.count})</span>
      </div>
    `).join('');

    return `
      <div class="slide-content">
        <p class="slide-label">${escapeHTML(title)}</p>
        <div class="slide-list">
          ${listHTML}
        </div>
      </div>
    `;
  }

  /**
   * Creates the HTML for a tag cloud slide
   * @param {Object} config - Slide configuration
   * @returns {string} HTML string
   */
  function createTagCloudSlide(config) {
    const { title, tags } = config;

    // Calculate size classes based on frequency
    const maxCount = tags.length > 0 ? tags[0].count : 1;
    const tagsHTML = tags.map(tag => {
      const ratio = tag.count / maxCount;
      let sizeClass = 'size-sm';
      if (ratio > 0.7) sizeClass = 'size-xl';
      else if (ratio > 0.4) sizeClass = 'size-lg';
      else if (ratio > 0.2) sizeClass = 'size-md';

      return `<span class="tag-cloud-item ${sizeClass}">${escapeHTML(truncate(tag.name, 30))}</span>`;
    }).join('');

    return `
      <div class="slide-content">
        <p class="slide-label">${escapeHTML(title)}</p>
        <div class="tag-cloud">
          ${tagsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Creates the HTML for a rating breakdown slide
   * @param {Object} config - Slide configuration
   * @returns {string} HTML string
   */
  function createRatingSlide(config) {
    const { ratings } = config;

    const barsHTML = ratings.map(r => `
      <div class="rating-bar-container">
        <span class="rating-label">${escapeHTML(r.shortName)}</span>
        <div class="rating-bar">
          <div class="rating-bar-fill ${r.shortName.toLowerCase()}" style="width: ${r.percent}%"></div>
        </div>
        <span class="rating-percent">${r.percent}%</span>
      </div>
    `).join('');

    return `
      <div class="slide-content">
        <p class="slide-label">Your Rating Distribution</p>
        <div class="rating-chart">
          ${barsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Creates the HTML for the final summary slide
   * @param {Object} stats - Statistics object
   * @returns {string} HTML string
   */
  function createSummarySlide(stats) {
    return `
      <div class="slide-content">
        <p class="slide-label">That's a wrap!</p>
        <div class="summary-stats">
          <p class="slide-subtitle">You read <strong>${stats.totalWorks}</strong> works</p>
          <p class="slide-subtitle">Across <strong>${stats.uniqueFandomCount}</strong> fandoms</p>
          <p class="slide-subtitle">Totaling <strong>${stats.totalWordsFormatted}</strong> words</p>
          <p class="slide-subtitle">That's about <strong>${stats.approximateBooks}</strong> novels!</p>
        </div>
        <p class="slide-small">Here's to another year of fic</p>
      </div>
    `;
  }

  /**
   * Creates the HTML for the thank you slide
   * @returns {string} HTML string
   */
  function createThankYouSlide() {
    return `
      <div class="slide-content">
        <p class="slide-label">Thank you for using</p>
        <h2 class="slide-title">Smut Wrapped!</h2>
        <p class="slide-subtitle">Made with love by the fandom, for the fandom</p>
        <p class="slide-small">Privacy-first, open source, free forever</p>
      </div>
    `;
  }

  /**
   * Creates a work info slide (for longest, most re-read, etc.)
   * @param {Object} config - Slide configuration
   * @returns {string} HTML string
   */
  function createWorkSlide(config) {
    const { label, work, stat, statLabel } = config;

    if (!work) {
      return `
        <div class="slide-content">
          <p class="slide-label">${escapeHTML(label)}</p>
          <p class="slide-subtitle">No data available</p>
        </div>
      `;
    }

    const authors = work.authors?.join(', ') || 'Anonymous';

    return `
      <div class="slide-content">
        <p class="slide-label">${escapeHTML(label)}</p>
        <h2 class="slide-title">"${escapeHTML(truncate(work.title, 60))}"</h2>
        <p class="slide-subtitle">by ${escapeHTML(truncate(authors, 40))}</p>
        ${stat ? `<p class="slide-number" style="font-size: 4rem; margin-top: 1rem;">${escapeHTML(String(stat))}</p>` : ''}
        ${statLabel ? `<p class="slide-unit">${escapeHTML(statLabel)}</p>` : ''}
      </div>
    `;
  }

  /**
   * Generates all slides from statistics
   * @param {Object} stats - Statistics object from analyzer
   * @returns {string[]} Array of HTML strings for each slide
   */
  function generateSlides(stats) {
    if (stats.isEmpty) {
      return [
        `<div class="slide active">
          <div class="slide-content">
            <p class="slide-label">Oops!</p>
            <h2 class="slide-title">No Reading History Found</h2>
            <p class="slide-subtitle">Go read some fic and come back!</p>
          </div>
        </div>`
      ];
    }

    const slides = [];

    // Slide 1: Total Works
    slides.push(createNumberSlide({
      label: 'This year you read',
      number: stats.totalWorks,
      unit: 'works'
    }));

    // Slide 2: Total Words
    slides.push(createNumberSlide({
      label: "That's",
      number: stats.totalWordsFormatted,
      unit: 'words',
      small: `About ${stats.approximateBooks} full-length novels!`
    }));

    // Slide 3: Top Fandom
    if (stats.topFandom && stats.topFandom[0]) {
      slides.push(createTitleSlide({
        label: 'Your top fandom was',
        title: stats.topFandom[0],
        subtitle: `${stats.topFandom[1]} works`
      }));
    }

    // Slide 4: All Top Fandoms
    if (stats.topFandoms.length > 0) {
      slides.push(createListSlide({
        title: 'Your Top Fandoms',
        items: stats.topFandoms.slice(0, 5).map(([name, count]) => ({ name, count }))
      }));
    }

    // Slide 5: Favorite Pairing
    if (stats.topShip && stats.topShip[0]) {
      slides.push(createTitleSlide({
        label: 'Your most-read ship',
        title: stats.topShip[0],
        subtitle: `${stats.topShip[1]} fics featuring this pairing`
      }));
    }

    // Slide 6: Rarest Pairs (if available)
    if (stats.rarestPairs && stats.rarestPairs.length > 1) {
      // Show multiple rare pairs as a list
      slides.push(createListSlide({
        title: 'Your Rarest Pairs',
        items: stats.rarestPairs.map(ship => ({ name: ship, count: 1 }))
      }));
    } else if (stats.rarestPair) {
      // Show single rare pair
      slides.push(createTitleSlide({
        label: 'Your rarest pair',
        title: stats.rarestPair,
        subtitle: 'A ship only you appreciate',
        small: 'You have excellent taste in rare pairs'
      }));
    }

    // Slide 7: Top Tags (Tag Cloud)
    if (stats.topTags.length > 0) {
      slides.push(createTagCloudSlide({
        title: 'Your Favorite Tropes',
        tags: stats.topTags.slice(0, 20).map(([name, count]) => ({ name, count }))
      }));
    }

    // Slide 8: Rating Breakdown
    if (stats.ratingBreakdown) {
      slides.push(createRatingSlide({
        ratings: stats.ratingBreakdown
      }));
    }

    // Slide 9: Longest Work
    if (stats.longestWork) {
      slides.push(createWorkSlide({
        label: 'Your longest read',
        work: stats.longestWork,
        stat: stats.longestWork.wordCount?.toLocaleString(),
        statLabel: 'words'
      }));
    }

    // Slide 10: Most Re-Read
    if (stats.mostReRead && stats.mostReRead.visitCount > 1) {
      slides.push(createWorkSlide({
        label: "You couldn't get enough of",
        work: stats.mostReRead,
        stat: stats.mostReRead.visitCount,
        statLabel: 'visits this year'
      }));
    }

    // Slide 11: Hidden Gem
    if (stats.hiddenGem) {
      slides.push(createWorkSlide({
        label: 'Your hidden gem',
        work: stats.hiddenGem,
        stat: `${stats.hiddenGem.kudos || 0} kudos, ${stats.hiddenGem.visitCount} visits`,
        statLabel: 'A treasure only you know'
      }));
    }

    // Slide 12: Top Author
    if (stats.topAuthor && stats.topAuthor[0]) {
      slides.push(createTitleSlide({
        label: 'Your most-read author',
        title: stats.topAuthor[0],
        subtitle: `${stats.topAuthor[1]} of their works`
      }));
    }

    // Slide 13: Smut Stats (if applicable)
    if (stats.smutPercentage > 0) {
      slides.push(createNumberSlide({
        label: 'Your smut percentage',
        number: `${stats.smutPercentage}%`,
        unit: 'Explicit-rated works',
        small: stats.smutPercentage > 50 ? 'You know what you like!' :
               stats.smutPercentage > 25 ? 'A healthy balance!' : 'Keeping it classy!'
      }));
    }

    // Slide 14: Mood Stats
    if (stats.moodStats && (stats.moodStats.fluff > 0 || stats.moodStats.angst > 0)) {
      slides.push(createTitleSlide({
        label: 'Fluff vs Angst',
        title: stats.moodStats.preference,
        subtitle: `${stats.moodStats.fluffPercent}% fluff, ${stats.moodStats.angstPercent}% angst`,
        small: stats.moodStats.preference === 'Fluff' ? 'You love the warm fuzzies!' :
               stats.moodStats.preference === 'Angst' ? 'You love to feel things!' : 'Perfectly balanced!'
      }));
    }

    // Slide 15: Summary
    slides.push(createSummarySlide(stats));

    // Slide 16: Thank You
    slides.push(createThankYouSlide());

    return slides;
  }

  /**
   * Renders slides to the DOM
   * @param {string[]} slidesHTML - Array of slide HTML strings
   * @param {HTMLElement} container - Container element
   */
  function renderSlides(slidesHTML, container) {
    container.innerHTML = slidesHTML.map((html, index) => `
      <div class="slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
        ${html}
      </div>
    `).join('');
  }

  /**
   * Navigates to a specific slide
   * @param {number} index - Slide index
   * @param {HTMLElement} container - Container element
   */
  function goToSlide(index, container) {
    const slides = container.querySelectorAll('.slide');
    const total = slides.length;

    // Clamp index
    index = Math.max(0, Math.min(index, total - 1));

    slides.forEach((slide, i) => {
      slide.classList.remove('active', 'prev');
      if (i === index) {
        slide.classList.add('active');
      } else if (i < index) {
        slide.classList.add('prev');
      }
    });

    return index;
  }

  /**
   * Captures a slide as an image using html2canvas
   * @param {HTMLElement} slideElement - Slide element to capture
   * @param {number} slideIndex - Slide index for filename
   * @returns {Promise<string>} Data URL of the image
   */
  async function captureSlide(slideElement, slideIndex) {
    // Dynamically load html2canvas if not already loaded
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas library not loaded');
    }

    const canvas = await html2canvas(slideElement, {
      backgroundColor: null,
      scale: 2, // Higher resolution
      logging: false,
      useCORS: true,
      width: slideElement.offsetWidth,
      height: slideElement.offsetHeight
    });

    return canvas.toDataURL('image/png');
  }

  // Public API
  return {
    generateSlides,
    renderSlides,
    goToSlide,
    captureSlide
  };
})();

// Make available globally
window.Visualizer = Visualizer;
