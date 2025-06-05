# Service Layer Migration Guide

## Overview
The service layer has been consolidated into a unified `apiService.js` to eliminate duplication, improve error handling, and provide consistent APIs across the application.

## What Changed

### Before (Multiple Services)
- `userService.js` - User data operations
- `dataService.js` - Mixed data operations with auth checks
- `transactionService.js` - Transaction operations and processing

### After (Unified Service)
- `apiService.js` - All Firebase operations with consistent error handling
- Deprecated services maintained for backward compatibility

## Key Improvements

### 1. **Consistent Error Handling**
```javascript
// Before - Different error patterns
try {
  const data = await getUserData(id);
  return data || null;
} catch (error) {
  console.error(error);
  return null;
}

// After - Structured responses
const result = await apiService.getUserData(id, authUser);
if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error, result.context);
}
```

### 2. **Unified Permission Checking**
```javascript
// Before - Inconsistent auth checks scattered across services
if (!authUser || authUser.uid === identifier || userData.administrator) {
  // Access allowed
}

// After - Centralized permission utility
const hasPermission = (authUser, targetUserId, userData = null) => {
  // Consistent permission logic
}
```

### 3. **Standardized Data Transformation**
```javascript
// Before - Different transformation patterns
return {
  ...userData,
  id: querySnapshot.docs[0].id,
  email: email,
  user_id: userData.user_id
};

// After - Consistent transformation utilities
const transformUserData = (docData, docId) => ({
  ...docData,
  id: docId,
  user_id: docData.user_id || docId,
  // ... consistent fields
});
```

## Migration Path

### Immediate (Backward Compatible)
Existing code continues to work with deprecation warnings:
```javascript
// This still works but shows warnings
import { getUserData } from '../services/userService';
const userData = await getUserData(email);
```

### Recommended (New API)
```javascript
// New unified API
import apiService from '../services/apiService';

const result = await apiService.getUserData(identifier, authUser);
if (result.success) {
  const userData = result.data;
  // Handle success
} else {
  // Handle error with result.error and result.context
}
```

## New Features

### 1. **Built-in Pagination**
```javascript
const result = await apiService.getTransactionsPaginated(userId, {
  page: 0,
  pageSize: 20,
  authUser: currentUser
});

// Returns: { transactions, pagination: { hasNextPage, hasPreviousPage, ... } }
```

### 2. **Flexible Query Options**
```javascript
const result = await apiService.getTransactions(userId, {
  authUser: currentUser,
  orderByField: 'timestamp',
  orderDirection: 'desc',
  limitCount: 50
});
```

### 3. **Admin Operations**
```javascript
// Get all users (admin only)
const result = await apiService.getAllUsers(adminUser);

// Get all transactions (admin only)  
const result = await apiService.getAllTransactions(adminUser, {
  limitCount: 100
});
```

## Component Updates

### PaginatedTransactionTable
New component that provides:
- Server-side pagination
- Client-side filtering and search
- Export capabilities
- Responsive design
- Performance optimizations

### Smart Component Loading
AccountOverview now automatically chooses the best component:
- **Simple Table** (< 20 transactions) - Fast, lightweight
- **Paginated Table** (20-100 transactions) - Server pagination, filtering
- **Virtualized List** (> 100 transactions) - Virtual scrolling, optimal performance

## Performance Benefits

### 1. **Reduced Bundle Duplication**
- Eliminated duplicate Firebase query logic
- Consolidated error handling utilities
- Shared transformation functions

### 2. **Optimized Data Loading**
- Pagination reduces initial load times
- Lazy loading for large datasets
- Efficient re-render prevention

### 3. **Better Memory Management**
- Consistent subscription cleanup
- Proper error boundary handling
- Optimized state management

## Error Handling

### Structured Error Responses
```javascript
{
  success: false,
  error: "Permission denied",
  code: "permission-denied",
  context: { userId: "123", operation: "getUserData" }
}
```

### Success Responses
```javascript
{
  success: true,
  data: { /* actual data */ },
  operation: "getUserData",
  context: { userId: "123" }
}
```

## Best Practices

### 1. **Always Check Success**
```javascript
const result = await apiService.getUserData(id, authUser);
if (!result.success) {
  // Handle error appropriately
  console.error(result.error);
  return;
}
```

### 2. **Use Proper Auth Context**
```javascript
// Always pass authUser for permission checks
const result = await apiService.getTransactions(userId, { authUser });
```

### 3. **Handle Loading States**
```javascript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const result = await apiService.getUserData(id, authUser);
    // Handle result
  } finally {
    setLoading(false);
  }
};
```

## Timeline

### Phase 1 (Current) ✅
- New `apiService.js` implemented
- Backward compatibility maintained
- Deprecation warnings added

### Phase 2 (Recommended)
- Migrate critical paths to new API
- Update component integrations
- Add comprehensive error handling

### Phase 3 (Future)
- Remove deprecated services
- Complete migration
- Performance optimizations

## Testing

All existing tests continue to work. New API includes:
- Structured error testing
- Permission validation tests
- Pagination functionality tests
- Performance benchmarks

---

For questions or migration assistance, refer to the new `apiService.js` documentation or check the component examples in `PaginatedTransactionTable.js`.