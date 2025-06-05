export const processTransactions = (transactions = []) => {
  const summary = {
    deposits: 0,
    withdrawals: 0,
    serviceCharges: 0,
    interests: 0,
    balance: 0
  };

  transactions.forEach(transaction => {
    const amount = transaction.amount || 0;
    const type = (transaction.transaction_type || transaction.transactionType || '').toLowerCase();

    switch (type) {
      case 'deposit':
        summary.deposits += amount;
        break;
      case 'withdrawal':
        summary.withdrawals += amount;
        break;
      case 'bankfee':
      case 'servicecharge':
        summary.serviceCharges += amount;
        break;
      case 'interest':
        summary.interests += amount;
        break;
    }
    summary.balance += amount;
  });

  return summary;
};
