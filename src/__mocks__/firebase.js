// Mock Firebase functions for testing
// Uses plain functions (not jest.fn) to survive CRA's resetMocks: true.
// Use __mockError to simulate failures: getDoc.__mockError = new Error('fail');

const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

// Helper: wrap a function to support __mockError injection.
// Plain function wrapper so resetMocks: true does not clear the implementation.
const withErrorSupport = (fn) => {
  const wrapped = (...args) => {
    if (wrapped.__mockError) {
      const err = wrapped.__mockError;
      wrapped.__mockError = null;
      return Promise.reject(err);
    }
    return fn(...args);
  };
  wrapped.__mockError = null;
  return wrapped;
};

// Mock Firebase Auth
export const auth = {
  currentUser: mockUser,
  signOut: () => Promise.resolve(),
  onAuthStateChanged: (callback) => {
    callback(mockUser);
    return () => {};
  },
  signInWithPopup: () => Promise.resolve({ user: mockUser }),
};

// Mock Firestore database object
export const db = {};

// Mock Firebase config
export const getFirebaseInfo = () => ({
  projectId: 'test-project',
  authDomain: 'test-project.firebaseapp.com',
  isEmulator: false,
  environment: 'test',
  debugEnabled: true,
});

// Mock Firebase Functions
export const functions = {};

// Firestore operation mocks with error simulation support
export const addDoc = withErrorSupport(() =>
  Promise.resolve({ id: 'new-doc-id' })
);

export const updateDoc = withErrorSupport(() => Promise.resolve());
export const deleteDoc = withErrorSupport(() => Promise.resolve());

export const getDoc = withErrorSupport(() =>
  Promise.resolve({
    exists: () => true,
    data: () => ({ ...mockUser }),
    id: 'test-doc-id',
  })
);

export const getDocs = withErrorSupport(() =>
  Promise.resolve({
    docs: [
      {
        id: 'doc-1',
        data: () => ({ ...mockUser }),
        ref: 'mock-doc-ref',
      },
    ],
    empty: false,
  })
);

export const setDoc = withErrorSupport(() => Promise.resolve());

export const onSnapshot = (queryOrRef, callback) => {
  callback({
    docs: [
      {
        id: 'doc-1',
        data: () => ({ ...mockUser }),
      },
    ],
    empty: false,
  });
  return () => {};
};

export const runTransaction = async (dbRef, updateFn) => {
  const txn = {
    get: () =>
      Promise.resolve({
        exists: () => true,
        data: () => ({ status: 'pending', user_id: 'test-user-123', amount: 100 }),
      }),
    set: () => {},
    update: () => {},
    delete: () => {},
  };
  return updateFn(txn);
};

export const collection = (dbRef, name) => `mock-collection-${name}`;
export const doc = (collectionRef, id) => {
  if (id) return `mock-doc-${id}`;
  return `mock-doc-auto-${Date.now()}`;
};
doc.id = 'mock-auto-id';

export const query = (...args) => 'mock-query';
export const where = () => 'mock-where-constraint';
export const orderBy = () => 'mock-orderby-constraint';
export const limit = () => 'mock-limit-constraint';
export const serverTimestamp = () => ({ _type: 'serverTimestamp' });
export const Timestamp = {
  now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }),
  fromDate: (date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 }),
};

// Firebase Auth function mocks
export const getAuth = () => auth;
export const signInWithPopup = () => Promise.resolve({ user: mockUser });
export const signOut = () => Promise.resolve();
export const onAuthStateChanged = (authInstance, callback) => {
  callback(mockUser);
  return () => {};
};
export const onIdTokenChanged = (authInstance, callback) => {
  callback(mockUser);
  return () => {};
};
export const GoogleAuthProvider = function() {};

// Firebase Functions mocks
export const httpsCallable = (functionsInstance, name) => {
  return () => Promise.resolve({ data: { success: true, message: `${name} called` } });
};

// Helper to reset all mock error states
export const __resetMockErrors = () => {
  [addDoc, updateDoc, deleteDoc, getDoc, getDocs, setDoc].forEach((mock) => {
    mock.__mockError = null;
  });
};

// Default export
export default {
  auth,
  db,
  functions,
  getFirebaseInfo,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  runTransaction,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  GoogleAuthProvider,
  httpsCallable,
  __resetMockErrors,
};
