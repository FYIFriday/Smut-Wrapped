const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// AO3 base URL
const AO3_BASE_URL = 'https://archiveofourown.org';

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
      const ses = session.defaultSession;
      await ses.clearStorageData();
      await ses.clearCache();
    } catch (error) {
      console.error('Error clearing session data:', error);
    }
  });
}

// App ready event
app.whenReady().then(() => {
  createWindow();

  // Set custom User-Agent for all requests to identify as a respectful bot
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
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
    const ses = session.defaultSession;
    const cookies = await ses.cookies.get({ url: AO3_BASE_URL });

    // Build cookie string
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Fetch the URL using Electron's net module via session
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
    const ses = session.defaultSession;
    const cookies = await ses.cookies.get({ url: AO3_BASE_URL });
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
    const ses = session.defaultSession;
    const cookies = await ses.cookies.get({ url: AO3_BASE_URL });

    // Look for the user session cookie
    const userCookie = cookies.find(c =>
      c.name === 'user_credentials' ||
      c.name === '_otwarchive_session'
    );

    // Also try to fetch the user page to verify login
    if (userCookie) {
      return { success: true, loggedIn: true };
    }

    return { success: true, loggedIn: false };
  } catch (error) {
    return { success: false, error: error.message, loggedIn: false };
  }
});

/**
 * Gets the logged-in username from AO3
 */
ipcMain.handle('get-username', async () => {
  try {
    const ses = session.defaultSession;
    const cookies = await ses.cookies.get({ url: AO3_BASE_URL });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Fetch the main page to get username from navigation
    const response = await fetch(AO3_BASE_URL, {
      headers: {
        'User-Agent': 'SmutWrapped/1.0 (Respectful Bot; Desktop App for Personal AO3 Stats)',
        'Cookie': cookieString
      }
    });

    const html = await response.text();

    // Parse username from the "Hi, username!" greeting
    const usernameMatch = html.match(/Hi,\s*<a[^>]*>([^<]+)<\/a>/);
    if (usernameMatch) {
      return { success: true, username: usernameMatch[1].trim() };
    }

    // Try alternate pattern - look for greeting link
    const altMatch = html.match(/class="greeting"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/s);
    if (altMatch) {
      return { success: true, username: altMatch[1].trim() };
    }

    return { success: false, error: 'Username not found in page' };
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
    const ses = session.defaultSession;
    await ses.clearStorageData();
    await ses.clearCache();
    await ses.clearAuthCache();
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
