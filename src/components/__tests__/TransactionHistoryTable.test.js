import React from 'react';
import { render, screen } from '../../utils/test-utils';
import TransactionHistoryTable from '../TransactionHistoryTable';
import { mockTransactions } from '../../utils/test-utils';

describe('TransactionHistoryTable', () => {
  const defaultProps = {
    transactions: mockTransactions,
    isLoading: false,
  };

  test('renders table heading and column headers', () => {
    render(<TransactionHistoryTable {...defaultProps} />);

    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  test('displays transactions with type chips', () => {
    render(<TransactionHistoryTable {...defaultProps} />);

    // Type is capitalized via charAt(0).toUpperCase() + slice(1)
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal')).toBeInTheDocument();
  });

  test('displays formatted currency amounts', () => {
    render(<TransactionHistoryTable {...defaultProps} />);
    expect(screen.getByText('$100.50')).toBeInTheDocument();
    expect(screen.getByText('$50.25')).toBeInTheDocument();
  });

  test('shows loading state when isLoading is true', () => {
    render(<TransactionHistoryTable {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Loading transactions...')).toBeInTheDocument();
  });

  test('shows empty state when no transactions', () => {
    render(<TransactionHistoryTable {...defaultProps} transactions={[]} />);
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  test('sorts transactions by date in descending order', () => {
    const unsortedTransactions = [
      { id: '1', amount: 50, transaction_type: 'deposit', timestamp: new Date('2024-01-01T12:00:00Z'), comment: 'First' },
      { id: '2', amount: 100, transaction_type: 'deposit', timestamp: new Date('2024-01-03T12:00:00Z'), comment: 'Third' },
      { id: '3', amount: 25, transaction_type: 'withdrawal', timestamp: new Date('2024-01-02T12:00:00Z'), comment: 'Second' },
    ];

    render(<TransactionHistoryTable {...defaultProps} transactions={unsortedTransactions} />);

    const rows = screen.getAllByRole('row');
    // First data row (index 1) should be most recent (Jan 3)
    expect(rows[1]).toHaveTextContent('Third');
    expect(rows[2]).toHaveTextContent('Second');
    expect(rows[3]).toHaveTextContent('First');
  });

  test('shows comment as description or dash when empty', () => {
    const transactions = [
      { id: '1', amount: 100, transaction_type: 'deposit', timestamp: new Date('2024-01-01T12:00:00Z'), comment: 'Test deposit' },
      { id: '2', amount: 50, transaction_type: 'withdrawal', timestamp: new Date('2024-01-02T12:00:00Z') },
    ];

    render(<TransactionHistoryTable {...defaultProps} transactions={transactions} />);

    expect(screen.getByText('Test deposit')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  test('handles different transaction types correctly', () => {
    const variousTransactions = [
      { id: '1', amount: 100, transaction_type: 'deposit', timestamp: new Date('2024-01-01T12:00:00Z') },
      { id: '2', amount: 50, transaction_type: 'withdrawal', timestamp: new Date('2024-01-02T12:00:00Z') },
      { id: '3', amount: 5, transaction_type: 'service_charge', timestamp: new Date('2024-01-03T12:00:00Z') },
      { id: '4', amount: 2.5, transaction_type: 'interest', timestamp: new Date('2024-01-04T12:00:00Z') },
    ];

    render(<TransactionHistoryTable {...defaultProps} transactions={variousTransactions} />);

    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal')).toBeInTheDocument();
    expect(screen.getByText('Service_charge')).toBeInTheDocument();
    expect(screen.getByText('Interest')).toBeInTheDocument();
  });

  test('handles alternative transaction type format', () => {
    const transactionWithAlternativeFormat = [
      { id: '1', amount: 100, transactionType: 'deposit', timestamp: new Date('2024-01-01T12:00:00Z') },
    ];

    render(<TransactionHistoryTable {...defaultProps} transactions={transactionWithAlternativeFormat} />);
    expect(screen.getByText('Deposit')).toBeInTheDocument();
  });

  test('formats dates correctly', () => {
    const transactionWithSpecificDate = [
      { id: '1', amount: 100, transaction_type: 'deposit', timestamp: new Date('2024-03-15T14:30:00Z'), comment: 'test' },
    ];

    render(<TransactionHistoryTable {...defaultProps} transactions={transactionWithSpecificDate} />);

    // Format is 'MMM d, yyyy HH:mm' - UTC time may vary by timezone
    const dateCell = screen.getByText(/Mar 15, 2024/);
    expect(dateCell).toBeInTheDocument();
  });
});
