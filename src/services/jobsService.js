import { db } from '../config/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc,
  orderBy,
  and,
  Timestamp
} from 'firebase/firestore';

/**
 * Jobs Service - Handles automated banking operations
 * Migrated from Python cloud functions to JavaScript
 */

// Utility function to get current month boundaries
const getCurrentMonthBoundaries = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { startOfMonth, endOfMonth, currentMonth: now.getMonth() + 1, currentYear: now.getFullYear() };
};

// Fetch interest rate from system config
export const fetchInterestRate = async () => {
  try {
    const configRef = doc(db, 'system', 'config');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const rate = configSnap.data().interest_rate || 0;
      console.log(`fetchInterestRate(): Interest is set to ${rate}%`);
      return rate;
    }
    console.warn('No system config found, defaulting to 0% interest');
    return 0;
  } catch (error) {
    console.error('Error fetching interest rate:', error);
    return 0;
  }
};

// Calculate account balance for a user
export const getAccountBalance = async (userId) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('user_id', '==', userId));
    const querySnapshot = await getDocs(q);
    
    let balance = 0;
    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      const type = transaction.transaction_type;
      const amount = transaction.amount;
      
      if (['deposit', 'interest'].includes(type)) {
        balance += amount;
      } else if (['withdrawal', 'service_charge', 'bankfee'].includes(type)) {
        balance -= amount;
      }
    });
    
    return balance;
  } catch (error) {
    console.error(`Error calculating balance for user ${userId}:`, error);
    return 0;
  }
};

// Check if interest has been paid this month for a user
export const hasInterestPaidThisMonth = async (userId) => {
  try {
    const { startOfMonth } = getCurrentMonthBoundaries();
    
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      and(
        where('user_id', '==', userId),
        where('transaction_type', '==', 'interest'),
        where('timestamp', '>=', Timestamp.fromDate(startOfMonth))
      )
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error(`Error checking interest payment for user ${userId}:`, error);
    return false;
  }
};

// Calculate and pay interest for all accounts
export const calculateInterest = async () => {
  const results = {
    totalProcessed: 0,
    totalInterestPaid: 0,
    alreadyPaid: 0,
    errors: []
  };

  try {
    const interestRate = (await fetchInterestRate()) / 100;
    console.log(`Starting interest calculation with rate: ${interestRate * 100}%`);

    // Get all accounts
    const accountsRef = collection(db, 'accounts');
    const accountsSnapshot = await getDocs(accountsRef);

    for (const accountDoc of accountsSnapshot.docs) {
      const accountData = accountDoc.data();
      const userId = accountData.user_id;
      const name = accountData.displayName || accountData.name || accountDoc.id;

      try {
        // Check if interest already paid this month
        const alreadyPaid = await hasInterestPaidThisMonth(userId);
        if (alreadyPaid) {
          console.log(`calculate_interest(${name}): Interest already paid this month.`);
          results.alreadyPaid++;
          continue;
        }

        // Get current balance
        const balance = await getAccountBalance(userId);
        console.log(`calculate_interest(${name}): Account Balance $${balance}`);

        // Calculate interest (only if balance > 0)
        if (balance <= 0) {
          console.log(`calculate_interest(${name}): No balance, skipping interest`);
          continue;
        }

        const interestPayment = balance * interestRate;
        const interestAmountRounded = Math.round(interestPayment * 100) / 100; // Round to 2 decimal places
        console.log(`calculate_interest(${name}): Interest to pay $${interestAmountRounded}`);

        if (interestAmountRounded > 0) {
          // Create interest transaction
          const newTransaction = {
            user_id: userId,
            amount: interestAmountRounded,
            comment: 'Monthly Interest Payment',
            transaction_type: 'interest',
            timestamp: Timestamp.now()
          };

          await addDoc(collection(db, 'transactions'), newTransaction);
          
          results.totalInterestPaid += interestAmountRounded;
          results.totalProcessed++;
          console.log(`Processed interest for ${name}: $${interestAmountRounded}`);
        }
      } catch (error) {
        console.error(`Error processing interest for ${name}:`, error);
        results.errors.push(`${name}: ${error.message}`);
      }
    }

    console.log('Interest calculation completed:', results);
    return results;
  } catch (error) {
    console.error('Error in calculateInterest:', error);
    results.errors.push(`General error: ${error.message}`);
    return results;
  }
};

