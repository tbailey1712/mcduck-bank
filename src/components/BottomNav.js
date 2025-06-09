import { BottomNavigation, BottomNavigationAction, Paper, Menu, MenuItem, Avatar, Badge, Box } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RequestPageIcon from '@mui/icons-material/RequestPage';
import EmailIcon from '@mui/icons-material/Email';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import withdrawalTaskService from '../services/withdrawalTaskService';
import auditService from '../services/auditService';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, signOut, user } = useUnifiedAuth();
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unviewedSecurityEventsCount, setUnviewedSecurityEventsCount] = useState(0);

  // Subscribe to pending withdrawal requests count for admins
  useEffect(() => {
    if (!isAdmin || !user) return;

    const unsubscribe = withdrawalTaskService.subscribeToAllWithdrawalRequests(
      (requests) => {
        const pendingCount = requests.filter(req => req.status === 'pending').length;
        setPendingRequestsCount(pendingCount);
      },
      'pending'
    );

    return () => unsubscribe();
  }, [isAdmin, user]);

  // Subscribe to unviewed security events count for admins
  useEffect(() => {
    if (!isAdmin || !user) return;

    const fetchSecurityEventsCount = async () => {
      try {
        const count = await auditService.getUnviewedSecurityEventsCount();
        setUnviewedSecurityEventsCount(count);
      } catch (error) {
        console.error('Failed to fetch unviewed security events count:', error);
      }
    };

    // Initial fetch
    fetchSecurityEventsCount();

    // Set up periodic polling (every 30 seconds)
    const interval = setInterval(fetchSecurityEventsCount, 30000);

    return () => clearInterval(interval);
  }, [isAdmin, user]);

  // Determine current tab based on location
  const getCurrentValue = () => {
    const path = location.pathname;
    
    if (!isAdmin) {
      // Regular user navigation: History(0), Withdraw(1)
      if (path.includes('/withdrawal')) return 1;
      return 0; // History tab (account)
    }
    
    // Admin navigation - corrected indices based on actual DOM behavior:
    // History(0), Admin(2), Requests(3), Messages(4)
    switch (path) {
      case '/admin/messages':
        return 4;
      case '/admin/requests':
        return 3;
      case '/admin':
        return 2;
      default:
        if (path.startsWith('/admin/logs')) return 2;
        if (path.includes('/account')) return 0;
        return 0; // Default to History
    }
  };

  const handleNavigation = (event, newValue) => {
    if (!isAdmin) {
      // Regular user: History(0), Withdraw(1)
      switch (newValue) {
        case 0: navigate('/account'); break;
        case 1: navigate('/withdrawal'); break;
      }
      return;
    }
    
    // Admin navigation - corrected mapping based on actual DOM behavior
    switch (newValue) {
      case 0: navigate('/account'); break;        // History
      case 2: navigate('/admin'); break;          // Admin  
      case 3: navigate('/admin/requests'); break; // Requests
      case 4: navigate('/admin/messages'); break; // Messages
    }
  };

  const handleProfileClose = () => {
    setProfileAnchor(null);
  };

  const handleProfile = () => {
    navigate('/profile');
    handleProfileClose();
  };

  const handleAbout = () => {
    navigate('/about');
    handleProfileClose();
  };

  const handleLogs = async () => {
    try {
      // Mark security events as viewed when admin opens logs page
      if (unviewedSecurityEventsCount > 0) {
        await auditService.markSecurityEventsAsViewed();
        setUnviewedSecurityEventsCount(0);
      }
    } catch (error) {
      console.error('Failed to mark security events as viewed:', error);
    }
    
    navigate('/admin/logs');
    handleProfileClose();
  };

  const handleLogout = async () => {
    await signOut();
    handleProfileClose();
  };

  return (
    <>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={getCurrentValue()}
          onChange={handleNavigation}
          sx={{ bgcolor: 'background.paper', position: 'relative' }}
        >
          {/* Always render History first - Index 0 */}
          <BottomNavigationAction label="History" icon={<ReceiptLongIcon />} />
          
          {/* Regular users get Withdraw - Index 1 */}
          {!isAdmin && <BottomNavigationAction label="Withdraw" icon={<AttachMoneyIcon />} />}
          
          {/* Admin users get Admin tabs - Indices 1, 2, 3 */}
          {isAdmin && <BottomNavigationAction label="Admin" icon={<AdminPanelSettingsIcon />} />}
          {isAdmin && (
            <BottomNavigationAction 
              label="Requests" 
              icon={
                <Badge badgeContent={pendingRequestsCount} color="error">
                  <RequestPageIcon />
                </Badge>
              } 
            />
          )}
          {isAdmin && <BottomNavigationAction label="Messages" icon={<EmailIcon />} />}
          
          <Avatar 
            alt="Profile"
            src={user?.photoURL || "/user.jpg"}
            sx={{ 
              position: 'absolute', 
              right: 16, 
              bottom: 8, 
              width: 40, 
              height: 40, 
              cursor: 'pointer',
              border: '2px solid',
              borderColor: 'primary.main'
            }}
            onClick={(e) => setProfileAnchor(e.currentTarget)}
          />
        </BottomNavigation>
      </Paper>

      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={handleProfileClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MenuItem onClick={handleProfile}>My Profile</MenuItem>
        {isAdmin && (
          <MenuItem onClick={handleLogs}>
            <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
              Admin Logs
              {unviewedSecurityEventsCount > 0 && (
                <Badge 
                  badgeContent={unviewedSecurityEventsCount} 
                  color="warning"
                  sx={{ ml: 1 }}
                >
                  <Box />
                </Badge>
              )}
            </Box>
          </MenuItem>
        )}
        <MenuItem onClick={handleAbout}>About</MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </>
  );
}