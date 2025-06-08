import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Box, 
  Chip, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Alert
} from '@mui/material';
import { 
  Info as InfoIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Build as BuildIcon,
  CalendarToday as CalendarIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  CloudDone as CloudIcon
} from '@mui/icons-material';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';

const About = () => {
  const { user } = useUnifiedAuth();
  const [notificationStatus, setNotificationStatus] = useState('checking');
  const [isInstalled, setIsInstalled] = useState(false);
  const [storageUsage, setStorageUsage] = useState(null);

  // Check notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationStatus(Notification.permission);
    } else {
      setNotificationStatus('not-supported');
    }
  }, []);

  // Check if PWA is installed
  useEffect(() => {
    const checkInstallation = () => {
      // Check for standalone mode (iOS)
      const isStandalone = window.navigator.standalone === true;
      // Check for display-mode (Android/Desktop)
      const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsInstalled(isStandalone || isDisplayModeStandalone);
    };

    checkInstallation();
    window.addEventListener('appinstalled', checkInstallation);
    return () => window.removeEventListener('appinstalled', checkInstallation);
  }, []);

  // Check storage usage
  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        setStorageUsage({
          used: Math.round((estimate.usage || 0) / 1024 / 1024 * 100) / 100, // MB
          quota: Math.round((estimate.quota || 0) / 1024 / 1024 / 1024 * 100) / 100 // GB
        });
      });
    }
  }, []);

  const getNotificationStatusChip = () => {
    switch (notificationStatus) {
      case 'granted':
        return <Chip icon={<NotificationsIcon />} label="Enabled" color="success" />;
      case 'denied':
        return <Chip icon={<NotificationsOffIcon />} label="Disabled" color="error" />;
      case 'default':
        return <Chip icon={<NotificationsIcon />} label="Not Set" color="warning" />;
      case 'not-supported':
        return <Chip icon={<NotificationsOffIcon />} label="Not Supported" color="default" />;
      default:
        return <Chip label="Checking..." color="default" />;
    }
  };

  const buildDate = process.env.REACT_APP_BUILD_DATE ? 
    new Date(process.env.REACT_APP_BUILD_DATE).toLocaleString() : 
    'Unknown';

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        About McDuck Bank
      </Typography>

      <Grid container spacing={3}>
        {/* Build Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <BuildIcon sx={{ mr: 1 }} />
                Build Information
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Build Number" 
                    secondary={process.env.REACT_APP_BUILD_NUMBER || 'Unknown'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Build Date" 
                    secondary={buildDate}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ComputerIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Environment" 
                    secondary={
                      window.location.hostname === 'localhost' 
                        ? `Development (${process.env.NODE_ENV} build)`
                        : process.env.NODE_ENV === 'production' ? 'Production' : 'Development'
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* App Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon sx={{ mr: 1 }} />
                App Status
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Push Notifications" 
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {getNotificationStatusChip()}
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CloudIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="PWA Installation" 
                    secondary={
                      <Chip 
                        label={isInstalled ? 'Installed' : 'Browser Mode'} 
                        color={isInstalled ? 'success' : 'default'} 
                      />
                    }
                  />
                </ListItem>
                {storageUsage && (
                  <ListItem>
                    <ListItemIcon>
                      <StorageIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Storage Usage" 
                      secondary={`${storageUsage.used} MB used of ${storageUsage.quota} GB available`}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* User Information */}
        {user && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <InfoIcon sx={{ mr: 1 }} />
                  User Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Email" 
                      secondary={user.email}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Display Name" 
                      secondary={user.displayName || 'Not set'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Account Type" 
                      secondary={
                        <Chip 
                          label={user.administrator || user.isAdmin ? 'Administrator' : 'Standard User'} 
                          color={user.administrator || user.isAdmin ? 'primary' : 'default'} 
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Browser Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <ComputerIcon sx={{ mr: 1 }} />
                Browser Information
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="User Agent" 
                    secondary={navigator.userAgent.substring(0, 80) + '...'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Language" 
                    secondary={navigator.language}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Online Status" 
                    secondary={
                      <Chip 
                        label={navigator.onLine ? 'Online' : 'Offline'} 
                        color={navigator.onLine ? 'success' : 'error'} 
                        size="small"
                      />
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* App Features */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                App Features
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                McDuck Bank is a Progressive Web App (PWA) with offline capabilities and push notifications.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🏦 Account Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      View account balance, transaction history, and manage your profile
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🔔 Push Notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Get notified about important account activities and updates
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      📱 Mobile Optimized
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Responsive design that works great on all devices
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🔒 Secure Authentication
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Firebase-powered authentication with Google sign-in
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      ⚡ Real-time Updates
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Live data synchronization with Firestore database
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      🛠️ Admin Tools
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Administrative panel for managing users and transactions
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default About;