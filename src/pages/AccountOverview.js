import React, { useCallback, useMemo } from 'react';
import { Container, Typography, Alert, CircularProgress, Box, Button } from '@mui/material';
import { UserProfileCard, AccountSummaryCard, PaginatedTransactionTable } from '../components';
import useAccountDataLegacy from '../hooks/useAccountData.legacy';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAdmin } from '../store/selectors';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  } = useAccountDataLegacy();
  
  const authUser = useSelector(selectUser);
  const isAdmin = useSelector(selectIsAdmin);

  // Memoized transaction handlers for admin users
  const handleTransactionEdit = useCallback(async (transactionData) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionData.id);
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
      
      await updateDoc(transactionRef, updateData);

      // Log transaction edit for audit
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_EDITED,
          authUser,
          {
            id: transactionData.id,
            transaction_type: transactionData.transaction_type,
            amount: transactionData.amount,
            description: transactionData.description,
            previous_values: 'N/A', // Could store original values if needed
            edited_from: 'account_overview'
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
  }, [refreshData]);

  const handleTransactionDelete = useCallback(async (transactionId) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      await deleteDoc(transactionRef);

      // Log transaction deletion for audit
      try {
        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_DELETED,
          authUser,
          {
            id: transactionId,
            deleted_from: 'account_overview',
            deleted_at: new Date()
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
  }, [refreshData]);

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

        {/* Account Summary Card */}
        <AccountSummaryCard 
          transactionSummary={transactionSummary}
          isLoading={loading}
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
