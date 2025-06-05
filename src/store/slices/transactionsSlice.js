import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  transactions: [],
  loading: false,
  error: null,
  pendingApprovals: [],
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    },
    addTransaction: (state, action) => {
      state.transactions.push(action.payload);
    },
    updateTransaction: (state, action) => {
      const index = state.transactions.findIndex(
        (t) => t.id === action.payload.id
      );
      if (index !== -1) {
        state.transactions[index] = action.payload;
      }
    },
    setPendingApprovals: (state, action) => {
      state.pendingApprovals = action.payload;
    },
  },
});

export const {
  setLoading,
  setError,
  setTransactions,
  addTransaction,
  updateTransaction,
  setPendingApprovals,
} = transactionsSlice.actions;

export default transactionsSlice.reducer;
