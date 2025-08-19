import React from 'react';
import { Card, CardContent, Typography, Grid, TextField, Button, InputAdornment, FormControlLabel, Switch, Divider, Alert } from '@mui/material';

const SystemConfiguration = ({ config, onConfigChange, onSave, loading, error, onToggleChange, toggleSaving, toggleStatus }) => (
  <Card sx={{ mb: 4 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        System Configuration
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            label="Interest Rate"
            type="number"
            value={config.interest_rate}
            onChange={(e) => onConfigChange('interest_rate', parseFloat(e.target.value) || 0)}
            disabled={loading}
            fullWidth
            inputProps={{
              step: "0.01",
              min: "0",
              max: "100"
            }}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>
            }}
            helperText="Annual interest rate percentage"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => onSave({ interest_rate: config.interest_rate })}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Saving...' : 'Save Interest Rate'}
          </Button>
        </Grid>
      </Grid>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" gutterBottom>
        User Registration Settings
      </Typography>
      
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} sm={8} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={config.allowNewUsers}
                onChange={(e) => onToggleChange(e.target.checked)}
                disabled={toggleSaving}
                color="primary"
              />
            }
            label="Allow New User Registration"
            sx={{ width: '100%' }}
          />
          <Typography variant="caption" color="text.secondary">
            When enabled, new Google OAuth users will be automatically registered if their email exists in accounts. 
            When disabled, new login attempts are logged as warnings and access is denied.
          </Typography>
          
          {toggleSaving && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Saving registration setting...
            </Alert>
          )}
          {toggleStatus === 'success' && (
            <Alert severity="success" sx={{ mt: 1 }}>
              ✅ Registration setting saved successfully!
            </Alert>
          )}
          {toggleStatus === 'error' && (
            <Alert severity="error" sx={{ mt: 1 }}>
              ❌ Failed to save registration setting. Please try again.
            </Alert>
          )}
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

export default SystemConfiguration;