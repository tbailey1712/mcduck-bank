import { db } from '../config/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  onSnapshot,
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore';

/**
 * Unified API Service Layer
 * Consolidates all Firebase operations with consistent error handling,
 * authentication checks, and data transformation
 */

// Error handling utility
const handleError = (error, operation, context = {}) => {
  const errorMessage = `Error in ${operation}: ${error.message}`;
  console.error(errorMessage, { error, context });
  
  // Return structured error for consistent handling
  return {
    success: false,
    error: errorMessage,
    code: error.code,
    context
  };
};

// Success response utility
const handleSuccess = (data, operation, context = {}) => {
  return {
    success: true,
    data,
    operation,
    context
  };
};

// Permission check utility
const hasPermission = (authUser, targetUserId, userData = null) => {
  if (!authUser) return false;
  
  // User can access their own data
  if (authUser.uid === targetUserId) return true;
  
  // Admin can access any data
  if (authUser.administrator || authUser.isAdmin) return true;
  
  // Check if target user data indicates admin access
  if (userData?.administrator) return true;
  
  return false;
};

// Data transformation utilities
const transformUserData = (docData, docId) => ({
  ...docData,
  id: docId,
  user_id: docData.user_id || docId,
  email: docData.email,
  displayName: docData.displayName || docData.name,
  administrator: docData.administrator || false,
  lastLogin: docData.lastLogin,
  createdAt: docData.createdAt,
});

const transformTransactionData = (docData, docId) => ({
  id: docId,
  ...docData,
  user_id: docData.user_id,
  amount: Number(docData.amount) || 0,
  transaction_type: docData.transaction_type,
  transactionType: docData.transaction_type, // Support both formats
  timestamp: docData.timestamp?.toDate?.() || new Date(docData.timestamp),
  description: docData.description || docData.comment,
  comment: docData.comment || docData.description,
});

/**
 * USER DATA OPERATIONS
 */

export const getUserData = async (identifier, authUser = null) => {
  try {
    
    let userData = null;
    let docId = identifier;

    // Try to get by document ID first
    const docRef = doc(db, 'accounts', identifier);
    const docSnap = await getDoc(docRef);
    
    
    if (docSnap.exists()) {
      userData = docSnap.data();
      docId = identifier;
    } else {
      // Document ID lookup failed, try by user_id field
      const userIdQuery = query(
        collection(db, 'accounts'),
        where('user_id', '==', identifier)
      );
      const userIdSnapshot = await getDocs(userIdQuery);
      
      
      if (!userIdSnapshot.empty) {
        userData = userIdSnapshot.docs[0].data();
        docId = userIdSnapshot.docs[0].id;
      } else {
        // Finally try by email field (for backward compatibility)
        const emailQuery = query(
          collection(db, 'accounts'),
          where('email', '==', identifier)
        );
        const emailSnapshot = await getDocs(emailQuery);
        
        
        if (!emailSnapshot.empty) {
          userData = emailSnapshot.docs[0].data();
          docId = emailSnapshot.docs[0].id;
        }
      }
    }

    if (!userData) {
      return handleSuccess(null, 'getUserData', { identifier, found: false });
    }

    // Check permissions
    if (authUser && !hasPermission(authUser, docId, userData)) {
      return handleError(
        new Error('Permission denied'), 
        'getUserData', 
        { identifier, permission: 'denied' }
      );
    }

    const transformedData = transformUserData(userData, docId);
    return handleSuccess(transformedData, 'getUserData', { identifier });

  } catch (error) {
    return handleError(error, 'getUserData', { identifier });
  }
};

export const subscribeToUserData = (identifier, onData, authUser = null) => {
  try {
    const docRef = doc(db, 'accounts', identifier);
    
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          
          // Check permissions
          if (authUser && !hasPermission(authUser, identifier, userData)) {
            onData(handleError(
              new Error('Permission denied'),
              'subscribeToUserData',
              { identifier, permission: 'denied' }
            ));
            return;
          }

          const transformedData = transformUserData(userData, identifier);
          onData(handleSuccess(transformedData, 'subscribeToUserData', { identifier }));
        } else {
          onData(handleSuccess(null, 'subscribeToUserData', { identifier, found: false }));
        }
      },
      (error) => {
        onData(handleError(error, 'subscribeToUserData', { identifier }));
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up user data subscription:', error);
    return () => {};
  }
};

