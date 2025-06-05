import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Snackbar, Alert } from '@mui/material';
import { clearError } from '../store/slices/authSlice';

const ErrorNotification = () => {
  const { error } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    dispatch(clearError());
  };

  return (
    <Snackbar
      open={!!error}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert 
        onClose={handleClose} 
        severity="error" 
        variant="filled"
        sx={{ width: '100%' }}
      >
        {error?.message || 'An unexpected error occurred'}
      </Alert>
    </Snackbar>
  );
};

export default ErrorNotification;