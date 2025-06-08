import React, { useState } from 'react';
import { Button, CircularProgress, Alert, Typography, Box } from '@mui/material';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Component to update existing house deposit descriptions to include customer names
 */
const UpdateDepositDescriptionsButton = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const updateDepositDescriptions = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      console.log('🔄 Updating house deposit descriptions...');
      
      // Find all house deposits (those with linked_withdrawal_id)
      const houseDepositsQuery = query(
        collection(db, 'transactions'),
        where('transaction_type', '==', 'deposit'),
        where('created_by', 'in', ['retroactive_script', 'withdrawal_deposit_service'])
      );
      
      const houseDepositsSnapshot = await getDocs(houseDepositsQuery);
      
      console.log(`📊 Found ${houseDepositsSnapshot.size} house deposits to update`);
      
      let updatedDeposits = 0;
      let skippedDeposits = 0;
      
      for (const depositDoc of houseDepositsSnapshot.docs) {
        const deposit = depositDoc.data();
        
        // Skip if already has the new format (contains parentheses with customer info)
        if (deposit.description && deposit.description.includes('(') && deposit.description.includes(',')) {
          console.log(`⏭️  Skipping deposit ${depositDoc.id} - already has new format`);
          skippedDeposits++;
          continue;
        }
        
        try {
          // Get the original withdrawal to find customer info
          let customerName = 'Unknown Customer';
          let withdrawalDescription = 'No description';
          
          if (deposit.linked_withdrawal_id) {
            const withdrawalQuery = query(
              collection(db, 'transactions'),
              where('__name__', '==', deposit.linked_withdrawal_id)
            );
            const withdrawalSnapshot = await getDocs(withdrawalQuery);
            
            if (!withdrawalSnapshot.empty) {
              const withdrawalData = withdrawalSnapshot.docs[0].data();
              withdrawalDescription = withdrawalData.reason || withdrawalData.description || withdrawalData.comment || 'No description';
              
              // Get customer data
              if (withdrawalData.user_id) {
                const customerQuery = query(collection(db, 'accounts'), where('user_id', '==', withdrawalData.user_id));
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                  const customerData = customerSnapshot.docs[0].data();
                  customerName = customerData.displayName || customerData.name || customerData.email || 'Unknown Customer';
                }
              }
            }
          }
          
          // Update the deposit with new description format
          const newDescription = `House deposit from customer withdrawal (${customerName}, ${withdrawalDescription})`;
          const newComment = `Automatic house deposit for withdrawal by ${customerName} ($${deposit.amount}) - Original reason: ${withdrawalDescription}`;
          
          await updateDoc(doc(db, 'transactions', depositDoc.id), {
            description: newDescription,
            comment: newComment,
            updated_description: true,
            updated_at: new Date()
          });
          
          updatedDeposits++;
          console.log(`✅ Updated deposit ${depositDoc.id}: ${newDescription}`);
          
        } catch (updateError) {
          console.warn(`Failed to update deposit ${depositDoc.id}:`, updateError);
        }
      }
      
      const resultData = {
        totalFound: houseDepositsSnapshot.size,
        updatedDeposits,
        skippedDeposits
      };
      
      setResults(resultData);
      console.log('✅ Deposit descriptions update completed!', resultData);

    } catch (error) {
      console.error('❌ Error updating deposit descriptions:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 4, p: 3, border: 1, borderColor: 'success.main', borderRadius: 1 }}>
      <Typography variant="h6" color="success.main" gutterBottom>
        Update Deposit Descriptions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This will update existing house deposits to include customer names and withdrawal descriptions in the format: "House deposit from customer withdrawal (Customer Name, Description)"
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {results && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Update Complete</Typography>
          <Typography variant="body2">
            • House deposits found: {results.totalFound}<br/>
            • Descriptions updated: {results.updatedDeposits}<br/>
            • Already formatted (skipped): {results.skippedDeposits}
          </Typography>
        </Alert>
      )}
      
      <Button
        variant="contained"
        color="success"
        onClick={updateDepositDescriptions}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : null}
      >
        {loading ? 'Updating Descriptions...' : 'Update Deposit Descriptions'}
      </Button>
    </Box>
  );
};

export default UpdateDepositDescriptionsButton;