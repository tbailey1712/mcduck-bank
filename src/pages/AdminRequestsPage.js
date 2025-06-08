import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Stack,
  Badge
} from '@mui/material';
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  Refresh as RefreshIcon,
  RequestPage as RequestIcon,
  Archive as ArchiveIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import withdrawalTaskService from '../services/withdrawalTaskService';
import { formatCurrency } from '../utils/formatUtils';

const AdminRequestsPage = () => {
  const { user, isAdmin } = useUnifiedAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Requests state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('open'); // 'open' or 'archive'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Action dialogs state
  const [approveDialog, setApproveDialog] = useState({
    open: false,
    request: null,
    processing: false
  });

  const [rejectDialog, setRejectDialog] = useState({
    open: false,
    request: null,
    reason: '',
    processing: false
  });

  // Redirect if not admin
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/');
    }
  }, [user, isAdmin, navigate]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !isAdmin) return;

    const statusFilter = viewMode === 'open' ? 'pending' : 'all';
    const unsubscribe = withdrawalTaskService.subscribeToAllWithdrawalRequests(
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
  }, [user, isAdmin, viewMode]);

  // Handle approval
  const handleApprove = async () => {
    if (!approveDialog.request) return;

    setApproveDialog(prev => ({ ...prev, processing: true }));
    setError('');

    try {
      await withdrawalTaskService.approveWithdrawalRequest(approveDialog.request.id, user);
      setSuccess(`Withdrawal request for ${formatCurrency(approveDialog.request.amount)} approved successfully`);
      setApproveDialog({ open: false, request: null, processing: false });
    } catch (err) {
      setError(err.message || 'Failed to approve withdrawal request');
      setApproveDialog(prev => ({ ...prev, processing: false }));
    }
  };

  // Handle rejection
  const handleReject = async () => {
    if (!rejectDialog.request || !rejectDialog.reason.trim()) return;

    setRejectDialog(prev => ({ ...prev, processing: true }));
    setError('');

    try {
      await withdrawalTaskService.rejectWithdrawalRequest(
        rejectDialog.request.id, 
        user, 
        rejectDialog.reason.trim()
      );
      setSuccess(`Withdrawal request for ${formatCurrency(rejectDialog.request.amount)} rejected`);
      setRejectDialog({ open: false, request: null, reason: '', processing: false });
    } catch (err) {
      setError(err.message || 'Failed to reject withdrawal request');
      setRejectDialog(prev => ({ ...prev, processing: false }));
    }
  };

  // Refresh requests
  const refreshRequests = useCallback(async () => {
    if (!user || !isAdmin) return;

    setLoading(true);
    try {
      const statusFilter = viewMode === 'open' ? 'pending' : 'all';
      const result = await withdrawalTaskService.getAllWithdrawalRequests(statusFilter);
      
      if (result.success) {
        let filteredRequests = result.requests;
        
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
  }, [user, isAdmin, viewMode]);

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

  if (!user || !isAdmin) {
    return null; // Will redirect
  }

  const pendingCount = requests.filter(req => req.status === 'pending').length;

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Withdrawal Requests
      </Typography>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
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
            <Badge badgeContent={pendingCount} color="error">
              <RequestIcon sx={{ mr: 1 }} />
            </Badge>
            Open Requests
          </ToggleButton>
          <ToggleButton value="archive">
            <ArchiveIcon sx={{ mr: 1 }} />
            Archive
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Refresh">
          <IconButton onClick={refreshRequests} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Requests List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {viewMode === 'open' ? `Pending Requests (${requests.length})` : 'Request History'}
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
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          {request.user_name || request.user_email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
                      <Box display="flex" justifyContent="flex-end" gap={1} mt={1}>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<RejectIcon />}
                          onClick={() => setRejectDialog({ open: true, request, reason: '', processing: false })}
                        >
                          Reject
                        </Button>
                        <Button
                          size="small"
                          color="success"
                          variant="contained"
                          startIcon={<ApproveIcon />}
                          onClick={() => setApproveDialog({ open: true, request, processing: false })}
                        >
                          Approve
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
                    <TableCell>Customer</TableCell>
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
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {request.user_name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.user_email}
                          </Typography>
                        </Box>
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
                            <Box display="flex" gap={1} justifyContent="center">
                              <Tooltip title="Reject Request">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setRejectDialog({ open: true, request, reason: '', processing: false })}
                                >
                                  <RejectIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Approve Request">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => setApproveDialog({ open: true, request, processing: false })}
                                >
                                  <ApproveIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
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

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialog.open} onClose={() => !approveDialog.processing && setApproveDialog({ open: false, request: null, processing: false })}>
        <DialogTitle>Approve Withdrawal Request</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to approve this withdrawal request?
          </Typography>
          {approveDialog.request && (
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                <strong>Customer:</strong> {approveDialog.request.user_name || approveDialog.request.user_email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Amount:</strong> {formatCurrency(approveDialog.request.amount)}
              </Typography>
              {approveDialog.request.description && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Description:</strong> {approveDialog.request.description}
                </Typography>
              )}
            </Box>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            This will create a withdrawal transaction and send a notification to the customer.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setApproveDialog({ open: false, request: null, processing: false })}
            disabled={approveDialog.processing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleApprove} 
            color="success" 
            variant="contained"
            disabled={approveDialog.processing}
            startIcon={approveDialog.processing ? <CircularProgress size={16} /> : <ApproveIcon />}
          >
            {approveDialog.processing ? 'Approving...' : 'Approve Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => !rejectDialog.processing && setRejectDialog({ open: false, request: null, reason: '', processing: false })}>
        <DialogTitle>Reject Withdrawal Request</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Please provide a reason for rejecting this withdrawal request:
          </Typography>
          {rejectDialog.request && (
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">
                <strong>Customer:</strong> {rejectDialog.request.user_name || rejectDialog.request.user_email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Amount:</strong> {formatCurrency(rejectDialog.request.amount)}
              </Typography>
              {rejectDialog.request.description && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Description:</strong> {rejectDialog.request.description}
                </Typography>
              )}
            </Box>
          )}
          <TextField
            label="Rejection Reason"
            value={rejectDialog.reason}
            onChange={(e) => setRejectDialog(prev => ({ ...prev, reason: e.target.value }))}
            fullWidth
            multiline
            rows={3}
            required
            placeholder="Explain why this request is being rejected..."
            disabled={rejectDialog.processing}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRejectDialog({ open: false, request: null, reason: '', processing: false })}
            disabled={rejectDialog.processing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleReject} 
            color="error" 
            variant="contained"
            disabled={rejectDialog.processing || !rejectDialog.reason.trim()}
            startIcon={rejectDialog.processing ? <CircularProgress size={16} /> : <RejectIcon />}
          >
            {rejectDialog.processing ? 'Rejecting...' : 'Reject Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminRequestsPage;