/**
 * ⚠️ NOT YET INTEGRATED - This service is scaffolding for future SMS notifications.
 * It is not imported or used anywhere in the app yet.
 * See DEPOSIT_REQUEST_IMPLEMENTATION_PLAN.md for integration plans.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';

/**
 * Service for sending SMS notifications via Twilio Cloud Function
 */
class SMSService {
  constructor() {
    // Lazy initialization - create callable function when needed
  }

  /**
   * Send an SMS notification
   * @param {string} to - Phone number to send to (e.g., '+15551234567')
   * @param {string} message - Message content
   * @param {string} type - Message type (e.g., 'test', 'withdrawal_request')
   * @returns {Promise<Object>} Result object with success status
   */
  async sendSMS(to, message, type = 'test') {
    try {
      console.log(`📱 Sending SMS - Type: ${type}, To: ${to?.substring(0, 6)}***`);

      // Lazy initialization: create callable function when needed
      if (!this.sendSMSNotificationFunction) {
        this.sendSMSNotificationFunction = httpsCallable(functions, 'sendSMSNotification');
      }

      const result = await this.sendSMSNotificationFunction({
        to: to,
        message: message,
        type: type
      });

      if (result.data.success) {
        console.log('✅ SMS sent successfully:', result.data);
        return {
          success: true,
          message: 'SMS sent successfully',
          twilioSid: result.data.twilioSid,
          status: result.data.status
        };
      } else {
        throw new Error(result.data.message || 'Unknown SMS error');
      }

    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      
      // Handle Firebase Functions errors (same pattern as admin functions)
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to send SMS notifications.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to send SMS notifications. Admin access required.');
      } else {
        throw new Error(`SMS send failed: ${error.message}`);
      }
    }
  }

  /**
   * Send a test SMS message
   * @param {string} phoneNumber - Phone number to test with
   */
  async sendTestSMS(phoneNumber) {
    const message = `🏦 McDuck Bank Test SMS - ${new Date().toLocaleString()}

This is a test message from your banking notification system. SMS notifications are working correctly!`;

    return this.sendSMS(phoneNumber, message, 'test');
  }

  /**
   * Send withdrawal request notification to admin
   * @param {string} adminPhone - Admin phone number
   * @param {Object} withdrawalData - Withdrawal request details
   */
  async sendWithdrawalRequestNotification(adminPhone, withdrawalData) {
    const { user_name, user_email, amount, description } = withdrawalData;
    
    const message = `🏦 McDuck Bank - New Withdrawal Request

Customer: ${user_name}
Email: ${user_email}
Amount: $${amount.toFixed(2)}
Description: ${description || 'No description'}

Please review in the admin panel.`;

    return this.sendSMS(adminPhone, message, 'withdrawal_request');
  }

  /**
   * Format phone number to E.164 format
   * @param {string} phone - Phone number in various formats
   * @returns {string} E.164 formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Add +1 if no country code
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Add + if missing
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return phone; // Return as-is if already formatted or unknown format
  }
}

// Export singleton instance
const smsService = new SMSService();
export default smsService;