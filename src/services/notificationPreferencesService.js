/**
 * Notification Preferences Service
 * Handles reading, writing, and managing user notification preferences in Firestore
 */

import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getDefaultNotificationPreferences, getImplementedNotifications } from '../config/notificationConfig';

class NotificationPreferencesService {
  
  /**
   * Get notification preferences for a user
   * @param {string} userId - User ID
   * @param {Object} userInfo - User info object with email and administrator flag
   * @returns {Promise<Object>} User's notification preferences
   */
  async getPreferences(userId, userInfo = {}) {
    try {
      console.log('🔔 Getting notification preferences for user:', userId, 'userInfo:', userInfo);
      
      // Use the same account finding logic as other services
      const { accountRef, accountDoc } = await this.findUserAccount(userId);
      console.log('📄 Found account:', !!accountDoc.exists());
      
      if (!accountDoc.exists()) {
        console.warn('⚠️ Account not found, creating default preferences');
        const defaults = getDefaultNotificationPreferences(userInfo);
        console.log('📋 Generated default preferences:', defaults);
        await this.setPreferences(userId, defaults);
        return defaults;
      }
      
      const accountData = accountDoc.data();
      console.log('📄 Account data keys:', Object.keys(accountData || {}));
      const preferences = accountData.notification_preferences;
      console.log('🔔 Found preferences:', !!preferences);
      
      if (!preferences) {
        console.log('📝 No preferences found, creating defaults');
        const defaults = getDefaultNotificationPreferences(userInfo);
        console.log('📋 Generated default preferences:', defaults);
        await this.setPreferences(userId, defaults);
        return defaults;
      }
      
      // Ensure preferences include all implemented notifications
      const updated = await this.ensureCompletePreferences(userId, preferences, userInfo);
      
      console.log('✅ Retrieved notification preferences:', {
        enabled: updated.enabled,
        eventCount: Object.keys(updated.events || {}).length,
        channels: Object.keys(updated.channels || {})
      });
      
      return updated;
      
    } catch (error) {
      console.error('❌ Error getting notification preferences:', error);
      throw error;
    }
  }
  
  /**
   * Set complete notification preferences for a user
   * @param {string} userId - User ID
   * @param {Object} preferences - Complete preferences object
   * @returns {Promise<void>}
   */
  async setPreferences(userId, preferences) {
    try {
      console.log('💾 Setting notification preferences for user:', userId);

      // Always resolve via findUserAccount to handle UID vs email
      const { accountRef, accountDoc } = await this.findUserAccount(userId);

      if (!accountDoc.exists()) {
        throw new Error('Account not found. Cannot set preferences for non-existent account.');
      }

      await updateDoc(accountRef, {
        'notification_preferences': {
          ...preferences,
          last_updated: new Date()
        }
      });

      console.log('✅ Notification preferences saved');

    } catch (error) {
      console.error('❌ Error setting notification preferences:', error);
      throw error;
    }
  }
  
  /**
   * Update preferences for a specific event
   * @param {string} userId - User ID
   * @param {string} eventType - Event type (e.g., 'monthly_statements')
   * @param {string[]} channels - Array of enabled channels
   * @returns {Promise<void>}
   */
  async updateEventPreferences(userId, eventType, channels) {
    try {
      console.log(`🔄 Updating ${eventType} preferences for user:`, userId, 'channels:', channels);

      const { accountRef } = await this.findUserAccount(userId);

      await updateDoc(accountRef, {
        [`notification_preferences.events.${eventType}`]: channels,
        'notification_preferences.last_updated': new Date()
      });
      
      console.log(`✅ Updated ${eventType} preferences`);
      
    } catch (error) {
      console.error(`❌ Error updating ${eventType} preferences:`, error);
      throw error;
    }
  }
  
  /**
   * Update channel settings (enable/disable, configure)
   * @param {string} userId - User ID
   * @param {string} channel - Channel name (email, telegram)
   * @param {Object} settings - Channel settings object
   * @returns {Promise<void>}
   */
  async updateChannelSettings(userId, channel, settings) {
    try {
      console.log(`🔄 Updating ${channel} settings for user:`, userId, settings);

      const { accountRef } = await this.findUserAccount(userId);

      await updateDoc(accountRef, {
        [`notification_preferences.channels.${channel}`]: {
          ...settings,
          updated_at: new Date()
        },
        'notification_preferences.last_updated': new Date()
      });
      
      console.log(`✅ Updated ${channel} settings`);
      
    } catch (error) {
      console.error(`❌ Error updating ${channel} settings:`, error);
      throw error;
    }
  }
  
