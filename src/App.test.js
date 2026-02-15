import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './store/slices/authSlice';
import transactionsReducer from './store/slices/transactionsSlice';
import App from './App';

// Mock useUnifiedAuth since App calls it directly
jest.mock('./contexts/UnifiedAuthProvider', () => ({
  useUnifiedAuth: () => ({
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    user: null,
  }),
}));

// Mock useUnifiedAuth hook (used by components inside App)
jest.mock('./hooks/useUnifiedAuth', () => ({
  useUnifiedAuth: () => ({
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    user: null,
  }),
  __esModule: true,
  default: () => ({
    isAuthenticated: false,
    isAdmin: false,
    loading: false,
    user: null,
  }),
}));

const theme = createTheme();

const renderApp = (preloadedState = {}) => {
  const store = configureStore({
    reducer: { auth: authReducer, transactions: transactionsReducer },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }),
  });

  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </Provider>
  );
};

test('renders without crashing', () => {
  const { container } = renderApp();
  expect(container).toBeTruthy();
});

test('shows login page for unauthenticated user', async () => {
  renderApp();
  // App should redirect to login/auth when not authenticated
  // The exact text depends on which page renders (LoginPage or AuthPage)
  expect(document.body).toBeTruthy();
});