/**
 * TRANSACTION OPERATIONS
 */

export const getTransactions = async (userId, options = {}) => {
  try {
    const {
      authUser = null,
      orderByField = 'timestamp',
      orderDirection = 'desc',
      limitCount = null,
      startAfterDoc = null
    } = options;

    // Check permissions
    if (authUser && !hasPermission(authUser, userId)) {
      return handleError(
        new Error('Permission denied'),
        'getTransactions',
        { userId, permission: 'denied' }
      );
    }

    let q = query(
      collection(db, 'transactions'),
      where('user_id', '==', userId),
      orderBy(orderByField, orderDirection)
    );

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    if (startAfterDoc) {
      q = query(q, startAfter(startAfterDoc));
    }

    const querySnapshot = await getDocs(q);
    
    const transactions = querySnapshot.docs.map(doc => 
      transformTransactionData(doc.data(), doc.id)
    );

    return handleSuccess(
      transactions, 
      'getTransactions', 
      { userId, count: transactions.length, hasMore: querySnapshot.docs.length === limitCount }
    );

  } catch (error) {
    return handleError(error, 'getTransactions', { userId });
  }
};

export const subscribeToTransactions = (userId, onData, options = {}) => {
  try {
    const {
      authUser = null,
      orderByField = 'timestamp',
      orderDirection = 'desc',
      limitCount = null
    } = options;


    if (!userId) {
      onData(handleError(
        new Error('No user ID provided'),
        'subscribeToTransactions',
        { userId }
      ));
      return () => {};
    }

    let q = query(
      collection(db, 'transactions'),
      where('user_id', '==', userId),
      orderBy(orderByField, orderDirection)
    );

    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        
        // Check permissions
        if (authUser && !hasPermission(authUser, userId)) {
          onData(handleError(
            new Error('Permission denied'),
            'subscribeToTransactions',
            { userId, permission: 'denied' }
          ));
          return;
        }

        const transactions = snapshot.docs.map(doc =>
          transformTransactionData(doc.data(), doc.id)
        );

        onData(handleSuccess(
          transactions,
          'subscribeToTransactions',
          { userId, count: transactions.length }
        ));
      },
      (error) => {
        onData(handleError(error, 'subscribeToTransactions', { userId }));
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up transaction subscription:', error);
    return () => {};
  }
};

/**
 * PAGINATION HELPERS
 */

export const getTransactionsPaginated = async (userId, options = {}) => {
  try {
    const {
      authUser = null,
      page = 0,
      pageSize = 20,
      orderByField = 'timestamp',
      orderDirection = 'desc'
    } = options;

    // Check permissions
    if (authUser && !hasPermission(authUser, userId)) {
      return handleError(
        new Error('Permission denied'),
        'getTransactionsPaginated',
        { userId, permission: 'denied' }
      );
    }

    // Build the query
    let q = query(
      collection(db, 'transactions'),
      where('user_id', '==', userId),
      orderBy(orderByField, orderDirection),
      limit(pageSize + 1) // Get one extra to check if there are more pages
    );

    // For page > 0, we need to implement cursor-based pagination
    // For now, use offset-based pagination (less efficient but simpler)
    if (page > 0) {
      // Calculate offset
      const offset = page * pageSize;
      
      // Get all documents up to the offset + pageSize + 1
      const offsetQuery = query(
        collection(db, 'transactions'),
        where('user_id', '==', userId),
        orderBy(orderByField, orderDirection),
        limit(offset + pageSize + 1)
      );
      
      const offsetSnapshot = await getDocs(offsetQuery);
      const allDocs = offsetSnapshot.docs;
      
      // Slice to get the current page
      const startIndex = offset;
      const endIndex = offset + pageSize;
      const currentPageDocs = allDocs.slice(startIndex, endIndex + 1);
      
      const hasNextPage = currentPageDocs.length > pageSize;
      const transactions = hasNextPage ? 
        currentPageDocs.slice(0, pageSize).map(doc => transformTransactionData(doc.data(), doc.id)) :
        currentPageDocs.map(doc => transformTransactionData(doc.data(), doc.id));

      return handleSuccess({
        transactions,
        pagination: {
          page,
          pageSize,
          hasNextPage,
          hasPreviousPage: page > 0,
          totalDisplayed: transactions.length,
          totalAvailable: allDocs.length > offset + pageSize + 1 ? 'unknown' : allDocs.length
        }
      }, 'getTransactionsPaginated', { userId, page, pageSize });
    }

    // First page - use the simple query
    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs;
    
    const hasNextPage = docs.length > pageSize;
    const transactions = hasNextPage ? 
      docs.slice(0, pageSize).map(doc => transformTransactionData(doc.data(), doc.id)) :
      docs.map(doc => transformTransactionData(doc.data(), doc.id));

    return handleSuccess({
      transactions,
      pagination: {
        page,
        pageSize,
        hasNextPage,
        hasPreviousPage: false,
        totalDisplayed: transactions.length,
        lastDoc: transactions.length > 0 ? docs[transactions.length - 1] : null
      }
    }, 'getTransactionsPaginated', { userId, page, pageSize });

  } catch (error) {
    return handleError(error, 'getTransactionsPaginated', { userId, page: options.page });
  }
};

