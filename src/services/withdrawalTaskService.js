import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import auditService, { AUDIT_EVENTS } from './auditService';
import serverNotificationService from './serverNotificationService';
import withdrawalDepositService from './withdrawalDepositService';
import { addDoc as addTransactionDoc } from 'firebase/firestore';

/**
 * Service for managing withdrawal requests as tasks in Firestore
 * Tasks flow: pending -> approved/rejected -> archived
 */
class WithdrawalTaskService {
  constructor() {
    this.tasksCollection = collection(db, 'withdrawal_tasks');
    this.transactionsCollection = collection(db, 'transactions');
  }

  /**
   * Create a new withdrawal request
   */
  async createWithdrawalRequest(requestData, user) {
    try {
      const taskData = {
        user_id: user.uid,
        user_email: user.email,
        user_name: user.displayName || user.email,
        amount: requestData.amount,
        description: requestData.description || '',
        status: 'pending',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user.uid
      };

      const docRef = await addDoc(this.tasksCollection, taskData);

      // Log the withdrawal request creation for audit
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.WITHDRAWAL_REQUEST_CREATED,
        user,
        {
          task_id: docRef.id,
          amount: requestData.amount,
          description: requestData.description,
          status: 'pending',
          created_at: new Date()
        }
      );

      console.log('✅ Withdrawal request created:', docRef.id);
      return { success: true, taskId: docRef.id };
    } catch (error) {
      console.error('❌ Error creating withdrawal request:', error);
      throw new Error(`Failed to create withdrawal request: ${error.message}`);
    }
  }

  /**
   * Get withdrawal requests for a specific user
   */
  async getUserWithdrawalRequests(userId, status = 'all') {
    try {
      let q = query(
        this.tasksCollection,
        where('user_id', '==', userId),
        orderBy('created_at', 'desc')
      );

      if (status !== 'all') {
        q = query(
          this.tasksCollection,
          where('user_id', '==', userId),
          where('status', '==', status),
          orderBy('created_at', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { success: true, requests };
    } catch (error) {
      console.error('❌ Error fetching user withdrawal requests:', error);
      return { success: false, error: error.message, requests: [] };
    }
  }

  /**
   * Get all withdrawal requests for admin view
   */
  async getAllWithdrawalRequests(status = 'pending') {
    try {
      let q = query(
        this.tasksCollection,
        orderBy('created_at', 'desc')
      );

      if (status !== 'all') {
        q = query(
          this.tasksCollection,
          where('status', '==', status),
          orderBy('created_at', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const requests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return { success: true, requests };
    } catch (error) {
      console.error('❌ Error fetching all withdrawal requests:', error);
      return { success: false, error: error.message, requests: [] };
    }
  }

  /**
   * Subscribe to withdrawal requests with real-time updates
   */
  subscribeToWithdrawalRequests(userId, callback, status = 'all') {
    try {
      let q = query(
        this.tasksCollection,
        where('user_id', '==', userId),
        orderBy('created_at', 'desc')
      );

      if (status !== 'all') {
        q = query(
          this.tasksCollection,
          where('user_id', '==', userId),
          where('status', '==', status),
          orderBy('created_at', 'desc')
        );
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const requests = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(requests);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error subscribing to withdrawal requests:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Subscribe to all withdrawal requests for admin
   */
  subscribeToAllWithdrawalRequests(callback, status = 'pending') {
    try {
      let q = query(
        this.tasksCollection,
        orderBy('created_at', 'desc')
      );

      if (status !== 'all') {
        q = query(
          this.tasksCollection,
          where('status', '==', status),
          orderBy('created_at', 'desc')
        );
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const requests = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(requests);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error subscribing to all withdrawal requests:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Cancel a withdrawal request (customer action)
   */
  async cancelWithdrawalRequest(taskId, user) {
    try {
      const taskRef = doc(this.tasksCollection, taskId);
      
      await updateDoc(taskRef, {
        status: 'cancelled',
        cancelled_at: serverTimestamp(),
        cancelled_by: user.uid,
        updated_at: serverTimestamp()
      });

      // Log the cancellation for audit
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.WITHDRAWAL_REQUEST_CANCELLED,
        user,
        {
          task_id: taskId,
          cancelled_by: 'customer',
          cancelled_at: new Date()
        }
      );

      console.log('✅ Withdrawal request cancelled:', taskId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error cancelling withdrawal request:', error);
      throw new Error(`Failed to cancel withdrawal request: ${error.message}`);
    }
  }

  /**
   * Approve a withdrawal request (admin action)
   */
  async approveWithdrawalRequest(taskId, adminUser) {
    try {
      const taskRef = doc(this.tasksCollection, taskId);
      
      // First, get the task data
      const taskDoc = await getDocs(query(this.tasksCollection, where('__name__', '==', taskId)));
      if (taskDoc.empty) {
        throw new Error('Withdrawal request not found');
      }
      
      const taskData = { id: taskId, ...taskDoc.docs[0].data() };

      // Create the actual withdrawal transaction
      const transactionData = {
        user_id: taskData.user_id,
        amount: taskData.amount,
        transaction_type: 'withdrawal',
        description: taskData.description || 'Approved withdrawal request',
        comment: taskData.description || 'Approved withdrawal request',
        timestamp: serverTimestamp(),
        approved_by: adminUser.uid,
        approved_at: serverTimestamp(),
        task_id: taskId
      };

      const transactionRef = await addTransactionDoc(this.transactionsCollection, transactionData);

      // Update task status
      await updateDoc(taskRef, {
        status: 'approved',
        approved_at: serverTimestamp(),
        approved_by: adminUser.uid,
        transaction_id: transactionRef.id,
        updated_at: serverTimestamp()
      });

      // Create house deposit for the withdrawal
      try {
        await withdrawalDepositService.createHouseDeposit(
          { ...transactionData, id: transactionRef.id },
          transactionRef.id,
          { 
            uid: taskData.user_id,
            email: taskData.user_email,
            displayName: taskData.user_name
          }
        );
        console.log('✅ House deposit created for approved withdrawal:', transactionRef.id);
      } catch (houseDepositError) {
        console.warn('⚠️ Failed to create house deposit for approved withdrawal:', houseDepositError);
      }

      // Send notification to customer
      try {
        await serverNotificationService.sendWithdrawalApprovedNotification(
          taskData.user_id,
          taskData.amount,
          taskData.description
        );
      } catch (notificationError) {
        console.warn('⚠️ Failed to send approval notification:', notificationError);
      }

      // Log the approval for audit
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.WITHDRAWAL_REQUEST_APPROVED,
        adminUser,
        {
          task_id: taskId,
          transaction_id: transactionRef.id,
          amount: taskData.amount,
          customer_id: taskData.user_id,
          customer_email: taskData.user_email,
          approved_by: adminUser.uid,
          approved_at: new Date()
        }
      );

      console.log('✅ Withdrawal request approved and transaction created:', transactionRef.id);
      return { success: true, transactionId: transactionRef.id };
    } catch (error) {
      console.error('❌ Error approving withdrawal request:', error);
      throw new Error(`Failed to approve withdrawal request: ${error.message}`);
    }
  }

  /**
   * Reject a withdrawal request (admin action)
   */
  async rejectWithdrawalRequest(taskId, adminUser, rejectionReason = '') {
    try {
      const taskRef = doc(this.tasksCollection, taskId);
      
      // Get task data for notification
      const taskDoc = await getDocs(query(this.tasksCollection, where('__name__', '==', taskId)));
      if (taskDoc.empty) {
        throw new Error('Withdrawal request not found');
      }
      
      const taskData = { id: taskId, ...taskDoc.docs[0].data() };

      await updateDoc(taskRef, {
        status: 'rejected',
        rejected_at: serverTimestamp(),
        rejected_by: adminUser.uid,
        rejection_reason: rejectionReason,
        updated_at: serverTimestamp()
      });

      // Send notification to customer
      try {
        await serverNotificationService.sendWithdrawalRejectedNotification(
          taskData.user_id,
          taskData.amount,
          taskData.description,
          rejectionReason
        );
      } catch (notificationError) {
        console.warn('⚠️ Failed to send rejection notification:', notificationError);
      }

      // Log the rejection for audit
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.WITHDRAWAL_REQUEST_REJECTED,
        adminUser,
        {
          task_id: taskId,
          amount: taskData.amount,
          customer_id: taskData.user_id,
          customer_email: taskData.user_email,
          rejected_by: adminUser.uid,
          rejection_reason: rejectionReason,
          rejected_at: new Date()
        }
      );

      console.log('✅ Withdrawal request rejected:', taskId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error rejecting withdrawal request:', error);
      throw new Error(`Failed to reject withdrawal request: ${error.message}`);
    }
  }

  /**
   * Archive old completed requests (utility function)
   */
  async archiveCompletedRequests(olderThanDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const q = query(
        this.tasksCollection,
        where('status', 'in', ['approved', 'rejected', 'cancelled']),
        where('updated_at', '<', cutoffDate)
      );

      const querySnapshot = await getDocs(q);
      const archivePromises = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, { archived: true, archived_at: serverTimestamp() })
      );

      await Promise.all(archivePromises);
      
      console.log(`✅ Archived ${querySnapshot.docs.length} completed requests`);
      return { success: true, archivedCount: querySnapshot.docs.length };
    } catch (error) {
      console.error('❌ Error archiving completed requests:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const withdrawalTaskService = new WithdrawalTaskService();
export default withdrawalTaskService;