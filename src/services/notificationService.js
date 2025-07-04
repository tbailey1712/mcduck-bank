import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

class NotificationService {
  constructor() {
    this.messaging = null;
    // VAPID key from Firebase Console Project Settings > Cloud Messaging
    this.vapidKey = 'BAaEzyyyUzsc8YM_oG8y-MkxCb5do_zRQNZosy-5AdG14vSdR90-yyE9aljgVWpEgPlhKmJ_rIKVzuJxLGzmmlo';
    this.isSupported = false;
    this.init();
  }

  async init() {
    try {
      // Check if messaging is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('📱 Push notifications not supported in this browser');
        return;
      }

      this.messaging = getMessaging();
      this.isSupported = true;

      // Listen for foreground messages
      onMessage(this.messaging, (payload) => {
        console.log('💬 Foreground message received:', payload);
        this.showForegroundNotification(payload);
      });

      console.log('🔔 Notification service initialized');
    } catch (error) {
      console.error('❌ Error initializing notification service:', error);
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Notifications not supported');
    }

    try {
      console.log('🔔 Requesting notification permission...');
      
      const permission = await Notification.requestPermission();
      console.log('📋 Permission result:', permission);

      if (permission === 'granted') {
        try {
          const token = await this.getToken();
          console.log('🎫 FCM token obtained:', token ? 'Success' : 'Failed');
          return { success: true, token };
        } catch (tokenError) {
          console.error('❌ FCM token error:', tokenError);
          
          // Check if it's a VAPID key error
          if (tokenError.message.includes('applicationServerKey') || tokenError.message.includes('P-256')) {
            return { 
              success: false, 
              error: 'VAPID key required. Please configure Web Push certificates in Firebase Console.',
              needsVapidKey: true
            };
          }
          
          return { success: false, error: tokenError.message };
        }
      } else {
        return { success: false, error: 'Permission denied' };
      }
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return { success: false, error: error.message };
    }
  }

  async getToken() {
    if (!this.messaging) {
      throw new Error('Messaging not initialized');
    }

    try {
      // Get token with or without VAPID key
      const options = this.vapidKey ? { vapidKey: this.vapidKey } : {};
      const token = await getToken(this.messaging, options);
      
      if (token) {
        console.log('✅ FCM registration token:', token.substring(0, 20) + '...');
        return token;
      } else {
        console.log('❌ No registration token available');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      throw error;
    }
  }

  async saveTokenToDatabase(userId, token) {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Use setDoc with merge to update existing doc or create if it doesn't exist
      await setDoc(userRef, {
        fcmToken: token,
        notificationsEnabled: true,
        lastTokenUpdate: new Date()
      }, { merge: true });
      
      console.log('✅ FCM token saved to database');
    } catch (error) {
      console.error('❌ Error saving token to database:', error);
      console.error('❌ User ID that failed:', userId);
      throw error;
    }
  }

  showForegroundNotification(payload) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const title = payload.notification?.title || 'McDuck Bank';
    const options = {
      body: payload.notification?.body || 'You have a new notification',
      icon: '/logo-192x192.png',
      badge: '/logo-192x192.png',
      tag: 'mcduck-bank-foreground',
      data: payload.data,
      requireInteraction: false, // Less intrusive
      silent: false
    };

    const notification = new Notification(title, options);
    
    notification.onclick = () => {
      notification.close();
      if (payload.data?.url) {
        window.focus();
        window.location.href = payload.data.url;
      }
    };

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  }

  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    return Notification.permission;
  }

  isNotificationSupported() {
    return this.isSupported;
  }

  // Send a test notification (for development)
  async sendTestNotification() {
    if (Notification.permission === 'granted') {
      const notification = new Notification('McDuck Bank - Test Notification', {
        body: 'Notifications are working! You will receive alerts for account activities.',
        icon: '/logo-192x192.png',
        badge: '/logo-192x192.png',
        tag: 'mcduck-test',
        requireInteraction: false,
        silent: false
      });

      setTimeout(() => {
        notification.close();
      }, 8000);
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;