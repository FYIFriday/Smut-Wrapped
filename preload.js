const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script that exposes safe APIs to the renderer process
 * This maintains security by not exposing Node.js directly
 */

// Expose protected methods that renderer can call
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Fetches a URL through the main process with proper cookies
   * @param {string} url - The URL to fetch
   * @returns {Promise<{success: boolean, html?: string, error?: string}>}
   */
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url),

  /**
   * Gets current AO3 session cookies
   * @returns {Promise<{success: boolean, cookies?: Array}>}
   */
  getCookies: () => ipcRenderer.invoke('get-cookies'),

  /**
   * Checks if the user is logged into AO3
   * @returns {Promise<{success: boolean, loggedIn: boolean}>}
   */
  checkLogin: () => ipcRenderer.invoke('check-login'),

  /**
   * Gets the logged-in AO3 username
   * @returns {Promise<{success: boolean, username?: string}>}
   */
  getUsername: () => ipcRenderer.invoke('get-username'),

  /**
   * Saves an image to disk using a save dialog
   * @param {string} dataUrl - Base64 encoded PNG data URL
   * @param {string} defaultFilename - Default filename for save dialog
   * @returns {Promise<{success: boolean, filePath?: string}>}
   */
  saveImage: (dataUrl, defaultFilename) =>
    ipcRenderer.invoke('save-image', { dataUrl, defaultFilename }),

  /**
   * Clears all session data for privacy
   * @returns {Promise<{success: boolean}>}
   */
  clearSession: () => ipcRenderer.invoke('clear-session'),

  /**
   * Gets application version information
   * @returns {Promise<{version: string, electronVersion: string, platform: string}>}
   */
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
});

// Log when preload script has finished loading
console.log('Smut Wrapped preload script loaded');
