/**
 * Admin Debug Info Component
 * Helps debug admin status and set up initial admin user
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  Paper,
  Divider,
  CircularProgress
} from '@mui/material';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAdmin, selectClaims, selectPermissions } from '../store/selectors';
import unifiedAuthService from '../services/unifiedAuthService';

const AdminDebugInfo = () => {
  const user = useSelector(selectUser);
  const isAdmin = useSelector(selectIsAdmin);
  const claims = useSelector(selectClaims);
  const permissions = useSelector(selectPermissions);
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleInitializeAdmin = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      console.log('🔧 Attempting to initialize admin user:', email);
      
      // For initial setup, we'll manually set the database field
      // Since you're the first admin, we can bypass the Cloud Function
      if (user?.email === email) {
        // Update the current user's document to have administrator: true
        const { doc, updateDoc, getFirestore } = await import('firebase/firestore');
        const db = getFirestore();
        
        const userDocRef = doc(db, 'accounts', email);
        await updateDoc(userDocRef, {
          administrator: true,
          adminSince: new Date(),
          initialAdmin: true
        });
        
        // Refresh the token to update claims
        await unifiedAuthService.refreshToken();
        
        setMessage(`Successfully set admin privileges for ${email}. Please refresh the page to see changes.`);
        setEmail('');
      } else {
        // Try the Cloud Function for other users
        const success = await unifiedAuthService.initializeAdminUser(email);
        if (success) {
          setMessage(`Successfully initialized admin user for ${email}. Please refresh the page.`);
          setEmail('');
        } else {
          setError('Failed to initialize admin user. Check the console for details.');
        }
      }
    } catch (err) {
      console.error('🔧 Admin initialization error:', err);
      setError(`Error: ${err.message}. Try refreshing the page and logging out/in again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setLoading(true);
    try {
      await unifiedAuthService.refreshToken();
      setMessage('Token refreshed successfully. Admin status should update.');
    } catch (err) {
      setError(`Error refreshing token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, m: 2, maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        🔧 Admin Debug Information
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="primary">
          Current User Info:
        </Typography>
        <Typography variant="body2">
          Email: {user?.email || 'Not logged in'}
        </Typography>
        <Typography variant="body2">
          UID: {user?.uid || 'N/A'}
        </Typography>
        <Typography variant="body2">
          Is Admin (Redux): {isAdmin ? '✅ Yes' : '❌ No'}
        </Typography>
        <Typography variant="body2">
          Database Admin Field: {user?.administrator === true ? '✅ Yes' : '❌ No'}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="primary">
          Firebase Custom Claims:
        </Typography>
        <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
          {JSON.stringify(claims, null, 2)}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="primary">
          Permissions:
        </Typography>
        <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
          {JSON.stringify(permissions, null, 2)}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Initialize Admin User:
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          If you're not seeing admin privileges, use this to set up the initial admin user.
          This only works if no admin users exist yet.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            disabled={loading}
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleInitializeAdmin}
            disabled={loading || !email}
          >
            {loading ? <CircularProgress size={20} /> : 'Initialize Admin'}
          </Button>
        </Box>

        <Button
          variant="outlined"
          onClick={handleRefreshToken}
          disabled={loading}
          sx={{ mr: 1 }}
        >
          Refresh Token
        </Button>
      </Box>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Alert severity="info">
        <Typography variant="body2">
          <strong>Troubleshooting:</strong>
          <br />
          1. If "Is Admin (Redux)" is false but you should be an admin, try initializing admin user above
          <br />
          2. If Firebase custom claims don't show "administrator: true", the claims need to be set
          <br />
          3. After setting claims, you may need to refresh your token or re-login
          <br />
          4. Make sure Firebase Functions are deployed for admin role management
        </Typography>
      </Alert>
    </Paper>
  );
};

export default AdminDebugInfo;