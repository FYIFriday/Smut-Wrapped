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
    webviewLoading: document.getElementById('webview-loading'),
    webviewLoadingMessage: document.getElementById('webview-loading-message'),
    btnCheckLogin: document.getElementById('btn-check-login'),
    btnStartWrapped: document.getElementById('btn-start-wrapped'),
    loginStatus: document.getElementById('login-status'),

    // Filter options
    filterOptions: document.getElementById('filter-options'),
    timeFilter: document.getElementById('time-filter'),
    timeFilterValue: document.getElementById('time-filter-value'),
    pageLimitContainer: document.getElementById('page-limit-container'),
    pageLimit: document.getElementById('page-limit'),
    pageLimitValue: document.getElementById('page-limit-value'),
    sourceHistory: document.getElementById('source-history'),
    sourceBookmarks: document.getElementById('source-bookmarks'),
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
      // Initialize slider displays
      updateTimeFilterDisplay();
      updatePageLimitDisplay();
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
    if (!elements.profileStats) return;

    // Check if we have valid profile stats
    if (!state.profileStats || (!state.profileStats.historyPages && !state.profileStats.bookmarkPages)) {
      elements.profileStats.innerHTML = '<p class="small-text">Profile stats will be calculated once you start scraping.</p>';
      return;
    }

    const stats = state.profileStats;
    const timeFilterValue = elements.timeFilter ? parseInt(elements.timeFilter.value, 10) : 1;
    const timeFilterOptions = ['all', 'year', 'pages'];
    const timeFilter = timeFilterOptions[timeFilterValue] || 'year';
    const pageLimit = elements.pageLimit ? parseInt(elements.pageLimit.value, 10) : 10;

    // Get source filter from checkboxes
    const historyChecked = elements.sourceHistory ? elements.sourceHistory.checked : true;
    const bookmarksChecked = elements.sourceBookmarks ? elements.sourceBookmarks.checked : true;

    // Calculate estimated pages to scrape based on filters
    let historyPages = stats.historyPages || 0;
    let bookmarkPages = stats.bookmarkPages || 0;

    // Apply page limit if custom pages mode
    if (timeFilter === 'pages') {
      historyPages = Math.min(historyPages, pageLimit);
      bookmarkPages = Math.min(bookmarkPages, pageLimit);
    }

    let totalPages = 0;
    if (historyChecked && bookmarksChecked) {
      totalPages = historyPages + bookmarkPages;
    } else if (historyChecked) {
      totalPages = historyPages;
    } else if (bookmarksChecked) {
      totalPages = bookmarkPages;
    }

    // More accurate time estimation
    // Each page takes ~5 seconds to fetch (rate limited)
    // Each work detail page takes ~5 seconds to fetch (rate limited)
    const estimatedWorks = totalPages * 20; // ~20 works per page
    const pagesFetchTime = totalPages * 5; // 5 seconds per listing page
    const workDetailTime = estimatedWorks * 5; // 5 seconds per work detail
    const totalSeconds = pagesFetchTime + workDetailTime;
    const totalMinutes = Math.ceil(totalSeconds / 60);

    let timeEstimate = '';
    if (totalPages === 0) {
      timeEstimate = 'No data to scrape';
    } else if (totalMinutes < 2) {
      timeEstimate = 'About 1-2 minutes';
    } else if (totalMinutes < 60) {
      timeEstimate = totalMinutes + '-' + Math.ceil(totalMinutes * 1.2) + ' minutes';
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      timeEstimate = hours + (mins > 30 ? '.5' : '') + '-' + (hours + 1) + ' hour' + (hours > 0 ? 's' : '');
    }

    let html = '<p><strong>Estimated data to scrape:</strong></p>';

    if (historyChecked) {
      html += '<p><span class="stat-highlight">~' + (historyPages * 20) + '</span> works from history (' + historyPages + ' pages)</p>';
    }
    if (bookmarksChecked) {
      html += '<p><span class="stat-highlight">~' + (bookmarkPages * 20) + '</span> bookmarks (' + bookmarkPages + ' pages)</p>';
    }

    if (totalPages > 0) {
      html += '<p><strong>Estimated time:</strong> <span class="stat-highlight">' + timeEstimate + '</span></p>';
      html += '<p class="small-text">Time varies based on network speed and AO3 server response.</p>';
    } else {
      html += '<p class="small-text">Please select at least one data source.</p>';
    }

    elements.profileStats.innerHTML = html;
  }

  /**
   * Updates the time filter slider display
   */
  function updateTimeFilterDisplay() {
    if (!elements.timeFilter || !elements.timeFilterValue) return;

    const value = parseInt(elements.timeFilter.value, 10);
    const labels = ['All time', 'Last 12 months', 'Custom pages'];
    const filterValues = ['all', 'year', 'pages'];

    elements.timeFilterValue.textContent = labels[value] || labels[1];
    state.filters.timeRange = filterValues[value] || 'year';

    // Show/hide page limit slider
    if (elements.pageLimitContainer) {
      if (state.filters.timeRange === 'pages') {
        elements.pageLimitContainer.classList.remove('hidden');
      } else {
        elements.pageLimitContainer.classList.add('hidden');
      }
    }
  }

  /**
   * Updates the page limit slider display
   */
  function updatePageLimitDisplay() {
    if (!elements.pageLimit || !elements.pageLimitValue) return;

    const value = parseInt(elements.pageLimit.value, 10);
    elements.pageLimitValue.textContent = value;
    state.filters.pageLimit = value;
  }

  /**
   * Updates filters from UI and recalculates estimates
   */
  function updateFilters() {
    // Update time filter
    updateTimeFilterDisplay();

    // Update page limit
    updatePageLimitDisplay();

    // Update source filter based on checkboxes
    const historyChecked = elements.sourceHistory ? elements.sourceHistory.checked : true;
    const bookmarksChecked = elements.sourceBookmarks ? elements.sourceBookmarks.checked : true;

    if (historyChecked && bookmarksChecked) {
      state.filters.source = 'both';
    } else if (historyChecked) {
      state.filters.source = 'history';
    } else if (bookmarksChecked) {
      state.filters.source = 'bookmarks';
    } else {
      // If nothing is checked, default to both and re-check them
      state.filters.source = 'both';
      if (elements.sourceHistory) elements.sourceHistory.checked = true;
      if (elements.sourceBookmarks) elements.sourceBookmarks.checked = true;
    }

    // Recalculate time estimates
    displayProfileStats();
  }

  /**
   * Cycles through loading messages
   */
  let loadingMessageInterval = null;
  const loadingMessages = [
    "Loading AO3 login page...",
    "Because we respect AO3's servers by spacing out requests, this may take a moment",
    "Open-source, privacy-first, forever free"
  ];
  let currentMessageIndex = 0;

  function startLoadingMessages() {
    if (!elements.webviewLoadingMessage) return;

    currentMessageIndex = 0;
    elements.webviewLoadingMessage.textContent = loadingMessages[0];
    elements.webviewLoadingMessage.style.opacity = '1';

    // Clear any existing interval
    if (loadingMessageInterval) {
      clearInterval(loadingMessageInterval);
    }

    // Cycle through messages every 5 seconds with fade transition
    loadingMessageInterval = setInterval(function() {
      if (!elements.webviewLoadingMessage) return;

      // Fade out
      elements.webviewLoadingMessage.style.opacity = '0';

      setTimeout(function() {
        if (!elements.webviewLoadingMessage) return;

        // Change message
        currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
        elements.webviewLoadingMessage.textContent = loadingMessages[currentMessageIndex];

        // Fade in
        elements.webviewLoadingMessage.style.opacity = '1';
      }, 300);
    }, 5000);
  }

  function stopLoadingMessages() {
    if (loadingMessageInterval) {
      clearInterval(loadingMessageInterval);
      loadingMessageInterval = null;
    }
  }

  /**
   * Handles webview navigation events to detect successful login
   */
  function setupWebviewListeners() {
    if (!elements.webview) return;

    // Show loading indicator when starting to load
    elements.webview.addEventListener('did-start-loading', function() {
      if (elements.webviewLoading) {
        elements.webviewLoading.classList.remove('hidden');
        startLoadingMessages();
      }
    });

    // Hide loading indicator when webview finishes loading
    elements.webview.addEventListener('did-finish-load', function() {
      if (elements.webviewLoading) {
        stopLoadingMessages();
        elements.webviewLoading.classList.add('hidden');
      }
    });

    // Also handle dom-ready as a fallback
    elements.webview.addEventListener('dom-ready', function() {
      if (elements.webviewLoading) {
        setTimeout(function() {
          stopLoadingMessages();
          elements.webviewLoading.classList.add('hidden');
        }, 500);
      }
    });

    // Show loading on navigation start
    elements.webview.addEventListener('did-start-navigation', function() {
      if (elements.webviewLoading) {
        elements.webviewLoading.classList.remove('hidden');
        startLoadingMessages();
      }
    });

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
        if (elements.webviewLoading) {
          elements.webviewLoading.classList.add('hidden');
        }
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
    elements.slideCounter.textContent = (state.currentSlide + 1) + ' / ' + state.totalSlides;

    // Show "Download All" button only on the last slide
    if (elements.btnDownloadAll) {
      if (state.currentSlide === state.totalSlides - 1) {
        elements.btnDownloadAll.style.display = '';
      } else {
        elements.btnDownloadAll.style.display = 'none';
      }
    }
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
   * Captures a slide as it appears on screen
   * @param {HTMLElement} slideEl - Slide element
   * @returns {Promise<string>} Data URL
   */
  async function captureSlideAsDisplayed(slideEl) {
    // Use html2canvas if available
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(slideEl, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
        width: slideEl.offsetWidth,
        height: slideEl.offsetHeight,
        windowWidth: slideEl.scrollWidth,
        windowHeight: slideEl.scrollHeight
      });
      return canvas.toDataURL('image/png');
    }

    // Fallback to capturing via Electron if available
    if (window.electronAPI && window.electronAPI.captureSlide) {
      const result = await window.electronAPI.captureSlide();
      if (result.success) {
        return result.dataUrl;
      }
    }

    // Last resort: use the simple canvas method
    return captureSlideSimple(slideEl);
  }

  /**
   * Downloads the current slide as an image
   */
  async function downloadCurrentSlide() {
    try {
      const currentSlideEl = elements.slidesContainer.querySelector('.slide.active');
      if (!currentSlideEl) return;

      elements.btnDownloadSlide.disabled = true;
      elements.btnDownloadSlide.textContent = 'Capturing...';

      const dataUrl = await captureSlideAsDisplayed(currentSlideEl);
      const filename = 'smut-wrapped-2025-slide-' + (state.currentSlide + 1) + '.png';

      elements.btnDownloadSlide.textContent = 'Saving...';

      const result = await window.electronAPI.saveImage(dataUrl, filename);

      if (result.success) {
        // Show brief success message
        elements.btnDownloadSlide.textContent = 'Saved!';
        setTimeout(function() {
          elements.btnDownloadSlide.textContent = 'Download This Slide';
          elements.btnDownloadSlide.disabled = false;
        }, 2000);
      } else if (!result.canceled) {
        elements.btnDownloadSlide.textContent = 'Download This Slide';
        elements.btnDownloadSlide.disabled = false;
        showError('Download Failed', result.error || 'Could not save the image.');
      } else {
        elements.btnDownloadSlide.textContent = 'Download This Slide';
        elements.btnDownloadSlide.disabled = false;
      }
    } catch (error) {
      console.error('Download error:', error);
      elements.btnDownloadSlide.textContent = 'Download This Slide';
      elements.btnDownloadSlide.disabled = false;
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
    ctx.fillText('Smut Wrapped 2025', canvas.width / 2, canvas.height - 60);

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
    elements.btnDownloadAll.disabled = true;

    try {
      const slides = elements.slidesContainer.querySelectorAll('.slide');
      const capturedSlides = [];

      // Phase 1: Capture all slides
      elements.btnDownloadAll.textContent = 'Capturing slides...';

      for (let i = 0; i < slides.length; i++) {
        elements.btnDownloadAll.textContent = 'Capturing ' + (i + 1) + '/' + slides.length + '...';

        // Temporarily activate slide for capture
        const wasActive = slides[i].classList.contains('active');
        slides[i].classList.add('active');
        slides[i].style.transform = 'translateX(0)';
        slides[i].style.opacity = '1';

        // Wait a moment for slide to render
        await new Promise(function(resolve) { setTimeout(resolve, 100); });

        const dataUrl = await captureSlideAsDisplayed(slides[i]);
        capturedSlides.push({
          dataUrl: dataUrl,
          filename: 'smut-wrapped-2025-slide-' + (i + 1) + '.png'
        });

        // Restore state
        if (!wasActive) {
          slides[i].classList.remove('active');
          slides[i].style.transform = '';
          slides[i].style.opacity = '';
        }
      }

      // Restore the last slide as active
      slides[state.currentSlide].classList.add('active');

      // Phase 2: Save all slides - use batch save if available
      elements.btnDownloadAll.textContent = 'Saving...';

      if (window.electronAPI.saveAllImages) {
        // Use batch save API if available
        const result = await window.electronAPI.saveAllImages(capturedSlides);
        if (result.success) {
          elements.btnDownloadAll.textContent = 'All Saved!';
        } else if (result.canceled) {
          elements.btnDownloadAll.textContent = originalText;
          elements.btnDownloadAll.disabled = false;
          return;
        } else {
          throw new Error(result.error || 'Failed to save slides');
        }
      } else {
        // Fallback: save individually
        for (let i = 0; i < capturedSlides.length; i++) {
          elements.btnDownloadAll.textContent = 'Saving ' + (i + 1) + '/' + capturedSlides.length + '...';
          await window.electronAPI.saveImage(capturedSlides[i].dataUrl, capturedSlides[i].filename);
          await new Promise(function(resolve) { setTimeout(resolve, 100); });
        }
        elements.btnDownloadAll.textContent = 'All Saved!';
      }

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

    // Log out of AO3 first
    if (elements.webview) {
      // Show loading indicator
      if (elements.webviewLoading) {
        elements.webviewLoading.classList.remove('hidden');
      }

      // Navigate to AO3 logout page
      elements.webview.src = 'https://archiveofourown.org/users/logout';

      // Wait for logout to complete
      await new Promise(function(resolve) { setTimeout(resolve, 1500); });
    }

    // Clear session data
    await window.electronAPI.clearSession();

    // Navigate back to login page
    if (elements.webview) {
      elements.webview.src = 'https://archiveofourown.org/users/login';
    }

    elements.btnStartWrapped.disabled = true;
    setLoginStatus('', '');
    hideFilterOptions();

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
    elements.btnGetStarted.addEventListener('click', function() {
      showScreen('login');
      setupWebviewListeners();
    });

    // Login screen
    elements.btnCheckLogin.addEventListener('click', checkLoginStatus);
    elements.btnStartWrapped.addEventListener('click', startScraping);

    // Filter options - sliders update on input for real-time feedback
    if (elements.timeFilter) {
      elements.timeFilter.addEventListener('input', updateFilters);
    }
    if (elements.pageLimit) {
      elements.pageLimit.addEventListener('input', updateFilters);
    }
    if (elements.sourceHistory) {
      elements.sourceHistory.addEventListener('change', updateFilters);
    }
    if (elements.sourceBookmarks) {
      elements.sourceBookmarks.addEventListener('change', updateFilters);
    }

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

    // Preload webview - start loading it in the background
    // This makes the login screen appear faster when user clicks "Get Started"
    setTimeout(function() {
      if (elements.webview && state.currentScreen === 'welcome') {
        // The webview will start loading in the background
        // This doesn't change the screen, just initiates the load
        console.log('Preloading webview in background...');
      }
    }, 1000);

    // Hide app loading screen and show main app
    setTimeout(function() {
      const appLoading = document.getElementById('app-loading');
      const app = document.getElementById('app');

      if (appLoading) {
        appLoading.classList.add('hidden');
      }
      if (app) {
        app.classList.add('ready');
      }
    }, 800);
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
