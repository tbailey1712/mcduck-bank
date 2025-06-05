import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Avatar, Card, CardContent } from '@mui/material';
import { useSelector } from 'react-redux';
import { formatCurrency } from '../utils/formatUtils';

const UserProfileCard = React.memo(({ userData, transactionSummary, isLoading }) => {
  // Get auth user data for profile photo fallback
  const authUser = useSelector((state) => state.auth.user);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading user data...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!userData) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Unable to load user data</Typography>
        </CardContent>
      </Card>
    );
  }

  // Use userData for profile display (the customer being viewed)
  // Don't fall back to authUser photo when viewing different customers
  const isViewingSelf = userData?.user_id === authUser?.uid || userData?.email === authUser?.email;
  const photoURL = userData?.photoURL || (isViewingSelf ? authUser?.photoURL : null);
  const displayName = userData?.displayName || userData?.name || userData?.email?.split('@')[0] || 'User';

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Avatar 
            src={photoURL}
            alt={displayName}
            sx={{ width: 100, height: 100, fontSize: '2.5rem' }}
          >
            {!photoURL && (displayName?.[0]?.toUpperCase() || 'U')}
          </Avatar>
          <Typography variant="h5" component="h2" sx={{ mt: 2 }}>
            {displayName}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {userData?.email}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Last Login: {userData?.lastLogin?.toDate?.()?.toLocaleString() || 'Never'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Administrator: {userData?.administrator ? 'Yes' : 'No'}
          </Typography>
        </Box>
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Account Balance
        </Typography>
        <Typography variant="h4" component="div">
          {formatCurrency(transactionSummary?.balance || 0)}
        </Typography>
      </CardContent>
    </Card>
  );
});

UserProfileCard.displayName = 'UserProfileCard';

UserProfileCard.propTypes = {
  userData: PropTypes.shape({
    displayName: PropTypes.string,
    email: PropTypes.string,
    photoURL: PropTypes.string,
    user_id: PropTypes.string,
    administrator: PropTypes.bool,
    lastLogin: PropTypes.object,
  }),
  transactionSummary: PropTypes.shape({
    balance: PropTypes.number,
    deposits: PropTypes.number,
    withdrawals: PropTypes.number,
    serviceCharges: PropTypes.number,
    interests: PropTypes.number,
  }),
  isLoading: PropTypes.bool,
};

UserProfileCard.defaultProps = {
  userData: null,
  transactionSummary: null,
  isLoading: false,
};

export default UserProfileCard;