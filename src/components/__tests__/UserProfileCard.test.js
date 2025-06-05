import React from 'react';
import { render, screen } from '../../utils/test-utils';
import UserProfileCard from '../UserProfileCard';
import { mockUser, mockTransactionSummary } from '../../utils/test-utils';

describe('UserProfileCard', () => {
  const defaultProps = {
    userData: mockUser,
    transactionSummary: mockTransactionSummary,
    isLoading: false,
  };

  test('renders user profile information correctly', () => {
    render(<UserProfileCard {...defaultProps} />);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText(/User ID: test-user-123/)).toBeInTheDocument();
    expect(screen.getByText('Administrator: No')).toBeInTheDocument();
  });

  test('displays account balance correctly', () => {
    render(<UserProfileCard {...defaultProps} />);
    
    expect(screen.getByText('Account Balance')).toBeInTheDocument();
    expect(screen.getByText('$125.25')).toBeInTheDocument();
  });

  test('shows loading state when isLoading is true', () => {
    render(<UserProfileCard {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Loading user data...')).toBeInTheDocument();
  });

  test('shows error state when userData is null', () => {
    render(<UserProfileCard {...defaultProps} userData={null} />);
    
    expect(screen.getByText('Unable to load user data')).toBeInTheDocument();
  });

  test('displays admin status correctly for admin users', () => {
    const adminUser = { ...mockUser, administrator: true };
    render(<UserProfileCard {...defaultProps} userData={adminUser} />);
    
    expect(screen.getByText('Administrator: Yes')).toBeInTheDocument();
  });

  test('handles missing transaction summary gracefully', () => {
    render(<UserProfileCard {...defaultProps} transactionSummary={null} />);
    
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  test('displays user avatar when photoURL is provided', () => {
    render(<UserProfileCard {...defaultProps} />);
    
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('src', mockUser.photoURL);
    expect(avatar).toHaveAttribute('alt', 'Test User');
  });

  test('displays initials when no photoURL is provided', () => {
    const userWithoutPhoto = { ...mockUser, photoURL: null };
    render(<UserProfileCard {...defaultProps} userData={userWithoutPhoto} />);
    
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  test('handles missing displayName gracefully', () => {
    const userWithoutName = { ...mockUser, displayName: null };
    render(<UserProfileCard {...defaultProps} userData={userWithoutName} />);
    
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument(); // Initial
  });
});