/**
 * ADMIN OPERATIONS
 */

export const getAllUsers = async (authUser, options = {}) => {
  try {
    const { limitCount = null } = options;

    // Check admin permissions
    if (!authUser?.administrator && !authUser?.isAdmin) {
      return handleError(
        new Error('Admin permission required'),
        'getAllUsers',
        { permission: 'admin_required' }
      );
    }

    let q = query(collection(db, 'accounts'));
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    
    const users = querySnapshot.docs.map(doc =>
      transformUserData(doc.data(), doc.id)
    );

    return handleSuccess(users, 'getAllUsers', { count: users.length });

  } catch (error) {
    return handleError(error, 'getAllUsers');
  }
};

export const getAllTransactions = async (authUser, options = {}) => {
  try {
    const { limitCount = null, orderByField = 'timestamp', orderDirection = 'desc' } = options;

    // Check admin permissions
    if (!authUser?.administrator && !authUser?.isAdmin) {
      return handleError(
        new Error('Admin permission required'),
        'getAllTransactions',
        { permission: 'admin_required' }
      );
    }

    let q = query(
      collection(db, 'transactions'),
      orderBy(orderByField, orderDirection)
    );
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    
    const transactions = querySnapshot.docs.map(doc =>
      transformTransactionData(doc.data(), doc.id)
    );

    return handleSuccess(transactions, 'getAllTransactions', { count: transactions.length });

  } catch (error) {
    return handleError(error, 'getAllTransactions');
  }
};

/**
 * UTILITIES
 */

export const processTransactionSummary = (transactions) => {
  const summary = {
    deposits: 0,
    withdrawals: 0,
    serviceCharges: 0,
    interests: 0,
    balance: 0,
    totalTransactions: transactions.length
  };

  if (!transactions || transactions.length === 0) {
    return summary;
  }

  // Sort transactions chronologically for balance calculation
  const sortedTransactions = [...transactions].sort((a, b) => {
    const timestampA = new Date(a.timestamp);
    const timestampB = new Date(b.timestamp);
    return timestampA - timestampB;
  });

  sortedTransactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const type = (transaction.transaction_type || transaction.transactionType || '').toLowerCase();
    
    if (!amount || !type) return;

    switch (type) {
      case 'deposit':
        summary.deposits += amount;
        summary.balance += amount;
        break;
      case 'interest':
        summary.interests += amount;
        summary.balance += amount;
        break;
      case 'withdrawal':
        summary.withdrawals += amount;
        summary.balance -= amount;
        break;
      case 'service_charge':
      case 'bankfee':
        summary.serviceCharges += amount;
        summary.balance -= amount;
        break;
      default:
        console.warn('Unknown transaction type:', type);
    }
  });

  return summary;
};

export default {
  getUserData,
  subscribeToUserData,
  getTransactions,
  subscribeToTransactions,
  getTransactionsPaginated,
  getAllUsers,
  getAllTransactions,
  processTransactionSummary
};