import { db } from '../config/firebaseConfig';
import { collection, query, where, getDocs, onSnapshot, doc, setDoc } from 'firebase/firestore';

// Verify database connection
export const verifyDatabase = async () => {
  try {
    const testRef = collection(db, 'test');
    const docRef = doc(testRef);
    await setDoc(docRef, { timestamp: new Date() });
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

export const getTransactions = async (userId, authUser = null) => {
  console.log("Fetching transactions for user:", userId);
  try {
    const q = query(collection(db, "transactions"), where("user_id", "==", userId));
    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log("Transaction:", data);
      return {
        id: doc.id,
        userId: data.user_id,
        amount: data.amount,
        transactionType: data.transaction_type,
        timestamp: data.timestamp.toDate(),
        comment: data.comment
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions for user_id:", userId, error);
    return [];
  }
};

export const subscribeToTransactions = (userId, onData, authUser = null) => {
  try {
    if (!userId) {
      console.error('No user ID provided');
      return () => {};
    }

    const q = query(collection(db, "transactions"), where("user_id", "==", userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log("Transaction:", data);
        return {
          id: doc.id,
          userId: data.user_id,
          amount: data.amount,
          transactionType: data.transaction_type,
          timestamp: data.timestamp.toDate(),
          comment: data.comment
        };
      }).sort((a, b) => b.timestamp - a.timestamp);
      onData(transactions);
    }, (error) => {
      console.error('Error in transactions subscription:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error in transaction subscription:', error);
    return () => {};
  }
};

/**
 * @deprecated Use apiService.processTransactionSummary instead
 */
export const processTransactions = (transactions) => {
  console.warn('processTransactions is deprecated. Use apiService.processTransactionSummary instead');
  
  // Import here to avoid circular dependency
  const { processTransactionSummary } = require('./apiService');
  return processTransactionSummary(transactions);
};

export const fetchAndProcessTransactions = async (user_id, authUser = null) => {
  try {
    const transactions = await getTransactions(user_id, authUser);
    console.log('Fetched transactions:', transactions.length);
    return {
      transactions,
      summary: processTransactions(transactions)
    };
  } catch (error) {
    console.error('Error fetching and processing transactions:', error);
    return {
      transactions: [],
      summary: null
    };
  }
};
