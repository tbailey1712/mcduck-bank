import React, { useEffect, useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import config from '../config/environment';

const Navbar = React.memo(() => {
  const { isAuthenticated, isAdmin, user } = useUnifiedAuth();
  const navigate = useNavigate();
  const [buildInfo, setBuildInfo] = useState(null);

  // Load build info if configured to show build number
  useEffect(() => {
    if (config.ui.navbar.showBuildNumber) {
      fetch('/build-info.json')
        .then(response => response.json())
        .then(data => setBuildInfo(data))
        .catch(error => console.warn('Could not load build info:', error));
    }
  }, []);

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
        <Box 
          sx={{ 
            flexGrow: 1, 
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start'
          }}
          onClick={() => navigate(isAuthenticated ? (isAdmin ? '/admin' : `/account/${user?.uid}`) : '/auth')}
        >
          <Typography 
            variant="h6" 
            component="div"
            sx={{ 
              fontWeight: 600,
              color: 'primary.main'
            }}
          >
            {config.app.name}
          </Typography>
          {config.ui.navbar.showBuildNumber && buildInfo && (
            <Typography 
              variant="caption"
              sx={{ 
                fontSize: '0.7rem',
                color: 'text.secondary',
                lineHeight: 1
              }}
            >
              Build {buildInfo.buildNumber}
            </Typography>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;