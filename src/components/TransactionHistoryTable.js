import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  Typography, 
  Card, 
  CardContent, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip
} from '@mui/material';
import { formatCurrency } from '../utils/formatUtils';
import { format } from 'date-fns';
import { generateTransactionKey } from '../utils/keyGeneration';

const TransactionHistoryTable = React.memo(({ transactions, isLoading }) => {
  // Memoize utility functions (must be at top level)
  const getTransactionTypeDisplay = useMemo(() => {
    return (transaction) => {
      const type = transaction.transaction_type || transaction.transactionType;
      if (!type) return '-';
      
      return type.charAt(0).toUpperCase() + type.slice(1);
    };
  }, []);

  const getTransactionColor = useMemo(() => {
    return (transaction) => {
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
    };
  }, []);

  // Memoize sorted transactions to avoid re-sorting on every render
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Transactions
          </Typography>
          <Typography>Loading transactions...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Transactions
        </Typography>
        {transactions.length === 0 ? (
          <Typography color="text.secondary">
            No transactions found
          </Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTransactions.map((transaction, index) => (
                  <TableRow key={generateTransactionKey(transaction, index)}>
                    <TableCell>
                      {format(transaction.timestamp, 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getTransactionTypeDisplay(transaction)}
                        color={getTransactionColor(transaction)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      {transaction.comment || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
});

TransactionHistoryTable.displayName = 'TransactionHistoryTable';

TransactionHistoryTable.propTypes = {
  transactions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      timestamp: PropTypes.instanceOf(Date).isRequired,
      transaction_type: PropTypes.string,
      transactionType: PropTypes.string,
      amount: PropTypes.number.isRequired,
      comment: PropTypes.string,
    })
  ),
  isLoading: PropTypes.bool,
};

TransactionHistoryTable.defaultProps = {
  transactions: [],
  isLoading: false,
};

export default TransactionHistoryTable;