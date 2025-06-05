import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  IconButton, 
  Menu, 
  MenuItem, 
  Avatar, 
  useTheme, 
  useMediaQuery,
  Divider
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  AccountCircle as AccountCircleIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Settings as SettingsIcon,
  Assignment as LogsIcon,
  Logout as LogoutIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser, setError } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

const Navbar = React.memo(() => {
  const { isAuthenticated, isAdmin, userId } = useAuthContext();
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Responsive design
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const open = Boolean(anchorEl);
  const profileMenuOpen = Boolean(profileMenuAnchor);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileMenuOpen = (event) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate('/auth');
      handleMenuClose();
      handleProfileMenuClose();
    } catch (error) {
      console.error('Logout error:', error);
      dispatch(setError({ message: 'Failed to logout', error: error.message }));
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
    handleMenuClose();
    handleProfileMenuClose();
  };

  // Get user's display name and photo
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userPhotoURL = user?.photoURL;
  
  // Debug profile image
  React.useEffect(() => {
    if (user) {
      console.log('👤 Navbar user data:', {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        hasPhotoURL: !!user.photoURL
      });
    }
  }, [user]);

  return (
    <AppBar 
      position="fixed"
      sx={{
        paddingTop: 'env(safe-area-inset-top)',
        // Ensure proper spacing for iOS status bar
        '@supports (padding-top: env(safe-area-inset-top))': {
          paddingTop: 'env(safe-area-inset-top)'
        },
        // Ensure navbar stays on top during scroll
        zIndex: (theme) => theme.zIndex.appBar,
        top: 0,
        left: 0,
        right: 0
      }}
    >
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate(isAuthenticated ? '/account' : '/auth')}
        >
          McDuck Bank
        </Typography>
        
        {isAuthenticated && (
          <>
            {isMobile ? (
              // Mobile: Hamburger menu
              <>
                <IconButton
                  color="inherit"
                  aria-label="menu"
                  onClick={handleMenuOpen}
                  edge="end"
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={open}
                  onClose={handleMenuClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  <MenuItem onClick={() => handleNavigation('/account')}>
                    <PersonIcon sx={{ mr: 1 }} />
                    Account
                  </MenuItem>
                  <MenuItem onClick={() => handleNavigation('/profile')}>
                    <SettingsIcon sx={{ mr: 1 }} />
                    Profile
                  </MenuItem>
                  {isAdmin && (
                    <MenuItem onClick={() => handleNavigation('/admin')}>
                      <AdminIcon sx={{ mr: 1 }} />
                      Admin Panel
                    </MenuItem>
                  )}
                  {isAdmin && (
                    <MenuItem onClick={() => handleNavigation('/admin/logs')}>
                      <LogsIcon sx={{ mr: 1 }} />
                      Audit Logs
                    </MenuItem>
                  )}
                  <MenuItem onClick={() => handleNavigation('/about')}>
                    <InfoIcon sx={{ mr: 1 }} />
                    About
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <LogoutIcon sx={{ mr: 1 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </>
            ) : (
              // Desktop: Regular buttons + profile menu
              <Box display="flex" alignItems="center">
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/account"
                  sx={{ mr: 1 }}
                >
                  Account
                </Button>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/profile"
                  sx={{ mr: 1 }}
                >
                  Profile
                </Button>
                {isAdmin && (
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/admin"
                    sx={{ mr: 1 }}
                  >
                    Admin
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/admin/logs"
                    sx={{ mr: 1 }}
                  >
                    Logs
                  </Button>
                )}
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/about"
                  sx={{ mr: 1 }}
                >
                  About
                </Button>
                
                {/* Profile menu */}
                <IconButton
                  color="inherit"
                  onClick={handleProfileMenuOpen}
                  sx={{ ml: 1 }}
                  aria-label="user menu"
                >
                  {userPhotoURL ? (
                    <Avatar 
                      src={userPhotoURL} 
                      alt={userDisplayName}
                      sx={{ width: 32, height: 32 }}
                    />
                  ) : (
                    <AccountCircleIcon />
                  )}
                </IconButton>
                
                <Menu
                  anchorEl={profileMenuAnchor}
                  open={profileMenuOpen}
                  onClose={handleProfileMenuClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  PaperProps={{
                    sx: { minWidth: 180 }
                  }}
                >
                  <MenuItem disabled>
                    <Box display="flex" flexDirection="column" alignItems="flex-start">
                      <Typography variant="subtitle2" fontWeight="medium">
                        {userDisplayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user?.email}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={() => handleNavigation('/account')}>
                    <PersonIcon sx={{ mr: 1 }} />
                    My Account
                  </MenuItem>
                  <MenuItem onClick={() => handleNavigation('/profile')}>
                    <SettingsIcon sx={{ mr: 1 }} />
                    Profile Settings
                  </MenuItem>
                  {isAdmin && (
                    <MenuItem onClick={() => handleNavigation('/admin')}>
                      <AdminIcon sx={{ mr: 1 }} />
                      Admin Panel
                    </MenuItem>
                  )}
                  {isAdmin && (
                    <MenuItem onClick={() => handleNavigation('/admin/logs')}>
                      <LogsIcon sx={{ mr: 1 }} />
                      Audit Logs
                    </MenuItem>
                  )}
                  <MenuItem onClick={() => handleNavigation('/about')}>
                    <InfoIcon sx={{ mr: 1 }} />
                    About
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <LogoutIcon sx={{ mr: 1 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;
