import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import { Box, Container, Typography, Paper, CircularProgress, Alert, Button } from '@mui/material';
import { collection, query, getDocs, doc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { fetchAndProcessTransactions } from '../services/transactionService';
import { getAuth } from 'firebase/auth';
import auditService, { AUDIT_EVENTS } from '../services/auditService';
import adminCloudFunctions from '../services/adminCloudFunctions';
import CustomerList from '../components/CustomerList';
import SystemConfiguration from '../components/SystemConfiguration';
import AdminJobs from '../components/AdminJobs';
import TransactionForm from '../components/TransactionForm';
import withdrawalTaskService from '../services/withdrawalTaskService';
import withdrawalDepositService from '../services/withdrawalDepositService';
import serverNotificationService from '../services/serverNotificationService';

const AdminPanel = () => {
  const { user, isAdmin } = useUnifiedAuth();
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState([]);
  const [customerBalances, setCustomerBalances] = useState({});
  const [lastTransactionDates, setLastTransactionDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  
  const [systemConfig, setSystemConfig] = useState({
    interest_rate: 1.75,
    allowNewUsers: false
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  
  const [toggleSaving, setToggleSaving] = useState(false);
  const [toggleStatus, setToggleStatus] = useState('');

  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobResults, setJobResults] = useState(null);
  const [jobError, setJobError] = useState('');

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

  const fetchSystemConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists()) {
        const configData = configSnap.data();
        setSystemConfig({
          interest_rate: configData.interest_rate || 1.75,
          allowNewUsers: configData.allowNewUsers || false
        });
      }
    } catch (error) {
      console.error('Error fetching system config:', error);
      setConfigError('Failed to load system configuration');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const updateSystemConfig = useCallback(async (newConfig) => {
    try {
      setConfigLoading(true);
      setConfigError('');
      
      const configRef = doc(db, 'system', 'config');
      
      await setDoc(configRef, newConfig, { merge: true });
      
      try {
        await auditService.logAdminEvent(
          AUDIT_EVENTS.CONFIG_UPDATED,
          user,
          {
            config_changes: newConfig,
            previous_config: systemConfig,
            sensitive: true
          }
        );
      } catch (auditError) {
        console.warn('Failed to log config update audit event:', auditError);
      }
      
      setSystemConfig(prev => ({ ...prev, ...newConfig }));
    } catch (error) {
      console.error('❌ Error updating system config:', error);
      setConfigError(`Failed to update system configuration: ${error.message}`);
      throw error;
    } finally {
      setConfigLoading(false);
    }
  }, [user, systemConfig]);

  const updateRegistrationSetting = useCallback(async (allowNewUsers) => {
    try {
      setToggleSaving(true);
      setToggleStatus('');
      
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, { allowNewUsers }, { merge: true });
      
      setToggleStatus('success');
      
      try {
        await auditService.logAdminEvent(
          AUDIT_EVENTS.CONFIG_UPDATED,
          user,
          {
            config_changes: { allowNewUsers },
            previous_config: { allowNewUsers: systemConfig.allowNewUsers },
            setting_changed: 'user_registration',
            sensitive: true
          }
        );
      } catch (auditError) {
        console.warn('Failed to log registration setting audit event:', auditError);
      }
      
    } catch (error) {
      setToggleStatus('error');
    } finally {
      setToggleSaving(false);
      setTimeout(() => setToggleStatus(''), 3000);
    }
  }, [user, systemConfig.allowNewUsers]);

  const handleRetry = useCallback(() => {
    fetchCustomers();
    fetchSystemConfig();
  }, [fetchCustomers, fetchSystemConfig]);

  const handleSetupAdmin = async () => {
    try {
      setJobsLoading(true);
      setJobError('');
      setJobResults(null);

      const results = await adminCloudFunctions.setupAdmin();
      
      setJobResults({
        type: 'setup',
        message: results.message,
        success: true
      });

      alert('Admin privileges set! Please refresh your browser for changes to take effect.');
      
    } catch (error) {
      setJobError(adminCloudFunctions.getErrorMessage(error));
    } finally {
      setJobsLoading(false);
    }
  };

  const handleCalculateInterest = async () => {
    try {
      setJobsLoading(true);
      setJobError('');
      setJobResults(null);

      const results = await adminCloudFunctions.calculateInterest();
      
      setJobResults({
        type: 'interest',
        ...results.results
      });

      try {
        await auditService.logAdminEvent(
          AUDIT_EVENTS.CLOUD_FUNCTION_EXECUTED,
          user,
          {
            function_name: 'calculateInterest',
            results: results.results,
            execution_time: new Date(),
            sensitive: true
          }
        );
      } catch (auditError) {
        console.warn('Failed to log interest calculation audit event:', auditError);
      }

      await fetchCustomers();
    } catch (error) {
      setJobError(adminCloudFunctions.getErrorMessage(error));
    } finally {
      setJobsLoading(false);
    }
  };

  const handleSendIndividualStatement = async (customerEmail) => {
    try {
      setJobsLoading(true);
      setJobError('');
      setJobResults(null);

      const results = await adminCloudFunctions.sendMonthlyStatements({ customerEmail });
      
      setJobResults({
        type: 'individual_statement',
        customerEmail: customerEmail,
        totalProcessed: results.results.totalProcessed,
        emailsSent: results.results.emailsSent,
        emailErrors: results.results.emailErrors,
        errors: results.results.errors
      });

    } catch (error) {
      setJobError(adminCloudFunctions.getErrorMessage(error));
    } finally {
      setJobsLoading(false);
    }
  };

  const handleGenerateStatements = async () => {
    try {
      setJobsLoading(true);
      setJobError('');
      setJobResults(null);

      const results = await adminCloudFunctions.sendMonthlyStatements();
      
      setJobResults({
        type: 'statements',
        totalProcessed: results.results.totalProcessed,
        emailsSent: results.results.emailsSent,
        emailErrors: results.results.emailErrors,
        errors: results.results.errors
      });

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
      setJobError(adminCloudFunctions.getErrorMessage(error));
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSystemConfig();
  }, [fetchCustomers, fetchSystemConfig]);

  const createTransaction = async (transactionData) => {
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
        timestamp: transactionData.date ? new Date(transactionData.date) : new Date()
      });

      // Log transaction creation for audit
      const targetCustomer = customers.find(c => c.user_id === transactionData.userId);
      
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
            timestamp: transactionData.date ? new Date(transactionData.date) : new Date(),
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

      // Create house deposit for withdrawals
      if (transactionData.transactionType === 'withdrawal') {
        try {
          await withdrawalDepositService.createHouseDeposit(
            { 
              id: docRef.id,
              user_id: transactionData.userId,
              amount: transactionData.amount,
              transaction_type: transactionData.transactionType,
              comment: transactionData.description || '',
              timestamp: new Date()
            },
            docRef.id,
            { 
              uid: transactionData.userId,
              email: transactionData.userEmail,
              displayName: targetCustomer?.displayName || targetCustomer?.name
            }
          );
        } catch (houseDepositError) {
          console.warn('⚠️ Failed to create house deposit for admin withdrawal:', houseDepositError);
        }
      }

      // Send notification for deposit/withdrawal
      try {
        const targetUserId = transactionData.userId;
        
        if (transactionData.transactionType === 'deposit') {
          await serverNotificationService.sendDepositNotification(
            targetUserId,
            transactionData.amount,
            transactionData.description,
            { 
              id: docRef.id,
              user_id: transactionData.userId,
              amount: transactionData.amount,
              transaction_type: transactionData.transactionType,
              comment: transactionData.description || '',
              timestamp: new Date()
            }
          );
        } else if (transactionData.transactionType === 'withdrawal') {
          await serverNotificationService.sendWithdrawalNotification(
            targetUserId,
            transactionData.amount,
            transactionData.description,
            { 
              id: docRef.id,
              user_id: transactionData.userId,
              amount: transactionData.amount,
              transaction_type: transactionData.transactionType,
              comment: transactionData.description || '',
              timestamp: new Date()
            }
          );
        }
      } catch (notificationError) {
        console.warn('⚠️ Failed to send notification:', notificationError);
      }

      await fetchCustomers();
    } catch (error) {
      setTransactionError(error.message || 'Failed to create transaction');
      throw error;
    } finally {
      setTransactionLoading(false);
    }
  };

  if (!user || !isAdmin) {
    navigate('/');
    return null;
  }

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

      <TransactionForm
        customers={customers}
        onSubmit={createTransaction}
        loading={transactionLoading}
        error={transactionError}
      />

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Customer Accounts
        </Typography>
        <CustomerList
          customers={customers}
          customerBalances={customerBalances}
          lastTransactionDates={lastTransactionDates}
          onSendStatement={handleSendIndividualStatement}
          onViewTransactions={(userId) => navigate(`/account/${userId}`)}
          onCustomerClick={(userId) => navigate(`/account/${userId}`)}
        />
      </Paper>

      <SystemConfiguration
        config={systemConfig}
        onConfigChange={(key, value) => setSystemConfig(prev => ({ ...prev, [key]: value }))}
        onSave={updateSystemConfig}
        loading={configLoading}
        error={configError}
        onToggleChange={updateRegistrationSetting}
        toggleSaving={toggleSaving}
        toggleStatus={toggleStatus}
      />

      <AdminJobs
        onSetupAdmin={handleSetupAdmin}
        onCalculateInterest={handleCalculateInterest}
        onGenerateStatements={handleGenerateStatements}
        loading={jobsLoading}
        error={jobError}
        results={jobResults}
      />
    </Container>
  );
};

export default AdminPanel;
