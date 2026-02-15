import React from 'react';
import { render, screen } from '../../utils/test-utils';
import AccountSummaryCard from '../AccountSummaryCard';
import { mockTransactionSummary } from '../../utils/test-utils';

describe('AccountSummaryCard', () => {
  const defaultProps = {
    transactionSummary: mockTransactionSummary,
    isLoading: false,
  };

  test('renders account summary heading', () => {
    render(<AccountSummaryCard {...defaultProps} />);
    expect(screen.getByText('Account Summary')).toBeInTheDocument();
  });

  test('displays transaction totals correctly', () => {
    render(<AccountSummaryCard {...defaultProps} />);

    expect(screen.getByText('Total Deposits')).toBeInTheDocument();
    expect(screen.getByText('Total Withdrawals')).toBeInTheDocument();
    expect(screen.getByText('Total Service Charges')).toBeInTheDocument();
    expect(screen.getByText('Total Interest')).toBeInTheDocument();
  });

  test('formats currency values correctly', () => {
    render(<AccountSummaryCard {...defaultProps} />);

    // mockTransactionSummary: deposits=100.50, withdrawals=50.25, serviceCharges=25.00, interests=0
    expect(screen.getByText('$100.50')).toBeInTheDocument();
    expect(screen.getByText('$50.25')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  test('shows loading state when isLoading is true', () => {
    render(<AccountSummaryCard {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Loading account summary...')).toBeInTheDocument();
  });

  test('handles missing transaction summary gracefully', () => {
    render(<AccountSummaryCard {...defaultProps} transactionSummary={null} />);
    // All values should be $0.00 when summary is null
    expect(screen.getAllByText('$0.00')).toHaveLength(4);
  });

  test('handles partial transaction summary data', () => {
    const partialSummary = {
      deposits: 50.00,
      // Missing other fields
    };

    render(<AccountSummaryCard {...defaultProps} transactionSummary={partialSummary} />);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });
});
