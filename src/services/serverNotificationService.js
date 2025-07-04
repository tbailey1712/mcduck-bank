import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Server-side notification service for handling push notifications
 * triggered by account activities like deposits and withdrawals
 */
class ServerNotificationService {
  constructor() {
    this.apiEndpoint = process.env.REACT_APP_NOTIFICATION_ENDPOINT || '/api/notifications';
    // Check for pending notifications on initialization
    this.checkPendingNotifications();
  }

  /**
   * Check for pending cross-device notifications (simulation only)
   */
  async checkPendingNotifications() {
    try {
      const storedNotifications = JSON.parse(localStorage.getItem('mcduck_pending_notifications') || '[]');
      if (storedNotifications.length === 0) return;

      console.log('🔍 Checking for pending notifications:', storedNotifications.length);

      for (const notification of storedNotifications) {
        // Only show notifications from the last 30 seconds to avoid old notifications
        const notificationTime = new Date(notification.timestamp);
        const now = new Date();
        const timeDiff = (now - notificationTime) / 1000; // seconds

        if (timeDiff < 30) {
          console.log('📬 Displaying pending notification:', notification.title);
          
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(notification.title, {
              body: notification.body,
              icon: '/logo-192x192.png',
              badge: '/logo-192x192.png',
              tag: `mcduck-pending-${notification.id}`,
              data: notification.data,
              requireInteraction: false
            });
          }
        }
      }

      // Clear processed notifications
      localStorage.removeItem('mcduck_pending_notifications');
    } catch (error) {
      console.warn('⚠️ Error checking pending notifications:', error);
    }
  }

  /**
   * Register a device token for a user account
   * @param {string} userId - User ID
   * @param {string} fcmToken - FCM device token
   * @param {Object} deviceInfo - Device information
   */
  async registerDevice(userId, fcmToken, deviceInfo = {}) {
    try {
      console.log('🔔 Registering device for user:', userId, 'token:', fcmToken.substring(0, 20) + '...');
      
      const { accountRef, accountDoc } = await this.findUserAccount(userId, true); // Create if not found

      // Check if device is already registered (prevent duplicates)
      const account = accountDoc.data();
      const existingDevices = account.notifications?.devices || [];
      const existingDevice = existingDevices.find(device => device.token === fcmToken);
      
      if (existingDevice) {
        console.log('📱 Device already registered, updating last used time');
        // Remove old entry and add updated one
        await updateDoc(accountRef, {
          'notifications.devices': arrayRemove(existingDevice),
          'notifications.lastUpdated': new Date()
        });
        
        // Add updated device
        const updatedDevice = {
          ...existingDevice,
          lastUsed: new Date(),
          active: true,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            ...deviceInfo
          }
        };
        
        await updateDoc(accountRef, {
          'notifications.devices': arrayUnion(updatedDevice),
        });
      } else {
        console.log('📱 Registering new device');
        const deviceRegistration = {
          token: fcmToken,
          registeredAt: new Date(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            ...deviceInfo
          },
          lastUsed: new Date(),
          active: true
        };

        // Add device to the notifications.devices array
        await updateDoc(accountRef, {
          'notifications.devices': arrayUnion(deviceRegistration),
          'notifications.enabled': true,
          'notifications.lastUpdated': new Date()
        });
      }

      console.log('✅ Device registered for notifications:', fcmToken.substring(0, 20) + '...');
      
      // Verify the registration worked
      const verifyDoc = await getDoc(accountRef);
      const verifyData = verifyDoc.data();
      console.log('🔍 Verification - devices registered:', verifyData.notifications?.devices?.length || 0);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error registering device:', error);
      throw error;
    }
  }

  /**
   * Unregister a device token
   * @param {string} userId - User ID
   * @param {string} fcmToken - FCM device token to remove
   */
  async unregisterDevice(userId, fcmToken) {
    try {
      const accountRef = doc(db, 'accounts', userId);
      const accountDoc = await getDoc(accountRef);
      
      if (!accountDoc.exists()) {
        throw new Error('Account not found');
      }

      const account = accountDoc.data();
      const devices = account.notifications?.devices || [];
      
      // Find and remove the device with matching token
      const updatedDevices = devices.filter(device => device.token !== fcmToken);
      
      await updateDoc(accountRef, {
        'notifications.devices': updatedDevices,
        'notifications.lastUpdated': new Date()
      });

      console.log('✅ Device unregistered from notifications');
      return { success: true };
    } catch (error) {
      console.error('❌ Error unregistering device:', error);
      throw error;
    }
  }

  /**
   * Send notification when a deposit is made
   * @param {string} userId - User ID
   * @param {number} amount - Deposit amount
   * @param {string} description - Transaction description
   * @param {Object} transactionData - Full transaction data
   */
  async sendDepositNotification(userId, amount, description, transactionData) {
    const notification = {
      type: 'deposit',
      title: '💰 Deposit Received',
      body: `$${amount.toFixed(2)} has been deposited to your account${description ? ': ' + description : ''}`,
      data: {
        type: 'transaction',
        transactionId: transactionData.id,
        amount: amount,
        url: '/account'
      }
    };

    return this.sendNotificationToUser(userId, notification);
  }

  /**
   * Send notification when a withdrawal is made
   * @param {string} userId - User ID
   * @param {number} amount - Withdrawal amount
   * @param {string} description - Transaction description
   * @param {Object} transactionData - Full transaction data
   */
  async sendWithdrawalNotification(userId, amount, description, transactionData) {
    const notification = {
      type: 'withdrawal',
      title: '💳 Withdrawal Processed',
      body: `$${amount.toFixed(2)} has been withdrawn from your account${description ? ': ' + description : ''}`,
      data: {
        type: 'transaction',
        transactionId: transactionData.id,
        amount: amount,
        url: '/account'
      }
    };

    return this.sendNotificationToUser(userId, notification);
  }

  /**
   * Send low balance alert
   * @param {string} userId - User ID
   * @param {number} currentBalance - Current account balance
   * @param {number} threshold - Low balance threshold
   */
  async sendLowBalanceAlert(userId, currentBalance, threshold = 100) {
    if (currentBalance > threshold) return;

    const notification = {
      type: 'low_balance',
      title: '⚠️ Low Balance Alert',
      body: `Your account balance is $${currentBalance.toFixed(2)}. Consider making a deposit.`,
      data: {
        type: 'balance_alert',
        balance: currentBalance,
        url: '/account'
      }
    };

    return this.sendNotificationToUser(userId, notification);
  }

  /**
   * Find account document for user
   * @param {string} userId - User ID
   * @param {boolean} createIfNotFound - Create account document if not found
   * @returns {Object} - Account reference and document
   */
  async findUserAccount(userId, createIfNotFound = false) {
    // Try direct document lookup first
    let accountRef = doc(db, 'accounts', userId);
    let accountDoc = await getDoc(accountRef);
    
    if (!accountDoc.exists()) {
      // Try to find account by user_id field
      const accountsRef = collection(db, 'accounts');
      const q = query(accountsRef, where('user_id', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        if (createIfNotFound) {
          // Create a basic account document
          await setDoc(accountRef, {
            user_id: userId,
            created_at: new Date(),
            notifications: {
              enabled: false,
              devices: []
            }
          });
          accountDoc = await getDoc(accountRef);
          console.log('✅ Created account document for user:', userId);
        } else {
          console.error('🚨 Account not found for user:', userId);
          throw new Error(`Account not found for user: ${userId}`);
        }
      } else {
        // Use the first matching account
        const firstDoc = querySnapshot.docs[0];
        accountRef = doc(db, 'accounts', firstDoc.id);
        accountDoc = firstDoc;
      }
    }
    
    return { accountRef, accountDoc };
  }

  /**
   * Send a notification to all registered devices for a user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification payload
   */
  async sendNotificationToUser(userId, notification) {
    try {
      // Get user's registered devices
      const { accountDoc } = await this.findUserAccount(userId);

      const account = accountDoc.data();
      const devices = account.notifications?.devices || [];
      const activeDevices = devices.filter(device => device.active);

      if (activeDevices.length === 0) {
        console.log('📱 No active devices registered for user:', userId);
        return { success: false, reason: 'No devices registered' };
      }

      console.log(`📤 Sending ${notification.type} notification to ${activeDevices.length} device(s)`);

      // For now, we'll simulate server-side sending with client-side notifications
      // In production, this would call your server endpoint
      return this.simulateServerNotification(activeDevices, notification);
      
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Simulate server-side notification sending (for development)
   * In production, this would be replaced with actual server-side FCM calls
   */
  async simulateServerNotification(devices, notification) {
    try {
      console.log('🔔 [SIMULATED SERVER] Sending notification:', {
        notification: notification.title,
        body: notification.body,
        devices: devices.length,
        type: notification.type
      });

      // Use service worker to show notification (simulates FCM behavior)
      if ('serviceWorker' in navigator) {
        try {
          console.log('🔧 Checking service worker registration...');
          const registration = await navigator.serviceWorker.ready;
          console.log('✅ Service worker ready:', registration);
          
          // Check notification permission specifically
          const permission = await navigator.permissions.query({name: 'notifications'});
          console.log('🔍 Notification permission state:', permission.state);
          
          if (permission.state !== 'granted') {
            console.warn('⚠️ Notification permission not granted, requesting...');
            const result = await Notification.requestPermission();
            console.log('📋 Permission request result:', result);
          }
          
          // Show notification through service worker (like FCM would)
          console.log('📤 Attempting to show notification via service worker...');
          await registration.showNotification(notification.title, {
            body: notification.body,
            icon: '/logo-192x192.png',
            badge: '/logo-192x192.png',
            tag: `mcduck-${notification.type}`,
            data: notification.data,
            requireInteraction: false,
            actions: [
              {
                action: 'view',
                title: 'View Details'
              }
            ]
          });
          
          console.log('✅ Notification displayed via service worker');
          
          // Debug: Check if notifications are actually showing
          setTimeout(async () => {
            const notifications = await registration.getNotifications();
            console.log('🔍 Active notifications:', notifications.length);
            notifications.forEach((notif, index) => {
              console.log(`📱 Notification ${index + 1}:`, notif.title, notif.body);
            });
          }, 100);
          
        } catch (swError) {
          console.error('❌ Service worker notification error:', swError);
          throw swError;
        }
      } else {
        // Fallback to browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const browserNotification = new Notification(notification.title, {
            body: notification.body,
            icon: '/logo-192x192.png',
            badge: '/logo-192x192.png',
            tag: `mcduck-${notification.type}`,
            data: notification.data,
            requireInteraction: false
          });

          browserNotification.onclick = () => {
            browserNotification.close();
            if (notification.data?.url) {
              window.focus();
              window.location.href = notification.data.url;
            }
          };

          setTimeout(() => {
            browserNotification.close();
          }, 8000);
        }
      }

      // Update device last used timestamps
      const updates = devices.map(device => ({
        ...device,
        lastUsed: new Date()
      }));

      // Store notification in localStorage for cross-device simulation
      try {
        const storedNotifications = JSON.parse(localStorage.getItem('mcduck_pending_notifications') || '[]');
        const newNotification = {
          id: Date.now(),
          ...notification,
          timestamp: new Date().toISOString(),
          targetDevices: devices.length
        };
        storedNotifications.push(newNotification);
        localStorage.setItem('mcduck_pending_notifications', JSON.stringify(storedNotifications));
        console.log('💾 Stored notification for cross-device delivery');
      } catch (storageError) {
        console.warn('⚠️ Could not store notification for cross-device delivery:', storageError);
      }

      // In a real implementation, you'd call your server API here:
      // const response = await fetch(this.apiEndpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     tokens: devices.map(d => d.token),
      //     notification: notification
      //   })
      // });

      return { 
        success: true, 
        devicesNotified: devices.length,
        simulatedOnly: true 
      };
      
    } catch (error) {
      console.error('❌ Error in simulated server notification:', error);
      throw error;
    }
  }

  /**
   * Test notification system
   * @param {string} userId - User ID to test
   */
  async sendTestNotification(userId) {
    const notification = {
      type: 'test',
      title: '🧪 McDuck Bank Test',
      body: 'This is a test notification from the server-side notification system!',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        url: '/about'
      }
    };

    return this.sendNotificationToUser(userId, notification);
  }

  /**
   * Get notification settings for a user
   * @param {string} userId - User ID
   */
  async getNotificationSettings(userId) {
    try {
      const { accountDoc } = await this.findUserAccount(userId);

      const account = accountDoc.data();
      return {
        enabled: account.notifications?.enabled || false,
        devices: account.notifications?.devices || [],
        activeDevices: (account.notifications?.devices || []).filter(d => d.active).length,
        lastUpdated: account.notifications?.lastUpdated
      };
    } catch (error) {
      console.error('❌ Error getting notification settings:', error);
      throw error;
    }
  }

  /**
   * Disable notifications for a user
   * @param {string} userId - User ID
   */
  async disableNotifications(userId) {
    try {
      const accountRef = doc(db, 'accounts', userId);
      await updateDoc(accountRef, {
        'notifications.enabled': false,
        'notifications.lastUpdated': new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error disabling notifications:', error);
      throw error;
    }
  }

  /**
   * Send withdrawal request approved notification
   * @param {string} userId - User ID
   * @param {number} amount - Withdrawal amount
   * @param {string} description - Withdrawal description
   */
  async sendWithdrawalApprovedNotification(userId, amount, description = '') {
    const notification = {
      type: 'withdrawal_approved',
      title: '✅ Withdrawal Request Approved',
      body: `Your withdrawal request for $${amount.toFixed(2)} has been approved.`,
      data: {
        type: 'withdrawal_approved',
        amount: amount,
        description: description,
        timestamp: new Date().toISOString(),
        url: '/withdrawal'
      }
    };

    return this.sendNotificationToUser(userId, notification);
  }

  /**
   * Send withdrawal request rejected notification
   * @param {string} userId - User ID
   * @param {number} amount - Withdrawal amount
   * @param {string} description - Withdrawal description
   * @param {string} reason - Rejection reason
   */
  async sendWithdrawalRejectedNotification(userId, amount, description = '', reason = '') {
    const notification = {
      type: 'withdrawal_rejected',
      title: '❌ Withdrawal Request Rejected',
      body: `Your withdrawal request for $${amount.toFixed(2)} has been rejected. ${reason ? 'Reason: ' + reason : ''}`,
      data: {
        type: 'withdrawal_rejected',
        amount: amount,
        description: description,
        reason: reason,
        timestamp: new Date().toISOString(),
        url: '/withdrawal'
      }
    };

    return this.sendNotificationToUser(userId, notification);
  }
}

// Create singleton instance
const serverNotificationService = new ServerNotificationService();

export default serverNotificationService;