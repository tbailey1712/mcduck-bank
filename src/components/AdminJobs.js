import React from 'react';
import { Card, CardContent, Typography, Grid, Button, Alert } from '@mui/material';

const AdminJobs = ({ onSetupAdmin, onCalculateInterest, onGenerateStatements, loading, error, results }) => (
  <Card sx={{ mb: 4 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Cloud Function Jobs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Trigger automated banking operations via cloud functions
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {results && (
        <Alert 
          severity="success" 
          sx={{ mb: 2 }}
          onClose={() => {}}
        >
          <Typography variant="subtitle2">
            {results.type === 'interest' ? 'Interest Calculation' : 
             results.type === 'individual_statement' ? `Individual Statement for ${results.customerEmail}` :
             'Statement Generation'} Completed
          </Typography>
          <Typography variant="body2">
            Processed: {results.totalProcessed} accounts
            {results.type === 'interest' && (
              <>
                <br />Total Interest Paid: ${results.totalInterestPaid?.toFixed(2) || '0.00'}
                <br />Already Paid This Month: {results.alreadyPaid || 0}
              </>
            )}
            {(results.type === 'statements' || results.type === 'individual_statement') && (
              <>
                <br />Emails Sent: {results.emailsSent || 0}
                {results.emailErrors > 0 && (
                  <>
                    <br />Email Errors: {results.emailErrors}
                  </>
                )}
              </>
            )}
            {results.errors?.length > 0 && (
              <>
                <br />Errors: {results.errors.length}
              </>
            )}
          </Typography>
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            variant="contained"
            color="warning"
            onClick={onSetupAdmin}
            disabled={loading}
            fullWidth
            sx={{ mb: 1 }}
          >
            {loading ? 'Processing...' : 'Setup Admin Privileges'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            One-time setup to grant admin privileges to current user
          </Typography>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Button
            variant="contained"
            color="primary"
            onClick={onCalculateInterest}
            disabled={loading}
            fullWidth
            sx={{ mb: 1 }}
          >
            {loading ? 'Processing...' : 'Calculate Monthly Interest'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Pays interest to all eligible accounts (notifications sent via monthly statements)
          </Typography>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Button
            variant="contained"
            color="secondary"
            onClick={onGenerateStatements}
            disabled={loading}
            fullWidth
            sx={{ mb: 1 }}
          >
            {loading ? 'Processing...' : 'Send Monthly Statements'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Generates and emails monthly statements to all customers
          </Typography>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

export default AdminJobs;