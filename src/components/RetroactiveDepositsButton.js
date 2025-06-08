import React, { useState } from 'react';
import { Button, CircularProgress, Alert, Typography, Box } from '@mui/material';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Temporary component to create retroactive house deposits for existing withdrawals
 * This should be run once and then removed from the codebase
 */
const RetroactiveDepositsButton = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const createRetroactiveDeposits = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      console.log('🔄 Starting retroactive deposit creation for withdrawals...');
      
      // First, find all admin users
      const adminQuery = query(collection(db, 'accounts'), where('administrator', '==', true));
      const usersSnapshot = await getDocs(adminQuery);
      
      let primaryAdminId;
      
      if (usersSnapshot.empty) {
        console.error('❌ No admin accounts found. Creating default admin account...');
        // Create a default admin account for the house
        const adminAccount = {
          email: 'admin@mcduckbank.com',
          displayName: 'McDuck Bank - House Account',
          administrator: true,
          created_at: serverTimestamp(),
          balance: 0
        };
        
        const adminRef = await addDoc(collection(db, 'accounts'), adminAccount);
        console.log('✅ Created admin account:', adminRef.id);
        
        primaryAdminId = adminRef.id;
      } else {
        const adminDoc = usersSnapshot.docs[0];
        const adminData = adminDoc.data();
        primaryAdminId = adminData.user_id || adminDoc.id;
        console.log('📋 Using existing admin account:', primaryAdminId);
      }
      
      // Get all withdrawal transactions
      console.log('🔍 Finding all withdrawal transactions...');
      const withdrawalsQuery = query(collection(db, 'transactions'), where('transaction_type', '==', 'withdrawal'));
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
      
      console.log(`📊 Found ${withdrawalsSnapshot.size} withdrawal transactions`);
      
      let createdDeposits = 0;
      let skippedDeposits = 0;
      
      for (const withdrawalDoc of withdrawalsSnapshot.docs) {
        const withdrawal = withdrawalDoc.data();
        
        // Skip if this withdrawal already has a corresponding deposit
        const existingDepositQuery = query(
          collection(db, 'transactions'),
          where('linked_withdrawal_id', '==', withdrawalDoc.id),
          where('transaction_type', '==', 'deposit')
        );
        const existingDepositSnapshot = await getDocs(existingDepositQuery);
        
        if (!existingDepositSnapshot.empty) {
          console.log(`⏭️  Skipping withdrawal ${withdrawalDoc.id} - deposit already exists`);
          skippedDeposits++;
          continue;
        }
        
        // Get customer information for better deposit description
        let customerName = 'Unknown Customer';
        let withdrawalDescription = withdrawal.reason || withdrawal.description || withdrawal.comment || 'No description';
        
        try {
          const customerQuery = query(collection(db, 'accounts'), where('user_id', '==', withdrawal.user_id));
          const customerSnapshot = await getDocs(customerQuery);
          if (!customerSnapshot.empty) {
            const customerData = customerSnapshot.docs[0].data();
            customerName = customerData.displayName || customerData.name || customerData.email || 'Unknown Customer';
          }
        } catch (customerError) {
          console.warn('Could not fetch customer data for withdrawal:', withdrawalDoc.id);
        }

        // Create corresponding deposit to admin account
        const depositData = {
          user_id: primaryAdminId,
          amount: withdrawal.amount,
          transaction_type: 'deposit',
          description: `House deposit from customer withdrawal (${customerName}, ${withdrawalDescription})`,
          comment: `Automatic house deposit for withdrawal by ${customerName} ($${withdrawal.amount}) - Original reason: ${withdrawalDescription}`,
          timestamp: withdrawal.timestamp, // Use same timestamp as original withdrawal
          linked_withdrawal_id: withdrawalDoc.id, // Link back to original withdrawal
          created_by: 'retroactive_script',
          created_at: serverTimestamp()
        };
        
        await addDoc(collection(db, 'transactions'), depositData);
        createdDeposits++;
        
        console.log(`💰 Creating deposit for withdrawal ${withdrawalDoc.id}: $${withdrawal.amount}`);
      }
      
      const resultData = {
        withdrawalsFound: withdrawalsSnapshot.size,
        newDepositsCreated: createdDeposits,
        skippedDeposits,
        primaryAdminId
      };
      
      setResults(resultData);
      console.log('✅ Retroactive deposits process completed!', resultData);

    } catch (error) {
      console.error('❌ Error creating retroactive deposits:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 4, p: 3, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
      <Typography variant="h6" color="warning.main" gutterBottom>
        Retroactive House Deposits Migration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This will create house deposits for all existing withdrawals that don't already have them.
        Run this once to migrate historical data.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {results && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Migration Complete</Typography>
          <Typography variant="body2">
            • Withdrawals found: {results.withdrawalsFound}<br/>
            • New deposits created: {results.newDepositsCreated}<br/>
            • Already had deposits: {results.skippedDeposits}<br/>
            • Admin account used: {results.primaryAdminId}
          </Typography>
        </Alert>
      )}
      
      <Button
        variant="contained"
        color="warning"
        onClick={createRetroactiveDeposits}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : null}
      >
        {loading ? 'Creating Deposits...' : 'Run Retroactive Migration'}
      </Button>
    </Box>
  );
};

export default RetroactiveDepositsButton;