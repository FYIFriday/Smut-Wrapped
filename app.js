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
    isProcessing: false,
    profileStats: null,
    filters: {
      timeRange: 'year',
      pageLimit: 10,
      source: 'both'
    }
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

    // Filter options
    filterOptions: document.getElementById('filter-options'),
    timeFilter: document.getElementById('time-filter'),
    pageLimitContainer: document.getElementById('page-limit-container'),
    pageLimit: document.getElementById('page-limit'),
    sourceFilter: document.getElementById('source-filter'),
    profileStats: document.getElementById('profile-stats'),

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
    document.querySelectorAll('.screen').forEach(function(screen) {
      screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById('screen-' + screenName);
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
  function showError(title, message, onRetry) {
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.errorModal.classList.remove('hidden');

    if (onRetry) {
      elements.btnErrorRetry.classList.remove('hidden');
      elements.btnErrorRetry.onclick = function() {
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
  function setLoginStatus(message, type) {
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
    setLoginStatus('Checking login status...', '');

    try {
      const result = await window.electronAPI.checkLogin();

      if (result.success && result.loggedIn) {
        // Try to get the username
        const usernameResult = await window.electronAPI.getUsername();

        if (usernameResult.success && usernameResult.username) {
          state.username = usernameResult.username;
          setLoginStatus('Logged in as ' + state.username, 'success');
          elements.btnStartWrapped.disabled = false;

          // Show filter options and fetch profile stats
          showFilterOptions();
          fetchProfileStats();
        } else {
          setLoginStatus('Logged in (username detection failed, but you can continue)', 'success');
          elements.btnStartWrapped.disabled = false;
          showFilterOptions();
        }
      } else {
        setLoginStatus('Not logged in yet. Please log in above.', 'error');
        elements.btnStartWrapped.disabled = true;
        hideFilterOptions();
      }
    } catch (error) {
      setLoginStatus('Error checking login: ' + error.message, 'error');
      elements.btnStartWrapped.disabled = true;
    }
  }

  /**
   * Shows the filter options panel
   */
  function showFilterOptions() {
    if (elements.filterOptions) {
      elements.filterOptions.classList.remove('hidden');
    }
  }

  /**
   * Hides the filter options panel
   */
  function hideFilterOptions() {
    if (elements.filterOptions) {
      elements.filterOptions.classList.add('hidden');
    }
  }

  /**
   * Fetches and displays profile statistics
   */
  async function fetchProfileStats() {
    if (!state.username || !elements.profileStats) return;

    elements.profileStats.innerHTML = '<p>Loading profile statistics...</p>';

    try {
      const result = await window.electronAPI.getProfileStats(state.username);

      if (result.success && result.stats) {
        state.profileStats = result.stats;
        displayProfileStats();
      } else {
        elements.profileStats.innerHTML = '<p>Could not load profile statistics.</p>';
      }
    } catch (error) {
      elements.profileStats.innerHTML = '<p>Error loading statistics.</p>';
    }
  }

  /**
   * Displays profile statistics and time estimates
   */
  function displayProfileStats() {
    if (!state.profileStats || !elements.profileStats) return;

    const stats = state.profileStats;
    const timeFilter = elements.timeFilter ? elements.timeFilter.value : 'year';
    const sourceFilter = elements.sourceFilter ? elements.sourceFilter.value : 'both';
    const pageLimit = elements.pageLimit ? parseInt(elements.pageLimit.value, 10) : 10;

    // Calculate estimated pages to scrape based on filters
    let historyPages = stats.historyPages || 0;
    let bookmarkPages = stats.bookmarkPages || 0;

    if (timeFilter === 'pages') {
      historyPages = Math.min(historyPages, pageLimit);
      bookmarkPages = Math.min(bookmarkPages, pageLimit);
    }

    let totalPages = 0;
    if (sourceFilter === 'both') {
      totalPages = historyPages + bookmarkPages;
    } else if (sourceFilter === 'history') {
      totalPages = historyPages;
    } else {
      totalPages = bookmarkPages;
    }

    // Estimate time: ~5 seconds per page for listing + ~5 seconds per work for details
    const estimatedWorks = totalPages * 20;
    const listingTime = totalPages * 5; // seconds
    const detailTime = estimatedWorks * 5; // seconds (this is the main time sink)
    const totalSeconds = listingTime + detailTime;
    const totalMinutes = Math.ceil(totalSeconds / 60);

    let timeEstimate = '';
    if (totalMinutes < 2) {
      timeEstimate = 'Less than 2 minutes';
    } else if (totalMinutes < 60) {
      timeEstimate = 'About ' + totalMinutes + ' minutes';
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      timeEstimate = 'About ' + hours + ' hour' + (hours > 1 ? 's' : '') + (mins > 0 ? ' ' + mins + ' min' : '');
    }

    let html = '<p>Your profile has:</p>';

    if (sourceFilter === 'both' || sourceFilter === 'history') {
      html += '<p><span class="stat-highlight">~' + (stats.historyWorks || 0) + '</span> works in reading history (' + (stats.historyPages || 0) + ' pages)</p>';
    }
    if (sourceFilter === 'both' || sourceFilter === 'bookmarks') {
      html += '<p><span class="stat-highlight">~' + (stats.bookmarkWorks || 0) + '</span> bookmarks (' + (stats.bookmarkPages || 0) + ' pages)</p>';
    }

    html += '<p>Estimated time: <span class="stat-highlight">' + timeEstimate + '</span></p>';

    elements.profileStats.innerHTML = html;
  }

  /**
   * Updates filters from UI and recalculates estimates
   */
  function updateFilters() {
    if (elements.timeFilter) {
      state.filters.timeRange = elements.timeFilter.value;

      // Show/hide page limit input
      if (elements.pageLimitContainer) {
        if (state.filters.timeRange === 'pages') {
          elements.pageLimitContainer.classList.remove('hidden');
        } else {
          elements.pageLimitContainer.classList.add('hidden');
        }
      }
    }

    if (elements.pageLimit) {
      state.filters.pageLimit = parseInt(elements.pageLimit.value, 10) || 10;
    }

    if (elements.sourceFilter) {
      state.filters.source = elements.sourceFilter.value;
    }

    // Recalculate time estimates
    displayProfileStats();
  }

  /**
   * Handles webview navigation events to detect successful login
   */
  function setupWebviewListeners() {
    if (!elements.webview) return;

    elements.webview.addEventListener('did-navigate', function(event) {
      const url = event.url;

      // If navigated away from login page, user might be logged in
      if (url.indexOf('/users/login') === -1) {
        setTimeout(checkLoginStatus, 1000);
      }
    });

    elements.webview.addEventListener('did-navigate-in-page', function(event) {
      const url = event.url;
      if (url.indexOf('/users/login') === -1) {
        setTimeout(checkLoginStatus, 1000);
      }
    });

    // Handle webview loading errors
    elements.webview.addEventListener('did-fail-load', function(event) {
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
    elements.progressBar.style.width = progress.percent + '%';
    elements.progressPercent.textContent = Math.round(progress.percent) + '%';
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

      // Pass filters to scraper
      const options = {
        timeRange: state.filters.timeRange,
        pageLimit: state.filters.pageLimit,
        source: state.filters.source
      };

      // Start scraping
      const result = await window.AO3Scraper.scrapeAll(state.username, updateProgress, options);

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

      setTimeout(function() {
        showScreen('results');
        updateSlideNavigation();
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
    elements.slideCounter.textContent = (state.currentSlide + 1) + ' / ' + state.totalSlides;
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

      const dataUrl = await captureSlideSimple(currentSlideEl);
      const filename = 'smut-wrapped-2024-slide-' + (state.currentSlide + 1) + '.png';

      const result = await window.electronAPI.saveImage(dataUrl, filename);

      if (result.success) {
        // Show brief success message
        const originalText = elements.btnDownloadSlide.textContent;
        elements.btnDownloadSlide.textContent = 'Saved!';
        setTimeout(function() {
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
   * Enhanced slide capture with better text rendering
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

    // Fallback: create a canvas manually with improved rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 1080;
    canvas.height = 1920;

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#2d1f3d');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get text content from slide
    const label = slideEl.querySelector('.slide-label');
    const number = slideEl.querySelector('.slide-number');
    const title = slideEl.querySelector('.slide-title');
    const subtitle = slideEl.querySelector('.slide-subtitle');
    const unit = slideEl.querySelector('.slide-unit');
    const small = slideEl.querySelector('.slide-small');
    const list = slideEl.querySelector('.slide-list');
    const tagCloud = slideEl.querySelector('.tag-cloud');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let y = canvas.height / 2 - 300;

    if (label) {
      ctx.font = '600 36px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(label.textContent.toUpperCase(), canvas.width / 2, y);
      y += 100;
    }

    if (number) {
      ctx.font = 'bold 160px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#e94560';
      ctx.fillText(number.textContent, canvas.width / 2, y);
      y += 140;
    }

    if (title) {
      ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#ffffff';
      const titleText = title.textContent;
      // Word wrap for long titles
      if (titleText.length > 25) {
        ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
      }
      wrapText(ctx, titleText, canvas.width / 2, y, canvas.width - 100, 70);
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
      wrapText(ctx, subtitle.textContent, canvas.width / 2, y, canvas.width - 100, 50);
      y += 60;
    }

    if (small) {
      ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(small.textContent, canvas.width / 2, y + 40);
    }

    // Handle list slides
    if (list) {
      const items = list.querySelectorAll('.slide-list-item');
      ctx.textAlign = 'left';
      let listY = canvas.height / 2 - (items.length * 40);

      items.forEach(function(item, index) {
        const rank = item.querySelector('.slide-list-rank');
        const name = item.querySelector('.slide-list-name');
        const count = item.querySelector('.slide-list-count');

        ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#e94560';
        ctx.fillText((index + 1) + '.', 150, listY);

        ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#ffffff';
        if (name) {
          ctx.fillText(name.textContent.substring(0, 35), 220, listY);
        }

        if (count) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(count.textContent, 850, listY);
        }

        listY += 70;
      });
    }

    // Add watermark
    ctx.textAlign = 'center';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('Smut Wrapped 2024', canvas.width / 2, canvas.height - 60);

    return canvas.toDataURL('image/png');
  }

  /**
   * Helper function to wrap text on canvas
   */
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let testY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line.trim(), x, testY);
        line = words[i] + ' ';
        testY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, testY);
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
        const filename = 'smut-wrapped-2024-slide-' + (i + 1) + '.png';

        await window.electronAPI.saveImage(dataUrl, filename);

        // Restore state
        if (!wasActive) {
          slides[i].classList.remove('active');
          slides[i].style.transform = '';
          slides[i].style.opacity = '';
        }

        // Small delay between saves
        await new Promise(function(resolve) { setTimeout(resolve, 200); });
      }

      elements.btnDownloadAll.textContent = 'All Saved!';
      setTimeout(function() {
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
    state.profileStats = null;

    // Clear session data
    await window.electronAPI.clearSession();

    // Reload webview
    if (elements.webview) {
      elements.webview.src = 'https://archiveofourown.org/users/login';
    }

    elements.btnStartWrapped.disabled = true;
    setLoginStatus('', '');
    hideFilterOptions();

    showScreen('welcome');
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
    elements.btnGetStarted.addEventListener('click', function() {
      showScreen('login');
      setupWebviewListeners();
    });

    // Login screen
    elements.btnCheckLogin.addEventListener('click', checkLoginStatus);
    elements.btnStartWrapped.addEventListener('click', startScraping);

    // Filter options
    if (elements.timeFilter) {
      elements.timeFilter.addEventListener('change', updateFilters);
    }
    if (elements.pageLimit) {
      elements.pageLimit.addEventListener('change', updateFilters);
    }
    if (elements.sourceFilter) {
      elements.sourceFilter.addEventListener('change', updateFilters);
    }

    // Progress screen
    elements.btnCancelScrape.addEventListener('click', cancelScraping);

    // Results screen
    elements.btnPrevSlide.addEventListener('click', previousSlide);
    elements.btnNextSlide.addEventListener('click', nextSlide);
    elements.btnDownloadSlide.addEventListener('click', downloadCurrentSlide);
    elements.btnDownloadAll.addEventListener('click', downloadAllSlides);
    elements.btnStartOver.addEventListener('click', startOver);

    // Error modal
    elements.btnErrorClose.addEventListener('click', hideError);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeydown);

    // Touch/swipe support for slides
    var touchStartX = 0;
    var touchEndX = 0;

    elements.slidesContainer.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].screenX;
    });

    elements.slidesContainer.addEventListener('touchend', function(e) {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });

    function handleSwipe() {
      var swipeThreshold = 50;
      var diff = touchStartX - touchEndX;

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
    window.electronAPI.getAppInfo().then(function(info) {
      console.log('Smut Wrapped v' + info.version + ' running on ' + info.platform);
    });
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
