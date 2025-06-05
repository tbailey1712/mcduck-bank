import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  useTheme,
  useMediaQuery,
  Stack
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  GetApp as ExportIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/formatUtils';
import { getTransactionsPaginated } from '../services/apiService';
import { debounce } from '../utils/performance';

const PaginatedTransactionTable = React.memo(({
  userId,
  authUser = null,
  title = "Transaction History",
  defaultPageSize = 10,
  showFilters = true,
  showExport = false,
  onTransactionClick = null,
  isAdmin = false,
  onTransactionEdit = null,
  onTransactionDelete = null
}) => {
  // Theme and responsive breakpoints
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [pagination, setPagination] = useState({
    hasNextPage: false,
    hasPreviousPage: false,
    totalDisplayed: 0
  });

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });

  // Edit dialog state
  const [editDialog, setEditDialog] = useState({
    open: false,
    transaction: null,
    amount: '',
    description: '',
    type: '',
    date: ''
  });

  // Memoized filter options
  const transactionTypes = useMemo(() => [
    { value: 'all', label: 'All Types' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'service_charge', label: 'Service Charges' },
    { value: 'interest', label: 'Interest' },
    { value: 'bankfee', label: 'Bank Fees' }
  ], []);

  const sortOptions = useMemo(() => [
    { value: 'timestamp', label: 'Date' },
    { value: 'amount', label: 'Amount' },
    { value: 'transaction_type', label: 'Type' },
    { value: 'description', label: 'Description' }
  ], []);

  // Fetch transactions with pagination
  const fetchTransactions = useCallback(async (currentPage = page, currentPageSize = pageSize) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getTransactionsPaginated(userId, {
        authUser,
        page: currentPage,
        pageSize: currentPageSize,
        orderByField: filters.sortBy,
        orderDirection: filters.sortOrder
      });

      if (result.success) {
        let filteredTransactions = result.data.transactions;

        // Apply client-side filters
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          filteredTransactions = filteredTransactions.filter(transaction =>
            (transaction.description || '').toLowerCase().includes(searchTerm) ||
            (transaction.comment || '').toLowerCase().includes(searchTerm) ||
            (transaction.transaction_type || '').toLowerCase().includes(searchTerm) ||
            transaction.amount.toString().includes(searchTerm)
          );
        }

        if (filters.type !== 'all') {
          filteredTransactions = filteredTransactions.filter(transaction =>
            (transaction.transaction_type || '').toLowerCase() === filters.type
          );
        }

        setTransactions(filteredTransactions);
        setPagination(result.data.pagination);
      } else {
        setError(result.error);
        setTransactions([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, authUser, page, pageSize, filters]);

  // Debounced search to avoid excessive API calls
  const debouncedFetch = useMemo(
    () => debounce(fetchTransactions, 300),
    [fetchTransactions]
  );

  // Effect for initial load and filter changes
  useEffect(() => {
    if (filters.search) {
      debouncedFetch(0, pageSize); // Reset to first page when searching
    } else {
      fetchTransactions();
    }
  }, [filters, debouncedFetch, fetchTransactions, pageSize, showFilters]);

  // Handle pagination changes
  const handlePageChange = useCallback((event, newPage) => {
    setPage(newPage);
    fetchTransactions(newPage, pageSize);
  }, [fetchTransactions, pageSize]);

  const handlePageSizeChange = useCallback((event) => {
    const newPageSize = parseInt(event.target.value, 10);
    setPageSize(newPageSize);
    setPage(0);
    fetchTransactions(0, newPageSize);
  }, [fetchTransactions]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setPage(0); // Reset to first page when filtering
  }, []);

  // Utility functions
  const getTransactionColor = useCallback((transaction) => {
    const type = (transaction.transaction_type || '').toLowerCase();
    switch (type) {
      case 'deposit':
        return 'success';
      case 'interest':
        return 'info'; // Blue color for interest
      case 'withdrawal':
      case 'service_charge':
      case 'bankfee':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  const getTransactionTypeDisplay = useCallback((transaction) => {
    const type = transaction.transaction_type || '';
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  }, []);

  const handleRefresh = useCallback(() => {
    fetchTransactions(page, pageSize);
  }, [fetchTransactions, page, pageSize]);

  const handleExport = useCallback(() => {
    // Placeholder for export functionality
    if (showExport) {
      console.log('Export transactions:', transactions);
      // Implement CSV export or other formats
    }
  }, [transactions, showExport]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      type: 'all',
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });
    setPage(0);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return filters.search !== '' || 
           filters.type !== 'all' || 
           filters.sortBy !== 'timestamp' || 
           filters.sortOrder !== 'desc';
  }, [filters]);

  // Admin action handlers
  const handleEditTransaction = useCallback((transaction) => {
    // Format the date from timestamp
    const transactionDate = new Date(transaction.timestamp);
    const formattedDate = transactionDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    setEditDialog({
      open: true,
      transaction,
      amount: transaction.amount.toString(),
      description: transaction.description || transaction.comment || '',
      type: transaction.transaction_type,
      date: formattedDate
    });
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditDialog({
      open: false,
      transaction: null,
      amount: '',
      description: '',
      type: '',
      date: ''
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editDialog.transaction || !onTransactionEdit) return;

    try {
      // Convert date to timestamp
      const timestamp = new Date(editDialog.date + 'T00:00:00.000Z');
      
      await onTransactionEdit({
        id: editDialog.transaction.id,
        amount: parseFloat(editDialog.amount),
        description: editDialog.description,
        transaction_type: editDialog.type,
        timestamp: timestamp
      });
      handleCloseEditDialog();
      fetchTransactions(page, pageSize); // Refresh data
    } catch (error) {
      console.error('Error editing transaction:', error);
    }
  }, [editDialog, onTransactionEdit, fetchTransactions, page, pageSize]);

  const handleDeleteTransaction = useCallback(async (transaction) => {
    if (!onTransactionDelete) return;

    if (window.confirm(`Are you sure you want to delete this ${transaction.transaction_type} transaction for ${formatCurrency(transaction.amount)}?`)) {
      try {
        await onTransactionDelete(transaction.id);
        fetchTransactions(page, pageSize); // Refresh data
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  }, [onTransactionDelete, fetchTransactions, page, pageSize]);

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Box display="flex" justifyContent="center">
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Box display="flex" gap={1} alignItems="center">
            {transactions.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {pagination.totalDisplayed} transactions
              </Typography>
            )}
            {showExport && (
              <Tooltip title="Export transactions">
                <IconButton onClick={handleExport} size="small">
                  <ExportIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        {showFilters && (
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                size="small"
                placeholder="Search transactions..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type}
                  label="Type"
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  {transactionTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={filters.sortBy}
                  label="Sort by"
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  {sortOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Order</InputLabel>
                <Select
                  value={filters.sortOrder}
                  label="Order"
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                >
                  <MenuItem value="desc">
                    {filters.sortBy === 'timestamp' ? 'Newest' : 
                     filters.sortBy === 'amount' ? 'Highest' : 'Z-A'}
                  </MenuItem>
                  <MenuItem value="asc">
                    {filters.sortBy === 'timestamp' ? 'Oldest' : 
                     filters.sortBy === 'amount' ? 'Lowest' : 'A-Z'}
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {hasActiveFilters && (
              <Grid item xs={6} sm={3} md={2} display="flex" alignItems="center">
                <Tooltip title="Clear all filters">
                  <IconButton 
                    onClick={handleClearFilters} 
                    size="small"
                    color="secondary"
                  >
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              </Grid>
            )}
          </Grid>
        )}

        {/* Loading indicator */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Responsive Table/Cards */}
        {isMobile ? (
          // Mobile card layout
          <Stack spacing={2}>
            {transactions.length === 0 && !loading ? (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">
                  No transactions found
                </Typography>
              </Box>
            ) : (
              transactions.map((transaction) => (
                <Card 
                  key={transaction.id}
                  variant="outlined"
                  sx={{ 
                    cursor: onTransactionClick && !isAdmin ? 'pointer' : 'default',
                    '&:hover': onTransactionClick && !isAdmin ? { 
                      boxShadow: 1 
                    } : {}
                  }}
                  onClick={onTransactionClick && !isAdmin ? () => onTransactionClick(transaction) : undefined}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(transaction.timestamp), 'MMM d, yyyy HH:mm')}
                        </Typography>
                        <Typography
                          variant="h6"
                          color={
                            ['withdrawal', 'service_charge', 'bankfee'].includes(
                              transaction.transaction_type
                            ) ? 'error.main' : 
                            transaction.transaction_type === 'interest' ? 'info.main' : 'success.main'
                          }
                          fontWeight="medium"
                        >
                          {formatCurrency(transaction.amount)}
                        </Typography>
                      </Box>
                      <Chip
                        label={getTransactionTypeDisplay(transaction)}
                        color={getTransactionColor(transaction)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    
                    {(transaction.description || transaction.comment) && (
                      <Typography variant="body2" color="text.secondary" mb={1}>
                        {transaction.description || transaction.comment}
                      </Typography>
                    )}
                    
                    {isAdmin && (
                      <Box display="flex" justifyContent="flex-end" gap={1}>
                        <Tooltip title="Edit transaction">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTransaction(transaction);
                            }}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete transaction">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransaction(transaction);
                            }}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        ) : (
          // Desktop table layout
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Description</TableCell>
                  {isAdmin && <TableCell align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} align="center">
                      <Typography color="text.secondary">
                        No transactions found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow 
                      key={transaction.id}
                      hover={!!onTransactionClick}
                      onClick={onTransactionClick && !isAdmin ? () => onTransactionClick(transaction) : undefined}
                      sx={{ cursor: onTransactionClick && !isAdmin ? 'pointer' : 'default' }}
                    >
                      <TableCell>
                        {format(new Date(transaction.timestamp), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getTransactionTypeDisplay(transaction)}
                          color={getTransactionColor(transaction)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          color={
                            ['withdrawal', 'service_charge', 'bankfee'].includes(
                              transaction.transaction_type
                            ) ? 'error.main' : 
                            transaction.transaction_type === 'interest' ? 'info.main' : 'success.main'
                          }
                          fontWeight="medium"
                        >
                          {formatCurrency(transaction.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {transaction.description || transaction.comment || '-'}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="center">
                          <Tooltip title="Edit transaction">
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditTransaction(transaction)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete transaction">
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteTransaction(transaction)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        <TablePagination
          component="div"
          count={-1} // Unknown total, using next/previous navigation
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handlePageSizeChange}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelDisplayedRows={({ from, to }) => 
            `${from}-${to} of ${pagination.totalDisplayed} displayed`
          }
          nextIconButtonProps={{
            disabled: !pagination.hasNextPage || loading
          }}
          backIconButtonProps={{
            disabled: !pagination.hasPreviousPage || loading
          }}
        />

        {/* Edit Transaction Dialog */}
        <Dialog open={editDialog.open} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogContent>
            <TextField
              label="Date"
              type="date"
              value={editDialog.date}
              onChange={(e) => setEditDialog(prev => ({ ...prev, date: e.target.value }))}
              fullWidth
              margin="normal"
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              label="Amount"
              type="number"
              value={editDialog.amount}
              onChange={(e) => setEditDialog(prev => ({ ...prev, amount: e.target.value }))}
              fullWidth
              margin="normal"
              inputProps={{ step: "0.01", min: "0" }}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={editDialog.type}
                label="Transaction Type"
                onChange={(e) => setEditDialog(prev => ({ ...prev, type: e.target.value }))}
              >
                <MenuItem value="deposit">Deposit</MenuItem>
                <MenuItem value="withdrawal">Withdrawal</MenuItem>
                <MenuItem value="service_charge">Service Charge</MenuItem>
                <MenuItem value="interest">Interest</MenuItem>
                <MenuItem value="bankfee">Bank Fee</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={editDialog.description}
              onChange={(e) => setEditDialog(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              margin="normal"
              multiline
              rows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEditDialog}>Cancel</Button>
            <Button 
              onClick={handleSaveEdit} 
              variant="contained" 
              color="primary"
              disabled={!editDialog.amount || parseFloat(editDialog.amount) <= 0 || !editDialog.date}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
});

PaginatedTransactionTable.displayName = 'PaginatedTransactionTable';

PaginatedTransactionTable.propTypes = {
  userId: PropTypes.string.isRequired,
  authUser: PropTypes.object,
  title: PropTypes.string,
  defaultPageSize: PropTypes.number,
  showFilters: PropTypes.bool,
  showExport: PropTypes.bool,
  onTransactionClick: PropTypes.func,
  isAdmin: PropTypes.bool,
  onTransactionEdit: PropTypes.func,
  onTransactionDelete: PropTypes.func,
};

export default PaginatedTransactionTable;