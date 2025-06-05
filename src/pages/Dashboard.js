import { Container, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import { db, auth } from '../config/firebaseConfig';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { addTransaction, setTransactions } from '../store/slices/transactionsSlice';
import WithdrawalForm from '../components/WithdrawalForm';
import { setError } from '../store/slices/authSlice';
import auditService, { AUDIT_EVENTS } from '../services/auditService';

const Dashboard = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [userBalance, setUserBalance] = useState(null);

  const transactionsRef = collection(db, 'transactions');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const querySnapshot = await getDocs(transactionsRef);
        const transactions = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        dispatch(setTransactions(transactions));
        
        // Calculate user balance (simplified - in real app, get from account data)
        const userTransactions = transactions.filter(t => t.userId === auth.currentUser?.uid);
        const balance = userTransactions.reduce((sum, t) => {
          return t.transaction_type === 'deposit' ? sum + t.amount : sum - t.amount;
        }, 0);
        setUserBalance(Math.max(0, balance));
      } catch (err) {
        dispatch(setError({ message: 'Failed to load transactions', error: err.message }));
      }
    };
    
    if (auth.currentUser) {
      fetchTransactions();
    }
  }, [dispatch, transactionsRef]);

  const handleWithdrawal = async (withdrawalData) => {
    // Validate authentication
    if (!auth.currentUser) {
      throw new Error('You must be logged in to make a withdrawal');
    }

    setLoading(true);
    setWithdrawalError('');

    try {
      const transaction = {
        amount: withdrawalData.amount,
        reason: withdrawalData.reason,
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid,
        transaction_type: 'withdrawal',
        timestamp: new Date()
      };

      const docRef = await addDoc(transactionsRef, transaction);
      dispatch(addTransaction({ id: docRef.id, ...transaction }));

      // Log withdrawal request for audit
      try {
        const transactionDoc = {
          id: docRef.id,
          ...transaction
        };

        await auditService.logTransactionEvent(
          AUDIT_EVENTS.TRANSACTION_CREATED,
          {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName
          },
          {
            ...transactionDoc,
            request_type: 'withdrawal_request',
            initiated_by: 'customer'
          }
        );
      } catch (auditError) {
        console.warn('Failed to log withdrawal request audit event:', auditError);
      }
      
      // Update user balance optimistically
      setUserBalance(prev => Math.max(0, prev - withdrawalData.amount));
    } catch (err) {
      console.error('Error creating withdrawal:', err);
      setWithdrawalError(err.message || 'Failed to create withdrawal request');
      throw err; // Re-throw to be handled by form
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
