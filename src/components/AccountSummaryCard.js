import React from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Card, CardContent } from '@mui/material';
import { formatCurrency } from '../utils/formatUtils';

const AccountSummaryCard = React.memo(({ transactionSummary, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading account summary...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Account Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1">
              Total Deposits
            </Typography>
            <Typography variant="h6">
              {formatCurrency(transactionSummary?.deposits || 0)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1">
              Total Withdrawals
            </Typography>
            <Typography variant="h6">
              {formatCurrency(transactionSummary?.withdrawals || 0)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1">
              Total Service Charges
            </Typography>
            <Typography variant="h6">
              {formatCurrency(transactionSummary?.serviceCharges || 0)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle1">
              Total Interest
            </Typography>
            <Typography variant="h6">
              {formatCurrency(transactionSummary?.interests || 0)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
});

AccountSummaryCard.displayName = 'AccountSummaryCard';

AccountSummaryCard.propTypes = {
  transactionSummary: PropTypes.shape({
    deposits: PropTypes.number,
    withdrawals: PropTypes.number,
    serviceCharges: PropTypes.number,
    interests: PropTypes.number,
  }),
  isLoading: PropTypes.bool,
};

AccountSummaryCard.defaultProps = {
  transactionSummary: null,
  isLoading: false,
};

export default AccountSummaryCard;