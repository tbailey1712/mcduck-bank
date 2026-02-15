import React from 'react';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import WithdrawalForm from '../WithdrawalForm';

// Mock security utils with plain functions to survive resetMocks: true
jest.mock('../../utils/security', () => ({
  sanitizeTransactionData: (data) => data,
  analyzeSecurityRisk: () => ({ safe: true, issues: [] }),
  secureLog: () => {},
}));

describe('WithdrawalForm', () => {
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    onSubmit: mockOnSubmit,
    loading: false,
    error: null,
    userBalance: 1000,
    disabled: false,
  };

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnSubmit.mockResolvedValue();
  });

  test('renders form heading and fields', () => {
    render(<WithdrawalForm {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /Request Withdrawal/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Withdrawal Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason for Withdrawal/)).toBeInTheDocument();
  });

  test('displays user balance when provided', () => {
    render(<WithdrawalForm {...defaultProps} />);
    expect(screen.getByText('Available Balance: $1000.00')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    render(<WithdrawalForm {...defaultProps} loading={true} />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  test('shows error message', () => {
    render(<WithdrawalForm {...defaultProps} error="Withdrawal failed" />);
    expect(screen.getByText('Withdrawal failed')).toBeInTheDocument();
  });

  test('disables form when disabled prop is true', () => {
    render(<WithdrawalForm {...defaultProps} disabled={true} />);
    expect(screen.getByLabelText(/Withdrawal Amount/)).toBeDisabled();
    expect(screen.getByLabelText(/Reason for Withdrawal/)).toBeDisabled();
  });

  test('submits form with valid data', async () => {
    render(<WithdrawalForm {...defaultProps} />);

    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);

    await userEvent.type(amountInput, '100.50');
    await userEvent.type(reasonInput, 'Valid withdrawal reason');

    // Click submit button (not the heading)
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        amount: 100.50,
        reason: 'Valid withdrawal reason',
      });
    });
  });

  test('resets form after successful submission', async () => {
    render(<WithdrawalForm {...defaultProps} />);

    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);

    await userEvent.type(amountInput, '100');
    await userEvent.type(reasonInput, 'Test withdrawal reason');

    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(amountInput.value).toBe('');
      expect(reasonInput.value).toBe('');
    });
  });
});
