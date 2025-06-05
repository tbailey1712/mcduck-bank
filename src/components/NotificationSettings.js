import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Send as TestIcon,
  Security as SecurityIcon,
  AccountBalance as BankIcon
} from '@mui/icons-material';
import { useNotifications } from '../hooks/useNotifications';

const NotificationSettings = React.memo(() => {
  const {
    permissionStatus,
    isSupported,
    loading,
    error,
    requestPermission,
    sendTestNotification,
    sendServerTestNotification,
    refreshToken,
    isGranted,
    isDenied,
    canRequest
  } = useNotifications();

  const getStatusColor = () => {
    switch (permissionStatus) {
      case 'granted': return 'success';
      case 'denied': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = () => {
    switch (permissionStatus) {
      case 'granted': return 'Enabled';
      case 'denied': return 'Blocked';
      case 'default': return 'Not Set';
      default: return 'Unknown';
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <NotificationsOffIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Push Notifications</Typography>
          </Box>
          <Alert severity="info">
            Push notifications are not supported on this device or browser.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <NotificationsIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Push Notifications</Typography>
          </Box>
          <Chip 
            label={getStatusText()} 
            color={getStatusColor()} 
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Get instant alerts for transactions, security events, and account updates.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {error.includes('VAPID') && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" display="block">
                  <strong>To fix this:</strong>
                </Typography>
                <Typography variant="caption" display="block">
                  1. Go to Firebase Console → Project Settings → Cloud Messaging
                </Typography>
                <Typography variant="caption" display="block">
                  2. Generate Web Push certificates if none exist
                </Typography>
                <Typography variant="caption" display="block">
                  3. Contact your developer to update the VAPID key
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        {canRequest && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Enable notifications to receive real-time banking alerts on this device.
          </Alert>
        )}

        {isDenied && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Notifications are blocked. To enable them, please allow notifications in your browser settings.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {canRequest && (
            <Button
              variant="contained"
              startIcon={<NotificationsIcon />}
              onClick={requestPermission}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Enable Notifications'}
            </Button>
          )}

          {isGranted && (
            <>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={sendTestNotification}
                disabled={loading}
                sx={{ mr: 1 }}
              >
                Client Test
              </Button>
              <Button
                variant="contained"
                startIcon={<BankIcon />}
                onClick={sendServerTestNotification}
                disabled={loading}
                color="secondary"
                sx={{ mr: 1 }}
              >
                Server Test
              </Button>
              <Button
                variant="outlined"
                startIcon={<SecurityIcon />}
                onClick={() => refreshToken()}
                disabled={loading}
                size="small"
              >
                Re-register
              </Button>
            </>
          )}
        </Box>

        {isGranted && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Notification Types
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={<Switch checked={true} disabled />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BankIcon sx={{ mr: 1, fontSize: 16 }} />
                    Transaction Alerts
                  </Box>
                }
              />
              <FormControlLabel
                control={<Switch checked={true} disabled />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SecurityIcon sx={{ mr: 1, fontSize: 16 }} />
                    Security Notifications
                  </Box>
                }
              />
            </Box>
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Notification preferences will be customizable in a future update.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
});

NotificationSettings.displayName = 'NotificationSettings';

export default NotificationSettings;