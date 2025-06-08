import { Box, TextField, Button, Paper, Typography } from '@mui/material';
import { useState } from 'react';

export default function SimpleWithdrawalForm({ onSubmit }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ amount: parseFloat(amount), reason: note });
    } else {
      alert(`Request submitted: $${amount} - ${note}`);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Request Withdrawal
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Amount"
          variant="outlined"
          margin="normal"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField
          fullWidth
          label="Note (optional)"
          variant="outlined"
          margin="normal"
          multiline
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button 
          type="submit" 
          variant="contained" 
          sx={{ mt: 2 }}
          disabled={!amount}
        >
          Submit Request
        </Button>
      </Box>
    </Paper>
  );
}