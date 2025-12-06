const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// AO3 base URL
const AO3_BASE_URL = 'https://archiveofourown.org';

// Session partition - must match the webview partition in index.html
const AO3_PARTITION = 'persist:ao3';

/**
 * Gets the AO3 session (used by the webview)
 */
function getAO3Session() {
  return session.fromPartition(AO3_PARTITION);
}

/**
 * Creates the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    },
    title: 'Smut Wrapped',
    backgroundColor: '#1a1a2e'
  });

  // Load the main HTML file
  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Clear all session data on app close for privacy
  mainWindow.on('close', async () => {
    try {
      const ao3Session = getAO3Session();
      await ao3Session.clearStorageData();
      await ao3Session.clearCache();
    } catch (error) {
      console.error('Error clearing session data:', error);
    }
  });
}

// App ready event
app.whenReady().then(() => {
  createWindow();

  // Set custom User-Agent for the AO3 session
  const ao3Session = getAO3Session();
  ao3Session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('archiveofourown.org')) {
      details.requestHeaders['User-Agent'] =
        'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for communication with renderer process

/**
 * Fetches a URL with proper headers and rate limiting handled by the renderer
 * Returns HTML content as string
 */
ipcMain.handle('fetch-url', async (event, url) => {
  try {
    const ao3Session = getAO3Session();
    const cookies = await ao3Session.cookies.get({ url: AO3_BASE_URL });

    // Build cookie string
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
        'Cookie': cookieString,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return { success: true, html, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Gets the current session cookies for AO3
 */
ipcMain.handle('get-cookies', async () => {
  try {
    const ao3Session = getAO3Session();
    const cookies = await ao3Session.cookies.get({ url: AO3_BASE_URL });
    return { success: true, cookies };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Checks if user is logged into AO3 by looking for user session cookie
 */
ipcMain.handle('check-login', async () => {
  try {
    const ao3Session = getAO3Session();
    const cookies = await ao3Session.cookies.get({ url: AO3_BASE_URL });

    // Log cookies for debugging
    console.log('AO3 Cookies:', cookies.map(c => c.name));

    // Look for the user session cookie - AO3 uses user_credentials when logged in
    const userCookie = cookies.find(c =>
      c.name === 'user_credentials' ||
      c.name === 'remember_user_token'
    );

    if (userCookie) {
      return { success: true, loggedIn: true };
    }

    // Also check if we have a session and can access a logged-in page
    const sessionCookie = cookies.find(c => c.name === '_otwarchive_session');
    if (sessionCookie) {
      // Try to verify by checking if the main page shows logged-in state
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const response = await fetch(AO3_BASE_URL, {
        headers: {
          'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
          'Cookie': cookieString
        }
      });
      const html = await response.text();

      // Check for logged-in indicators
      if (html.includes('Log Out') || html.includes('log-out') || html.includes('Hi, ')) {
        return { success: true, loggedIn: true };
      }
    }

    return { success: true, loggedIn: false };
  } catch (error) {
    return { success: false, error: error.message, loggedIn: false };
  }
});

/**
 * Validates a username by checking if the user page exists
 * @param {string} username - Username to validate
 * @param {string} cookieString - Cookie string for auth
 * @returns {Promise<boolean>}
 */
async function validateUsername(username, cookieString) {
  try {
    const response = await fetch(`${AO3_BASE_URL}/users/${username}`, {
      headers: {
        'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
        'Cookie': cookieString
      }
    });
    // If we get a 200 and the page contains the username, it's valid
    if (response.ok) {
      const html = await response.text();
      return html.includes(`/users/${username}/`) || html.includes(`>${username}<`);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Gets the logged-in username from AO3 with validation
 */
ipcMain.handle('get-username', async () => {
  try {
    const ao3Session = getAO3Session();
    const cookies = await ao3Session.cookies.get({ url: AO3_BASE_URL });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Fetch the main page to get username from navigation
    const response = await fetch(AO3_BASE_URL, {
      headers: {
        'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
        'Cookie': cookieString
      }
    });

    const html = await response.text();
    let username = null;

    // Parse username from the "Hi, username!" greeting
    const usernameMatch = html.match(/Hi,\s*<a[^>]*>([^<]+)<\/a>/);
    if (usernameMatch) {
      username = usernameMatch[1].trim();
    }

    // Try alternate pattern - look in the user navigation
    if (!username) {
      const navMatch = html.match(/href="\/users\/([^"\/]+)"[^>]*>My Dashboard/);
      if (navMatch) {
        username = navMatch[1].trim();
      }
    }

    // Try another pattern - greeting area
    if (!username) {
      const greetMatch = html.match(/id="greeting"[^>]*>.*?<a[^>]*href="\/users\/([^"\/]+)"/s);
      if (greetMatch) {
        username = greetMatch[1].trim();
      }
    }

    if (!username) {
      return { success: false, error: 'Username not found in page' };
    }

    // Sanity check: validate that this username exists and matches a /users/{username} URL
    const isValid = await validateUsername(username, cookieString);
    if (!isValid) {
      return { success: false, error: 'Username validation failed - please try logging in again' };
    }

    return { success: true, username };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Gets profile stats (history/bookmarks page counts) for time estimation
 */
ipcMain.handle('get-profile-stats', async (event, username) => {
  try {
    const ao3Session = getAO3Session();
    const cookies = await ao3Session.cookies.get({ url: AO3_BASE_URL });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const stats = {
      historyPages: 0,
      historyWorks: 0,
      bookmarkPages: 0,
      bookmarkWorks: 0
    };

    // Fetch history page to get count
    const historyResponse = await fetch(`${AO3_BASE_URL}/users/${username}/readings`, {
      headers: {
        'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
        'Cookie': cookieString
      }
    });

    if (historyResponse.ok) {
      const historyHtml = await historyResponse.text();

      // Look for pagination to find total pages
      const historyPagesMatch = historyHtml.match(/href="[^"]*readings\?page=(\d+)"[^>]*>(\d+)<\/a>\s*<\/li>\s*<li[^>]*class="next"/);
      if (historyPagesMatch) {
        stats.historyPages = parseInt(historyPagesMatch[1], 10);
      } else {
        // Check if there's any pagination at all
        const anyPageMatch = historyHtml.match(/class="pagination".*?page=(\d+)/s);
        stats.historyPages = anyPageMatch ? parseInt(anyPageMatch[1], 10) : 1;
      }

      // Estimate works (20 per page)
      stats.historyWorks = stats.historyPages * 20;
    }

    // Fetch bookmarks page to get count
    const bookmarksResponse = await fetch(`${AO3_BASE_URL}/users/${username}/bookmarks`, {
      headers: {
        'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
        'Cookie': cookieString
      }
    });

    if (bookmarksResponse.ok) {
      const bookmarksHtml = await bookmarksResponse.text();

      // Look for pagination
      const bookmarkPagesMatch = bookmarksHtml.match(/href="[^"]*bookmarks\?page=(\d+)"[^>]*>(\d+)<\/a>\s*<\/li>\s*<li[^>]*class="next"/);
      if (bookmarkPagesMatch) {
        stats.bookmarkPages = parseInt(bookmarkPagesMatch[1], 10);
      } else {
        const anyPageMatch = bookmarksHtml.match(/class="pagination".*?page=(\d+)/s);
        stats.bookmarkPages = anyPageMatch ? parseInt(anyPageMatch[1], 10) : 1;
      }

      stats.bookmarkWorks = stats.bookmarkPages * 20;
    }

    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Saves an image file to disk
 */
ipcMain.handle('save-image', async (event, { dataUrl, defaultFilename }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters: [
        { name: 'PNG Images', extensions: ['png'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Convert data URL to buffer and save
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(filePath, buffer);

    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Clears all stored session data for privacy
 */
ipcMain.handle('clear-session', async () => {
  try {
    const ao3Session = getAO3Session();
    await ao3Session.clearStorageData();
    await ao3Session.clearCache();
    await ao3Session.clearAuthCache();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Gets app version info
 */
ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform
  };
});
