import { db } from '../config/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';

// Error handling utility
const handleError = (error, operation) => {
  console.error(`Error in ${operation}:`, error);
  throw error;
};

// User data operations
export const getUserData = async (identifier, authUser = null) => {
  try {
    // Get document directly by ID
    const docRef = doc(db, 'accounts', identifier);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const userData = docSnap.data();
      // Check if authenticated user is allowed to view this data
      if (!authUser || authUser.uid === identifier || authUser.administrator) {
        return {
          ...userData,
          id: identifier,
          user_id: identifier
        };
      }
    }

    // If that fails, try by email
    const emailQuery = query(
      collection(db, 'accounts'),
      where('email', '==', identifier)
    );
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      const userData = emailSnapshot.docs[0].data();
      // Check if authenticated user is allowed to view this data
      if (!authUser || authUser.uid === userData.user_id || authUser.administrator) {
        return {
          ...userData,
          id: emailSnapshot.docs[0].id,
          user_id: userData.user_id || identifier
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error in getUserData:', error);
  }
};

export const subscribeToUserData = (identifier, onData, authUser = null) => {
  try {
    // Subscribe directly to the document
    const docRef = doc(db, 'accounts', identifier);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Only provide data if user has permission
          if (!authUser || authUser.uid === identifier || authUser.administrator) {
            onData({
              ...data,
              id: identifier,
              user_id: identifier
            });
          }
        }
      },
      (error) => {
        console.error('Error in user data subscription:', error);
        // If permission denied, try to fetch once
        if (error.code === 'permission-denied') {
          const docRef = doc(db, 'accounts', identifier);
          getDoc(docRef)
            .then((docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                // Only provide data if user has permission
                if (!authUser || authUser.uid === identifier || authUser.administrator) {
                  onData({
                    ...data,
                    id: identifier,
                    user_id: identifier
                  });
                }
              }
            })
            .catch((error) => {
              console.error('Error fetching user data:', error);
            });
        }
      }
    );
    return unsubscribe;
  } catch (error) {
    console.error('Error in subscribeToUserData:', error);
  }
};

// Transaction operations
export const getTransactions = async (userId) => {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('user_id', '==', userId),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    }));
  } catch (error) {
    handleError(error, 'getTransactions');
  }
};

export const subscribeToTransactions = (userId, onData, authUser = null) => {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('user_id', '==', userId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Only provide transactions if user has permission
        if (!authUser || authUser.uid === userId || authUser.administrator) {
          const transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate()
          }));
          onData(transactions);
        }
      },
      (error) => {
        console.error('Error in transactions subscription:', error);
        // If permission denied, try to fetch once instead of subscribing
        if (error.code === 'permission-denied') {
          const transactionsRef = collection(db, 'transactions');
          const q = query(transactionsRef, where('user_id', '==', userId));
          getDocs(q).then((snapshot) => {
            // Only provide transactions if user has permission
            if (!authUser || authUser.uid === userId || authUser.administrator) {
              const transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
              }));
              onData(transactions);
            }
          }).catch((error) => {
            console.error('Error fetching transactions:', error);
          });
        }
      }
    );
    return unsubscribe;
  } catch (error) {
    console.error('Error in subscribeToTransactions:', error);
  }
};
