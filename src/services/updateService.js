/**
 * PWA Update Service - Handles automatic updates for iOS PWA
 */
class UpdateService {
  constructor() {
    this.currentBuildNumber = process.env.REACT_APP_BUILD_NUMBER;
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.updateCheckUrl = '/build-info.json'; // We'll create this
    this.isCheckingForUpdates = false;
  }

  /**
   * Initialize update checking
   */
  init() {
    console.log('🔄 PWA Update Service initialized - Build:', this.currentBuildNumber);
    
    // Check for updates when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });

    // Check for updates when app loads
    this.checkForUpdates();
    
    // Periodic update checks
    setInterval(() => {
      this.checkForUpdates();
    }, this.checkInterval);

    // Listen for service worker updates
    this.listenForServiceWorkerUpdates();
  }

  /**
   * Check if a new build is available
   */
  async checkForUpdates() {
    if (this.isCheckingForUpdates) return;
    
    try {
      this.isCheckingForUpdates = true;
      console.log('🔍 Checking for app updates...');

      const response = await fetch(this.updateCheckUrl + '?t=' + Date.now(), {
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        console.warn('⚠️ Could not check for updates');
        return;
      }

      const buildInfo = await response.json();
      const serverBuildNumber = buildInfo.buildNumber;
      
      console.log('📊 Current build:', this.currentBuildNumber, 'Server build:', serverBuildNumber);

      if (serverBuildNumber && serverBuildNumber !== this.currentBuildNumber) {
        console.log('🆕 New build available:', serverBuildNumber);
        this.promptForUpdate(buildInfo);
      } else {
        console.log('✅ App is up to date');
      }
    } catch (error) {
      console.warn('⚠️ Update check failed:', error);
    } finally {
      this.isCheckingForUpdates = false;
    }
  }

  /**
   * Listen for service worker updates
   */
  listenForServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service worker updated, reloading...');
        window.location.reload();
      });

      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Service worker update found');
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✅ New service worker installed, prompting for update');
              this.promptForServiceWorkerUpdate();
            }
          });
        });
      });
    }
  }

  /**
   * Prompt user for app update
   */
  promptForUpdate(buildInfo) {
    const updateBanner = this.createUpdateBanner(buildInfo);
    document.body.appendChild(updateBanner);
  }

  /**
   * Prompt for service worker update
   */
  promptForServiceWorkerUpdate() {
    const updateBanner = this.createServiceWorkerUpdateBanner();
    document.body.appendChild(updateBanner);
  }

  /**
   * Create update notification banner
   */
  createUpdateBanner(buildInfo) {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 64px;
      left: 0;
      right: 0;
      background: #1976d2;
      color: white;
      padding: 12px 16px;
      text-align: center;
      z-index: 1050;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; max-width: 600px; margin: 0 auto;">
        <span>🆕 New version available (${buildInfo.buildNumber})</span>
        <div>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                  style="background: transparent; border: 1px solid white; color: white; padding: 4px 12px; margin-right: 8px; border-radius: 4px; cursor: pointer;">
            Later
          </button>
          <button onclick="window.location.reload()" 
                  style="background: white; border: none; color: #1976d2; padding: 4px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;">
            Update Now
          </button>
        </div>
      </div>
    `;

    return banner;
  }

  /**
   * Create service worker update banner
   */
  createServiceWorkerUpdateBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #4caf50;
      color: white;
      padding: 12px 16px;
      text-align: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center;">
        <span>✅ App updated successfully! Refresh to use the latest version.</span>
        <button onclick="window.location.reload()" 
                style="background: white; border: none; color: #4caf50; padding: 4px 12px; margin-left: 12px; border-radius: 4px; font-weight: bold; cursor: pointer;">
          Refresh Now
        </button>
      </div>
    `;

    return banner;
  }

  /**
   * Force app update
   */
  async forceUpdate() {
    console.log('🔄 Forcing app update...');
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }

    // Reload the page
    window.location.reload(true);
  }

  /**
   * Check if running as PWA
   */
  isPWA() {
    return window.navigator.standalone === true || 
           window.matchMedia('(display-mode: standalone)').matches;
  }
}

// Create singleton instance
const updateService = new UpdateService();

export default updateService;