import { Grid, Card, CardContent, Typography, Box } from '@mui/material';

const AccountSummaryCards = ({ accountData }) => {
  const summaryData = [
    { 
      label: 'Current Balance', 
      value: accountData?.balance ? `$${accountData.balance.toFixed(2)}` : '$0.00',
      color: 'primary.main'
    },
    { 
      label: 'Total Deposits', 
      value: accountData?.deposits ? `$${accountData.deposits.toFixed(2)}` : '$0.00',
      color: 'success.main'
    },
    { 
      label: 'Total Withdrawals', 
      value: accountData?.withdrawals ? `$${accountData.withdrawals.toFixed(2)}` : '$0.00',
      color: 'error.main'
    },
    { 
      label: 'Interest Paid', 
      value: accountData?.interests ? `$${accountData.interests.toFixed(2)}` : '$0.00',
      color: 'info.main'
    },
    { 
      label: 'Pending Withdrawal', 
      value: accountData?.pendingWithdrawal ? `$${accountData.pendingWithdrawal.toFixed(2)}` : '$0.00',
      color: 'warning.main'
    },
  ];

  return (
    <Box sx={{ padding: 3 }}>
      <Grid container spacing={3}>
        {summaryData.map((item, idx) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} key={idx}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    mt: 1,
                    color: item.color || 'text.primary',
                    fontWeight: 600
                  }}
                >
                  {item.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AccountSummaryCards;