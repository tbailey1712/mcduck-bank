import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { UserProfileCard, PaginatedTransactionTable } from '../components';
import AccountSummaryCards from '../components/AccountSummaryCards';
import { getUserData, subscribeToUserData, subscribeToTransactions } from '../services/userService';
import { processTransactionSummary } from '../services/apiService';
import { useParams } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import auditService, { AUDIT_EVENTS } from '../services/auditService';

const SimplifiedAccountOverview = () => {
  const { user } = useUnifiedAuth();
  const { user_id: targetUserId } = useParams();
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user?.administrator || user?.isAdmin;

  // Memoized transaction handlers for admin users
  const handleTransactionEdit = useCallback(async (transactionData) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionData.id);
      
      // Get original transaction data for comparison
      const originalDoc = await getDoc(transactionRef);
      if (!originalDoc.exists()) {
        throw new Error('Transaction not found');
      }
      
      const originalData = originalDoc.data();
      const updateData = {
        amount: transactionData.amount,
        transaction_type: transactionData.transaction_type,
        description: transactionData.description || '',
        comment: transactionData.description || ''
      };
      
      if (transactionData.timestamp) {
        updateData.timestamp = transactionData.timestamp;
      }
      
      // Compare changes and build change log
      const changes = [];
      const fieldsToCheck = ['amount', 'transaction_type', 'description', 'timestamp'];
      
      fieldsToCheck.forEach(field => {
        const oldValue = originalData[field];
        const newValue = updateData[field] || transactionData[field];
        
        if (field === 'amount') {
          const oldAmount = parseFloat(oldValue) || 0;
          const newAmount = parseFloat(newValue) || 0;
          if (oldAmount !== newAmount) {
            changes.push({
              field: 'amount',
              old_value: oldAmount,
              new_value: newAmount,
              formatted_old: `$${oldAmount.toFixed(2)}`,
              formatted_new: `$${newAmount.toFixed(2)}`
            });
          }
        } else if (field === 'timestamp') {
          const oldTimestamp = originalData.timestamp?.toDate?.() || originalData.timestamp;
          const newTimestamp = transactionData.timestamp?.toDate?.() || transactionData.timestamp;
          if (oldTimestamp?.getTime() !== newTimestamp?.getTime()) {
            changes.push({
              field: 'timestamp',
              old_value: oldTimestamp,
              new_value: newTimestamp,
              formatted_old: oldTimestamp ? new Date(oldTimestamp).toISOString() : 'N/A',
              formatted_new: newTimestamp ? new Date(newTimestamp).toISOString() : 'N/A'
            });
          }
        } else {
          if (String(oldValue || '') !== String(newValue || '')) {
            changes.push({
              field: field,
              old_value: oldValue || '',
              new_value: newValue || '',
              formatted_old: String(oldValue || ''),
              formatted_new: String(newValue || '')
            });
          }
        }
      });
      
      await updateDoc(transactionRef, updateData);

      // Log transaction edit for audit
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_EDITED,
          user,
          {
            transaction_id: transactionData.id,
            account_edited: originalData.user_id || originalData.userId || targetUserId,
            account_email: userData?.email || 'unknown',
            account_name: userData?.displayName || userData?.name || 'unknown',
            changes_made: changes,
            total_changes: changes.length,
            edited_from: 'simplified_account_overview',
            original_values: {
              amount: originalData.amount,
              transaction_type: originalData.transaction_type,
              description: originalData.description || originalData.comment,
              timestamp: originalData.timestamp
            },
            new_values: {
              amount: transactionData.amount,
              transaction_type: transactionData.transaction_type,
              description: transactionData.description,
              timestamp: transactionData.timestamp
            }
          }
        );
      } catch (auditError) {
        console.warn('Failed to log transaction edit audit event:', auditError);
      }

      // Refresh data by re-fetching
      if (targetUserId) {
        const refreshedData = await getUserData(targetUserId, user);
        setUserData(refreshedData);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }, [user, userData, targetUserId]);

  const handleTransactionDelete = useCallback(async (transactionId) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      
      // Get transaction data before deletion for audit log
      const transactionDoc = await getDoc(transactionRef);
      const transactionData = transactionDoc.exists() ? transactionDoc.data() : null;
      
      await deleteDoc(transactionRef);

      // Log transaction deletion for audit
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_DELETED,
          user,
          {
            transaction_id: transactionId,
            account_affected: transactionData?.user_id || transactionData?.userId || targetUserId,
            account_email: userData?.email || 'unknown', 
            account_name: userData?.displayName || userData?.name || 'unknown',
            deleted_from: 'simplified_account_overview',
            deleted_at: new Date(),
            deleted_transaction: transactionData ? {
              amount: transactionData.amount,
              transaction_type: transactionData.transaction_type,
              description: transactionData.description || transactionData.comment,
              timestamp: transactionData.timestamp,
              original_user_id: transactionData.user_id || transactionData.userId
            } : null
          }
        );
      } catch (auditError) {
        console.warn('Failed to log transaction deletion audit event:', auditError);
      }

      // Refresh data by re-fetching
      if (targetUserId) {
        const refreshedData = await getUserData(targetUserId, user);
        setUserData(refreshedData);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }, [user, userData, targetUserId]);

  // Memoized transaction handlers for performance
  const transactionHandlers = useMemo(() => {
    if (!isAdmin) return {};
    return {
      onTransactionEdit: handleTransactionEdit,
      onTransactionDelete: handleTransactionDelete
    };
  }, [isAdmin, handleTransactionEdit, handleTransactionDelete]);

  useEffect(() => {
    if (!user) {
      setError('Not authenticated');
      return;
    }

    if (!targetUserId) {
      setError('Invalid user ID');
      return;
    }

    // Use targetUserId from URL params
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const data = await getUserData(targetUserId, user);
        setUserData(data);
      } catch (err) {
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, targetUserId]);

  useEffect(() => {
    if (!user) {
      setError('Not authenticated');
      return;
    }

    // Use targetUserId from URL params  
    if (!targetUserId) {
      setError('Invalid user ID');
      return;
    }

    // Subscribe to user data
    const unsubscribeUserData = subscribeToUserData(targetUserId, (updatedData) => {
      if (updatedData) {
        setUserData(updatedData);
      }
    }, user);

    // Subscribe to transactions
    const unsubscribeTransactions = subscribeToTransactions(targetUserId, (updatedTransactions) => {
      if (updatedTransactions) {
        setTransactions(updatedTransactions);
        setTransactionSummary(processTransactionSummary(updatedTransactions));
      }
    }, user);

    return () => {
      unsubscribeUserData?.();
      unsubscribeTransactions?.();
    };
  }, [user, targetUserId]);

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  // Debug logging
  console.log('🔍 SimplifiedAccountOverview Debug:', {
    currentUser: user?.uid,
    targetUserId,
    isAdmin: user?.administrator,
    userData,
    transactionsLength: transactions.length,
    transactionSummary
  });

  // Check if user has permission to view this account
  if (user && user.uid !== targetUserId && !user.administrator) {
    return <Typography>You do not have permission to view this account</Typography>;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* User Profile Card - Full width on top */}
        <UserProfileCard 
          userData={userData}
          transactionSummary={transactionSummary}
          isLoading={loading}
        />

        {/* Account Summary Cards - Full width below user info */}
        <AccountSummaryCards 
          accountData={{
            balance: transactionSummary?.balance || 0,
            deposits: transactionSummary?.deposits || 0,
            withdrawals: transactionSummary?.withdrawals || 0,
            interests: transactionSummary?.interests || 0,
            pendingWithdrawal: transactionSummary?.pendingAmount || 0
          }}
        />

        {/* Transaction History - Full width */}
        <PaginatedTransactionTable
          userId={targetUserId}
          authUser={user}
          title="Transaction History"
          defaultPageSize={15}
          showFilters={true}
          showExport={false}
          isAdmin={isAdmin}
          {...transactionHandlers}
        />
      </Box>
    </Container>
  );
};

export default SimplifiedAccountOverview;
