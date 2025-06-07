import { BottomNavigation, BottomNavigationAction, Paper, Menu, MenuItem, Avatar } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BarChartIcon from '@mui/icons-material/BarChart';
import InfoIcon from '@mui/icons-material/Info';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, signOut, user } = useUnifiedAuth();
  const [profileAnchor, setProfileAnchor] = useState(null);

  // Determine current tab based on location
  const getCurrentValue = () => {
    if (location.pathname.includes('/account')) return 0;
    if (location.pathname.includes('/dashboard')) return 1;
    if (location.pathname.includes('/about')) return 2;
    if (location.pathname.includes('/admin') && !location.pathname.includes('/logs')) return 3;
    if (location.pathname.includes('/logs')) return 4;
    return 0; // default to account
  };

  const handleNavigation = (event, newValue) => {
    switch (newValue) {
      case 0:
        navigate('/account');
        break;
      case 1:
        navigate('/dashboard');
        break;
      case 2:
        navigate('/about');
        break;
      case 3:
        if (isAdmin) navigate('/admin');
        break;
      case 4:
        if (isAdmin) navigate('/admin/logs');
        break;
      default:
        break;
    }
  };

  const handleProfileClose = () => {
    setProfileAnchor(null);
  };

  const handleProfile = () => {
    navigate('/profile');
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
          <BottomNavigationAction label="History" icon={<ReceiptLongIcon />} />
          <BottomNavigationAction label="Withdraw" icon={<AttachMoneyIcon />} />
          <BottomNavigationAction label="About" icon={<InfoIcon />} />
          {isAdmin && <BottomNavigationAction label="Admin" icon={<AdminPanelSettingsIcon />} />}
          {isAdmin && <BottomNavigationAction label="Logs" icon={<BarChartIcon />} />}
          
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
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </>
  );
}