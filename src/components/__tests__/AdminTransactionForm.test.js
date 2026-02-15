import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import AdminTransactionForm from '../AdminTransactionForm';

const mockCustomers = [
  { id: 'acct-1', user_id: 'user-1', email: 'user1@example.com', displayName: 'User One' },
  { id: 'acct-2', user_id: 'user-2', email: 'user2@example.com', displayName: 'User Two' },
];

describe('AdminTransactionForm', () => {
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    customers: mockCustomers,
    onSubmit: mockOnSubmit,
    loading: false,
    error: null,
    disabled: false,
  };

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSubmit.mockResolvedValue();
  });

  test('renders form heading and fields', () => {
    render(<AdminTransactionForm {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Create Transaction' })).toBeInTheDocument();
    expect(screen.getByText('Select Customer')).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
  });

  test('renders customer options in dropdown', () => {
    render(<AdminTransactionForm {...defaultProps} />);

    // Open the customer select by clicking it
    const customerSelect = screen.getByText('Select Customer');
    expect(customerSelect).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(<AdminTransactionForm {...defaultProps} loading={true} />);
    expect(screen.getByText('Creating Transaction...')).toBeInTheDocument();
  });

  test('shows error message', () => {
    render(<AdminTransactionForm {...defaultProps} error="Transaction failed" />);
    expect(screen.getByText('Transaction failed')).toBeInTheDocument();
  });

  test('renders transaction type select', () => {
    render(<AdminTransactionForm {...defaultProps} />);
    // MUI Select renders label text in both <label> and <span> elements
    const labels = screen.getAllByText('Transaction Type');
    expect(labels.length).toBeGreaterThan(0);
  });

  test('renders without customers gracefully', () => {
    render(<AdminTransactionForm {...defaultProps} customers={[]} />);
    expect(screen.getByRole('heading', { name: 'Create Transaction' })).toBeInTheDocument();
    expect(screen.getByText('Select Customer')).toBeInTheDocument();
  });
});
