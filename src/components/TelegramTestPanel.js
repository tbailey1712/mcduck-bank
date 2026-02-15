import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Alert,
  CircularProgress 
} from '@mui/material';
import adminCloudFunctions from '../services/adminCloudFunctions';

const TelegramTestPanel = () => {
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleTestTelegram = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const testMessage = `🏦 McDuck Bank Test Notification - ${new Date().toLocaleString()}

This is a test message from your banking notification system. Telegram notifications are working correctly!`;
      const response = await adminCloudFunctions.sendTelegram(testMessage, 'test');
      
      setResult(response);
      setError('');
    } catch (error) {
      console.error('Telegram test failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomTelegram = async () => {
    if (!customMessage.trim()) {
      setError('Message is required');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await adminCloudFunctions.sendTelegram(customMessage, 'admin_test');
      
      setResult(response);
      setError('');
    } catch (error) {
      console.error('Custom Telegram failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        📱 Telegram Notification Test
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Test the Telegram Bot integration. Messages will be sent to the configured admin chat.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={handleTestTelegram}
            disabled={loading}
            size="small"
          >
            {loading ? <CircularProgress size={16} /> : 'Send Test Telegram'}
          </Button>
          
        </Box>

        <TextField
          label="Custom Message"
          multiline
          rows={3}
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Enter custom message to send..."
          fullWidth
          size="small"
        />

        <Button
          variant="outlined"
          onClick={handleCustomTelegram}
          disabled={loading || !customMessage.trim()}
          size="small"
        >
          Send Custom Message
        </Button>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Alert severity="success" sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>✅ Telegram Message Sent Successfully!</strong><br />
              Message ID: {result.messageId}<br />
              Type: {result.type}
            </Typography>
          </Alert>
        )}
      </Box>
    </Paper>
  );
};

export default TelegramTestPanel;