// Fetch transactions for a specific month/year
export const fetchTransactionsForAccount = async (userId, year, month) => {
  try {
    console.log(`fetchTransactionsForAccount(${userId}, ${year}, ${month}): BEGIN`);

    const startDate = new Date(year, month - 1, 1); // month is 1-based
    const endDate = new Date(year, month, 1); // First day of next month
    
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      and(
        where('user_id', '==', userId),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<', Timestamp.fromDate(endDate))
      ),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions = [];
    
    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      // Convert Firestore timestamp to readable date
      const timestamp = transaction.timestamp.toDate();
      transactions.push({
        ...transaction,
        id: doc.id,
        timestamp: timestamp.toISOString().split('T')[0] // YYYY-MM-DD format
      });
    });
    
    return transactions;
  } catch (error) {
    console.error(`Error fetching transactions for ${userId}:`, error);
    return [];
  }
};

// Create monthly statement text
export const createMonthlyStatement = async (account, transactions, year, month) => {
  try {
    const statementLines = [
      `Monthly Statement for ${account.displayName || account.name || 'Account Holder'}`,
      `Email: ${account.email || account.id}`,
      `Statement Period: ${month}/${year}`,
      '',
      'Transactions:'
    ];

    if (transactions.length === 0) {
      statementLines.push('No transactions this month.');
    } else {
      transactions.forEach(transaction => {
        const comment = transaction.comment || transaction.description || '';
        let line = `${transaction.timestamp} - ${transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}: $${transaction.amount.toFixed(2)}`;
        if (comment) {
          line += ` (${comment})`;
        }
        statementLines.push(line);
      });
    }

    // Calculate and display current balance
    const balance = await getAccountBalance(account.user_id);
    statementLines.push('');
    statementLines.push(`Current Account Balance: $${balance.toFixed(2)}`);
    statementLines.push('');
    statementLines.push('Thank you for banking with McDuck Bank!');

    return statementLines.join('\n');
  } catch (error) {
    console.error('Error creating monthly statement:', error);
    return 'Error generating statement';
  }
};

// Process all accounts and generate statements (no email sending in browser version)
export const processAccountsAndGenerateStatements = async (year = null, month = null) => {
  const results = {
    totalProcessed: 0,
    statements: [],
    errors: []
  };

  try {
    const { currentYear, currentMonth } = getCurrentMonthBoundaries();
    const targetYear = year || currentYear;
    const targetMonth = month || currentMonth;

    console.log(`processAccountsAndGenerateStatements(): Beginning for ${targetMonth}/${targetYear}`);

    // Get all accounts
    const accountsRef = collection(db, 'accounts');
    const accountsSnapshot = await getDocs(accountsRef);

    for (const accountDoc of accountsSnapshot.docs) {
      try {
        const account = accountDoc.data();
        const userId = account.user_id;
        const email = accountDoc.id;
        account.email = email;

        console.log(`processAccountsAndGenerateStatements(${email}): Processing Transactions`);

        // Fetch transactions for the specified month
        const transactions = await fetchTransactionsForAccount(userId, targetYear, targetMonth);

        // Create the statement text
        const statementText = await createMonthlyStatement(account, transactions, targetYear, targetMonth);

        results.statements.push({
          email: email,
          name: account.displayName || account.name || 'Account Holder',
          userId: userId,
          statementText: statementText,
          transactionCount: transactions.length
        });

        results.totalProcessed++;
        console.log(`Statement generated for ${email}`);
      } catch (error) {
        console.error(`Error processing account ${accountDoc.id}:`, error);
        results.errors.push(`${accountDoc.id}: ${error.message}`);
      }
    }

    console.log('Statement generation completed:', results);
    return results;
  } catch (error) {
    console.error('Error in processAccountsAndGenerateStatements:', error);
    results.errors.push(`General error: ${error.message}`);
    return results;
  }
};

// Log job execution (for audit trail)
export const logJobExecution = async (jobName, results) => {
  try {
    const logEntry = {
      jobName,
      timestamp: Timestamp.now(),
      results,
      executedBy: 'admin-panel' // Could be enhanced to track actual admin user
    };

    await addDoc(collection(db, 'job_logs'), logEntry);
    console.log(`Job log created for ${jobName}`);
  } catch (error) {
    console.error('Error logging job execution:', error);
  }
};

export default {
  calculateInterest,
  processAccountsAndGenerateStatements,
  fetchInterestRate,
  getAccountBalance,
  hasInterestPaidThisMonth,
  fetchTransactionsForAccount,
  createMonthlyStatement,
  logJobExecution
};