  /**
   * Enable or disable all notifications for a user
   * @param {string} userId - User ID
   * @param {boolean} enabled - Whether notifications are enabled
   * @returns {Promise<void>}
   */
  async setGlobalEnabled(userId, enabled) {
    try {
      console.log(`🔄 ${enabled ? 'Enabling' : 'Disabling'} all notifications for user:`, userId);

      const { accountRef } = await this.findUserAccount(userId);

      await updateDoc(accountRef, {
        'notification_preferences.enabled': enabled,
        'notification_preferences.last_updated': new Date()
      });
      
      console.log(`✅ ${enabled ? 'Enabled' : 'Disabled'} all notifications`);
      
    } catch (error) {
      console.error('❌ Error updating global notification setting:', error);
      throw error;
    }
  }
  
  /**
   * Ensure user preferences include all currently implemented notifications
   * @param {string} userId - User ID
   * @param {Object} currentPrefs - Current preferences
   * @param {Object} userInfo - User info with administrator flag
   * @returns {Promise<Object>} Updated preferences
   */
  async ensureCompletePreferences(userId, currentPrefs, userInfo) {
    try {
      const implementedNotifications = getImplementedNotifications(userInfo.administrator);
      const currentEvents = currentPrefs.events || {};
      let needsUpdate = false;
      const updatedEvents = { ...currentEvents };
      
      // Add any missing implemented notifications with default settings
      Object.entries(implementedNotifications).forEach(([eventKey, config]) => {
        if (!currentEvents.hasOwnProperty(eventKey)) {
          console.log(`📝 Adding missing notification: ${eventKey}`);
          updatedEvents[eventKey] = config.defaultChannels;
          needsUpdate = true;
        }
      });
      
      // Remove any notifications that are no longer implemented or valid for this user
      Object.keys(currentEvents).forEach(eventKey => {
        if (!implementedNotifications.hasOwnProperty(eventKey)) {
          console.log(`🗑️ Removing invalid notification: ${eventKey}`);
          delete updatedEvents[eventKey];
          needsUpdate = true;
        }
      });
      
      if (needsUpdate) {
        const updatedPrefs = {
          ...currentPrefs,
          events: updatedEvents,
          last_updated: new Date()
        };
        
        await this.setPreferences(userId, updatedPrefs);
        return updatedPrefs;
      }
      
      return currentPrefs;
      
    } catch (error) {
      console.error('❌ Error ensuring complete preferences:', error);
      return currentPrefs; // Return current prefs if update fails
    }
  }
  
  /**
   * Find account document for user
   * @param {string} userId - User ID (email address for this app)
   * @param {boolean} createIfNotFound - Create account document if not found
   * @returns {Object} - Account reference and document
   */
  async findUserAccount(userId, createIfNotFound = false) {
    // Try direct document lookup first (using email as document ID)
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
            notification_preferences: getDefaultNotificationPreferences({ email: userId })
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
   * Check if a user should receive a specific notification
   * @param {string} userId - User ID
   * @param {string} eventType - Event type
   * @param {string} channel - Channel to check
   * @param {Object} userInfo - User info object
   * @returns {Promise<boolean>} Whether user should receive the notification
   */
  async shouldSendNotification(userId, eventType, channel, userInfo = {}) {
    try {
      const preferences = await this.getPreferences(userId, userInfo);
      
      // Check global enable
      if (!preferences.enabled) {
        console.log(`🚫 Notifications globally disabled for user: ${userId}`);
        return false;
      }
      
      // Check channel enable
      if (!preferences.channels[channel]?.enabled) {
        console.log(`🚫 Channel ${channel} disabled for user: ${userId}`);
        return false;
      }
      
      // Check event-specific setting
      const eventChannels = preferences.events[eventType] || [];
      if (!eventChannels.includes(channel)) {
        console.log(`🚫 Event ${eventType} not enabled for ${channel} for user: ${userId}`);
        return false;
      }
      
      console.log(`✅ Should send ${eventType} via ${channel} to user: ${userId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error checking notification permission:', error);
      return false; // Fail closed - don't send if we can't check
    }
  }
}

// Create singleton instance
const notificationPreferencesService = new NotificationPreferencesService();

export default notificationPreferencesService;