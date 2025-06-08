import React, { useState } from 'react';
import { Button, CircularProgress, Alert, Typography, Box } from '@mui/material';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Temporary component to fix existing house deposits that were created with wrong user_id
 * This should be run once and then removed from the codebase
 */
const FixHouseDepositsButton = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const fixHouseDeposits = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      console.log('🔧 Starting to fix house deposits with incorrect user_id...');
      
      // First, find the admin account and get both document ID and user_id
      const adminQuery = query(collection(db, 'accounts'), where('administrator', '==', true));
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        throw new Error('No admin account found');
      }

      const adminDoc = adminSnapshot.docs[0];
      const adminData = adminDoc.data();
      const adminDocumentId = adminDoc.id;
      const adminUserId = adminData.user_id || adminDoc.id;

      console.log('📋 Admin account info:', {
        documentId: adminDocumentId,
        userId: adminUserId
      });

      // Find house deposits that were created with the document ID instead of user_id
      const incorrectDepositsQuery = query(
        collection(db, 'transactions'),
        where('user_id', '==', adminDocumentId),
        where('transaction_type', '==', 'deposit'),
        where('created_by', '==', 'retroactive_script')
      );
      
      const incorrectDepositsSnapshot = await getDocs(incorrectDepositsQuery);
      
      console.log(`🔍 Found ${incorrectDepositsSnapshot.size} house deposits with incorrect user_id`);
      
      let fixedDeposits = 0;
      
      for (const depositDoc of incorrectDepositsSnapshot.docs) {
        const depositData = depositDoc.data();
        
        console.log(`🔧 Fixing deposit ${depositDoc.id}: changing user_id from ${depositData.user_id} to ${adminUserId}`);
        
        // Update the user_id to the correct admin user_id
        await updateDoc(doc(db, 'transactions', depositDoc.id), {
          user_id: adminUserId,
          fixed_user_id: true,
          fixed_at: new Date()
        });
        
        fixedDeposits++;
      }
      
      const resultData = {
        adminDocumentId,
        adminUserId,
        depositsFound: incorrectDepositsSnapshot.size,
        depositsFixed: fixedDeposits
      };
      
      setResults(resultData);
      console.log('✅ House deposits fix completed!', resultData);

    } catch (error) {
      console.error('❌ Error fixing house deposits:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 4, p: 3, border: 1, borderColor: 'error.main', borderRadius: 1 }}>
      <Typography variant="h6" color="error.main" gutterBottom>
        Fix House Deposits User ID
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This will fix house deposits that were created with the admin's document ID instead of their user_id.
        Run this once to fix existing deposits.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {results && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Fix Complete</Typography>
          <Typography variant="body2">
            • Admin Document ID: {results.adminDocumentId}<br/>
            • Admin User ID: {results.adminUserId}<br/>
            • Deposits found with wrong ID: {results.depositsFound}<br/>
            • Deposits fixed: {results.depositsFixed}
          </Typography>
        </Alert>
      )}
      
      <Button
        variant="contained"
        color="error"
        onClick={fixHouseDeposits}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : null}
      >
        {loading ? 'Fixing Deposits...' : 'Fix House Deposits User ID'}
      </Button>
    </Box>
  );
};

export default FixHouseDepositsButton;