/**
 * Admin Cloud Functions Service
 * Provides secure access to admin-only Cloud Functions
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';

class AdminCloudFunctions {

  /**
   * Calculate and distribute interest payments to all accounts
   * Requires admin authentication
   * @returns {Promise<Object>} Results of interest calculation
   */
  async calculateInterest() {
    try {
      console.log('🔐 Calling secure calculateInterest Cloud Function...');
      
      // Lazy initialization: create callable function when needed
      if (!this.calculateInterestFunction) {
        this.calculateInterestFunction = httpsCallable(functions, 'calculateMonthlyInterest');
      }
      
      const result = await this.calculateInterestFunction({});
      
      console.log('✅ Interest calculation completed:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling calculateInterest:', error);
      
      // Handle Firebase Functions errors
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to perform this action.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to calculate interest. Admin access required.');
      } else {
        throw new Error(`Interest calculation failed: ${error.message}`);
      }
    }
  }

  /**
   * Send monthly statements to all customers or a specific customer
   * Requires admin authentication
   * @param {Object} options - Options for statement generation
   * @param {number} options.year - Target year (optional, defaults to current)
   * @param {number} options.month - Target month (optional, defaults to current)
   * @param {string} options.customerEmail - Specific customer email (optional)
   * @returns {Promise<Object>} Results of statement sending
   */
  async sendMonthlyStatements({ year, month, customerEmail } = {}) {
    try {
      console.log('🔐 Calling secure sendMonthlyStatements Cloud Function...', { year, month, customerEmail });
      
      // Lazy initialization: create callable function when needed
      if (!this.sendMonthlyStatementsFunction) {
        this.sendMonthlyStatementsFunction = httpsCallable(functions, 'sendStatements');
      }
      
      const payload = {};
      if (year) payload.year = year;
      if (month) payload.month = month;
      if (customerEmail) payload.customerEmail = customerEmail;
      
      const result = await this.sendMonthlyStatementsFunction(payload);
      
      console.log('✅ Monthly statements completed:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling sendMonthlyStatements:', error);
      
      // Handle Firebase Functions errors
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to perform this action.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to send statements. Admin access required.');
      } else {
        throw new Error(`Statement sending failed: ${error.message}`);
      }
    }
  }

  /**
   * Send a custom email through the secure email service
   * Requires admin authentication
   * @param {Object} emailData - Email data
   * @param {string} emailData.to - Recipient email
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.htmlContent - HTML content
   * @param {string} emailData.textContent - Text content (optional)
   * @returns {Promise<Object>} Results of email sending
   */
  async sendEmail({ to, subject, htmlContent, textContent }) {
    try {
      console.log('🔐 Calling secure sendEmail Cloud Function...', { to, subject });
      
      // Lazy initialization: create callable function when needed
      if (!this.sendEmailFunction) {
        this.sendEmailFunction = httpsCallable(functions, 'sendEmail');
      }
      
      const payload = {
        to,
        subject,
        htmlContent,
        textContent
      };
      
      const result = await this.sendEmailFunction(payload);
      
      console.log('✅ Email sent successfully:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling sendEmail:', error);
      
      // Handle Firebase Functions errors
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to perform this action.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to send emails. Admin access required.');
      } else {
        throw new Error(`Email sending failed: ${error.message}`);
      }
    }
  }

  /**
   * Send a Telegram notification
   * Requires admin authentication
   * @param {string} message - Message content to send
   * @param {string} type - Notification type (e.g., 'test', 'admin_test', 'withdrawal_request')
   * @returns {Promise<Object>} Results of Telegram notification
   */
  async sendTelegram(message, type) {
    try {
      console.log('🔐 Calling secure sendTelegram Cloud Function...', { type });

      // Lazy initialization: create callable function when needed
      if (!this.sendTelegramFunction) {
        this.sendTelegramFunction = httpsCallable(functions, 'sendTelegramNotification');
      }

      const result = await this.sendTelegramFunction({ message, type });

      console.log('✅ Telegram notification sent:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling sendTelegram:', error);

      // Handle Firebase Functions errors
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to perform this action.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to send Telegram notifications. Admin access required.');
      } else {
        throw new Error(`Telegram notification failed: ${error.message}`);
      }
    }
  }

  /**
   * One-time setup to grant admin privileges to current user
   * @returns {Promise<Object>} Results of admin setup
   */
  async setupAdmin() {
    try {
      console.log('🔐 Calling setupAdmin Cloud Function...');

      // Lazy initialization: create callable function when needed
      if (!this.setupAdminFunction) {
        this.setupAdminFunction = httpsCallable(functions, 'setupAdmin');
      }

      const result = await this.setupAdminFunction({});

      console.log('✅ Admin setup completed:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling setupAdmin:', error);
      throw new Error(`Admin setup failed: ${error.message}`);
    }
  }

  /**
   * Create a new user account via Cloud Function
   * Server-side: checks allowNewUsers config, sets safe defaults
   * @returns {Promise<Object>} Created account data
   */
  async createAccount() {
    try {
      console.log('🔐 Calling createAccount Cloud Function...');
      if (!this.createAccountFunction) {
        this.createAccountFunction = httpsCallable(functions, 'createAccount');
      }
      const result = await this.createAccountFunction({});
      console.log('✅ Account creation completed:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling createAccount:', error);
      throw new Error(`Account creation failed: ${error.message}`);
    }
  }

  /**
   * Update session info via Cloud Function (server writes lastLogin, lastIp, etc.)
   * @param {string} sessionToken - Client session token
   * @returns {Promise<Object>} Success status
   */
  async updateSessionInfo(sessionToken) {
    try {
      if (!this.updateSessionInfoFunction) {
        this.updateSessionInfoFunction = httpsCallable(functions, 'updateSessionInfo');
      }
      const result = await this.updateSessionInfoFunction({ sessionToken });
      return result.data;
    } catch (error) {
      console.warn('⚠️ Session info update failed (non-critical):', error.message);
      // Non-critical: don't throw, just log
      return { success: false };
    }
  }

  /**
   * Merge account when UID changes via Cloud Function
   * Server-side: updates account fields and migrates transactions
   * @returns {Promise<Object>} Merge results
   */
  async mergeAccount() {
    try {
      console.log('🔐 Calling mergeAccount Cloud Function...');
      if (!this.mergeAccountFunction) {
        this.mergeAccountFunction = httpsCallable(functions, 'mergeAccount');
      }
      const result = await this.mergeAccountFunction({});
      console.log('✅ Account merge completed:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error calling mergeAccount:', error);
      throw new Error(`Account merge failed: ${error.message}`);
    }
  }

  /**
   * Check if the current user has admin privileges
   * This checks the client-side auth state - server-side validation happens in Cloud Functions
   * @param {Object} user - Firebase Auth user object
   * @returns {boolean} Whether user has admin privileges
   */
  isAdmin(user) {
    return user?.customClaims?.administrator === true;
  }

  /**
   * Get user-friendly error message from Firebase Functions error
   * @param {Error} error - Firebase Functions error
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    if (error.code === 'unauthenticated') {
      return 'Please log in to perform this action.';
    } else if (error.code === 'permission-denied') {
      return 'You do not have permission to perform this action. Admin access required.';
    } else if (error.code === 'failed-precondition') {
      return 'Operation failed due to invalid conditions. Please check your input.';
    } else if (error.code === 'invalid-argument') {
      return 'Invalid request data provided.';
    } else if (error.code === 'deadline-exceeded') {
      return 'Operation timed out. Please try again.';
    } else if (error.code === 'unavailable') {
      return 'Service temporarily unavailable. Please try again later.';
    } else {
      return error.message || 'An unexpected error occurred.';
    }
  }
}

// Export singleton instance
const adminCloudFunctions = new AdminCloudFunctions();
export default adminCloudFunctions;