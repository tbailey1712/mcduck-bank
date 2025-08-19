import React from 'react';
import { AdminTransactionForm } from '../components';

const TransactionForm = ({ customers, onSubmit, loading, error }) => (
  <AdminTransactionForm
    customers={customers}
    onSubmit={onSubmit}
    loading={loading}
    error={error}
  />
);

export default TransactionForm;