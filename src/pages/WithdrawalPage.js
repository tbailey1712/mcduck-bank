import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Stack
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  History as HistoryIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import withdrawalTaskService from '../services/withdrawalTaskService';
import { formatCurrency } from '../utils/formatUtils';
import useAccountData from '../hooks/useAccountData';

const WithdrawalPage = () => {
  const { user } = useUnifiedAuth();
  const { userData, transactionSummary, loading: accountLoading } = useAccountData();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Requests state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('open'); // 'open' or 'archive'
  
  // Cancel dialog state
  const [cancelDialog, setCancelDialog] = useState({
    open: false,
    request: null
  });

  // Fetch requests based on view mode
  const fetchRequests = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const statusFilter = viewMode === 'open' ? 'pending' : 'all';
      const result = await withdrawalTaskService.getUserWithdrawalRequests(user.uid, statusFilter);
      
      if (result.success) {
        let filteredRequests = result.requests;
        
        // Filter based on view mode
        if (viewMode === 'open') {
          filteredRequests = result.requests.filter(req => req.status === 'pending');
        } else {
          filteredRequests = result.requests.filter(req => 
            ['approved', 'rejected', 'cancelled'].includes(req.status)
          );
        }
        
        setRequests(filteredRequests);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  }, [user, viewMode]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const statusFilter = viewMode === 'open' ? 'pending' : 'all';
    const unsubscribe = withdrawalTaskService.subscribeToWithdrawalRequests(
      user.uid,
      (updatedRequests) => {
        let filteredRequests = updatedRequests;
        
        if (viewMode === 'open') {
          filteredRequests = updatedRequests.filter(req => req.status === 'pending');
        } else {
          filteredRequests = updatedRequests.filter(req => 
            ['approved', 'rejected', 'cancelled'].includes(req.status)
          );
        }
        
        setRequests(filteredRequests);
        setLoading(false);
      },
      statusFilter
    );

    return () => unsubscribe();
  }, [user, viewMode]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !amount || parseFloat(amount) <= 0) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const requestData = {
        amount: parseFloat(amount),
        description: description.trim()
      };

      const result = await withdrawalTaskService.createWithdrawalRequest(requestData, user);
      
      if (result.success) {
        setSuccess(`Withdrawal request for ${formatCurrency(requestData.amount)} submitted successfully!`);
        setAmount('');
        setDescription('');
        
        // Refresh requests to show the new one
        fetchRequests();
      }
    } catch (err) {
      setError(err.message || 'Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle request cancellation
  const handleCancelRequest = async () => {
    if (!cancelDialog.request) return;

    try {
      await withdrawalTaskService.cancelWithdrawalRequest(cancelDialog.request.id, user);
      setCancelDialog({ open: false, request: null });
      setSuccess('Withdrawal request cancelled successfully');
      fetchRequests(); // Refresh the list
    } catch (err) {
      setError(err.message || 'Failed to cancel withdrawal request');
      setCancelDialog({ open: false, request: null });
    }
  };

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const currentBalance = transactionSummary?.balance || 0;

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Withdrawal Requests
      </Typography>

      {/* New Withdrawal Request Form */}
      {viewMode === 'open' && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <MoneyIcon sx={{ mr: 1 }} />
              Request Withdrawal
            </Typography>
            
            {currentBalance > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Available Balance: {formatCurrency(currentBalance)}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                fullWidth
                margin="normal"
                required
                inputProps={{
                  step: "0.01",
                  min: "0.01",
                  max: currentBalance || "999999"
                }}
                error={parseFloat(amount) > currentBalance}
                helperText={parseFloat(amount) > currentBalance ? 'Amount exceeds available balance' : ''}
              />

              <TextField
                label="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                margin="normal"
                multiline
                rows={2}
                placeholder="What is this withdrawal for?"
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
                  {success}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={
                  submitting || 
                  !amount || 
                  parseFloat(amount) <= 0 || 
                  parseFloat(amount) > currentBalance ||
                  accountLoading
                }
                sx={{ mt: 2 }}
                fullWidth={isMobile}
              >
                {submitting ? <CircularProgress size={24} /> : 'Submit Request'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* View Toggle */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton value="open">
            <HistoryIcon sx={{ mr: 1 }} />
            Open Requests
          </ToggleButton>
          <ToggleButton value="archive">
            <ArchiveIcon sx={{ mr: 1 }} />
            Archive
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Refresh">
          <IconButton onClick={fetchRequests} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Requests List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {viewMode === 'open' ? 'Pending Requests' : 'Request History'}
          </Typography>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : requests.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="text.secondary">
                {viewMode === 'open' ? 'No pending requests' : 'No completed requests'}
              </Typography>
            </Box>
          ) : isMobile ? (
            // Mobile card layout
            <Stack spacing={2}>
              {requests.map((request) => (
                <Card key={request.id} variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(request.amount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {request.created_at?.toDate ? 
                            format(request.created_at.toDate(), 'MMM d, yyyy HH:mm') :
                            'Date not available'
                          }
                        </Typography>
                      </Box>
                      <Chip
                        label={getStatusText(request.status)}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </Box>
                    
                    {request.description && (
                      <Typography variant="body2" color="text.secondary" mb={1}>
                        {request.description}
                      </Typography>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                      <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
                        Reason: {request.rejection_reason}
                      </Alert>
                    )}
                    
                    {request.status === 'pending' && (
                      <Box display="flex" justifyContent="flex-end" mt={1}>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => setCancelDialog({ open: true, request })}
                        >
                          Cancel
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            // Desktop table layout
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    {viewMode === 'open' && <TableCell align="center">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {request.created_at?.toDate ? 
                          format(request.created_at.toDate(), 'MMM d, yyyy HH:mm') :
                          'Date not available'
                        }
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="primary" fontWeight="medium">
                          {formatCurrency(request.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {request.description || '-'}
                        {request.status === 'rejected' && request.rejection_reason && (
                          <Box mt={1}>
                            <Alert severity="error" sx={{ py: 0 }}>
                              Rejected: {request.rejection_reason}
                            </Alert>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(request.status)}
                          color={getStatusColor(request.status)}
                          size="small"
                        />
                      </TableCell>
                      {viewMode === 'open' && (
                        <TableCell align="center">
                          {request.status === 'pending' && (
                            <Tooltip title="Cancel Request">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setCancelDialog({ open: true, request })}
                              >
                                <CancelIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, request: null })}>
        <DialogTitle>Cancel Withdrawal Request</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel this withdrawal request for{' '}
            <strong>{cancelDialog.request && formatCurrency(cancelDialog.request.amount)}</strong>?
          </Typography>
          {cancelDialog.request?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Description: {cancelDialog.request.description}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, request: null })}>
            Keep Request
          </Button>
          <Button onClick={handleCancelRequest} color="error" variant="contained">
            Cancel Request
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WithdrawalPage;