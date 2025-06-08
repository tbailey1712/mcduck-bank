import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  TextField
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ValidatedTextField from './ValidatedTextField';
import {
  validatePositiveNumber,
  validateSafeText,
  validateRequired,
  validateForm
} from '../utils/validation';

/**
 * Admin transaction form with comprehensive validation
 */
const AdminTransactionForm = ({
  customers = [],
  onSubmit,
  loading = false,
  error = null,
  disabled = false
}) => {
  const [formData, setFormData] = useState({
    selectedCustomer: '',
    transactionType: 'deposit',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
  });
  const [formErrors, setFormErrors] = useState({});

  // Validation rules
  const validationRules = {
    selectedCustomer: [
      (value) => validateRequired(value)
    ],
    amount: [
      (value) => validatePositiveNumber(value, { 
        min: 0.01, 
        max: 1000000, 
        required: true 
      })
    ],
    description: [
      (value) => validateSafeText(value, { 
        min: 1, 
        max: 200, 
        required: false 
      })
    ]
  };

  // Handle input changes
  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field if it exists
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle customer selection change
  const handleCustomerChange = (event) => {
    const customerId = event.target.value;
    setFormData(prev => ({
      ...prev,
      selectedCustomer: customerId,
      amount: '' // Clear amount when customer changes
    }));

    // Clear customer selection error
    if (formErrors.selectedCustomer) {
      setFormErrors(prev => ({
        ...prev,
        selectedCustomer: ''
      }));
    }
  };

  // Validate entire form
  const validateFormData = () => {
    const errors = validateForm(formData, validationRules);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateFormData()) {
      return;
    }

    const selectedCustomerData = customers.find(c => c.user_id === formData.selectedCustomer);
    
    try {
      await onSubmit({
        userId: formData.selectedCustomer,
        userEmail: selectedCustomerData?.email,
        amount: parseFloat(formData.amount),
        transactionType: formData.transactionType,
        description: formData.description.trim() || undefined,
        date: formData.date
      });
      
      // Reset form on successful submission
      setFormData({
        selectedCustomer: '',
        transactionType: 'deposit',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      setFormErrors({});
    } catch (err) {
      console.error('Transaction submission error:', err);
    }
  };

  // Check if form is valid for submission
  const isFormValid = formData.selectedCustomer && 
                     formData.amount && 
                     Object.keys(formErrors).length === 0;

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Create Transaction
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth error={Boolean(formErrors.selectedCustomer)}>
            <InputLabel shrink={Boolean(formData.selectedCustomer)}>
              {formData.selectedCustomer ? 'Customer' : ''}
            </InputLabel>
            <Select
              value={formData.selectedCustomer}
              onChange={handleCustomerChange}
              disabled={loading || disabled}
              displayEmpty
            >
              <MenuItem value="" disabled>
                Select Customer
              </MenuItem>
              {customers.map(customer => (
                <MenuItem key={customer.id} value={customer.user_id}>
                  {customer.displayName || customer.name || customer.email?.split('@')[0] || 'Unknown'}
                </MenuItem>
              ))}
            </Select>
            {formErrors.selectedCustomer && (
              <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                {formErrors.selectedCustomer}
              </Typography>
            )}
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={3}>
          <TextField
            label="Date"
            type="date"
            value={formData.date}
            onChange={handleInputChange('date')}
            fullWidth
            disabled={loading || disabled}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={3}>
          <ValidatedTextField
            label="Amount"
            value={formData.amount}
            onChange={handleInputChange('amount')}
            validator={validationRules.amount[0]}
            type="number"
            required
            disabled={loading || disabled}
            startAdornment={<AttachMoneyIcon />}
            placeholder="0.00"
          />
        </Grid>
        
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth>
            <InputLabel>Transaction Type</InputLabel>
            <Select
              value={formData.transactionType}
              onChange={handleInputChange('transactionType')}
              label="Transaction Type"
              disabled={loading || disabled}
            >
              <MenuItem value="deposit">Deposit</MenuItem>
              <MenuItem value="withdrawal">Withdrawal</MenuItem>
              <MenuItem value="withdrawal_request">Withdrawal Request</MenuItem>
              <MenuItem value="service_charge">Service Charge</MenuItem>
              <MenuItem value="interest">Interest</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <ValidatedTextField
            label="Description (Optional)"
            value={formData.description}
            onChange={handleInputChange('description')}
            validator={validationRules.description[0]}
            disabled={loading || disabled}
            placeholder="Optional description for this transaction"
            helperText="Maximum 200 characters"
          />
        </Grid>
        
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={loading || disabled || !isFormValid}
            fullWidth
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Creating Transaction...' : 'Create Transaction'}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

AdminTransactionForm.propTypes = {
  customers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      user_id: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      name: PropTypes.string,
    })
  ),
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  disabled: PropTypes.bool,
};

export default AdminTransactionForm;