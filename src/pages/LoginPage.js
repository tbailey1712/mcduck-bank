import { Box, Button, Typography, Paper, Alert } from '@mui/material';
import { Google } from '@mui/icons-material';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import { useState } from 'react';

export default function LoginPage() {
  const { signInWithGoogle, error } = useUnifiedAuth();
  const [loginError, setLoginError] = useState('');

  const handleLogin = async () => {
    try {
      setLoginError('');
      await signInWithGoogle();
      // Navigation will be handled automatically by the auth system
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError(error.message || 'Sign in failed. Please try again.');
    }
  };

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4 }}>
        <img src="/logo512.png" alt="McDuck Bank Logo" width={80} style={{ marginBottom: '1rem' }} />
        <Typography variant="h5" color="text.primary" gutterBottom>
          Welcome to McDuck Bank
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Secure family banking
        </Typography>
        
        {(error || loginError) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {loginError || error?.message || 'Authentication failed'}
          </Alert>
        )}
        
        <Button variant="contained" startIcon={<Google />} onClick={handleLogin}>
          Sign in with Google
        </Button>
        
        {/* Version Info */}
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Version {process.env.REACT_APP_BUILD_NUMBER || 'Unknown'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {process.env.REACT_APP_BUILD_DATE ? 
              new Date(process.env.REACT_APP_BUILD_DATE).toLocaleDateString() : 
              'Build date unknown'
            }
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}