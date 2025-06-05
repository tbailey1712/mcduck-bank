import { Container, Typography, Card, CardContent, Button, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { db } from '../config/firebaseConfig';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { setPendingApprovals } from '../store/slices/transactionsSlice';

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const transactionsRef = collection(db, 'transactions');

  useEffect(() => {
    const fetchPendingApprovals = async () => {
      try {
        const querySnapshot = await getDocs(transactionsRef);
        const pendingApprovals = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter(t => t.status === 'pending');
        dispatch(setPendingApprovals(pendingApprovals));
      } catch (err) {
        setError(err.message);
      }
    };
    fetchPendingApprovals();
  }, [dispatch]);

  const handleApproval = async (transactionId, status) => {
    try {
      setLoading(true);
      const transactionRef = doc(transactionsRef, transactionId);
      await updateDoc(transactionRef, {
        status,
        updatedAt: new Date().toISOString(),
      });
      // Refresh the list
      dispatch(setPendingApprovals([]));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Pending Withdrawal Approvals
          </Typography>
          {error && (
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
          )}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Amount</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Add pending approvals data here */}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom>
        Transaction Management
      </Typography>
      {/* Add transaction management UI here */}
    </Container>
  );
};

export default AdminDashboard;
