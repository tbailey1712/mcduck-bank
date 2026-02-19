import { Container, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import { db, auth } from '../config/firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { setTransactions } from '../store/slices/transactionsSlice';
import WithdrawalForm from '../components/WithdrawalForm';
import { setError } from '../store/slices/authSlice';
import withdrawalTaskService from '../services/withdrawalTaskService';

const Dashboard = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [userBalance, setUserBalance] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!auth.currentUser) return;

      try {
        // Only fetch the current user's transactions
        const transactionsRef = collection(db, 'transactions');
        const userQuery = query(transactionsRef, where('user_id', '==', auth.currentUser.uid));
        const querySnapshot = await getDocs(userQuery);
        const transactions = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        dispatch(setTransactions(transactions));

        // Calculate user balance from their transactions
        const balance = transactions.reduce((sum, t) => {
          if (['deposit', 'interest'].includes(t.transaction_type)) {
            return sum + (t.amount || 0);
          } else if (['withdrawal', 'service_charge', 'bankfee'].includes(t.transaction_type)) {
            return sum - (t.amount || 0);
          }
          return sum;
        }, 0);
        setUserBalance(Math.max(0, balance));
      } catch (err) {
        dispatch(setError({ message: 'Failed to load transactions', error: err.message }));
      }
    };

    fetchTransactions();
  }, [dispatch]);

  const handleWithdrawal = async (withdrawalData) => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to make a withdrawal');
    }

    setLoading(true);
    setWithdrawalError('');

    try {
      // Create withdrawal request (admin will approve/reject)
      const result = await withdrawalTaskService.createWithdrawalRequest(
        {
          amount: withdrawalData.amount,
          description: withdrawalData.reason || ''
        },
        {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          displayName: auth.currentUser.displayName
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create withdrawal request');
      }

      // Update balance optimistically
      setUserBalance(prev => Math.max(0, prev - withdrawalData.amount));
    } catch (err) {
      console.error('Error creating withdrawal request:', err);
      setWithdrawalError(err.message || 'Failed to create withdrawal request');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Customer Dashboard
      </Typography>

      <WithdrawalForm
        onSubmit={handleWithdrawal}
        loading={loading}
        error={withdrawalError}
        userBalance={userBalance}
      />

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Recent Transactions
      </Typography>
      {/* Add transaction history display here */}
    </Container>
  );
};

export default Dashboard;
