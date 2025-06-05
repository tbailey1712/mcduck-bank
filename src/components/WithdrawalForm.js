import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Box, 
  Alert,
  CircularProgress 
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ValidatedTextField from './ValidatedTextField';
import { 
  validateWithdrawalAmount, 
  validateTransactionDescription,
  validateForm 
} from '../utils/validation';

/**
 * Withdrawal form component with comprehensive validation
 */
const WithdrawalForm = React.memo(({ 
  onSubmit, 
  loading = false, 
  error = null, 
  userBalance = null,
  disabled = false 
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    reason: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Memoize validation rules to prevent recreating on every render
  const validationRules = useMemo(() => ({
    amount: [
      (value) => validateWithdrawalAmount(value, userBalance)
    ],
    reason: [
      (value) => validateTransactionDescription(value)
    ]
  }), [userBalance]);

  // Memoize input change handlers to prevent child re-renders
  const handleInputChange = useCallback((field) => (event) => {
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
  }, [formErrors]);

  // Memoize form submission handler with validation inside
  const handleSubmit = useCallback(async () => {
    // Move validation inside useCallback to avoid dependency issues
    const validateFormData = () => {
      const errors = validateForm(formData, validationRules);
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    };

    if (!validateFormData()) {
      return;
    }

    try {
      await onSubmit({
        amount: parseFloat(formData.amount),
        reason: formData.reason.trim()
      });
      
      // Reset form on successful submission
      setFormData({ amount: '', reason: '' });
      setFormErrors({});
    } catch (err) {
      // Error handled by parent component
      console.error('Withdrawal submission error:', err);
    }
  }, [formData, onSubmit, validationRules]);

  // Memoize form validity check
  const isFormValid = useMemo(() => {
    return formData.amount && formData.reason && Object.keys(formErrors).length === 0;
  }, [formData.amount, formData.reason, formErrors]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Request Withdrawal
        </Typography>
        
        {userBalance !== null && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Available Balance: ${userBalance.toFixed(2)}
          </Typography>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mt: 2 }}>
          <Box sx={{ mb: 3 }}>
            <ValidatedTextField
              label="Withdrawal Amount"
              value={formData.amount}
              onChange={handleInputChange('amount')}
              validator={validationRules.amount[0]}
              type="number"
              required
              disabled={loading || disabled}
              placeholder="0.00"
              startAdornment={<AttachMoneyIcon />}
              helperText="Enter the amount you wish to withdraw"
            />
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <ValidatedTextField
              label="Reason for Withdrawal"
              value={formData.reason}
              onChange={handleInputChange('reason')}
              validator={validationRules.reason[0]}
              required
              disabled={loading || disabled}
              multiline
              rows={3}
              placeholder="Please provide a reason for this withdrawal..."
              helperText="Minimum 3 characters, maximum 200 characters"
            />
          </Box>
          
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSubmit}
            disabled={loading || disabled || !isFormValid}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Request Withdrawal'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
});

WithdrawalForm.displayName = 'WithdrawalForm';

WithdrawalForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  userBalance: PropTypes.number,
  disabled: PropTypes.bool,
};

export default WithdrawalForm;