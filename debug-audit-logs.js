#!/usr/bin/env node

/**
 * Debug Audit Logs Timestamp Issue
 * 
 * This script examines audit log documents in Firestore to understand 
 * why timestamps might all be showing the same value.
 */

const admin = require('firebase-admin');
const fs = require('fs');

async function debugAuditLogs() {
  try {
    // Initialize Firebase Admin
    if (!fs.existsSync('./serviceAccountKey.json')) {
      console.log('❌ Please download serviceAccountKey.json from Firebase Console');
      console.log('   Project Settings → Service Accounts → Generate new private key');
      return;
    }

    const serviceAccount = require('./serviceAccountKey.json');
    
    // Check if already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    const db = admin.firestore();

    console.log('🔍 Debugging audit logs timestamps...');
    console.log('=====================================');

    // 1. Get some audit logs to examine
    console.log('\n1️⃣ Fetching audit logs...');
    const logsQuery = await db.collection('audit_logs')
      .limit(10)
      .get();

    if (logsQuery.empty) {
      console.log('❌ No audit logs found in the database');
      return;
    }

    console.log(`✅ Found ${logsQuery.size} audit logs`);

    // 2. Examine each log document structure
    console.log('\n2️⃣ Examining audit log document structures...');
    logsQuery.forEach((doc, index) => {
      const data = doc.data();
      
      console.log(`\n--- Log ${index + 1} (ID: ${doc.id}) ---`);
      console.log(`Event Type: ${data.event_type}`);
      console.log(`User: ${data.user_email}`);
      
      // Check timestamp field
      if (data.timestamp) {
        console.log(`✅ Has 'timestamp' field:`);
        console.log(`   Type: ${typeof data.timestamp}`);
        console.log(`   Constructor: ${data.timestamp.constructor.name}`);
        if (data.timestamp.toDate) {
          console.log(`   As Date: ${data.timestamp.toDate().toISOString()}`);
          console.log(`   Timestamp (ms): ${data.timestamp.toDate().getTime()}`);
        } else {
          console.log(`   Raw value: ${data.timestamp}`);
        }
      } else {
        console.log(`❌ No 'timestamp' field`);
      }
      
      // Check created_at field (legacy)
      if (data.created_at) {
        console.log(`✅ Has 'created_at' field:`);
        console.log(`   Type: ${typeof data.created_at}`);
        console.log(`   Constructor: ${data.created_at.constructor.name}`);
        if (data.created_at.toDate) {
          console.log(`   As Date: ${data.created_at.toDate().toISOString()}`);
          console.log(`   Timestamp (ms): ${data.created_at.toDate().getTime()}`);
        } else {
          console.log(`   Raw value: ${data.created_at}`);
        }
      } else {
        console.log(`ℹ️ No 'created_at' field`);
      }
      
      // Show other timestamp-related fields
      console.log(`Other fields:`, Object.keys(data).filter(key => 
        key.includes('time') || key.includes('date')
      ));
    });

    // 3. Check for duplicate timestamps
    console.log('\n3️⃣ Checking for duplicate timestamps...');
    const timestamps = [];
    logsQuery.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp || data.created_at;
      if (timestamp && timestamp.toDate) {
        timestamps.push(timestamp.toDate().getTime());
      }
    });

    const uniqueTimestamps = [...new Set(timestamps)];
    console.log(`Total logs examined: ${timestamps.length}`);
    console.log(`Unique timestamps: ${uniqueTimestamps.length}`);
    
    if (uniqueTimestamps.length === 1 && timestamps.length > 1) {
      console.log(`⚠️ ISSUE FOUND: All logs have the same timestamp!`);
      console.log(`   Timestamp: ${new Date(uniqueTimestamps[0]).toISOString()}`);
    } else if (uniqueTimestamps.length < timestamps.length) {
      console.log(`⚠️ Some duplicate timestamps found`);
      
      // Group by timestamp to see duplicates
      const timestampGroups = {};
      timestamps.forEach(ts => {
        timestampGroups[ts] = (timestampGroups[ts] || 0) + 1;
      });
      
      Object.entries(timestampGroups).forEach(([ts, count]) => {
        if (count > 1) {
          console.log(`   ${new Date(parseInt(ts)).toISOString()}: ${count} logs`);
        }
      });
    } else {
      console.log(`✅ All timestamps are unique`);
    }

    // 4. Show timestamp distribution
    console.log('\n4️⃣ Timestamp distribution...');
    timestamps.sort((a, b) => a - b);
    if (timestamps.length > 0) {
      console.log(`   Earliest: ${new Date(timestamps[0]).toISOString()}`);
      console.log(`   Latest:   ${new Date(timestamps[timestamps.length - 1]).toISOString()}`);
      console.log(`   Span:     ${((timestamps[timestamps.length - 1] - timestamps[0]) / 1000 / 60).toFixed(1)} minutes`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  debugAuditLogs();
}

module.exports = { debugAuditLogs };