// Mock Firebase functions for testing
// Use __mockError to simulate failures: getDoc.__mockError = new Error('fail');

const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

// Helper: wrap a mock to support __mockError injection
const withErrorSupport = (fn) => {
  const wrapped = jest.fn((...args) => {
    if (wrapped.__mockError) {
      const err = wrapped.__mockError;
      wrapped.__mockError = null;
      return Promise.reject(err);
    }
    return fn(...args);
  });
  wrapped.__mockError = null;
  return wrapped;
};

// Mock Firebase Auth
export const auth = {
  currentUser: mockUser,
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((callback) => {
    callback(mockUser);
    return jest.fn();
  }),
  signInWithPopup: jest.fn(() => Promise.resolve({ user: mockUser })),
};

// Mock Firestore database object
export const db = {};

// Mock Firebase config
export const getFirebaseInfo = jest.fn(() => ({
  projectId: 'test-project',
  authDomain: 'test-project.firebaseapp.com',
  isEmulator: false,
  environment: 'test',
  debugEnabled: true,
}));

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

export const onSnapshot = jest.fn((queryOrRef, callback) => {
  callback({
    docs: [
      {
        id: 'doc-1',
        data: () => ({ ...mockUser }),
      },
    ],
    empty: false,
  });
  return jest.fn();
});

export const runTransaction = jest.fn(async (dbRef, updateFn) => {
  const txn = {
    get: jest.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({ status: 'pending', user_id: 'test-user-123', amount: 100 }),
      })
    ),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return updateFn(txn);
});

export const collection = jest.fn((dbRef, name) => `mock-collection-${name}`);
export const doc = jest.fn((collectionRef, id) => {
  if (id) return `mock-doc-${id}`;
  // Auto-generate ID for new docs (used in runTransaction)
  return `mock-doc-auto-${Date.now()}`;
});
doc.id = 'mock-auto-id';

export const query = jest.fn((...args) => 'mock-query');
export const where = jest.fn(() => 'mock-where-constraint');
export const orderBy = jest.fn(() => 'mock-orderby-constraint');
export const limit = jest.fn(() => 'mock-limit-constraint');
export const serverTimestamp = jest.fn(() => ({ _type: 'serverTimestamp' }));
export const Timestamp = {
  now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  fromDate: jest.fn((date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
};

// Firebase Auth function mocks
export const getAuth = jest.fn(() => auth);
export const signInWithPopup = jest.fn(() => Promise.resolve({ user: mockUser }));
export const signOut = jest.fn(() => Promise.resolve());
export const onAuthStateChanged = jest.fn((authInstance, callback) => {
  callback(mockUser);
  return jest.fn();
});
export const onIdTokenChanged = jest.fn((authInstance, callback) => {
  callback(mockUser);
  return jest.fn();
});
export const GoogleAuthProvider = jest.fn();

// Firebase Functions mocks
export const httpsCallable = jest.fn((functionsInstance, name) => {
  return jest.fn(() => Promise.resolve({ data: { success: true, message: `${name} called` } }));
});

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
