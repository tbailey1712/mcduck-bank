import React from 'react';
import { render, screen } from '../../utils/test-utils';
import AccountSummaryCard from '../AccountSummaryCard';
import { mockTransactionSummary } from '../../utils/test-utils';

describe('AccountSummaryCard', () => {
  const defaultProps = {
    transactionSummary: mockTransactionSummary,
    isLoading: false,
  };

  test('renders account summary information correctly', () => {
    render(<AccountSummaryCard {...defaultProps} />);
    
    expect(screen.getByText('Account Summary')).toBeInTheDocument();
    expect(screen.getByText('Current Balance')).toBeInTheDocument();
    expect(screen.getByText('$125.25')).toBeInTheDocument();
  });

  test('displays transaction totals correctly', () => {
    render(<AccountSummaryCard {...defaultProps} />);
    
    expect(screen.getByText('Total Deposits')).toBeInTheDocument();
    expect(screen.getByText('$100.50')).toBeInTheDocument();
    
    expect(screen.getByText('Total Withdrawals')).toBeInTheDocument();
    expect(screen.getByText('$50.25')).toBeInTheDocument();
    
    expect(screen.getByText('Service Charges')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    
    expect(screen.getByText('Interest Earned')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  test('shows loading state when isLoading is true', () => {
    render(<AccountSummaryCard {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading account summary...')).toBeInTheDocument();
  });

  test('handles missing transaction summary gracefully', () => {
    render(<AccountSummaryCard {...defaultProps} transactionSummary={null} />);
    
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getAllByText('$0.00')).toHaveLength(5); // All values should be $0.00
  });

  test('handles partial transaction summary data', () => {
    const partialSummary = {
      balance: 50.00,
      deposits: 50.00,
      // Missing other fields
    };
    
    render(<AccountSummaryCard {...defaultProps} transactionSummary={partialSummary} />);
    
    expect(screen.getByText('$50.00')).toBeInTheDocument(); // Balance and deposits
    expect(screen.getAllByText('$0.00')).toHaveLength(3); // Other missing fields
  });

  test('displays proper currency formatting', () => {
    const summaryWithDecimals = {
      balance: 1234.56,
      deposits: 999.99,
      withdrawals: 123.45,
      serviceCharges: 12.34,
      interests: 5.67,
    };
    
    render(<AccountSummaryCard {...defaultProps} transactionSummary={summaryWithDecimals} />);
    
    expect(screen.getByText('$1234.56')).toBeInTheDocument();
    expect(screen.getByText('$999.99')).toBeInTheDocument();
    expect(screen.getByText('$123.45')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(screen.getByText('$5.67')).toBeInTheDocument();
  });

  test('handles negative balance appropriately', () => {
    const negativeBalanceSummary = {
      ...mockTransactionSummary,
      balance: -50.25,
    };
    
    render(<AccountSummaryCard {...defaultProps} transactionSummary={negativeBalanceSummary} />);
    
    expect(screen.getByText('-$50.25')).toBeInTheDocument();
  });

  test('displays correct net activity calculation', () => {
    const summary = {
      balance: 100.00,
      deposits: 200.00,
      withdrawals: 75.00,
      serviceCharges: 15.00,
      interests: 10.00,
    };
    
    render(<AccountSummaryCard {...defaultProps} transactionSummary={summary} />);
    
    // Net activity should be deposits + interests - withdrawals - serviceCharges
    // 200 + 10 - 75 - 15 = 120
    expect(screen.getByText('Net Activity')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
  });
});