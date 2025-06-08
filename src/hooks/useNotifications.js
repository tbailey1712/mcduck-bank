import { useState, useEffect, useCallback } from 'react';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import notificationService from '../services/notificationService';
import serverNotificationService from '../services/serverNotificationService';

export const useNotifications = () => {
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { user } = useUnifiedAuth();

  useEffect(() => {
    // Initialize notification status
    setIsSupported(notificationService.isNotificationSupported());
    setPermissionStatus(notificationService.getPermissionStatus());
  }, []);

  const requestPermission = useCallback(async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await notificationService.requestPermission();
      
      if (result.success) {
        setPermissionStatus('granted');
        setFcmToken(result.token);
        
        // Save token to database and register device for server notifications
        if (result.token) {
          await notificationService.saveTokenToDatabase(user.uid, result.token);
          await serverNotificationService.registerDevice(user.uid, result.token);
        }
        
        return true;
      } else {
        setError(result.error);
        setPermissionStatus('denied');
        return false;
      }
    } catch (err) {
      setError(err.message);
      setPermissionStatus('denied');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const sendTestNotification = useCallback(async () => {
    try {
      await notificationService.sendTestNotification();
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const sendServerTestNotification = useCallback(async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }
    
    try {
      const result = await serverNotificationService.sendTestNotification(user.uid);
      console.log('🧪 Server test notification result:', result);
    } catch (err) {
      setError(err.message);
    }
  }, [user?.uid]);

  const refreshToken = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Refreshing notification token and re-registering device...');
      const token = await notificationService.getToken();
      if (token) {
        setFcmToken(token);
        await notificationService.saveTokenToDatabase(user.uid, token);
        await serverNotificationService.registerDevice(user.uid, token);
        console.log('✅ Device re-registered successfully');
      }
    } catch (err) {
      console.error('❌ Error refreshing token:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  return {
    permissionStatus,
    isSupported,
    fcmToken,
    loading,
    error,
    requestPermission,
    sendTestNotification,
    sendServerTestNotification,
    refreshToken,
    isGranted: permissionStatus === 'granted',
    isDenied: permissionStatus === 'denied',
    canRequest: permissionStatus === 'default' && isSupported
  };
};