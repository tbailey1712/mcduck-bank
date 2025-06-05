import React from 'react';
import { render, screen, fireEvent } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import TransactionHistoryTable from '../TransactionHistoryTable';
import { mockTransactions } from '../../utils/test-utils';

describe('TransactionHistoryTable', () => {
  const defaultProps = {
    transactions: mockTransactions,
    isLoading: false,
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders transaction history table correctly', () => {
    render(<TransactionHistoryTable {...defaultProps} />);
    
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });

  test('displays transactions correctly', () => {
    render(<TransactionHistoryTable {...defaultProps} />);
    
    // Check for transaction data
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
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
      {
        id: '1',
        amount: 50,
        transaction_type: 'deposit',
        timestamp: new Date('2024-01-01'),
        runningBalance: 50,
      },
      {
        id: '2',
        amount: 100,
        transaction_type: 'deposit',
        timestamp: new Date('2024-01-03'),
        runningBalance: 150,
      },
      {
        id: '3',
        amount: 25,
        transaction_type: 'withdrawal',
        timestamp: new Date('2024-01-02'),
        runningBalance: 75,
      },
    ];
    
    render(<TransactionHistoryTable {...defaultProps} transactions={unsortedTransactions} />);
    
    const rows = screen.getAllByRole('row');
    // First row is header, so check data rows
    expect(rows[1]).toHaveTextContent('Jan 3, 2024'); // Most recent first
    expect(rows[2]).toHaveTextContent('Jan 2, 2024');
    expect(rows[3]).toHaveTextContent('Jan 1, 2024');
  });

  test('formats currency amounts correctly', () => {
    const transactionWithDecimals = [{
      id: '1',
      amount: 123.456,
      transaction_type: 'deposit',
      timestamp: new Date('2024-01-01'),
      runningBalance: 123.456,
    }];
    
    render(<TransactionHistoryTable {...defaultProps} transactions={transactionWithDecimals} />);
    
    expect(screen.getByText('$123.46')).toBeInTheDocument(); // Rounded to 2 decimal places
  });

  test('handles different transaction types correctly', () => {
    const variousTransactions = [
      {
        id: '1',
        amount: 100,
        transaction_type: 'deposit',
        timestamp: new Date('2024-01-01'),
        runningBalance: 100,
      },
      {
        id: '2',
        amount: 50,
        transaction_type: 'withdrawal',
        timestamp: new Date('2024-01-02'),
        runningBalance: 50,
      },
      {
        id: '3',
        amount: 5,
        transaction_type: 'service_charge',
        timestamp: new Date('2024-01-03'),
        runningBalance: 45,
      },
      {
        id: '4',
        amount: 2.5,
        transaction_type: 'interest',
        timestamp: new Date('2024-01-04'),
        runningBalance: 47.5,
      },
    ];
    
    render(<TransactionHistoryTable {...defaultProps} transactions={variousTransactions} />);
    
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal')).toBeInTheDocument();
    expect(screen.getByText('Service Charge')).toBeInTheDocument();
    expect(screen.getByText('Interest')).toBeInTheDocument();
  });

  test('refresh button works correctly', async () => {
    const user = userEvent.setup();
    const mockOnRefresh = jest.fn();
    
    render(<TransactionHistoryTable {...defaultProps} onRefresh={mockOnRefresh} />);
    
    const refreshButton = screen.getByLabelText('Refresh transactions');
    await user.click(refreshButton);
    
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  test('handles alternative transaction type format', () => {
    const transactionWithAlternativeFormat = [{
      id: '1',
      amount: 100,
      transactionType: 'deposit', // Alternative format
      timestamp: new Date('2024-01-01'),
      runningBalance: 100,
    }];
    
    render(<TransactionHistoryTable {...defaultProps} transactions={transactionWithAlternativeFormat} />);
    
    expect(screen.getByText('Deposit')).toBeInTheDocument();
  });

  test('handles missing transaction data gracefully', () => {
    const incompleteTransactions = [
      {
        id: '1',
        amount: 100,
        // Missing transaction_type
        timestamp: new Date('2024-01-01'),
        runningBalance: 100,
      },
      {
        id: '2',
        // Missing amount
        transaction_type: 'deposit',
        timestamp: new Date('2024-01-02'),
        runningBalance: 100,
      },
    ];
    
    render(<TransactionHistoryTable {...defaultProps} transactions={incompleteTransactions} />);
    
    expect(screen.getByText('Unknown')).toBeInTheDocument(); // Unknown transaction type
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // Missing amount
  });

  test('pagination works correctly when many transactions', () => {
    const manyTransactions = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      amount: 10 * (i + 1),
      transaction_type: 'deposit',
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      runningBalance: 10 * (i + 1),
    }));
    
    render(<TransactionHistoryTable {...defaultProps} transactions={manyTransactions} />);
    
    // Should show pagination controls
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
  });

  test('handles date formatting correctly', () => {
    const transactionWithSpecificDate = [{
      id: '1',
      amount: 100,
      transaction_type: 'deposit',
      timestamp: new Date('2024-03-15T14:30:00Z'),
      runningBalance: 100,
    }];
    
    render(<TransactionHistoryTable {...defaultProps} transactions={transactionWithSpecificDate} />);
    
    expect(screen.getByText('Mar 15, 2024')).toBeInTheDocument();
  });

  test('shows running balance correctly', () => {
    render(<TransactionHistoryTable {...defaultProps} />);
    
    // Check that running balances are displayed
    const balanceCells = screen.getAllByText(/\$\d+\.\d{2}/);
    expect(balanceCells.length).toBeGreaterThan(0);
  });
});