import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import { Box, Container, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Paper, Card, CardContent, Grid, Alert, InputAdornment, useTheme, useMediaQuery, Stack, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { collection, query, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { formatCurrency } from '../utils/formatUtils';
import { format } from 'date-fns';
import { fetchAndProcessTransactions } from '../services/transactionService';
import { getAuth } from 'firebase/auth';
import { AdminTransactionForm } from '../components';
import serverNotificationService from '../services/serverNotificationService';
import auditService, { AUDIT_EVENTS } from '../services/auditService';
import withdrawalDepositService from '../services/withdrawalDepositService';
import withdrawalTaskService from '../services/withdrawalTaskService';

const AdminPanel = () => {
  const { user, isAdmin, updateActivity } = useUnifiedAuth();
  const navigate = useNavigate();
  
  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Customer management state
  const [customers, setCustomers] = useState([]);
  const [customerBalances, setCustomerBalances] = useState({});
  const [lastTransactionDates, setLastTransactionDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Transaction management state
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // System configuration state
  const [systemConfig, setSystemConfig] = useState({
    interest_rate: 1.75
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');

  // Jobs state
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobResults, setJobResults] = useState(null);
  const [jobError, setJobError] = useState('');

  // Optimized customer data fetching with batch processing
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const accountsRef = collection(db, 'accounts');
      const q = query(accountsRef);
      const querySnapshot = await getDocs(q);
      const customersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        user_id: doc.data().user_id || doc.id,
        ...doc.data()
      }));
      
      setCustomers(customersData);
      
      // Process customer balances in batches to avoid overwhelming the system
      const balances = {};
      const lastTransactionDates = {};
      const batchSize = 5;
      
      for (let i = 0; i < customersData.length; i += batchSize) {
        const batch = customersData.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (customer) => {
          try {
            const auth = getAuth();
            const { summary, transactions } = await fetchAndProcessTransactions(customer.user_id, auth.currentUser);
            
            const balance = summary?.balance || 0;
            const lastTransaction = transactions && transactions.length > 0 
              ? transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp
              : null;
              
            return {
              id: customer.id,
              balance,
              lastTransaction
            };
          } catch (error) {
            console.error(`Error processing transactions for customer ${customer.id}:`, error);
            return {
              id: customer.id,
              balance: 0,
              lastTransaction: null
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Update state incrementally for better UX
        batchResults.forEach(({ id, balance, lastTransaction }) => {
          balances[id] = balance;
          lastTransactionDates[id] = lastTransaction;
        });
        
        setCustomerBalances(prev => ({ ...prev, ...balances }));
        setLastTransactionDates(prev => ({ ...prev, ...lastTransactionDates }));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to load customer data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch system configuration
  const fetchSystemConfig = async () => {
    try {
      setConfigLoading(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists()) {
        const configData = configSnap.data();
        setSystemConfig({
          interest_rate: configData.interest_rate || 1.75
        });
      }
    } catch (error) {
      console.error('Error fetching system config:', error);
      setConfigError('Failed to load system configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  // Memoized system configuration update
  const updateSystemConfig = useCallback(async (newConfig) => {
    try {
      setConfigLoading(true);
      setConfigError('');
      
      const configRef = doc(db, 'system', 'config');
      await updateDoc(configRef, newConfig);
      
      // Log configuration update for audit
      try {
        await auditService.logAdminEvent(
          AUDIT_EVENTS.CONFIG_UPDATED,
          user,
          {
            config_changes: newConfig,
            previous_config: systemConfig,
            sensitive: true // System configuration changes are sensitive
          }
        );
      } catch (auditError) {
        console.warn('Failed to log config update audit event:', auditError);
      }
      
      setSystemConfig(prev => ({ ...prev, ...newConfig }));
    } catch (error) {
      console.error('Error updating system config:', error);
      setConfigError('Failed to update system configuration');
      throw error;
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Retry functionality - must be before any conditional returns
  const handleRetry = useCallback(() => {
    fetchCustomers();
    fetchSystemConfig();
  }, [fetchCustomers]);

  // Cloud Function job handlers
  const handleCalculateInterest = async () => {
    try {
      setJobsLoading(true);
      setJobError('');
      setJobResults(null);

      // Call the cloud function
      const functionUrl = `${process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-' + process.env.REACT_APP_PROJECT_ID + '.cloudfunctions.net'}/calculateInterest`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Cloud function failed: ${response.status}`);
      }

      const results = await response.json();
      
      setJobResults({
        type: 'interest',
        ...results.results
      });

      // Log cloud function execution for audit
      try {
        await auditService.logAdminEvent(
          AUDIT_EVENTS.CLOUD_FUNCTION_EXECUTED,
          user,
          {
            function_name: 'calculateInterest',
            results: results.results,
            execution_time: new Date(),
            sensitive: true // Interest calculations are sensitive operations
          }
        );
      } catch (auditError) {
        console.warn('Failed to log interest calculation audit event:', auditError);
      }

      // Refresh customer data to show updated balances
      await fetchCustomers();
    } catch (error) {
      console.error('Error calling interest calculation function:', error);
      setJobError(`Failed to calculate interest: ${error.message}`);
    } finally {
      setJobsLoading(false);
    }
  };

  const handleGenerateStatements = async () => {
    try {
      setJobsLoading(true);
      setJobError('');
      setJobResults(null);

      // Call the cloud function
      const functionUrl = `${process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-' + process.env.REACT_APP_PROJECT_ID + '.cloudfunctions.net'}/sendMonthlyStatements`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Cloud function failed: ${response.status}`);
      }

      const results = await response.json();
      
      setJobResults({
        type: 'statements',
        totalProcessed: results.results.totalProcessed,
        emailsSent: results.results.emailsSent,
        emailErrors: results.results.emailErrors,
        errors: results.results.errors
      });

      // Log cloud function execution for audit
      try {
        await auditService.logAdminEvent(
          AUDIT_EVENTS.CLOUD_FUNCTION_EXECUTED,
          user,
          {
            function_name: 'sendMonthlyStatements',
            results: results.results,
            execution_time: new Date(),
            sensitive: false
          }
        );
      } catch (auditError) {
        console.warn('Failed to log statements generation audit event:', auditError);
      }
    } catch (error) {
      console.error('Error calling statements generation function:', error);
      setJobError(`Failed to generate statements: ${error.message}`);
    } finally {
      setJobsLoading(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchCustomers();
    fetchSystemConfig();
  }, []);

  // Create transaction
  const createTransaction = async (transactionData) => {
    console.log('🚀 CREATE TRANSACTION CALLED:', transactionData);
    setTransactionLoading(true);
    setTransactionError('');

    try {
      // Handle withdrawal_request differently - create a task instead of transaction
      if (transactionData.transactionType === 'withdrawal_request') {
        // Find target customer for the request
        const targetCustomer = customers.find(c => c.user_id === transactionData.userId);
        
        const mockUser = {
          uid: transactionData.userId,
          email: targetCustomer?.email || 'unknown@example.com',
          displayName: targetCustomer?.displayName || targetCustomer?.name || 'Unknown User'
        };

        const requestData = {
          amount: transactionData.amount,
          description: transactionData.description || 'Admin created withdrawal request'
        };

        const result = await withdrawalTaskService.createWithdrawalRequest(requestData, mockUser);
        
        if (result.success) {
          console.log('✅ Withdrawal request task created:', result.taskId);
          // Refresh customer data
          await fetchCustomers();
          return; // Exit early for withdrawal requests
        } else {
          throw new Error('Failed to create withdrawal request');
        }
      }

      // Handle regular transactions
      const transactionRef = collection(db, 'transactions');
      const docRef = await addDoc(transactionRef, {
        user_id: transactionData.userId,
        amount: transactionData.amount,
        transaction_type: transactionData.transactionType,
        comment: transactionData.description || '',
        timestamp: new Date()
      });

      console.log('📄 TRANSACTION CREATED IN FIRESTORE:', docRef.id);

      // Log transaction creation for audit
      console.log('🔄 Starting audit logging for transaction creation...');
      
      const transactionDoc = {
        id: docRef.id,
        user_id: transactionData.userId,
        amount: transactionData.amount,
        transaction_type: transactionData.transactionType,
        comment: transactionData.description || '',
        timestamp: new Date()
      };

      // Find target customer for audit log
      const targetCustomer = customers.find(c => c.user_id === transactionData.userId);
      
      console.log('🎯 Transaction audit data:', {
        transactionDoc,
        targetCustomer,
        currentUser: user
      });
      
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.TRANSACTION_CREATED,
        user,
        {
          transaction_id: docRef.id,
          account_affected: transactionData.userId,
          account_email: targetCustomer?.email || transactionData.userEmail || 'unknown',
          account_name: targetCustomer?.displayName || targetCustomer?.name || 'unknown',
          created_from: 'admin_panel',
          transaction_details: {
            amount: transactionData.amount,
            transaction_type: transactionData.transactionType,
            description: transactionData.description || '',
            timestamp: new Date(),
            user_id: transactionData.userId
          }
        },
        targetCustomer ? {
          id: targetCustomer.user_id,
          type: 'customer',
          email: targetCustomer.email,
          displayName: targetCustomer.displayName || targetCustomer.name
        } : null
      );
      
      console.log('✅ Transaction audit logging completed');

      // Create house deposit for withdrawals
      if (transactionData.transactionType === 'withdrawal') {
        try {
          const transactionDoc = {
            id: docRef.id,
            user_id: transactionData.userId,
            amount: transactionData.amount,
            transaction_type: transactionData.transactionType,
            comment: transactionData.description || '',
            timestamp: new Date()
          };

          await withdrawalDepositService.createHouseDeposit(
            transactionDoc,
            docRef.id,
            { 
              uid: transactionData.userId,
              email: transactionData.userEmail,
              displayName: targetCustomer?.displayName || targetCustomer?.name
            }
          );
          console.log('✅ House deposit created for admin withdrawal:', docRef.id);
        } catch (houseDepositError) {
          console.warn('⚠️ Failed to create house deposit for admin withdrawal:', houseDepositError);
          // Don't fail the transaction if house deposit fails
        }
      }

      // Send notification for deposit/withdrawal
      try {
        const transactionDoc = {
          id: docRef.id,
          user_id: transactionData.userId,
          amount: transactionData.amount,
          transaction_type: transactionData.transactionType,
          comment: transactionData.description || '',
          timestamp: new Date()
        };

        console.log('🔔 Sending transaction notification to user:', transactionData.userId);
        console.log('💰 Transaction type:', transactionData.transactionType, 'Amount:', transactionData.amount);

        // Always send notification to the transaction recipient
        const targetUserId = transactionData.userId;
        console.log('🎯 Target notification user:', targetUserId);
        
        // Check if this is the admin user (for testing cross-device notifications)
        if (targetUserId === user.uid) {
          console.log('📱 This is the admin user - notification should appear on all admin devices (including mobile)');
        } else {
          console.log('👤 This is a customer - notification will only work if customer has registered devices');
        }

        if (transactionData.transactionType === 'deposit') {
          await serverNotificationService.sendDepositNotification(
            targetUserId,
            transactionData.amount,
            transactionData.description,
            transactionDoc
          );
        } else if (transactionData.transactionType === 'withdrawal') {
          await serverNotificationService.sendWithdrawalNotification(
            targetUserId,
            transactionData.amount,
            transactionData.description,
            transactionDoc
          );
        }
        
        console.log('✅ Transaction notification sent successfully');
      } catch (notificationError) {
        console.warn('⚠️ Failed to send notification:', notificationError);
        // Don't fail the transaction if notification fails
      }

      // Refresh customer data to update balances
      await fetchCustomers();
    } catch (error) {
      console.error('Error creating transaction:', error);
      setTransactionError(error.message || 'Failed to create transaction');
      throw error; // Re-throw to be handled by form
    } finally {
      setTransactionLoading(false);
    }
  };

  if (!user || !isAdmin) {
    navigate('/');
    return null;
  }

  // Handle transaction management
  const handleViewTransactions = async (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    try {
      // Use user_id for transaction queries
      const { transactions } = await fetchAndProcessTransactions(customer.user_id);
      if (transactions.length > 0) {
        setSelectedTransaction(transactions[0]);
        setEditAmount(transactions[0].amount.toString());
        setEditDescription(transactions[0].comment || '');
        setOpenEditDialog(true);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleSaveTransaction = async () => {
    if (!selectedTransaction || !editAmount) return;

    try {
      const previousAmount = selectedTransaction.amount;
      const previousDescription = selectedTransaction.comment || selectedTransaction.description || '';
      const newAmount = parseFloat(editAmount);
      const newDescription = editDescription || '';
      
      // Track what changed
      const changes = [];
      
      if (previousAmount !== newAmount) {
        changes.push({
          field: 'amount',
          old_value: previousAmount,
          new_value: newAmount,
          formatted_old: `$${previousAmount.toFixed(2)}`,
          formatted_new: `$${newAmount.toFixed(2)}`
        });
      }
      
      if (previousDescription !== newDescription) {
        changes.push({
          field: 'description',
          old_value: previousDescription,
          new_value: newDescription,
          formatted_old: previousDescription || '(empty)',
          formatted_new: newDescription || '(empty)'
        });
      }
      
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        amount: newAmount,
        comment: editDescription
      });

      // Log transaction edit for audit with detailed change tracking
      const targetCustomer = customers.find(c => c.user_id === selectedTransaction.user_id);
      
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.TRANSACTION_EDITED,
        user,
        {
          transaction_id: selectedTransaction.id,
          account_edited: selectedTransaction.user_id || 'unknown',
          account_email: targetCustomer?.email || 'unknown',
          account_name: targetCustomer?.displayName || targetCustomer?.name || 'unknown',
          changes_made: changes,
          total_changes: changes.length,
          edited_from: 'admin_panel',
          original_values: {
            amount: previousAmount,
            description: previousDescription,
            transaction_type: selectedTransaction.transaction_type,
            timestamp: selectedTransaction.timestamp
          },
          new_values: {
            amount: newAmount,
            description: newDescription,
            transaction_type: selectedTransaction.transaction_type,
            timestamp: selectedTransaction.timestamp
          }
        },
        targetCustomer ? {
          id: targetCustomer.user_id,
          type: 'customer',
          email: targetCustomer.email,
          displayName: targetCustomer.displayName || targetCustomer.name
        } : null
      );

      setOpenEditDialog(false);
      setSelectedTransaction(null);
      // Refresh customer balances
      fetchCustomers();
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;

    try {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await deleteDoc(transactionRef);

      // Log transaction deletion for audit
      const targetCustomer = customers.find(c => c.user_id === selectedTransaction.user_id);
      
      await auditService.logTransactionEvent(
        AUDIT_EVENTS.TRANSACTION_DELETED,
        user,
        {
          id: selectedTransaction.id,
          transaction_type: selectedTransaction.transaction_type,
          amount: selectedTransaction.amount,
          description: selectedTransaction.comment,
          comment: selectedTransaction.comment,
          deleted_at: new Date()
        },
        targetCustomer ? {
          id: targetCustomer.user_id,
          type: 'customer',
          email: targetCustomer.email,
          displayName: targetCustomer.displayName || targetCustomer.name
        } : null
      );

      setOpenEditDialog(false);
      setSelectedTransaction(null);
      // Refresh customer balances
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 } }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading admin dashboard...</Typography>
        </Box>
      </Container>
    );
  }

  // Error state with retry option
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 } }}>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>

      {/* Transaction Form */}
      <AdminTransactionForm
        customers={customers}
        onSubmit={createTransaction}
        loading={transactionLoading}
        error={transactionError}
      />


      {/* System Configuration Panel */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            System Configuration
          </Typography>
          
          {configError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {configError}
            </Alert>
          )}
          
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                label="Interest Rate"
                type="number"
                value={systemConfig.interest_rate}
                onChange={(e) => setSystemConfig(prev => ({
                  ...prev,
                  interest_rate: parseFloat(e.target.value) || 0
                }))}
                disabled={configLoading}
                fullWidth
                inputProps={{
                  step: "0.01",
                  min: "0",
                  max: "100"
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
                helperText="Annual interest rate percentage"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => updateSystemConfig({ interest_rate: systemConfig.interest_rate })}
                disabled={configLoading}
                fullWidth
              >
                {configLoading ? 'Updating...' : 'Update Configuration'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cloud Functions Jobs Panel */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Cloud Function Jobs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Trigger automated banking operations via cloud functions
          </Typography>
          
          {jobError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {jobError}
            </Alert>
          )}

          {jobResults && (
            <Alert 
              severity="success" 
              sx={{ mb: 2 }}
              onClose={() => setJobResults(null)}
            >
              <Typography variant="subtitle2">
                {jobResults.type === 'interest' ? 'Interest Calculation' : 'Statement Generation'} Completed
              </Typography>
              <Typography variant="body2">
                Processed: {jobResults.totalProcessed} accounts
                {jobResults.type === 'interest' && (
                  <>
                    <br />Total Interest Paid: ${jobResults.totalInterestPaid?.toFixed(2) || '0.00'}
                    <br />Already Paid This Month: {jobResults.alreadyPaid || 0}
                  </>
                )}
                {jobResults.type === 'statements' && (
                  <>
                    <br />Emails Sent: {jobResults.emailsSent || 0}
                    {jobResults.emailErrors > 0 && (
                      <>
                        <br />Email Errors: {jobResults.emailErrors}
                      </>
                    )}
                  </>
                )}
                {jobResults.type === 'interest' && jobResults.emailsSent && (
                  <>
                    <br />Notification Emails Sent: {jobResults.emailsSent}
                  </>
                )}
                {jobResults.errors?.length > 0 && (
                  <>
                    <br />Errors: {jobResults.errors.length}
                  </>
                )}
              </Typography>
            </Alert>
          )}
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCalculateInterest}
                disabled={jobsLoading}
                fullWidth
                sx={{ mb: 1 }}
              >
                {jobsLoading ? 'Processing...' : 'Calculate Monthly Interest'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Pays interest to all accounts and sends notification emails
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleGenerateStatements}
                disabled={jobsLoading}
                fullWidth
                sx={{ mb: 1 }}
              >
                {jobsLoading ? 'Processing...' : 'Send Monthly Statements'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Generates and emails monthly statements to all customers
              </Typography>
            </Grid>
          </Grid>

        </CardContent>
      </Card>

      {/* Customer List */}
      <Paper sx={{ p: 3, mt: { xs: 10, sm: 8, md: 9 } }}>
        <Typography variant="h6" gutterBottom>
          Customer Accounts
        </Typography>
        
        {isMobile ? (
          // Mobile card layout
          <Stack spacing={2}>
            {customers.map((customer) => (
              <Card key={customer.id} variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Button
                        variant="text"
                        onClick={() => navigate(`/account/${customer.user_id}`)}
                        sx={{ textTransform: 'none', p: 0, justifyContent: 'flex-start', mb: 1 }}
                      >
                        <Typography variant="subtitle1" fontWeight="medium">
                          {customer.displayName || customer.name || 'No name set'}
                        </Typography>
                      </Button>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {customer.email || customer.id}
                      </Typography>
                      <Typography variant="h6" color="success.main" fontWeight="medium">
                        {formatCurrency(customerBalances[customer.id] || 0)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleViewTransactions(customer.user_id)}
                      title="View Transactions"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Last transaction: {lastTransactionDates[customer.id] ? 
                      format(new Date(lastTransactionDates[customer.id]), 'MMM d, yyyy HH:mm') : 
                      'No transactions'
                    }
                  </Typography>
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
                  <TableCell>Customer Name</TableCell>
                  <TableCell>Email Address</TableCell>
                  <TableCell>Account Balance</TableCell>
                  <TableCell>Last Transaction</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Button
                        variant="text"
                        onClick={() => navigate(`/account/${customer.user_id}`)}
                        sx={{ textTransform: 'none' }}
                      >
                        {customer.displayName || customer.name || 'No name set'}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {customer.email || customer.id}
                    </TableCell>
                    <TableCell>{formatCurrency(customerBalances[customer.id] || 0)}</TableCell>
                    <TableCell>
                      {lastTransactionDates[customer.id] ? 
                        format(new Date(lastTransactionDates[customer.id]), 'MMM d, yyyy HH:mm') : 
                        'No transactions'
                      }
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewTransactions(customer.user_id)}
                        title="View Transactions"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Transaction Management Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>{selectedTransaction ? 'Edit Transaction' : 'Transaction Details'}</DialogTitle>
        <DialogContent>
          {selectedTransaction && (
            <>
              <TextField
                label="Amount"
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                fullWidth
                margin="normal"
              />
              <Button
                variant="outlined"
                color="error"
                onClick={handleDeleteTransaction}
                sx={{ mt: 2 }}
              >
                Delete Transaction
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          {selectedTransaction && (
            <Button onClick={handleSaveTransaction} color="primary">
              Save Changes
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminPanel;
