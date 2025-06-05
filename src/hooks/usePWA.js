import { useState, useEffect } from 'react';

export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    console.log('🎯 PWA Hook initialized');
    
    // Check if app is already installed
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isInStandaloneMode = window.navigator && window.navigator.standalone;
    
    if (isStandalone || isInStandaloneMode) {
      console.log('📱 App is already installed/running in standalone mode');
      setIsInstalled(true);
    }

    // For iOS Safari, we need to manually detect if installation is possible
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isIOS && isSafari && !isInStandaloneMode) {
      console.log('🍎 iOS Safari detected - manual install available');
      setIsInstallable(true); // iOS doesn't fire beforeinstallprompt
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      console.log('⚡ beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('✅ App installed event fired');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isIOS && isSafari) {
      // For iOS Safari, show instructions
      console.log('📱 iOS Safari - showing install instructions');
      alert('To install McDuck Bank:\n\n1. Tap the Share button (□↗)\n2. Select "Add to Home Screen"\n3. Tap "Add"');
      return false;
    }

    if (!deferredPrompt) {
      console.log('❌ No deferred prompt available');
      return false;
    }

    try {
      console.log('🚀 Triggering install prompt');
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      
      console.log('👤 User choice:', result.outcome);
      
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error installing app:', error);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    installApp
  };
};