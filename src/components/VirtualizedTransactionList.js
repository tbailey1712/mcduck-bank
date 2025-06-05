import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FixedSizeList as List } from 'react-window';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { formatCurrency } from '../utils/formatUtils';
import { format } from 'date-fns';

const TransactionItem = React.memo(({ index, style, data }) => {
  const theme = useTheme();
  const transaction = data[index];

  const getTransactionColor = useCallback((transaction) => {
    const type = transaction.transaction_type || transaction.transactionType;
    switch (type?.toLowerCase()) {
      case 'deposit':
      case 'interest':
        return 'success';
      case 'withdrawal':
      case 'service_charge':
      case 'bankfee':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  const getTransactionTypeDisplay = useCallback((transaction) => {
    const type = transaction.transaction_type || transaction.transactionType;
    if (!type) return 'Unknown';
    
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  }, []);

  const isDebitTransaction = useMemo(() => {
    const type = transaction.transaction_type || transaction.transactionType;
    return ['withdrawal', 'service_charge', 'bankfee'].includes(type?.toLowerCase());
  }, [transaction]);

  return (
    <div style={style}>
      <Box sx={{ px: 2, py: 1 }}>
        <Card 
          variant="outlined" 
          sx={{ 
            borderLeft: `4px solid ${theme.palette[getTransactionColor(transaction)]?.main || theme.palette.grey[400]}`,
            transition: 'box-shadow 0.2s ease-in-out',
            '&:hover': {
              boxShadow: theme.shadows[2]
            }
          }}
        >
          <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={getTransactionTypeDisplay(transaction)}
                  color={getTransactionColor(transaction)}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="body2" color="text.secondary">
                  {format(new Date(transaction.timestamp), 'MMM d, yyyy HH:mm')}
                </Typography>
              </Box>
              <Typography 
                variant="h6" 
                color={isDebitTransaction ? 'error.main' : 'success.main'}
                sx={{ fontWeight: 'bold' }}
              >
                {isDebitTransaction ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
              </Typography>
            </Box>
            
            {transaction.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {transaction.description}
              </Typography>
            )}
            
            {transaction.runningBalance !== undefined && (
              <Typography variant="caption" color="text.secondary">
                Balance: {formatCurrency(transaction.runningBalance)}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </div>
  );
});

TransactionItem.displayName = 'TransactionItem';

const VirtualizedTransactionList = React.memo(({ 
  transactions = [], 
  height = 400,
  isLoading = false 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Sort and memoize transactions
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [transactions]);

  // Calculate item height based on screen size
  const itemHeight = useMemo(() => {
    return isMobile ? 120 : 100;
  }, [isMobile]);

  // Calculate list height based on number of items
  const listHeight = useMemo(() => {
    const maxHeight = height;
    const calculatedHeight = sortedTransactions.length * itemHeight;
    return Math.min(calculatedHeight, maxHeight);
  }, [height, sortedTransactions.length, itemHeight]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transaction History
          </Typography>
          <Typography>Loading transactions...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (sortedTransactions.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transaction History
          </Typography>
          <Typography color="text.secondary">
            No transactions found
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="h6" gutterBottom>
            Transaction History ({sortedTransactions.length})
          </Typography>
        </Box>
        <Divider />
        
        <List
          height={listHeight}
          itemCount={sortedTransactions.length}
          itemSize={itemHeight}
          itemData={sortedTransactions}
          overscanCount={5} // Render 5 extra items outside visible area for smooth scrolling
        >
          {TransactionItem}
        </List>
      </CardContent>
    </Card>
  );
});

VirtualizedTransactionList.displayName = 'VirtualizedTransactionList';

VirtualizedTransactionList.propTypes = {
  transactions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      timestamp: PropTypes.oneOfType([
        PropTypes.instanceOf(Date),
        PropTypes.string,
        PropTypes.number
      ]).isRequired,
      transaction_type: PropTypes.string,
      transactionType: PropTypes.string,
      amount: PropTypes.number.isRequired,
      description: PropTypes.string,
      runningBalance: PropTypes.number,
    })
  ),
  height: PropTypes.number,
  isLoading: PropTypes.bool,
};

export default VirtualizedTransactionList;