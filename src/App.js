import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import theme from './config/darkTheme';
import { useUnifiedAuth } from './contexts/UnifiedAuthProvider';
import ErrorBoundary from './components/ErrorBoundary';

import AuthPage from './pages/AuthPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AccountOverview from './pages/AccountOverview';
import SimplifiedAccountOverview from './pages/SimplifiedAccountOverview';
import AdminPanel from './pages/AdminPanel';
import AdminLogs from './pages/AdminLogs';
import WithdrawalPage from './pages/WithdrawalPage';
import AdminRequestsPage from './pages/AdminRequestsPage';
import MessagesPage from './pages/MessagesPage';
import ForceUpdatePage from './pages/ForceUpdatePage';
import Profile from './pages/Profile';
import About from './pages/About';
import BottomNav from './components/BottomNav';
import Navbar from './components/Navbar';

function App() {
  const { isAuthenticated, isAdmin, loading } = useUnifiedAuth();

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
          {isAuthenticated && <Navbar />}
          <div style={{ paddingTop: isAuthenticated ? '64px' : '0', paddingBottom: isAuthenticated ? '80px' : '0' }}>
            <Routes>
              <Route path="/" element={
                isAuthenticated ? (
                  isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/account" replace />
                ) : (
                  <LoginPage />
                )
              } />
              <Route path="/auth" element={
                isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
              } />
              <Route path="/dashboard" element={
                isAuthenticated ? <Dashboard /> : <Navigate to="/" replace />
              } />
              <Route path="/withdrawal" element={
                isAuthenticated ? <WithdrawalPage /> : <Navigate to="/" replace />
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
              <Route path="/admin/requests" element={
                isAuthenticated && isAdmin ? <AdminRequestsPage /> : <Navigate to="/" replace />
              } />
              <Route path="/admin/logs" element={
                isAuthenticated && isAdmin ? <AdminLogs /> : <Navigate to="/" replace />
              } />
              <Route path="/admin/messages" element={
                isAuthenticated && isAdmin ? <MessagesPage /> : <Navigate to="/" replace />
              } />
              <Route path="/profile" element={
                isAuthenticated ? <Profile /> : <Navigate to="/" replace />
              } />
              <Route path="/about" element={
                isAuthenticated ? <About /> : <Navigate to="/" replace />
              } />
              <Route path="/forceupdate" element={<ForceUpdatePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          {isAuthenticated && <BottomNav />}
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
