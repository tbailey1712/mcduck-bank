import React, { useState } from 'react';
import { Button, CircularProgress, Alert, Typography, Box, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Diagnostic component to investigate where house deposits went
 */
const DiagnoseDepositsButton = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const diagnoseDeposits = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      console.log('🔍 Starting deposits diagnosis...');
      
      // Get admin accounts
      const adminQuery = query(collection(db, 'accounts'), where('administrator', '==', true));
      const adminSnapshot = await getDocs(adminQuery);
      
      const adminAccounts = adminSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get all withdrawals
      const withdrawalsQuery = query(collection(db, 'transactions'), where('transaction_type', '==', 'withdrawal'));
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
      
      const withdrawals = withdrawalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get all deposits
      const depositsQuery = query(collection(db, 'transactions'), where('transaction_type', '==', 'deposit'));
      const depositsSnapshot = await getDocs(depositsQuery);
      
      const deposits = depositsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find house deposits (those with linked_withdrawal_id or created_by retroactive_script)
      const houseDeposits = deposits.filter(d => 
        d.linked_withdrawal_id || 
        d.created_by === 'retroactive_script' || 
        d.created_by === 'withdrawal_deposit_service'
      );

      // Find orphaned house deposits (deposits with wrong user_id)
      const orphanedDeposits = deposits.filter(d => 
        adminAccounts.some(admin => admin.id === d.user_id) && // user_id matches admin document ID
        !adminAccounts.some(admin => admin.user_id === d.user_id) // but not admin Firebase UID
      );

      // Group deposits by user_id to see distribution
      const depositsByUserId = {};
      deposits.forEach(d => {
        if (!depositsByUserId[d.user_id]) {
          depositsByUserId[d.user_id] = [];
        }
        depositsByUserId[d.user_id].push(d);
      });

      const resultData = {
        adminAccounts,
        totalWithdrawals: withdrawals.length,
        totalDeposits: deposits.length,
        houseDeposits: houseDeposits.length,
        orphanedDeposits: orphanedDeposits.length,
        depositsByUserId,
        withdrawals: withdrawals.slice(0, 5), // First 5 for inspection
        deposits: deposits.slice(0, 10), // First 10 for inspection
        houseDepositsData: houseDeposits.slice(0, 10)
      };
      
      setResults(resultData);
      console.log('🔍 Diagnosis complete:', resultData);

    } catch (error) {
      console.error('❌ Error diagnosing deposits:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mb: 4, p: 3, border: 1, borderColor: 'info.main', borderRadius: 1 }}>
      <Typography variant="h6" color="info.main" gutterBottom>
        Diagnose House Deposits
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This will analyze the database to find where house deposits went and identify any issues.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {results && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Diagnosis Results</Typography>
            <Typography variant="body2">
              • Admin accounts found: {results.adminAccounts.length}<br/>
              • Total withdrawals: {results.totalWithdrawals}<br/>
              • Total deposits: {results.totalDeposits}<br/>
              • House deposits found: {results.houseDeposits}<br/>
              • Orphaned deposits (wrong user_id): {results.orphanedDeposits}
            </Typography>
          </Alert>

          <Typography variant="h6" gutterBottom>Admin Accounts:</Typography>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Document ID</TableCell>
                <TableCell>User ID (Firebase UID)</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Admin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.adminAccounts.map(admin => (
                <TableRow key={admin.id}>
                  <TableCell>{admin.id}</TableCell>
                  <TableCell>{admin.user_id || 'N/A'}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.administrator ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="h6" gutterBottom>Deposits by User ID:</Typography>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>User ID</TableCell>
                <TableCell>Deposit Count</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(results.depositsByUserId).map(([userId, deposits]) => {
                const isAdminDocId = results.adminAccounts.some(admin => admin.id === userId);
                const isAdminFirebaseUid = results.adminAccounts.some(admin => admin.user_id === userId);
                const type = isAdminFirebaseUid ? 'Admin (Firebase UID)' : 
                           isAdminDocId ? 'Admin (Document ID - WRONG!)' : 'Customer';
                
                return (
                  <TableRow key={userId}>
                    <TableCell>{userId}</TableCell>
                    <TableCell>{deposits.length}</TableCell>
                    <TableCell style={{ color: type.includes('WRONG') ? 'red' : 'inherit' }}>
                      {type}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Typography variant="h6" gutterBottom>Sample House Deposits:</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Linked Withdrawal</TableCell>
                <TableCell>Created By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.houseDepositsData.map(deposit => (
                <TableRow key={deposit.id}>
                  <TableCell>{deposit.id.slice(0, 8)}...</TableCell>
                  <TableCell>{deposit.user_id}</TableCell>
                  <TableCell>${deposit.amount}</TableCell>
                  <TableCell>{deposit.linked_withdrawal_id ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{deposit.created_by || 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      
      <Button
        variant="contained"
        color="info"
        onClick={diagnoseDeposits}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : null}
      >
        {loading ? 'Diagnosing...' : 'Diagnose Deposits'}
      </Button>
    </Box>
  );
};

export default DiagnoseDepositsButton;