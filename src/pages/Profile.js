import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Grid, 
  Alert, 
  Divider,
  FormGroup,
  FormControlLabel,
  Switch,
  CircularProgress
} from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getUserData } from '../services/userService';
import auditService, { AUDIT_EVENTS } from '../services/auditService';
import { selectUser } from '../store/selectors';

const Profile = () => {
  const user = useSelector(selectUser);
  
  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    mobile: '',
    preferences: {
      smsNotifications: true,
      emailNotifications: true,
      monthlyStatements: true
    }
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load user profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;
      
      try {
        setLoading(true);
        setError('');
        
        // Use the same getUserData service as AccountOverview
        console.log('📱 Loading profile for user:', user.uid, 'email:', user.email);
        
        // Try to get user data by UID first, then by email (same pattern as AccountOverview)
        let userData = await getUserData(user.uid, user);
        
        if (!userData && user.email) {
          console.log('📱 Trying to load by email:', user.email);
          userData = await getUserData(user.email, user);
        }
        
        if (userData) {
          console.log('📱 Loaded user data:', userData); // Debug log
          setFormData({
            displayName: userData.displayName || user.displayName || '',
            mobile: userData.mobile || '', // Will be empty string if field doesn't exist
            preferences: {
              smsNotifications: userData.preferences?.smsNotifications ?? true,
              emailNotifications: userData.preferences?.emailNotifications ?? true,
              monthlyStatements: userData.preferences?.monthlyStatements ?? true
            }
          });
        } else {
          console.error('❌ No account found for user:', user.uid, user.email);
          throw new Error('Account not found. Please contact an administrator to set up your account.');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Handle form input changes
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle preference changes
  const handlePreferenceChange = useCallback((preference, value) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value
      }
    }));
  }, []);

  // Validate phone number format
  const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  // Save profile changes
  const handleSave = async () => {
    if (!user?.uid) return;

    // Validation
    if (!formData.displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (formData.mobile && !validatePhoneNumber(formData.mobile)) {
      setError('Please enter a valid phone number');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // First, get the current user data to find the correct document ID
      let userData = await getUserData(user.uid, user);
      if (!userData && user.email) {
        userData = await getUserData(user.email, user);
      }
      
      if (!userData) {
        throw new Error('Account not found. Please contact an administrator.');
      }
      
      // Use the document ID from the userData (could be email or uid)
      const docId = userData.id || userData.user_id || user.email;
      console.log('📱 Updating profile document:', docId);
      
      const userRef = doc(db, 'accounts', docId);
      
      // Update only the fields we're managing, add them if they don't exist
      await updateDoc(userRef, {
        displayName: formData.displayName.trim(),
        mobile: formData.mobile.trim(),
        preferences: formData.preferences,
        updatedAt: new Date()
      });

      // Log profile update for audit
      try {
        await auditService.logProfileEvent(
          AUDIT_EVENTS.PROFILE_UPDATED,
          user,
          {
            displayName: formData.displayName.trim(),
            mobile: formData.mobile.trim(),
            preferences: formData.preferences,
            mobile_changed: userData.mobile !== formData.mobile.trim(),
            preferences_changed: JSON.stringify(userData.preferences) !== JSON.stringify(formData.preferences)
          }
        );
      } catch (auditError) {
        console.warn('Failed to log profile update audit event:', auditError);
      }

      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  // Reset form to original values
  const handleReset = useCallback(() => {
    // Reload original data
    const loadProfile = async () => {
      if (!user?.uid) return;
      
      try {
        // Use the same getUserData service
        let userData = await getUserData(user.uid, user);
        if (!userData && user.email) {
          userData = await getUserData(user.email, user);
        }
        
        if (userData) {
          setFormData({
            displayName: userData.displayName || user.displayName || '',
            mobile: userData.mobile || '',
            preferences: {
              smsNotifications: userData.preferences?.smsNotifications ?? true,
              emailNotifications: userData.preferences?.emailNotifications ?? true,
              monthlyStatements: userData.preferences?.monthlyStatements ?? true
            }
          });
        } else {
          throw new Error('Account not found. Please contact an administrator.');
        }
      } catch (error) {
        console.error('Error resetting profile:', error);
      }
    };

    loadProfile();
    setError('');
    setSuccess('');
  }, [user]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: { xs: 10, sm: 8, md: 9 } }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading profile...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Profile Settings
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Update your personal information and notification preferences
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={4}>
          {/* Personal Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Display Name"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  required
                  helperText="This name will be displayed in your account"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.mobile}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  helperText="Used for SMS notifications and account security"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={user?.email || ''}
                  disabled
                  helperText="Email address cannot be changed. Contact support if needed."
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Notification Preferences */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Notification Preferences
            </Typography>
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.preferences.smsNotifications}
                    onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                  />
                }
                label="SMS Notifications"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1, mb: 2 }}>
                Receive text messages for important account activities
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.preferences.emailNotifications}
                    onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                  />
                }
                label="Email Notifications"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1, mb: 2 }}>
                Receive email alerts for transactions and account updates
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.preferences.monthlyStatements}
                    onChange={(e) => handlePreferenceChange('monthlyStatements', e.target.checked)}
                  />
                }
                label="Monthly Statements"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                Receive monthly account statements via email
              </Typography>
            </FormGroup>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={saving}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : null}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default Profile;