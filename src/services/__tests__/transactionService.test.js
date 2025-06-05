import { processTransactions } from '../transactionService';

describe('transactionService', () => {
  describe('processTransactions', () => {
    test('processes empty transaction array', () => {
      const result = processTransactions([]);
      
      expect(result).toEqual({
        deposits: 0,
        withdrawals: 0,
        serviceCharges: 0,
        interests: 0,
        balance: 0,
      });
    });

    test('processes deposit transactions', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 50,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-02'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(150);
      expect(result.balance).toBe(150);
    });

    test('processes withdrawal transactions', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 30,
          transaction_type: 'withdrawal',
          timestamp: new Date('2024-01-02'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(100);
      expect(result.withdrawals).toBe(30);
      expect(result.balance).toBe(70);
    });

    test('processes service charge transactions', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 5,
          transaction_type: 'service_charge',
          timestamp: new Date('2024-01-02'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(100);
      expect(result.serviceCharges).toBe(5);
      expect(result.balance).toBe(95);
    });

    test('processes interest transactions', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 2.50,
          transaction_type: 'interest',
          timestamp: new Date('2024-01-02'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(100);
      expect(result.interests).toBe(2.50);
      expect(result.balance).toBe(102.50);
    });

    test('processes mixed transaction types in chronological order', () => {
      const transactions = [
        {
          id: '3',
          amount: 20,
          transaction_type: 'withdrawal',
          timestamp: new Date('2024-01-03'),
        },
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 50,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-02'),
        },
        {
          id: '4',
          amount: 5,
          transaction_type: 'service_charge',
          timestamp: new Date('2024-01-04'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(150);
      expect(result.withdrawals).toBe(20);
      expect(result.serviceCharges).toBe(5);
      expect(result.interests).toBe(0);
      expect(result.balance).toBe(125); // 100 + 50 - 20 - 5
    });

    test('handles alternative transaction type format (transactionType)', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transactionType: 'deposit', // Alternative format
          timestamp: new Date('2024-01-01'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(100);
      expect(result.balance).toBe(100);
    });

    test('handles bankfee as service charge', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 10,
          transaction_type: 'bankfee',
          timestamp: new Date('2024-01-02'),
        },
      ];

      const result = processTransactions(transactions);

      expect(result.serviceCharges).toBe(10);
      expect(result.balance).toBe(90);
    });

    test('handles missing or invalid transaction data gracefully', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          // Missing amount
          transaction_type: 'withdrawal',
          timestamp: new Date('2024-01-02'),
        },
        {
          id: '3',
          amount: 50,
          // Missing transaction_type
          timestamp: new Date('2024-01-03'),
        },
      ];

      const result = processTransactions(transactions);

      // Should only process the valid transaction
      expect(result.deposits).toBe(100);
      expect(result.withdrawals).toBe(0);
      expect(result.balance).toBe(100);
    });

    test('handles different timestamp formats', () => {
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'deposit',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: '2',
          amount: 50,
          transaction_type: 'deposit',
          timestamp: '2024-01-02', // String format
        },
        {
          id: '3',
          amount: 25,
          transaction_type: 'deposit',
          timestamp: 1704240000000, // Unix timestamp
        },
        {
          id: '4',
          amount: 10,
          transaction_type: 'deposit',
          // Missing timestamp
        },
      ];

      const result = processTransactions(transactions);

      expect(result.deposits).toBe(185);
      expect(result.balance).toBe(185);
    });

    test('handles null or undefined input', () => {
      expect(processTransactions(null)).toEqual({
        deposits: 0,
        withdrawals: 0,
        serviceCharges: 0,
        interests: 0,
        balance: 0,
      });

      expect(processTransactions(undefined)).toEqual({
        deposits: 0,
        withdrawals: 0,
        serviceCharges: 0,
        interests: 0,
        balance: 0,
      });
    });

    test('warns about unknown transaction types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const transactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'unknown_type',
          timestamp: new Date('2024-01-01'),
        },
      ];

      processTransactions(transactions);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown transaction type:', 'unknown_type');
      
      consoleSpy.mockRestore();
    });
  });
});