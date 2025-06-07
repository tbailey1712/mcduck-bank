import { db } from '../config/firebaseConfig';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import auditService, { AUDIT_EVENTS } from './auditService';

/**
 * Service to handle the house banking system where withdrawals from customer accounts
 * automatically create corresponding deposits to the admin (house) account
 */
class WithdrawalDepositService {
  constructor() {
    this.adminAccountId = null;
  }

  /**
   * Get or create the primary admin account for house deposits
   */
  async getAdminAccount() {
    if (this.adminAccountId) {
      return this.adminAccountId;
    }

    try {
      // Find existing admin account
      const adminQuery = query(
        collection(db, 'accounts'), 
        where('administrator', '==', true)
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const adminDoc = adminSnapshot.docs[0];
        const adminData = adminDoc.data();
        this.adminAccountId = adminData.user_id || adminDoc.id;
        console.log('📋 Using existing admin account for house deposits:', this.adminAccountId);
        return this.adminAccountId;
      }

      // If no admin found, this is an error state - there should always be an admin
      throw new Error('No admin account found for house deposits');
      
    } catch (error) {
      console.error('❌ Error getting admin account:', error);
      throw error;
    }
  }

  /**
   * Create a house deposit when a customer withdrawal is made
   * @param {Object} withdrawalData - The withdrawal transaction data
   * @param {string} withdrawalId - The ID of the withdrawal transaction
   * @param {Object} user - The user making the withdrawal
   */
  async createHouseDeposit(withdrawalData, withdrawalId, user) {
    try {
      const adminAccountId = await this.getAdminAccount();

      // Format customer name and withdrawal description for better house deposit tracking
      const customerName = user?.displayName || user?.email || 'Unknown Customer';
      const withdrawalDescription = withdrawalData.reason || withdrawalData.description || withdrawalData.comment || 'No description';
      
      const depositData = {
        user_id: adminAccountId,
        amount: withdrawalData.amount,
        transaction_type: 'deposit',
        description: `House deposit from customer withdrawal (${customerName}, ${withdrawalDescription})`,
        comment: `Automatic house deposit for withdrawal by ${customerName} ($${withdrawalData.amount}) - Original reason: ${withdrawalDescription}`,
        timestamp: withdrawalData.timestamp || new Date(),
        linked_withdrawal_id: withdrawalId,
        customer_id: withdrawalData.user_id || withdrawalData.userId,
        created_by: 'withdrawal_deposit_service',
        created_at: serverTimestamp()
      };

      console.log('💰 Creating house deposit for withdrawal:', {
        withdrawalId,
        amount: withdrawalData.amount,
        adminAccountId
      });

      const depositRef = await addDoc(collection(db, 'transactions'), depositData);
      
      // Log the house deposit for audit trail
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_CREATED,
          {
            uid: 'system',
            email: 'system@mcduckbank.com',
            displayName: 'McDuck Bank System'
          },
          {
            id: depositRef.id,
            ...depositData,
            request_type: 'house_deposit',
            initiated_by: 'withdrawal_service',
            linked_withdrawal: withdrawalId,
            original_customer: user?.uid || 'unknown'
          }
        );
      } catch (auditError) {
        console.warn('Failed to log house deposit audit event:', auditError);
      }

      console.log('✅ House deposit created successfully:', depositRef.id);
      return depositRef.id;

    } catch (error) {
      console.error('❌ Error creating house deposit:', error);
      throw error;
    }
  }

  /**
   * Check if a withdrawal already has a corresponding house deposit
   * @param {string} withdrawalId - The withdrawal transaction ID
   */
  async hasHouseDeposit(withdrawalId) {
    try {
      const depositQuery = query(
        collection(db, 'transactions'),
        where('linked_withdrawal_id', '==', withdrawalId),
        where('transaction_type', '==', 'deposit')
      );
      
      const depositSnapshot = await getDocs(depositQuery);
      return !depositSnapshot.empty;
      
    } catch (error) {
      console.error('❌ Error checking for existing house deposit:', error);
      return false;
    }
  }

  /**
   * Get house deposit statistics
   */
  async getHouseDepositStats() {
    try {
      const adminAccountId = await this.getAdminAccount();
      
      const houseDepositsQuery = query(
        collection(db, 'transactions'),
        where('user_id', '==', adminAccountId),
        where('transaction_type', '==', 'deposit'),
        where('created_by', '==', 'withdrawal_deposit_service')
      );
      
      const depositsSnapshot = await getDocs(houseDepositsQuery);
      
      const stats = {
        totalDeposits: depositsSnapshot.size,
        totalAmount: 0,
        depositsByCustomer: {}
      };
      
      depositsSnapshot.forEach(doc => {
        const deposit = doc.data();
        stats.totalAmount += deposit.amount;
        
        const customerId = deposit.customer_id;
        if (customerId) {
          if (!stats.depositsByCustomer[customerId]) {
            stats.depositsByCustomer[customerId] = {
              count: 0,
              amount: 0
            };
          }
          stats.depositsByCustomer[customerId].count++;
          stats.depositsByCustomer[customerId].amount += deposit.amount;
        }
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting house deposit stats:', error);
      return null;
    }
  }
}

// Export singleton instance
const withdrawalDepositService = new WithdrawalDepositService();
export default withdrawalDepositService;