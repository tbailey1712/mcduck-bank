import { Box, Button, Typography, Paper } from '@mui/material';
import { Google } from '@mui/icons-material';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';

export default function LoginPage() {
  const { signInWithGoogle } = useUnifiedAuth();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // Navigation will be handled automatically by the auth system
    } catch (error) {
      console.error('Login failed:', error);
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
          Secure family banking for grown-up kids
        </Typography>
        <Button variant="contained" startIcon={<Google />} onClick={handleLogin}>
          Sign in with Google
        </Button>
      </Paper>
    </Box>
  );
}