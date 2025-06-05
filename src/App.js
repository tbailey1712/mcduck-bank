import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box, Toolbar, Typography } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
// import ErrorNotification from './components/ErrorNotification';
import { AuthProvider } from './contexts/AuthContext';
import { initializeAuth } from './store/slices/authSlice';
import { initPerformanceMonitoring } from './utils/performance';
import updateService from './services/updateService';
import { selectUser, selectIsAuthenticated, selectIsAdmin, selectAuthLoading } from './store/selectors';

import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import AccountOverview from './pages/AccountOverview';
import SimplifiedAccountOverview from './pages/SimplifiedAccountOverview';
import AdminPanel from './pages/AdminPanel';
import AdminLogs from './pages/AdminLogs';
import Profile from './pages/Profile';
import About from './pages/About';

// Loading component for Suspense fallback
const PageLoader = () => (
  <Box 
    display="flex" 
    justifyContent="center" 
    alignItems="center" 
    height="50vh"
  >
    <CircularProgress />
  </Box>
);

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  // Use memoized selectors for better performance
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin = useSelector(selectIsAdmin);
  const loading = useSelector(selectAuthLoading);
  const dispatch = useDispatch();

  useEffect(() => {
    // Initialize performance monitoring
    initPerformanceMonitoring();
    
    // Initialize authentication
    dispatch(initializeAuth());
    
    // Initialize PWA update service
    updateService.init();
    
    // Cleanup auth listener on unmount
    return () => {
      if (window.authUnsubscribe) {
        window.authUnsubscribe();
      }
    };
  }, [dispatch]);

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          height="100vh"
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AuthProvider>
            {isAuthenticated && <Navbar />}
            <Routes>
              <Route path="/" element={
                isAuthenticated ? (
                  isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />
                ) : (
                  <AuthPage />
                )
              } />
              <Route path="/dashboard" element={
                isAuthenticated ? <Dashboard /> : <Navigate to="/" replace />
              } />
              <Route path="/account" element={
                isAuthenticated ? <AccountOverview /> : <Navigate to="/" replace />
              } />
              <Route path="/account/:user_id" element={
                isAuthenticated ? <SimplifiedAccountOverview /> : <Navigate to="/" replace />
              } />
              <Route path="/admin" element={
                isAuthenticated && isAdmin ? <AdminPanel /> : <Navigate to="/" replace />
              } />
              <Route path="/admin/logs" element={
                isAuthenticated && isAdmin ? <AdminLogs /> : <Navigate to="/" replace />
              } />
              <Route path="/profile" element={
                isAuthenticated ? <Profile /> : <Navigate to="/" replace />
              } />
              <Route path="/about" element={
                isAuthenticated ? <About /> : <Navigate to="/" replace />
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
