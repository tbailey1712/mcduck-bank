import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import WithdrawalForm from '../WithdrawalForm';

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
  });

  test('renders form elements correctly', () => {
    render(<WithdrawalForm {...defaultProps} />);
    
    expect(screen.getByText('Request Withdrawal')).toBeInTheDocument();
    expect(screen.getByLabelText(/Withdrawal Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason for Withdrawal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request Withdrawal/ })).toBeInTheDocument();
  });

  test('displays user balance when provided', () => {
    render(<WithdrawalForm {...defaultProps} />);
    
    expect(screen.getByText('Available Balance: $1000.00')).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    render(<WithdrawalForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });
    
    // Try to submit without filling fields
    await user.click(submitButton);
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('validates withdrawal amount', async () => {
    const user = userEvent.setup();
    render(<WithdrawalForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    
    // Test negative amount
    await user.type(amountInput, '-50');
    await user.type(reasonInput, 'Test reason for withdrawal');
    
    await waitFor(() => {
      expect(screen.getByText(/Please enter a positive number/)).toBeInTheDocument();
    });
  });

  test('validates withdrawal amount against balance', async () => {
    const user = userEvent.setup();
    render(<WithdrawalForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    
    // Test amount exceeding balance
    await user.type(amountInput, '1500');
    await user.type(reasonInput, 'Test reason for withdrawal');
    
    await waitFor(() => {
      expect(screen.getByText(/Insufficient funds/)).toBeInTheDocument();
    });
  });

  test('validates minimum withdrawal amount', async () => {
    const user = userEvent.setup();
    render(<WithdrawalForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    
    // Test amount too small
    await user.type(amountInput, '0.001');
    await user.type(reasonInput, 'Test reason for withdrawal');
    
    await waitFor(() => {
      expect(screen.getByText(/Minimum withdrawal amount is \$0.01/)).toBeInTheDocument();
    });
  });

  test('validates reason length', async () => {
    const user = userEvent.setup();
    render(<WithdrawalForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    
    await user.type(amountInput, '100');
    await user.type(reasonInput, 'Hi'); // Too short
    
    await waitFor(() => {
      expect(screen.getByText(/Must be at least 3 characters/)).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue();
    
    render(<WithdrawalForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });
    
    await user.type(amountInput, '100.50');
    await user.type(reasonInput, 'Valid withdrawal reason');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        amount: 100.50,
        reason: 'Valid withdrawal reason',
      });
    });
  });

  test('shows loading state', () => {
    render(<WithdrawalForm {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('shows error message', () => {
    render(<WithdrawalForm {...defaultProps} error="Withdrawal failed" />);
    
    expect(screen.getByText('Withdrawal failed')).toBeInTheDocument();
  });

  test('disables form when disabled prop is true', () => {
    render(<WithdrawalForm {...defaultProps} disabled={true} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });
    
    expect(amountInput).toBeDisabled();
    expect(reasonInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  test('resets form after successful submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue();
    
    render(<WithdrawalForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Withdrawal Amount/);
    const reasonInput = screen.getByLabelText(/Reason for Withdrawal/);
    const submitButton = screen.getByRole('button', { name: /Request Withdrawal/ });
    
    await user.type(amountInput, '100');
    await user.type(reasonInput, 'Test withdrawal');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(amountInput.value).toBe('');
      expect(reasonInput.value).toBe('');
    });
  });
});