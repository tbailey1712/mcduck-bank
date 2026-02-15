import React from 'react';
import { render, screen } from '../../utils/test-utils';
import UserProfileCard from '../UserProfileCard';
import { mockUser, mockTransactionSummary } from '../../utils/test-utils';

// Mock the unified auth context (UserProfileCard calls useUnifiedAuth)
jest.mock('../../contexts/UnifiedAuthProvider', () => ({
  useUnifiedAuth: () => ({
    user: {
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
    },
    isAuthenticated: true,
    isAdmin: false,
    loading: false,
  }),
}));

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
    expect(screen.getByText('Administrator: No')).toBeInTheDocument();
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

  test('displays user avatar with photo', () => {
    const userWithPhoto = { ...mockUser, photoURL: 'https://example.com/photo.jpg', user_id: 'test-user-123' };
    render(<UserProfileCard {...defaultProps} userData={userWithPhoto} />);

    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(avatar).toHaveAttribute('alt', 'Test User');
  });

  test('displays initials when no photoURL is provided', () => {
    // Use a different email so isViewingSelf is false and no photo fallback occurs
    const userWithoutPhoto = { ...mockUser, photoURL: null, user_id: 'other-user', email: 'other@example.com', displayName: 'Other User' };
    render(<UserProfileCard {...defaultProps} userData={userWithoutPhoto} />);
    expect(screen.getByText('O')).toBeInTheDocument();
  });

  test('handles missing displayName gracefully', () => {
    const userWithoutName = { ...mockUser, displayName: null, email: 'test@example.com', user_id: 'other-user' };
    render(<UserProfileCard {...defaultProps} userData={userWithoutName} />);
    // Falls back to email prefix
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
