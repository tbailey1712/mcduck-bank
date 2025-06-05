import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';
import { Box, Button, Typography, Container, Paper, Alert, Chip } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { setError, clearError } from '../store/slices/authSlice';
// import { usePWA } from '../hooks/usePWA';
// Use direct import path to avoid chunk splitting issues
import GetAppIcon from '@mui/icons-material/GetApp';
// BuildInfo temporarily disabled due to chunk loading issues
// import BuildInfo from '../components/BuildInfo';

const AuthPage = () => {
  const { isAuthenticated, isAdmin, user, loading, error } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Temporarily disable PWA functionality to test chunk loading
  // const { isInstallable, isInstalled, installApp } = usePWA();
  const isInstallable = false;
  const isInstalled = false;
  const installApp = () => console.log('PWA install disabled');

  useEffect(() => {
    console.log('🔄 AuthPage state check:', {
      isAuthenticated,
      isAdmin,
      userUid: user?.uid,
      loading,
      shouldRedirect: isAuthenticated && !loading
    });
    
    if (isAuthenticated && !loading) {
      const redirectUrl = isAdmin ? '/admin' : `/account/${user?.uid}`;
      console.log('🚀 Redirecting to:', redirectUrl);
      navigate(redirectUrl);
    }
  }, [isAuthenticated, isAdmin, user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      dispatch(clearError());
      console.log('🔐 Starting Google sign-in process...');
      console.log('🌐 Current origin:', window.location.origin);
      
      const provider = new GoogleAuthProvider();
      
      // Only set redirect_uri if not the same as current origin
      const customParams = { prompt: 'select_account' };
      
      provider.setCustomParameters(customParams);
      console.log('🔧 OAuth provider configured with params:', customParams);
      
      const result = await signInWithPopup(getAuth(), provider);
      console.log('✅ Sign-in successful:', result.user.email);
      // Auth state will be updated automatically via the listener in authSlice
      // If user is not authorized, they will be signed out and an error will be shown
    } catch (err) {
      console.error('❌ Login error details:', {
        code: err.code,
        message: err.message,
        customData: err.customData,
        stack: err.stack
      });
      
      if (err.code === 'auth/popup-closed-by-user') {
        dispatch(setError({ message: 'Sign-in was cancelled' }));
      } else if (err.code === 'auth/invalid-api-key') {
        dispatch(setError({ message: 'Firebase API key is invalid' }));
      } else if (err.code === 'auth/network-request-failed') {
        dispatch(setError({ message: 'Network error. Please check your connection.' }));
      } else if (err.code === 'auth/too-many-requests') {
        dispatch(setError({ message: 'Too many requests. Please try again later.' }));
      } else {
        dispatch(setError({ 
          message: `Authentication failed: ${err.code || 'Unknown error'}`, 
          error: err.message 
        }));
      }
    }
  };



  return (
    <>
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, mt: { xs: 10, sm: 8, md: 9 } }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to McDuck Bank
          </Typography>
          <Typography variant="body1" gutterBottom>
            Sign in with your Google account to continue
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {error.message || 'Authentication failed'}
            </Alert>
          )}
          
          {/* PWA Install Prompt */}
          {isInstallable && !isInstalled && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <Chip
                icon={<GetAppIcon />}
                label="Install as App"
                onClick={installApp}
                variant="outlined"
                color="primary"
                sx={{ width: '100%', py: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                Add to home screen for a native app experience
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 4 }}>
            {loading ? (
              <Typography variant="body2" color="textSecondary">
                Checking authentication...
              </Typography>
            ) : (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                Sign in with Google
              </Button>
            )}
          </Box>

          {/* Build Info */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Version {process.env.REACT_APP_BUILD_NUMBER || 'Unknown'}
            </Typography>
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              {process.env.REACT_APP_BUILD_DATE ? 
                new Date(process.env.REACT_APP_BUILD_DATE).toLocaleDateString() : 
                'Build date unknown'
              }
            </Typography>
          </Box>
        </Paper>
      </Container>
      
      {/* Small build number in corner for reference - Temporarily disabled */}
      {/* <BuildInfo showDetailed={false} /> */}
    </>
  );
};

export default AuthPage;
