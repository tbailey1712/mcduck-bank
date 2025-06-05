import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import AdminTransactionForm from '../AdminTransactionForm';

describe('AdminTransactionForm', () => {
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    onSubmit: mockOnSubmit,
    loading: false,
    error: null,
    disabled: false,
  };

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  test('renders form elements correctly', () => {
    render(<AdminTransactionForm {...defaultProps} />);
    
    expect(screen.getByText('Create Transaction')).toBeInTheDocument();
    expect(screen.getByLabelText(/User ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Transaction Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Transaction/ })).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });
    
    // Try to submit without filling fields
    await user.click(submitButton);
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/User ID is required/)).toBeInTheDocument();
    expect(screen.getByText(/Amount is required/)).toBeInTheDocument();
  });

  test('validates user ID format', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const userIdInput = screen.getByLabelText(/User ID/);
    
    // Test invalid user ID
    await user.type(userIdInput, 'invalid-id');
    
    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid user ID/)).toBeInTheDocument();
    });
  });

  test('validates transaction amount', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Amount/);
    
    // Test negative amount
    await user.type(amountInput, '-50');
    
    await waitFor(() => {
      expect(screen.getByText(/Please enter a positive number/)).toBeInTheDocument();
    });
    
    // Clear and test zero amount
    await user.clear(amountInput);
    await user.type(amountInput, '0');
    
    await waitFor(() => {
      expect(screen.getByText(/Amount must be greater than 0/)).toBeInTheDocument();
    });
  });

  test('validates minimum amount', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Amount/);
    
    // Test amount too small
    await user.type(amountInput, '0.001');
    
    await waitFor(() => {
      expect(screen.getByText(/Minimum amount is \$0.01/)).toBeInTheDocument();
    });
  });

  test('validates description length', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText(/Description/);
    
    // Test description too short
    await user.type(descriptionInput, 'Hi');
    
    await waitFor(() => {
      expect(screen.getByText(/Must be at least 3 characters/)).toBeInTheDocument();
    });
    
    // Test description too long
    const longDescription = 'a'.repeat(501);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, longDescription);
    
    await waitFor(() => {
      expect(screen.getByText(/Must be less than 500 characters/)).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue();
    
    render(<AdminTransactionForm {...defaultProps} />);
    
    const userIdInput = screen.getByLabelText(/User ID/);
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    const amountInput = screen.getByLabelText(/Amount/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });
    
    await user.type(userIdInput, 'test-user-123');
    await user.selectOptions(typeSelect, 'deposit');
    await user.type(amountInput, '100.50');
    await user.type(descriptionInput, 'Test admin transaction');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        userId: 'test-user-123',
        transactionType: 'deposit',
        amount: 100.50,
        description: 'Test admin transaction',
      });
    });
  });

  test('shows loading state', () => {
    render(<AdminTransactionForm {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Creating Transaction...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('shows error message', () => {
    render(<AdminTransactionForm {...defaultProps} error="Transaction failed" />);
    
    expect(screen.getByText('Transaction failed')).toBeInTheDocument();
  });

  test('disables form when disabled prop is true', () => {
    render(<AdminTransactionForm {...defaultProps} disabled={true} />);
    
    const userIdInput = screen.getByLabelText(/User ID/);
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    const amountInput = screen.getByLabelText(/Amount/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });
    
    expect(userIdInput).toBeDisabled();
    expect(typeSelect).toBeDisabled();
    expect(amountInput).toBeDisabled();
    expect(descriptionInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  test('resets form after successful submission', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue();
    
    render(<AdminTransactionForm {...defaultProps} />);
    
    const userIdInput = screen.getByLabelText(/User ID/);
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    const amountInput = screen.getByLabelText(/Amount/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });
    
    await user.type(userIdInput, 'test-user-123');
    await user.selectOptions(typeSelect, 'deposit');
    await user.type(amountInput, '100');
    await user.type(descriptionInput, 'Test transaction');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(userIdInput.value).toBe('');
      expect(typeSelect.value).toBe('');
      expect(amountInput.value).toBe('');
      expect(descriptionInput.value).toBe('');
    });
  });

  test('handles all transaction types', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    
    // Check that all transaction types are available
    expect(screen.getByRole('option', { name: 'Deposit' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Withdrawal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Service Charge' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Interest' })).toBeInTheDocument();
  });

  test('sanitizes input to prevent XSS', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue();
    
    render(<AdminTransactionForm {...defaultProps} />);
    
    const userIdInput = screen.getByLabelText(/User ID/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const amountInput = screen.getByLabelText(/Amount/);
    const typeSelect = screen.getByLabelText(/Transaction Type/);
    const submitButton = screen.getByRole('button', { name: /Create Transaction/ });
    
    // Input with potential XSS
    await user.type(userIdInput, 'test-user-123<script>alert("xss")</script>');
    await user.type(descriptionInput, 'Test description<img src=x onerror=alert("xss")>');
    await user.type(amountInput, '100');
    await user.selectOptions(typeSelect, 'deposit');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        userId: 'test-user-123&lt;script&gt;alert("xss")&lt;/script&gt;',
        transactionType: 'deposit',
        amount: 100,
        description: 'Test description&lt;img src=x onerror=alert("xss")&gt;',
      });
    });
  });

  test('validates maximum amount', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionForm {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/Amount/);
    
    // Test amount too large
    await user.type(amountInput, '1000000');
    
    await waitFor(() => {
      expect(screen.getByText(/Maximum amount is \$999,999.99/)).toBeInTheDocument();
    });
  });
});