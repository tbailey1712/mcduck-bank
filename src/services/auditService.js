import { collection, addDoc, query, orderBy, limit, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Audit Service for logging security and operational events
 * Stores audit logs in Firestore for admin review
 */

// Audit event types
export const AUDIT_EVENTS = {
  // Authentication events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure', 
  LOGOUT: 'logout',
  
  // Transaction events
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_EDITED: 'transaction_edited',
  TRANSACTION_DELETED: 'transaction_deleted',
  
  // Administrative events
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  CONFIG_UPDATED: 'config_updated',
  CLOUD_FUNCTION_EXECUTED: 'cloud_function_executed',
  
  // Profile events
  PROFILE_UPDATED: 'profile_updated',
  
  // Security events
  UNAUTHORIZED_ACCESS_ATTEMPT: 'unauthorized_access_attempt',
  PERMISSION_DENIED: 'permission_denied'
};

/**
 * Remove undefined values from an object and convert Date objects to Timestamps
 */
const cleanUndefinedValues = (obj) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value instanceof Date) {
        // Convert Date objects to Firestore Timestamps
        cleaned[key] = Timestamp.fromDate(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = cleanUndefinedValues(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
};

/**
 * Get user's IP address and additional client info
 */
const getClientInfo = async () => {
  try {
    // Get IP address from external service
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    
    return {
      ip_address: data.ip,
      user_agent: navigator.userAgent,
      browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 
               navigator.userAgent.includes('Firefox') ? 'Firefox' :
               navigator.userAgent.includes('Safari') ? 'Safari' : 'Other',
      platform: navigator.platform,
      language: navigator.language
    };
  } catch (error) {
    console.warn('Could not get IP address:', error);
    return {
      ip_address: 'unknown',
      user_agent: navigator.userAgent,
      browser: 'unknown',
      platform: navigator.platform,
      language: navigator.language
    };
  }
};

/**
 * Log an audit event to Firestore
 * @param {string} eventType - Type of event (from AUDIT_EVENTS)
 * @param {Object} user - User object who performed the action
 * @param {Object} details - Additional details about the event
 * @param {Object} target - Target of the action (optional)
 */
export const logAuditEvent = async (eventType, user, details = {}, target = null) => {
  try {
    const clientInfo = await getClientInfo();
    
    const auditLog = cleanUndefinedValues({
      // Event information
      event_type: eventType,
      timestamp: Timestamp.fromDate(new Date()),
      
      // User information
      user_id: user?.uid || 'unknown',
      user_email: user?.email || 'unknown',
      user_name: user?.displayName || user?.email?.split('@')[0] || 'unknown',
      is_admin: user?.administrator || user?.isAdmin || false,
      
      // Client information
      ...clientInfo,
      
      // Event details
      details: cleanUndefinedValues({
        ...details,
        // Add common context
        page_url: window.location.href,
        page_path: window.location.pathname
      }),
      
      // Target information (for actions on other users/entities)
      target: target ? cleanUndefinedValues({
        target_id: target.id || target.user_id,
        target_type: target.type || 'user',
        target_email: target.email,
        target_name: target.displayName || target.name
      }) : null,
      
      // Metadata
      session_id: sessionStorage.getItem('session_id') || 'unknown',
      created_at: Timestamp.fromDate(new Date())
    });
    
    // Add to audit_logs collection
    console.log(`📊 Attempting to create audit log: ${eventType}`, auditLog);
    
    const docRef = await addDoc(collection(db, 'audit_logs'), auditLog);
    
    console.log(`✅ Audit log created successfully: ${eventType}`, { id: docRef.id });
    
    return docRef.id;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error - audit logging should not break app functionality
  }
};

/**
 * Log authentication events
 */
export const logAuthEvent = async (eventType, user, details = {}) => {
  return logAuditEvent(eventType, user, {
    ...details,
    auth_method: 'google_oauth',
    session_start: eventType === AUDIT_EVENTS.LOGIN_SUCCESS ? new Date() : undefined
  });
};

/**
 * Log transaction events
 */
export const logTransactionEvent = async (eventType, user, transactionData, target = null) => {
  // Filter out undefined values to avoid Firestore errors
  const details = {
    transaction_id: transactionData.id,
    transaction_type: transactionData.transaction_type || transactionData.transactionType,
    amount: transactionData.amount,
    description: transactionData.description || transactionData.comment
  };

  // Only add optional fields if they have values
  if (transactionData.previous_amount !== undefined) {
    details.previous_amount = transactionData.previous_amount;
  }
  if (transactionData.balance_after !== undefined) {
    details.balance_after = transactionData.balance_after;
  }
  if (transactionData.request_type !== undefined) {
    details.request_type = transactionData.request_type;
  }
  if (transactionData.initiated_by !== undefined) {
    details.initiated_by = transactionData.initiated_by;
  }
  if (transactionData.deleted_at !== undefined) {
    details.deleted_at = transactionData.deleted_at;
  }
  if (transactionData.edited_from !== undefined) {
    details.edited_from = transactionData.edited_from;
  }
  if (transactionData.deleted_from !== undefined) {
    details.deleted_from = transactionData.deleted_from;
  }

  return logAuditEvent(eventType, user, details, target);
};

/**
 * Log administrative events
 */
export const logAdminEvent = async (eventType, user, details = {}, target = null) => {
  return logAuditEvent(eventType, user, {
    ...details,
    admin_action: true,
    requires_review: details.sensitive || false
  }, target);
};

/**
 * Log profile update events
 */
export const logProfileEvent = async (eventType, user, changes = {}) => {
  return logAuditEvent(eventType, user, {
    profile_changes: changes,
    fields_updated: Object.keys(changes)
  });
};

/**
 * Get audit logs (admin only)
 * @param {Object} filters - Filter options
 * @param {number} limitCount - Number of logs to return
 */
export const getAuditLogs = async (filters = {}, limitCount = 100) => {
  try {
    console.log('🔍 Getting audit logs with filters:', filters);
    
    let q = collection(db, 'audit_logs');
    
    // Apply filters
    if (filters.user_id) {
      console.log('📝 Adding user_id filter:', filters.user_id);
      q = query(q, where('user_id', '==', filters.user_id));
    }
    
    if (filters.event_type) {
      console.log('📝 Adding event_type filter:', filters.event_type);
      q = query(q, where('event_type', '==', filters.event_type));
    }
    
    // Temporarily disable start_date filter for debugging
    if (filters.start_date && false) {
      console.log('📝 Adding start_date filter:', filters.start_date);
      q = query(q, where('timestamp', '>=', Timestamp.fromDate(filters.start_date)));
    }
    
    if (filters.end_date) {
      console.log('📝 Adding end_date filter:', filters.end_date);
      q = query(q, where('timestamp', '<=', Timestamp.fromDate(filters.end_date)));
    }
    
    // Order by timestamp (most recent first) and limit
    q = query(q, orderBy('timestamp', 'desc'), limit(limitCount));
    
    console.log('🔎 Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    
    console.log('📊 Query returned', querySnapshot.docs.length, 'documents');
    
    const logs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Handle timestamp with better error checking
      let timestamp;
      try {
        if (data.timestamp?.toDate) {
          timestamp = data.timestamp.toDate();
        } else if (data.timestamp) {
          timestamp = new Date(data.timestamp);
        } else {
          timestamp = new Date(); // fallback to current time
        }
        
        // Validate timestamp
        if (isNaN(timestamp.getTime())) {
          console.warn('⚠️ Invalid timestamp for log:', doc.id, 'raw timestamp:', data.timestamp);
          timestamp = new Date(); // fallback to current time
        }
      } catch (error) {
        console.warn('⚠️ Error processing timestamp for log:', doc.id, error);
        timestamp = new Date(); // fallback to current time
      }
      
      // Handle created_at with better error checking
      let created_at;
      try {
        if (data.created_at?.toDate) {
          created_at = data.created_at.toDate();
        } else if (data.created_at) {
          created_at = new Date(data.created_at);
        } else {
          created_at = timestamp; // fallback to timestamp
        }
        
        // Validate created_at
        if (isNaN(created_at.getTime())) {
          console.warn('⚠️ Invalid created_at for log:', doc.id, 'raw created_at:', data.created_at);
          created_at = timestamp; // fallback to timestamp
        }
      } catch (error) {
        console.warn('⚠️ Error processing created_at for log:', doc.id, error);
        created_at = timestamp; // fallback to timestamp
      }
      
      console.log('📄 Processing log document:', doc.id, 'timestamp:', timestamp, 'event:', data.event_type);
      
      return {
        id: doc.id,
        ...data,
        timestamp,
        created_at
      };
    });
    
    console.log('✅ Returning', logs.length, 'processed logs');
    return logs;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
};

/**
 * Get audit log statistics (admin only)
 */
export const getAuditStats = async (timeframe = '24h') => {
  try {
    // Temporarily disable date filtering for stats to match logs display
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );
    
    const querySnapshot = await getDocs(q);
    const logs = querySnapshot.docs.map(doc => doc.data());
    
    // Calculate statistics
    const now = new Date();
    const stats = {
      total_events: logs.length,
      unique_users: new Set(logs.map(log => log.user_id)).size,
      unique_ips: new Set(logs.map(log => log.ip_address)).size,
      event_types: {},
      timeframe: 'All Time',
      start_date: null,
      end_date: now
    };
    
    // Count by event type
    logs.forEach(log => {
      stats.event_types[log.event_type] = (stats.event_types[log.event_type] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    throw error;
  }
};

/**
 * Initialize session tracking
 */
export const initializeSession = () => {
  if (!sessionStorage.getItem('session_id')) {
    sessionStorage.setItem('session_id', `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }
};

// Initialize session on service load
initializeSession();

export default {
  logAuditEvent,
  logAuthEvent,
  logTransactionEvent,
  logAdminEvent,
  logProfileEvent,
  getAuditLogs,
  getAuditStats,
  AUDIT_EVENTS
};