/**
 * Smut Wrapped - Main Application Logic
 *
 * Coordinates the UI flow and connects scraper, analyzer, and visualizer.
 */

(function () {
  'use strict';

  // ==================
  // State
  // ==================

  const state = {
    currentScreen: 'welcome',
    username: null,
    scrapedData: null,
    stats: null,
    currentSlide: 0,
    totalSlides: 0,
    isProcessing: false
  };

  // ==================
  // DOM Elements
  // ==================

  const elements = {
    // Screens
    screenWelcome: document.getElementById('screen-welcome'),
    screenLogin: document.getElementById('screen-login'),
    screenProgress: document.getElementById('screen-progress'),
    screenResults: document.getElementById('screen-results'),

    // Welcome screen
    btnGetStarted: document.getElementById('btn-get-started'),

    // Login screen
    webview: document.getElementById('ao3-webview'),
    btnCheckLogin: document.getElementById('btn-check-login'),
    btnStartWrapped: document.getElementById('btn-start-wrapped'),
    loginStatus: document.getElementById('login-status'),

    // Progress screen
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percent'),
    progressStatus: document.getElementById('progress-status'),
    progressDetail: document.getElementById('progress-detail'),
    btnCancelScrape: document.getElementById('btn-cancel-scrape'),

    // Results screen
    slidesContainer: document.getElementById('slides-container'),
    btnPrevSlide: document.getElementById('btn-prev-slide'),
    btnNextSlide: document.getElementById('btn-next-slide'),
    slideCounter: document.getElementById('slide-counter'),
    btnDownloadSlide: document.getElementById('btn-download-slide'),
    btnDownloadAll: document.getElementById('btn-download-all'),
    btnStartOver: document.getElementById('btn-start-over'),

    // Filter elements
    btnToggleFilters: document.getElementById('btn-toggle-filters'),
    filterContent: document.getElementById('filter-content'),
    wordCountMin: document.getElementById('word-count-min'),
    wordCountMax: document.getElementById('word-count-max'),
    wordCountMinValue: document.getElementById('word-count-min-value'),
    wordCountMaxValue: document.getElementById('word-count-max-value'),
    ratingFilters: document.querySelectorAll('.rating-filter'),
    btnApplyFilters: document.getElementById('btn-apply-filters'),
    btnResetFilters: document.getElementById('btn-reset-filters'),

    // Error modal
    errorModal: document.getElementById('error-modal'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    btnErrorRetry: document.getElementById('btn-error-retry'),
    btnErrorClose: document.getElementById('btn-error-close')
  };

  // ==================
  // Screen Navigation
  // ==================

  /**
   * Switches to a different screen
   * @param {string} screenName - Name of the screen to show
   */
  function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) {
      targetScreen.classList.add('active');
      state.currentScreen = screenName;
    }
  }

  // ==================
  // Error Handling
  // ==================

  /**
   * Shows the error modal
   * @param {string} title - Error title
   * @param {string} message - Error message
   * @param {Function} onRetry - Retry callback (optional)
   */
  function showError(title, message, onRetry = null) {
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.remove('hidden');

    if (onRetry) {
      elements.btnErrorRetry.classList.remove('hidden');
      elements.btnErrorRetry.onclick = () => {
        hideError();
        onRetry();
      };
    } else {
      elements.btnErrorRetry.classList.add('hidden');
    }
  }

  /**
   * Hides the error modal
   */
  function hideError() {
    elements.errorModal.classList.add('hidden');
  }

  // ==================
  // Login Flow
  // ==================

  /**
   * Updates login status display
   * @param {string} message - Status message
   * @param {string} type - Status type ('success', 'error', or '')
   */
  function setLoginStatus(message, type = '') {
    elements.loginStatus.textContent = message;
    elements.loginStatus.className = 'status-text';
    if (type) {
      elements.loginStatus.classList.add(type);
    }
  }

  /**
   * Checks if the user is logged into AO3
   */
  async function checkLoginStatus() {
    setLoginStatus('Checking login status...');

    try {
      const result = await window.electronAPI.checkLogin();

      if (result.success && result.loggedIn) {
        // Try to get the username
        const usernameResult = await window.electronAPI.getUsername();

        if (usernameResult.success && usernameResult.username) {
          state.username = usernameResult.username;
          setLoginStatus(`Logged in as ${state.username}`, 'success');
          elements.btnStartWrapped.disabled = false;
        } else {
          setLoginStatus('Logged in (username detection failed, but you can continue)', 'success');
          elements.btnStartWrapped.disabled = false;
        }
      } else {
        setLoginStatus('Not logged in yet. Please log in above.', 'error');
        elements.btnStartWrapped.disabled = true;
      }
    } catch (error) {
      setLoginStatus(`Error checking login: ${error.message}`, 'error');
      elements.btnStartWrapped.disabled = true;
    }
  }

  /**
   * Handles webview navigation events to detect successful login
   */
  function setupWebviewListeners() {
    if (!elements.webview) return;

    elements.webview.addEventListener('did-navigate', (event) => {
      const url = event.url;

      // If navigated away from login page, user might be logged in
      if (!url.includes('/users/login')) {
        setTimeout(checkLoginStatus, 1000);
      }
    });

    elements.webview.addEventListener('did-navigate-in-page', (event) => {
      const url = event.url;
      if (!url.includes('/users/login')) {
        setTimeout(checkLoginStatus, 1000);
      }
    });

    // Handle webview loading errors
    elements.webview.addEventListener('did-fail-load', (event) => {
      if (event.errorCode !== -3) { // Ignore aborted loads
        setLoginStatus('Failed to load AO3. Please check your internet connection.', 'error');
      }
    });
  }

  // ==================
  // Scraping Flow
  // ==================

  /**
   * Updates the progress display
   * @param {Object} progress - Progress object from scraper
   */
  function updateProgress(progress) {
    elements.progressBar.style.width = `${progress.percent}%`;
    elements.progressPercent.textContent = `${Math.round(progress.percent)}%`;
    elements.progressStatus.textContent = progress.message || '';
    elements.progressDetail.textContent = progress.detail || '';
  }

  /**
   * Starts the scraping process
   */
  async function startScraping() {
    if (state.isProcessing) return;

    state.isProcessing = true;
    showScreen('progress');

    updateProgress({
      percent: 0,
      message: 'Starting...',
      detail: ''
    });

    try {
      // If we don't have a username, try to get it
      if (!state.username) {
        const usernameResult = await window.electronAPI.getUsername();
        if (usernameResult.success) {
          state.username = usernameResult.username;
        } else {
          throw new Error('Could not determine your AO3 username. Please try logging in again.');
        }
      }

      // Start scraping
      const result = await window.AO3Scraper.scrapeAll(state.username, updateProgress);

      if (!result.success) {
        if (result.cancelled) {
          showScreen('login');
          state.isProcessing = false;
          return;
        }
        throw new Error(result.error || 'Scraping failed');
      }

      if (result.items.length === 0) {
        showError(
          'No Reading History',
          'We couldn\'t find any reading history for your account. Go read some fics and come back!',
          null
        );
        showScreen('login');
        state.isProcessing = false;
        return;
      }

      state.scrapedData = result.items;

      // Analyze the data
      updateProgress({
        percent: 95,
        message: 'Calculating your stats...',
        detail: ''
      });

      state.stats = window.StatsAnalyzer.analyze(result.items);

      // Generate visualization
      updateProgress({
        percent: 98,
        message: 'Creating your Wrapped...',
        detail: ''
      });

      const slides = window.Visualizer.generateSlides(state.stats);
      state.totalSlides = slides.length;
      state.currentSlide = 0;

      window.Visualizer.renderSlides(slides, elements.slidesContainer);

      // Show results
      updateProgress({
        percent: 100,
        message: 'Done!',
        detail: ''
      });

      setTimeout(() => {
        showScreen('results');
        updateSlideNavigation();
        updateSliderValues(); // Initialize slider display values
        state.isProcessing = false;
      }, 500);

    } catch (error) {
      console.error('Scraping error:', error);
      showError(
        'Scraping Failed',
        error.message || 'An unexpected error occurred. Please try again.',
        startScraping
      );
      showScreen('login');
      state.isProcessing = false;
    }
  }

  /**
   * Cancels the current scraping operation
   */
  function cancelScraping() {
    window.AO3Scraper.requestCancel();
    showScreen('login');
    state.isProcessing = false;
  }

  // ==================
  // Results/Slides
  // ==================

  /**
   * Updates the slide navigation UI
   */
  function updateSlideNavigation() {
    elements.btnPrevSlide.disabled = state.currentSlide === 0;
    elements.btnNextSlide.disabled = state.currentSlide === state.totalSlides - 1;
    elements.slideCounter.textContent = `${state.currentSlide + 1} / ${state.totalSlides}`;
  }

  /**
   * Navigates to the previous slide
   */
  function previousSlide() {
    if (state.currentSlide > 0) {
      state.currentSlide--;
      window.Visualizer.goToSlide(state.currentSlide, elements.slidesContainer);
      updateSlideNavigation();
    }
  }

  /**
   * Navigates to the next slide
   */
  function nextSlide() {
    if (state.currentSlide < state.totalSlides - 1) {
      state.currentSlide++;
      window.Visualizer.goToSlide(state.currentSlide, elements.slidesContainer);
      updateSlideNavigation();
    }
  }

  /**
   * Downloads the current slide as an image
   */
  async function downloadCurrentSlide() {
    try {
      const currentSlideEl = elements.slidesContainer.querySelector('.slide.active');
      if (!currentSlideEl) return;

      // We'll use a simple canvas-based approach since html2canvas may not be loaded
      // For now, create a simpler export

      const dataUrl = await captureSlideSimple(currentSlideEl);
      const filename = `smut-wrapped-2024-slide-${state.currentSlide + 1}.png`;

      const result = await window.electronAPI.saveImage(dataUrl, filename);

      if (result.success) {
        // Show brief success message
        const originalText = elements.btnDownloadSlide.textContent;
        elements.btnDownloadSlide.textContent = 'Saved!';
        setTimeout(() => {
          elements.btnDownloadSlide.textContent = originalText;
        }, 2000);
      } else if (!result.canceled) {
        showError('Download Failed', result.error || 'Could not save the image.');
      }
    } catch (error) {
      console.error('Download error:', error);
      showError('Download Failed', error.message);
    }
  }

  /**
   * Simple slide capture using canvas
   * @param {HTMLElement} slideEl - Slide element
   * @returns {Promise<string>} Data URL
   */
  async function captureSlideSimple(slideEl) {
    // If html2canvas is available, use it
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(slideEl, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
        width: slideEl.offsetWidth,
        height: slideEl.offsetHeight
      });
      return canvas.toDataURL('image/png');
    }

    // Fallback: create a canvas manually (limited functionality)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 2;

    canvas.width = 1080;
    canvas.height = 1920;

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#2d1f3d');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text content
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Get text content from slide
    const label = slideEl.querySelector('.slide-label');
    const number = slideEl.querySelector('.slide-number');
    const title = slideEl.querySelector('.slide-title');
    const subtitle = slideEl.querySelector('.slide-subtitle');
    const unit = slideEl.querySelector('.slide-unit');

    let y = canvas.height / 2 - 200;

    if (label) {
      ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(label.textContent.toUpperCase(), canvas.width / 2, y);
      y += 80;
    }

    if (number) {
      ctx.font = 'bold 180px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#e94560';
      ctx.fillText(number.textContent, canvas.width / 2, y);
      y += 150;
    }

    if (title) {
      ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#ffffff';
      const titleText = title.textContent;
      if (titleText.length > 20) {
        ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, sans-serif';
      }
      ctx.fillText(titleText, canvas.width / 2, y);
      y += 100;
    }

    if (unit) {
      ctx.font = '48px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(unit.textContent, canvas.width / 2, y);
      y += 80;
    }

    if (subtitle) {
      ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(subtitle.textContent, canvas.width / 2, y);
    }

    // Add watermark
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('Smut Wrapped 2024', canvas.width / 2, canvas.height - 60);

    return canvas.toDataURL('image/png');
  }

  /**
   * Downloads all slides as images
   */
  async function downloadAllSlides() {
    const originalText = elements.btnDownloadAll.textContent;
    elements.btnDownloadAll.textContent = 'Saving...';
    elements.btnDownloadAll.disabled = true;

    try {
      const slides = elements.slidesContainer.querySelectorAll('.slide');

      for (let i = 0; i < slides.length; i++) {
        // Temporarily activate slide for capture
        const wasActive = slides[i].classList.contains('active');
        slides[i].classList.add('active');
        slides[i].style.transform = 'translateX(0)';
        slides[i].style.opacity = '1';

        const dataUrl = await captureSlideSimple(slides[i]);
        const filename = `smut-wrapped-2024-slide-${i + 1}.png`;

        await window.electronAPI.saveImage(dataUrl, filename);

        // Restore state
        if (!wasActive) {
          slides[i].classList.remove('active');
          slides[i].style.transform = '';
          slides[i].style.opacity = '';
        }

        // Small delay between saves
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      elements.btnDownloadAll.textContent = 'All Saved!';
      setTimeout(() => {
        elements.btnDownloadAll.textContent = originalText;
        elements.btnDownloadAll.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Download all error:', error);
      elements.btnDownloadAll.textContent = originalText;
      elements.btnDownloadAll.disabled = false;
      showError('Download Failed', error.message);
    }
  }

  /**
   * Resets the app to start over
   */
  async function startOver() {
    state.username = null;
    state.scrapedData = null;
    state.stats = null;
    state.currentSlide = 0;
    state.totalSlides = 0;
    state.isProcessing = false;

    // Clear session data
    await window.electronAPI.clearSession();

    // Reload webview
    if (elements.webview) {
      elements.webview.src = 'https://archiveofourown.org/users/login';
    }

    elements.btnStartWrapped.disabled = true;
    setLoginStatus('');

    showScreen('welcome');
  }

  // ==================
  // Filtering
  // ==================

  /**
   * Toggles the filter panel visibility
   */
  function toggleFilters() {
    elements.filterContent.classList.toggle('active');
  }

  /**
   * Updates the displayed slider values
   */
  function updateSliderValues() {
    const minVal = parseInt(elements.wordCountMin.value);
    const maxVal = parseInt(elements.wordCountMax.value);

    // Format display values
    elements.wordCountMinValue.textContent = minVal >= 1000
      ? `${Math.round(minVal / 1000)}K`
      : minVal;
    elements.wordCountMaxValue.textContent = maxVal >= 200000
      ? '200K+'
      : maxVal >= 1000
      ? `${Math.round(maxVal / 1000)}K`
      : maxVal;

    // Ensure min doesn't exceed max
    if (minVal > maxVal) {
      elements.wordCountMin.value = maxVal;
    }
  }

  /**
   * Gets the current filter settings
   * @returns {Object} Filter settings
   */
  function getFilterSettings() {
    const selectedRatings = Array.from(elements.ratingFilters)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    return {
      wordCountMin: parseInt(elements.wordCountMin.value),
      wordCountMax: parseInt(elements.wordCountMax.value),
      ratings: selectedRatings
    };
  }

  /**
   * Applies filters to the scraped data
   * @param {Object[]} works - Array of work objects
   * @param {Object} filters - Filter settings
   * @returns {Object[]} Filtered works
   */
  function applyFilters(works, filters) {
    return works.filter(work => {
      // Filter by word count
      const wordCount = work.wordCount || 0;
      if (wordCount < filters.wordCountMin || wordCount > filters.wordCountMax) {
        return false;
      }

      // Filter by rating
      const rating = work.rating || 'Unknown';
      if (!filters.ratings.includes(rating)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Resets filters to default values
   */
  function resetFilters() {
    elements.wordCountMin.value = 0;
    elements.wordCountMax.value = 200000;
    updateSliderValues();

    elements.ratingFilters.forEach(cb => {
      cb.checked = true;
    });

    applyFiltersAndRegenerate();
  }

  /**
   * Applies filters and regenerates the visualization
   */
  function applyFiltersAndRegenerate() {
    if (!state.scrapedData) return;

    const filters = getFilterSettings();
    const filteredWorks = applyFilters(state.scrapedData, filters);

    if (filteredWorks.length === 0) {
      showError(
        'No Results',
        'No works match your current filters. Try adjusting your filter settings.',
        null
      );
      return;
    }

    // Recalculate stats with filtered data
    state.stats = window.StatsAnalyzer.analyze(filteredWorks);

    // Regenerate slides
    const slides = window.Visualizer.generateSlides(state.stats);
    state.totalSlides = slides.length;
    state.currentSlide = 0;

    window.Visualizer.renderSlides(slides, elements.slidesContainer);
    updateSlideNavigation();

    // Close filter panel after applying
    elements.filterContent.classList.remove('active');
  }

  // ==================
  // Keyboard Navigation
  // ==================

  /**
   * Handles keyboard navigation
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (state.currentScreen !== 'results') return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        previousSlide();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        event.preventDefault();
        nextSlide();
        break;
      case 'Home':
        event.preventDefault();
        state.currentSlide = 0;
        window.Visualizer.goToSlide(0, elements.slidesContainer);
        updateSlideNavigation();
        break;
      case 'End':
        event.preventDefault();
        state.currentSlide = state.totalSlides - 1;
        window.Visualizer.goToSlide(state.totalSlides - 1, elements.slidesContainer);
        updateSlideNavigation();
        break;
    }
  }

  // ==================
  // Event Listeners
  // ==================

  function setupEventListeners() {
    // Welcome screen
    elements.btnGetStarted.addEventListener('click', () => {
      showScreen('login');
      setupWebviewListeners();
    });

    // Login screen
    elements.btnCheckLogin.addEventListener('click', checkLoginStatus);
    elements.btnStartWrapped.addEventListener('click', startScraping);

    // Progress screen
    elements.btnCancelScrape.addEventListener('click', cancelScraping);

    // Results screen
    elements.btnPrevSlide.addEventListener('click', previousSlide);
    elements.btnNextSlide.addEventListener('click', nextSlide);
    elements.btnDownloadSlide.addEventListener('click', downloadCurrentSlide);
    elements.btnDownloadAll.addEventListener('click', downloadAllSlides);
    elements.btnStartOver.addEventListener('click', startOver);

    // Filter controls
    elements.btnToggleFilters.addEventListener('click', toggleFilters);
    elements.wordCountMin.addEventListener('input', updateSliderValues);
    elements.wordCountMax.addEventListener('input', updateSliderValues);
    elements.btnApplyFilters.addEventListener('click', applyFiltersAndRegenerate);
    elements.btnResetFilters.addEventListener('click', resetFilters);

    // Error modal
    elements.btnErrorClose.addEventListener('click', hideError);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeydown);

    // Touch/swipe support for slides
    let touchStartX = 0;
    let touchEndX = 0;

    elements.slidesContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    elements.slidesContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });

    function handleSwipe() {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          nextSlide();
        } else {
          previousSlide();
        }
      }
    }
  }

  // ==================
  // Initialization
  // ==================

  function init() {
    setupEventListeners();

    // Show welcome screen
    showScreen('welcome');

    // Log app info
    window.electronAPI.getAppInfo().then(info => {
      console.log(`Smut Wrapped v${info.version} running on ${info.platform}`);
    });
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
