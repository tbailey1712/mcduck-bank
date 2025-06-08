import React, { useCallback, useMemo } from 'react';
import { Container, Typography, Alert, CircularProgress, Box, Button } from '@mui/material';
import { UserProfileCard, PaginatedTransactionTable } from '../components';
import AccountSummaryCards from '../components/AccountSummaryCards';
import useAccountData from '../hooks/useAccountData';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import auditService, { AUDIT_EVENTS } from '../services/auditService';

const AccountOverview = React.memo(() => {
  const {
    userData,
    transactions,
    transactionSummary,
    loading,
    error,
    currentUserId,
    refreshData
  } = useAccountData();
  
  const { user: authUser, isAdmin, updateActivity } = useUnifiedAuth();

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
        comment: transactionData.description || '' // Update both fields for compatibility
      };
      
      // Add timestamp if provided
      if (transactionData.timestamp) {
        updateData.timestamp = transactionData.timestamp;
      }
      
      // Compare changes and build change log
      const changes = [];
      const fieldsToCheck = ['amount', 'transaction_type', 'description', 'timestamp'];
      
      fieldsToCheck.forEach(field => {
        const oldValue = originalData[field];
        const newValue = updateData[field] || transactionData[field];
        
        // Handle special cases for comparison
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
          // Handle timestamp comparison
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
          // Handle string fields
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

      // Log transaction edit for audit with detailed changes
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_EDITED,
          authUser,
          {
            transaction_id: transactionData.id,
            account_edited: originalData.user_id || originalData.userId || 'unknown',
            account_email: userData?.email || 'unknown',
            account_name: userData?.displayName || userData?.name || 'unknown',
            changes_made: changes,
            total_changes: changes.length,
            edited_from: 'account_overview',
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

      refreshData?.(); // Refresh data after edit
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }, [authUser, userData, refreshData]);

  const handleTransactionDelete = useCallback(async (transactionId) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      
      // Get transaction data before deletion for audit log
      const transactionDoc = await getDoc(transactionRef);
      const transactionData = transactionDoc.exists() ? transactionDoc.data() : null;
      
      await deleteDoc(transactionRef);

      // Log transaction deletion for audit with detailed information
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_DELETED,
          authUser,
          {
            transaction_id: transactionId,
            account_affected: transactionData?.user_id || transactionData?.userId || 'unknown',
            account_email: userData?.email || 'unknown', 
            account_name: userData?.displayName || userData?.name || 'unknown',
            deleted_from: 'account_overview',
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

      refreshData?.(); // Refresh data after delete
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }, [authUser, userData, refreshData]);

  // Memoized transaction handlers for performance
  const transactionHandlers = useMemo(() => {
    if (!isAdmin) return {};
    return {
      onTransactionEdit: handleTransactionEdit,
      onTransactionDelete: handleTransactionDelete
    };
  }, [isAdmin, handleTransactionEdit, handleTransactionDelete]);

  // Enhanced error handling with retry option
  const handleRetry = useCallback(() => {
    refreshData?.();
  }, [refreshData]);

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 } }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading account data...</Typography>
        </Box>
      </Container>
    );
  }

  // Enhanced error state with retry functionality
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 } }}>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Please try again or contact support if the issue persists.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* User Profile Card */}
        <UserProfileCard 
          userData={userData}
          transactionSummary={transactionSummary}
          isLoading={loading}
        />

        {/* Account Summary Cards */}
        <AccountSummaryCards 
          accountData={{
            balance: transactionSummary?.balance || 0,
            deposits: transactionSummary?.deposits || 0,
            withdrawals: transactionSummary?.withdrawals || 0,
            interests: transactionSummary?.interests || 0,
            pendingWithdrawal: transactionSummary?.pendingAmount || 0
          }}
        />


        {/* Transaction History */}
        <PaginatedTransactionTable
          userId={currentUserId}
          authUser={authUser}
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
});

AccountOverview.displayName = 'AccountOverview';

export default AccountOverview;
