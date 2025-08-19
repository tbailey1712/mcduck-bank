import React from 'react';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton } from '@mui/material';
import { Visibility, Email } from '@mui/icons-material';
import { formatCurrency } from '../utils/formatUtils';
import { format } from 'date-fns';

const CustomerList = ({ customers, customerBalances, lastTransactionDates, onSendStatement, onViewTransactions, onCustomerClick }) => (
  <TableContainer>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Customer Name</TableCell>
          <TableCell>Email Address</TableCell>
          <TableCell>Account Balance</TableCell>
          <TableCell>Last Transaction</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <Button
                variant="text"
                onClick={() => onCustomerClick(customer.user_id)}
                sx={{ textTransform: 'none' }}
              >
                {customer.displayName || customer.name || 'No name set'}
              </Button>
            </TableCell>
            <TableCell>{customer.email || customer.id}</TableCell>
            <TableCell>{formatCurrency(customerBalances[customer.id] || 0)}</TableCell>
            <TableCell>
              {lastTransactionDates[customer.id] ? 
                format(new Date(lastTransactionDates[customer.id]), 'MMM d, yyyy HH:mm') : 
                'No transactions'
              }
            </TableCell>
            <TableCell>
              <IconButton
                size="small"
                onClick={() => onViewTransactions(customer.user_id)}
                title="View Transactions"
                sx={{ mr: 1 }}
              >
                <Visibility />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => onSendStatement(customer.email)}
                title="Send Monthly Statement"
                disabled={!customer.email}
              >
                <Email />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export default CustomerList;