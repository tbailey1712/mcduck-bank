import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { UserProfileCard, AccountSummaryCard, PaginatedTransactionTable } from '../components';
import { getUserData, subscribeToUserData, subscribeToTransactions } from '../services/userService';
import { processTransactions } from '../services/transactionService';
import { useParams } from 'react-router-dom';

const SimplifiedAccountOverview = () => {
  const { user } = useSelector((state) => state.auth);
  const { user_id: targetUserId } = useParams();
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        setTransactionSummary(processTransactions(updatedTransactions));
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

  const isAdmin = user?.administrator || user?.isAdmin;

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* User Profile Card - Full width on top */}
        <UserProfileCard 
          userData={userData}
          transactionSummary={transactionSummary}
          isLoading={loading}
        />

        {/* Account Summary Card - Full width below user info */}
        <AccountSummaryCard 
          transactionSummary={transactionSummary}
          isLoading={loading}
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
        />
      </Box>
    </Container>
  );
};

export default SimplifiedAccountOverview;
