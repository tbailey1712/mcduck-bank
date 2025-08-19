import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import withdrawalTaskService from '../../services/withdrawalTaskService';

const initialState = {
  requests: [],
  loading: false,
  error: null,
};

export const fetchWithdrawalRequests = createAsyncThunk(
  'withdrawalRequests/fetchWithdrawalRequests',
  async (status, { rejectWithValue }) => {
    try {
      const response = await withdrawalTaskService.getAllWithdrawalRequests(status);
      if (response.success) {
        return response.requests;
      } else {
        return rejectWithValue(response.error);
      }
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const withdrawalRequestsSlice = createSlice({
  name: 'withdrawalRequests',
  initialState,
  reducers: {
    setRequests: (state, action) => {
      state.requests = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWithdrawalRequests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWithdrawalRequests.fulfilled, (state, action) => {
        state.loading = false;
        state.requests = action.payload;
      })
      .addCase(fetchWithdrawalRequests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setRequests } = withdrawalRequestsSlice.actions;

export default withdrawalRequestsSlice.reducer;