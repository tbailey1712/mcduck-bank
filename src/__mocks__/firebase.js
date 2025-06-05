// Mock Firebase functions for testing

const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

// Mock Firebase Auth
export const auth = {
  currentUser: mockUser,
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((callback) => {
    // Simulate authenticated user
    callback(mockUser);
    // Return unsubscribe function
    return jest.fn();
  }),
  signInWithPopup: jest.fn(() => Promise.resolve({ user: mockUser })),
};

// Mock Firestore
export const db = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(() =>
        Promise.resolve({
          exists: true,
          data: () => mockUser,
          id: 'test-doc-id',
        })
      ),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
    })),
    add: jest.fn(() =>
      Promise.resolve({
        id: 'new-doc-id',
      })
    ),
    where: jest.fn(() => ({
      get: jest.fn(() =>
        Promise.resolve({
          docs: [
            {
              id: 'doc-id',
              data: () => mockUser,
              exists: true,
            },
          ],
          empty: false,
        })
      ),
    })),
    orderBy: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({
            docs: [],
            empty: true,
          })
        ),
      })),
    })),
  })),
};

// Mock Firebase config
export const getFirebaseInfo = jest.fn(() => ({
  projectId: 'test-project',
  authDomain: 'test-project.firebaseapp.com',
  isEmulator: false,
  environment: 'test',
  debugEnabled: true,
}));

// Mock Firestore functions
export const addDoc = jest.fn(() =>
  Promise.resolve({
    id: 'new-doc-id',
  })
);

export const updateDoc = jest.fn(() => Promise.resolve());
export const deleteDoc = jest.fn(() => Promise.resolve());
export const getDoc = jest.fn(() =>
  Promise.resolve({
    exists: () => true,
    data: () => mockUser,
    id: 'test-doc-id',
  })
);

export const getDocs = jest.fn(() =>
  Promise.resolve({
    docs: [
      {
        id: 'doc-1',
        data: () => mockUser,
      },
    ],
    empty: false,
  })
);

export const onSnapshot = jest.fn((query, callback) => {
  // Simulate real-time update
  callback({
    docs: [
      {
        id: 'doc-1',
        data: () => mockUser,
      },
    ],
    empty: false,
  });
  
  // Return unsubscribe function
  return jest.fn();
});

export const collection = jest.fn(() => 'mock-collection-ref');
export const doc = jest.fn(() => 'mock-doc-ref');
export const query = jest.fn(() => 'mock-query');
export const where = jest.fn(() => 'mock-where-constraint');
export const orderBy = jest.fn(() => 'mock-orderby-constraint');
export const limit = jest.fn(() => 'mock-limit-constraint');

// Default export
export default {
  auth,
  db,
  getFirebaseInfo,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
};