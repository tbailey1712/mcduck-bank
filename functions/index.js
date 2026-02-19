const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");
// Note: onCall functions handle CORS internally via the Firebase SDK.
// For any future onRequest endpoints, use this CORS middleware:
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["https://mcduck-bank-2025.web.app", "https://mcduck-bank-2025.firebaseapp.com"];
const cors = require("cors")({ origin: allowedOrigins });

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Set global options
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1"
});

// Set SendGrid API key from environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Telegram Bot API helper
const sendTelegramMessage = async (message) => {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  return axios.post(url, {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });
};

/**
 * Utility Functions
 */

// Fetch interest rate from system config
const fetchInterestRate = async () => {
  try {
    const configRef = db.collection('system').doc('config');
    const configSnap = await configRef.get();
    
    if (configSnap.exists) {
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

// Calculate account balance for a user (optimized)
const getAccountBalance = async (userId) => {
  try {
    // Look up account by UID (doc ID), fall back to email-keyed doc during transition
    let accountRef = db.collection('accounts').doc(userId);
    let accountSnapshot = await accountRef.get();
    if (!accountSnapshot.exists) {
      const q = await db.collection('accounts').where('user_id', '==', userId).limit(1).get();
      if (!q.empty) {
        accountRef = q.docs[0].ref;
        accountSnapshot = q.docs[0];
      }
    }
    
    if (accountSnapshot.exists) {
      const accountData = accountSnapshot.data();
      // Use cached balance if it exists and was updated recently
      if (accountData.balance !== undefined && accountData.lastBalanceUpdate) {
        const lastUpdate = accountData.lastBalanceUpdate.toDate();
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        
        // Use cached balance if updated within last 24 hours
        if (hoursSinceUpdate < 24) {
          console.log(`Using cached balance for user ${userId}: $${accountData.balance}`);
          return accountData.balance;
        }
      }
    }
    
    // Calculate balance from transactions (with optimization)
    console.log(`Calculating fresh balance for user ${userId}...`);
    const transactionsRef = db.collection('transactions')
      .where('user_id', '==', userId)
      .orderBy('timestamp', 'desc'); // Get newest first for early termination if needed
    
    const querySnapshot = await transactionsRef.get();
    
    let balance = 0;
    let transactionCount = 0;
    
    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      const type = transaction.transaction_type;
      const amount = transaction.amount || 0;
      
      if (['deposit', 'interest'].includes(type)) {
        balance += amount;
      } else if (['withdrawal', 'service_charge', 'bankfee'].includes(type)) {
        balance -= amount;
      }
      transactionCount++;
    });
    
    console.log(`Calculated balance for ${userId}: $${balance} from ${transactionCount} transactions`);
    
    // Cache the calculated balance for future use
    try {
      await accountRef.set({
        balance: balance,
        lastBalanceUpdate: admin.firestore.Timestamp.now(),
        transactionCount: transactionCount
      }, { merge: true });
      console.log(`Cached balance for user ${userId}`);
    } catch (cacheError) {
      console.warn(`Could not cache balance for user ${userId}:`, cacheError);
      // Don't fail the whole operation if caching fails
    }
    
    return balance;
  } catch (error) {
    console.error(`Error calculating balance for user ${userId}:`, error);
    return 0;
  }
};

// Check if interest has been paid this month for a user
const hasInterestPaidThisMonth = async (userId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const transactionsRef = db.collection('transactions')
      .where('user_id', '==', userId)
      .where('transaction_type', '==', 'interest')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfMonth));
    
    const querySnapshot = await transactionsRef.get();
    return !querySnapshot.empty;
  } catch (error) {
    console.error(`Error checking interest payment for user ${userId}:`, error);
    return false;
  }
};

// Fetch transactions for a specific month/year
const fetchTransactionsForAccount = async (userId, year, month) => {
  try {
    console.log(`fetchTransactionsForAccount(${userId}, ${year}, ${month}): BEGIN`);

    const startDate = new Date(year, month - 1, 1); // month is 1-based
    const endDate = new Date(year, month, 1); // First day of next month
    
    const transactionsRef = db.collection('transactions')
      .where('user_id', '==', userId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('timestamp', '<', admin.firestore.Timestamp.fromDate(endDate))
      .orderBy('timestamp', 'desc');
    
    const querySnapshot = await transactionsRef.get();
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

// Use the correct email_statement.html template from public directory
const fetchEmailTemplate = async () => {
  try {
    // First try the correct template in public directory
    const templateUrl = process.env.SITE_URL 
      ? `${process.env.SITE_URL}/email_statement_template.html`
      : 'https://mcduck-bank-2025.web.app/email_statement_template.html';
    
    console.log(`Fetching email template from: ${templateUrl}`);
    
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
    }
    
    const templateContent = await response.text();
    
    // Validate this is actually an email template (not admin panel HTML)
    if (templateContent.includes('McDuck Bank - Monthly Statement') && 
        templateContent.includes('{{') && 
        templateContent.includes('}}')) {
      console.log('✅ Successfully loaded email template');
      return templateContent;
    } else {
      console.warn('⚠️ Fetched content does not appear to be a valid email template');
      throw new Error('Invalid template content');
    }
    
  } catch (error) {
    console.error('❌ Error fetching email template:', error);
    console.log('📧 Using built-in email template fallback');
    
    // Return the exact template that's stored in localStorage and working in Messages tab
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Statement</title>
    <style>
        /* Dark theme matching McDuck Bank app */
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #141416;
            color: #FFFFFF;
        }
        .statement-container {
            max-width: 900px;
            margin: auto;
            background-color: #252533;
            padding: 20px;
            border-radius: 8px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            margin: 0;
            color: #FFFFFF;
            border-bottom: 4px solid #FFC700;
            display: inline-block;
            padding-bottom: 8px;
        }
        .header p {
            color: #CCCCCC;
            margin-top: 8px;
        }
        .account-info {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .account-info td {
            padding: 8px;
            color: #CCCCCC;
        }
        .snapshot {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            flex: 1;
            background-color: #1E1E2E;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        .card-label {
            font-size: 0.9em;
            color: #CCCCCC;
            margin-bottom: 8px;
        }
        .card-value {
            font-size: 1.5em;
            font-weight: bold;
        }
        .card-balance .card-value { color: #FFC700; }
        .card-deposits .card-value { color: #4CAF50; }
        .card-withdrawals .card-value { color: #E57373; }
        .card-interest .card-value { color: #64B5F6; }
        .card-pending .card-value { color: #FFC700; }
        .transaction-table {
            width: 100%;
            border-collapse: collapse;
        }
        .transaction-table th, .transaction-table td {
            padding: 12px 8px;
            border-bottom: 1px solid #3A3A4E;
        }
        .transaction-table th {
            color: #FFFFFF;
            text-align: left;
        }
        .transaction-table td {
            color: #CCCCCC;
            vertical-align: middle;
        }
        .transaction-table tbody tr:hover td {
            background-color: #1E1E2E;
        }
        .type-pill {
            display: inline-block;
            padding: 4px 10px;
            border: 1px solid;
            border-radius: 16px;
            font-size: 0.9em;
        }
        .type-deposit {
            color: #4CAF50;
            border-color: #4CAF50;
        }
        .type-withdrawal {
            color: #E57373;
            border-color: #E57373;
        }
        .amount-positive {
            color: #4CAF50;
        }
        .amount-negative {
            color: #E57373;
        }
        /* Account Info Grid Styles */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .info-card {
            background-color: #1E1E2E;
            border-radius: 8px;
            padding: 16px;
            text-align: left;
        }
        .info-label {
            font-size: 0.85em;
            color: #CCCCCC;
            margin-bottom: 4px;
        }
        .info-value {
            font-size: 1.1em;
            color: #FFFFFF;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="statement-container">
        <div class="header">
            <h1>Account Monthly Statement</h1>
            <p>Statement Period: {{statementPeriod}}</p>
        </div>
        <div class="account-info">
            <div class="info-grid">
                <div class="info-card"><div class="info-label">Account Holder</div><div class="info-value">{{name}}</div></div>
                <div class="info-card"><div class="info-label">Account Number</div><div class="info-value">{{accountNumber}}</div></div>
                <div class="info-card"><div class="info-label">Account Type</div><div class="info-value">{{accountType}}</div></div>
                <div class="info-card"><div class="info-label">Statement Date</div><div class="info-value">{{date}}</div></div>
            </div>
        </div>
        <div class="snapshot">
            <div class="card card-balance">
                <div class="card-label">Current Balance</div>
                <div class="card-value">{{balance}}</div>
            </div>
            <div class="card card-deposits">
                <div class="card-label">Total Deposits</div>
                <div class="card-value">{{totalDeposits}}</div>
            </div>
            <div class="card card-withdrawals">
                <div class="card-label">Total Withdrawals</div>
                <div class="card-value">{{totalWithdrawals}}</div>
            </div>
            <div class="card card-interest">
                <div class="card-label">Interest Paid</div>
                <div class="card-value">{{interest}}</div>
            </div>
            <div class="card card-pending">
                <div class="card-label">Pending Withdrawal</div>
                <div class="card-value">{{pendingWithdrawals}}</div>
            </div>
        </div>
        <table class="transaction-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                {{transactionRows}}
            </tbody>
        </table>
    </div>
</body>
</html>`;
  }
};

// Apply template substitutions
const applyTemplateSubstitutions = (template, substitutions) => {
  let processedTemplate = template;
  
  Object.entries(substitutions).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    processedTemplate = processedTemplate.replace(placeholder, String(value || ''));
  });
  
  // Clean up any remaining placeholders
  processedTemplate = processedTemplate.replace(/{{.*?}}/g, '');
  
  return processedTemplate;
};

// Create monthly statement using the proper template
const createMonthlyStatement = async (account, transactions, year, month) => {
  try {
    // Calculate totals
    const balance = await getAccountBalance(account.user_id);
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let interestEarned = 0;

    // Calculate totals from transactions
    transactions.forEach(transaction => {
      const amount = transaction.amount || 0;
      const type = transaction.transaction_type;
      
      if (['deposit', 'interest'].includes(type)) {
        totalDeposits += amount;
        if (type === 'interest') {
          interestEarned += amount;
        }
      } else if (['withdrawal', 'service_charge', 'bankfee'].includes(type)) {
        totalWithdrawals += amount;
      }
    });

    // Generate transaction rows HTML
    const transactionRows = transactions.map(transaction => {
      const amount = transaction.amount || 0;
      const isDeposit = ['deposit', 'interest'].includes(transaction.transaction_type);
      const typeDisplay = transaction.transaction_type.charAt(0).toUpperCase() + 
                         transaction.transaction_type.slice(1).replace('_', ' ');
      const comment = transaction.comment || transaction.description || '';
      
      return `
        <tr>
          <td>${transaction.timestamp}</td>
          <td><span class="type-pill ${isDeposit ? 'type-deposit' : 'type-withdrawal'}">${typeDisplay}</span></td>
          <td class="${isDeposit ? 'amount-positive' : 'amount-negative'}">$${amount.toFixed(2)}</td>
          <td>${comment}</td>
        </tr>
      `;
    }).join('');

    // Fetch the email template
    const template = await fetchEmailTemplate();
    
    // Calculate statement period
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const statementPeriod = `${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`;
    
    // Prepare substitutions
    const currentDate = new Date();
    const substitutions = {
      name: account.displayName || account.name || 'Account Holder',
      accountNumber: account.user_id || '****1234',
      accountType: 'Premium Savings',
      date: currentDate.toLocaleDateString(),
      statementPeriod: statementPeriod,
      balance: `$${balance.toFixed(2)}`,
      totalDeposits: `$${totalDeposits.toFixed(2)}`,
      totalWithdrawals: `$${totalWithdrawals.toFixed(2)}`,
      interest: `$${interestEarned.toFixed(2)}`,
      pendingWithdrawals: '$0.00', // TODO: Calculate from withdrawal_tasks if needed
      transactionRows: transactionRows
    };

    // Apply substitutions to template
    return applyTemplateSubstitutions(template, substitutions);
  } catch (error) {
    console.error('Error creating monthly statement:', error);
    return 'Error generating statement';
  }
};

// Send email using SendGrid
const sendStatementEmail = async (email, subject, htmlContent) => {
  try {
    
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL || 'noreply@mcduckbank.com',
      subject: subject,
      html: htmlContent,
      // Create a plain text version by stripping HTML (basic)
      text: htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    };

    await sgMail.send(msg);
    console.log(`Email sent successfully to ${email}`);
    return { success: true };
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error);
    return { success: false, error: error.message };
  }
};

// Log job execution
const logJobExecution = async (jobName, results) => {
  try {
    const logEntry = {
      jobName,
      timestamp: admin.firestore.Timestamp.now(),
      results,
      executedBy: 'cloud-function'
    };

    await db.collection('job_logs').add(logEntry);
    console.log(`Job log created for ${jobName}`);
  } catch (error) {
    console.error('Error logging job execution:', error);
  }
};

/**
 * Admin Setup Functions
 */

// Admin setup function - requires existing admin privileges
exports.setupAdmin = onCall(
  {
    timeoutSeconds: 60,
    memory: "128MiB"
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new Error('unauthenticated: Must be authenticated to call this function.');
      }

      // SECURITY: Require caller to already be an admin
      const isAdmin = request.auth.token.administrator === true;
      if (!isAdmin) {
        throw new Error('permission-denied: Only existing admins can grant admin privileges.');
      }

      // Resolve the target user server-side to prevent spoofing
      let targetUser;
      if (request.data?.uid) {
        targetUser = await admin.auth().getUser(request.data.uid);
      } else if (request.data?.email) {
        targetUser = await admin.auth().getUserByEmail(request.data.email);
      } else {
        targetUser = await admin.auth().getUser(request.auth.uid);
      }

      const targetUid = targetUser.uid;
      const targetEmail = targetUser.email;
      console.log(`Admin ${request.auth.token.email} granting admin claim to: ${targetEmail} (${targetUid})`);

      // Merge with existing claims to avoid overwriting them
      const existingClaims = targetUser.customClaims || {};
      await admin.auth().setCustomUserClaims(targetUid, {
        ...existingClaims,
        administrator: true
      });

      console.log(`✅ Successfully set administrator claim for ${targetEmail}`);

      // Sync administrator field to Firestore — try UID doc first, then find by email
      try {
        let accountRef = db.collection('accounts').doc(targetUid);
        let accountSnap = await accountRef.get();
        if (!accountSnap.exists) {
          // Fallback: find by email field (transition period)
          const q = await db.collection('accounts').where('email', '==', targetEmail).limit(1).get();
          if (!q.empty) {
            accountRef = q.docs[0].ref;
          }
        }
        await accountRef.update({
          administrator: true,
          adminSince: admin.firestore.Timestamp.now()
        });
        console.log(`✅ Synced administrator field to Firestore for ${targetEmail}`);
      } catch (firestoreError) {
        console.warn(`⚠️ Could not sync admin field to Firestore for ${targetEmail}:`, firestoreError.message);
      }

      return {
        success: true,
        message: `Admin claim set for ${targetEmail}. Please refresh your browser to apply changes.`,
        userEmail: targetEmail,
        uid: targetUid
      };

    } catch (error) {
      console.error('❌ Error in setupAdmin:', error);
      throw new Error(`Admin setup failed: ${error.message}`);
    }
  }
);

/**
 * Cloud Functions
 */

// Generate and Send Monthly Statements Function
exports.sendStatements = onCall(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: "512MiB"
  },
  async (request) => {
    try {
      // 1. Enforce authentication
      if (!request.auth) {
        throw new Error('unauthenticated: The function must be called while authenticated.');
      }
      // 2. Enforce authorization (check for admin custom claim)
      const isAdmin = request.auth.token.administrator === true;
      if (!isAdmin) {
        throw new Error('permission-denied: Only admins can trigger this function.');
      }
        console.log('Starting monthly statements job...');
        
        const results = {
          totalProcessed: 0,
          emailsSent: 0,
          emailErrors: 0,
          errors: []
        };

        // Get current month/year or from request data
        const now = new Date();
        const targetYear = parseInt(request.data?.year) || now.getFullYear();
        const targetMonth = parseInt(request.data?.month) || (now.getMonth() + 1);
        const targetCustomerEmail = request.data?.customerEmail;

        console.log(`Generating statements for ${targetMonth}/${targetYear}${targetCustomerEmail ? ` for customer: ${targetCustomerEmail}` : ' for all customers'}`);

        // Get accounts - filter by specific customer if provided
        const accountsRef = db.collection('accounts');
        let accountsSnapshot;

        if (targetCustomerEmail) {
          // Find customer by email field (works for both UID-keyed and email-keyed docs)
          const emailQuery = await accountsRef.where('email', '==', targetCustomerEmail).limit(1).get();
          if (!emailQuery.empty) {
            accountsSnapshot = { docs: emailQuery.docs };
            console.log(`Found specific customer account: ${targetCustomerEmail}`);
          } else {
            throw new Error(`Customer not found: ${targetCustomerEmail}`);
          }
        } else {
          // Get all accounts (existing behavior)
          accountsSnapshot = await accountsRef.get();
        }

        for (const accountDoc of accountsSnapshot.docs) {
          try {
            const account = accountDoc.data();
            const userId = account.user_id;
            const email = account.email || accountDoc.id;
            const name = account.displayName || account.name || 'Account Holder';
            account.email = email;

            console.log(`Processing statement for ${email}`);

            // Fetch transactions for the specified month
            const transactions = await fetchTransactionsForAccount(userId, targetYear, targetMonth);

            // Create the statement text
            const statementText = await createMonthlyStatement(account, transactions, targetYear, targetMonth);

            results.totalProcessed++;

            // Send statement email
            if (process.env.SENDGRID_API_KEY && email) {
              const emailResult = await sendStatementEmail(
                email,
                `McDuck Bank: Monthly Statement for ${targetMonth}/${targetYear}`,
                statementText
              );

              if (emailResult.success) {
                results.emailsSent++;
                console.log(`Statement sent to ${email}`);
              } else {
                results.emailErrors++;
                results.errors.push(`Email failed for ${email}: ${emailResult.error}`);
              }
            } else {
              console.log(`Skipping email for ${email} - no SendGrid key or invalid email`);
            }

          } catch (error) {
            console.error(`Error processing account ${accountDoc.id}:`, error);
            results.errors.push(`${accountDoc.id}: ${error.message}`);
          }
        }

        // Log the job execution
        await logJobExecution('send_monthly_statements', results);

        console.log('Monthly statements job completed:', results);
        return {
          success: true,
          message: 'Monthly statements job completed',
          results: results
        };

      } catch (error) {
        console.error('Error in sendMonthlyStatements function:', error);
        throw new Error(`Monthly statements job failed: ${error.message}`);
      }
    }
);

// Health check endpoint
exports.healthCheck = onRequest(async (req, res) => {
  cors(req, res, () => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      functions: ['sendStatements', 'scheduledPayInterest', 'scheduledSendStatements', 'setupAdmin', 'sendTelegramNotification']
    });
  });
});

/**
 * Scheduled Functions - Automated Monthly Tasks
 */

// Pay interest automatically on the 1st of each month at 1:00 AM Central Time
exports.scheduledPayInterest = onSchedule({
  schedule: "0 1 1 * *", // 1:00 AM on the 1st day of every month
  timeZone: "America/Chicago", // Central Time
  region: "us-central1"
}, async (context) => {
  console.log('🕐 Scheduled Interest Payment started at:', new Date().toISOString());
  
  try {
    // Get all accounts with positive balances
    const accountsSnapshot = await db.collection('accounts').get();
    const interestResults = [];
    let totalInterestPaid = 0;
    
    const interestRate = (await fetchInterestRate()) / 100;
    console.log(`📊 Current interest rate: ${(interestRate * 100).toFixed(2)}%`);
    
    for (const accountDoc of accountsSnapshot.docs) {
      const accountData = accountDoc.data();
      const userId = accountData.user_id;
      const email = accountData.email || accountDoc.id;
      
      try {
        // Check if interest already paid this month
        const hasInterest = await hasInterestPaidThisMonth(userId);
        if (hasInterest) {
          console.log(`⏭️ Interest already paid this month for user: ${userId} (${email})`);
          continue;
        }
        
        // Calculate current balance
        const balance = await getAccountBalance(userId);
        
        if (balance > 0) {
          const interestAmount = balance * interestRate;
          
          // Create interest transaction
          const interestTransaction = {
            user_id: userId,
            amount: interestAmount,
            transaction_type: 'interest',
            comment: `Monthly interest payment (${(interestRate * 100).toFixed(2)}% on $${balance.toFixed(2)})`,
            timestamp: admin.firestore.Timestamp.now(),
            created_by: 'system_scheduler',
            automated: true
          };
          
          const docRef = await db.collection('transactions').add(interestTransaction);
          
          interestResults.push({
            userId,
            balance,
            interestAmount,
            transactionId: docRef.id
          });
          
          totalInterestPaid += interestAmount;
          
          console.log(`💰 Interest paid: $${interestAmount.toFixed(2)} to user ${userId} (balance: $${balance.toFixed(2)})`);
        }
      } catch (error) {
        console.error(`❌ Error processing interest for user ${userId}:`, error);
      }
    }
    
    console.log(`✅ Scheduled Interest Payment completed. Total paid: $${totalInterestPaid.toFixed(2)} to ${interestResults.length} accounts`);
    
    return {
      success: true,
      accountsProcessed: interestResults.length,
      totalInterestPaid: totalInterestPaid,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Scheduled Interest Payment failed:', error);
    throw error;
  }
});

// Send statements automatically on the 1st of each month at 2:00 AM Central Time  
exports.scheduledSendStatements = onSchedule({
  schedule: "0 2 1 * *", // 2:00 AM on the 1st day of every month
  timeZone: "America/Chicago", // Central Time
  region: "us-central1"
}, async (context) => {
  console.log('📧 Scheduled Statement Generation started at:', new Date().toISOString());
  
  try {
    // Get all accounts
    const accountsSnapshot = await db.collection('accounts').get();
    const statementResults = [];
    
    for (const accountDoc of accountsSnapshot.docs) {
      const accountData = accountDoc.data();
      const userId = accountData.user_id || accountDoc.id;
      const userEmail = accountData.email;
      
      if (!userEmail) {
        console.warn(`⚠️ No email found for user: ${userId}`);
        continue;
      }
      
      try {
        // Generate and send statement
        const result = await createAndSendStatement(userId, userEmail);
        
        statementResults.push({
          userId,
          email: userEmail,
          success: result.success,
          statementId: result.statementId
        });
        
        console.log(`📋 Statement sent to ${userEmail} (user: ${userId})`);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error sending statement to user ${userId}:`, error);
        statementResults.push({
          userId,
          email: userEmail,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = statementResults.filter(r => r.success).length;
    console.log(`✅ Scheduled Statement Generation completed. Sent ${successCount}/${statementResults.length} statements`);
    
    return {
      success: true,
      statementsGenerated: statementResults.length,
      successfulSends: successCount,
      results: statementResults,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Scheduled Statement Generation failed:', error);
    throw error;
  }
});

/**
 * Send Telegram notification
 * Cloud Function for sending Telegram notifications to admins about withdrawal requests
 */
exports.sendTelegramNotification = onCall(
  {
    timeoutSeconds: 540,
    memory: "256MiB"
  },
  async (request) => {
    try {
      // 1. Enforce authentication
      if (!request.auth) {
        throw new Error('unauthenticated: Must be authenticated to call this function.');
      }
      
      // 2. Enforce authorization (admin only for now)
      const isAdmin = request.auth.token.administrator === true;
      if (!isAdmin) {
        throw new Error('permission-denied: Only admins can send Telegram notifications.');
      }
      
      // 3. Validate required parameters
      const { message, type } = request.data;
      
      if (!message) {
        throw new Error('missing-parameter: "message" content is required.');
      }
      
      if (!type) {
        throw new Error('missing-parameter: "type" is required (e.g., withdrawal_request, test).');
      }
      
      // 4. Validate Telegram configuration
      console.log('🔍 Checking Telegram config:', {
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasChatId: !!process.env.TELEGRAM_CHAT_ID,
        chatId: process.env.TELEGRAM_CHAT_ID
      });
      
      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
        console.error('❌ Missing Telegram configuration');
        throw new Error('configuration-error: Telegram credentials not properly configured.');
      }
      
      console.log(`📱 Sending Telegram notification - Type: ${type}`);
      
      // 5. Format message with HTML
      const formattedMessage = `🏦 <b>McDuck Bank Notification</b>
      
<b>Type:</b> ${type}
<b>Time:</b> ${new Date().toLocaleString()}

${message}`;
      
      // 6. Send message via Telegram
      const response = await sendTelegramMessage(formattedMessage);
      
      console.log(`✅ Telegram message sent successfully - Message ID: ${response.data.result.message_id}`);
      
      // 7. Return success response
      return {
        success: true,
        message: 'Telegram notification sent successfully',
        messageId: response.data.result.message_id,
        type: type
      };
      
    } catch (error) {
      console.error('❌ Error sending Telegram notification:', error);
      
      // Handle Telegram API errors
      if (error.response?.data?.description) {
        throw new Error(`telegram-error: ${error.response.data.description}`);
      }
      
      // Re-throw other errors with context
      throw new Error(`telegram-send-failed: ${error.message}`);
    }
  }
);

// testSMS removed - was a debug function that should not be deployed to production

/**
 * Fix all accounts where user_id is email-based instead of Firebase UID.
 * Migrates account docs and all associated transactions/withdrawal_tasks.
 * Admin-only, one-time data migration.
 */
/**
 * Migrate account documents from email-keyed to UID-keyed.
 * For each account where doc ID contains '@', creates a new doc keyed by UID,
 * copies all data, and deletes the old email-keyed doc. Idempotent.
 */
exports.migrateAccountsToUidKeys = onCall(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new Error('unauthenticated: Must be authenticated.');
    }
    if (request.auth.token.administrator !== true) {
      throw new Error('permission-denied: Only admins can run this migration.');
    }

    console.log('🔄 Starting email-to-UID account migration...');
    const accountsSnapshot = await db.collection('accounts').get();
    const results = [];

    for (const accountDoc of accountsSnapshot.docs) {
      const docId = accountDoc.id;
      const data = accountDoc.data();

      // Skip if doc ID doesn't contain '@' (already UID-keyed)
      if (!docId.includes('@')) {
        results.push({ docId, status: 'skip', message: 'Already UID-keyed' });
        continue;
      }

      const uid = data.user_id;
      const email = data.email || docId;

      if (!uid || uid.includes('@')) {
        // user_id field is missing or is still an email — look up the real UID
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().getUserByEmail(email);
        } catch (err) {
          results.push({ docId, status: 'error', message: `No Firebase Auth user: ${err.message}` });
          continue;
        }
        data.user_id = firebaseUser.uid;
        data.uid = firebaseUser.uid;
      }

      const targetUid = data.user_id;

      // Check if UID-keyed doc already exists
      const existingUidDoc = await db.collection('accounts').doc(targetUid).get();
      if (existingUidDoc.exists) {
        // UID doc already exists — delete the old email-keyed doc
        await accountDoc.ref.delete();
        results.push({ docId, targetUid, status: 'dedup', message: 'UID doc existed, deleted email doc' });
        continue;
      }

      // Batch: create new UID-keyed doc + delete old email-keyed doc
      const batch = db.batch();
      const newRef = db.collection('accounts').doc(targetUid);
      batch.set(newRef, {
        ...data,
        email: email,
        user_id: targetUid,
        uid: targetUid,
        _migrated_from: docId,
        _migrated_at: admin.firestore.Timestamp.now()
      });
      batch.delete(accountDoc.ref);
      await batch.commit();

      results.push({ docId, targetUid, status: 'migrated' });
      console.log(`✅ Migrated ${docId} → ${targetUid}`);
    }

    const migrated = results.filter(r => r.status === 'migrated');
    const deduped = results.filter(r => r.status === 'dedup');
    console.log(`🏁 Migration complete: ${migrated.length} migrated, ${deduped.length} deduped, ${results.length} total`);

    return { success: true, totalAccounts: results.length, migrated: migrated.length, results };
  }
);

// ============================================================
// Account Management Cloud Functions
// ============================================================

/**
 * Create a new user account (replaces client-side account creation)
 * Only allows creating an account for the authenticated caller's own email
 */
exports.createAccount = onCall(
  { timeoutSeconds: 60, memory: "128MiB" },
  async (request) => {
    if (!request.auth) {
      throw new Error('unauthenticated: Must be authenticated to create an account.');
    }

    const email = request.auth.token.email;
    const uid = request.auth.uid;

    // Check if account already exists (by UID first, then email for transition)
    const existingByUid = await db.collection('accounts').doc(uid).get();
    if (existingByUid.exists) {
      return { success: true, account: existingByUid.data(), alreadyExists: true };
    }
    const existingByEmail = await db.collection('accounts').doc(email).get();
    if (existingByEmail.exists) {
      return { success: true, account: existingByEmail.data(), alreadyExists: true };
    }

    // Check system config for registration permission
    const configSnap = await db.collection('system').doc('config').get();
    const allowNewUsers = configSnap.exists ? (configSnap.data().allowNewUsers || false) : false;

    // Also check if caller is already an admin (admins always allowed)
    const isCallerAdmin = request.auth.token.administrator === true;

    if (!allowNewUsers && !isCallerAdmin) {
      console.log(`🚫 New user registration denied for ${email} (registration disabled)`);
      throw new Error('permission-denied: New user registration is currently disabled.');
    }

    const now = admin.firestore.Timestamp.now();
    const newAccount = {
      user_id: uid,
      uid: uid,
      email: email,
      displayName: request.auth.token.name || email,
      photoURL: request.auth.token.picture || '',
      emailVerified: request.auth.token.email_verified || false,
      administrator: false,
      balance: 0,
      createdAt: now,
      lastLogin: now,
      lastIp: request.rawRequest?.ip || request.rawRequest?.headers?.['x-forwarded-for'] || 'unknown',
      lastActivity: now
    };

    await db.collection('accounts').doc(uid).set(newAccount);
    console.log(`✅ New account created for ${email} (${uid}) — keyed by UID`);

    return { success: true, account: newAccount };
  }
);

/**
 * Update session info for the authenticated user (replaces client-side session writes)
 * Writes lastLogin, lastIp, lastSessionToken, lastActivity to the user's account
 */
exports.updateSessionInfo = onCall(
  { timeoutSeconds: 30, memory: "128MiB" },
  async (request) => {
    if (!request.auth) {
      throw new Error('unauthenticated: Must be authenticated to update session info.');
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const sessionToken = request.data?.sessionToken || '';
    const ip = request.rawRequest?.ip ||
               request.rawRequest?.headers?.['x-forwarded-for'] ||
               'unknown';

    // Try UID-keyed doc first, fall back to email-keyed for transition
    let accountRef = db.collection('accounts').doc(uid);
    let accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      accountRef = db.collection('accounts').doc(email);
      accountSnap = await accountRef.get();
    }

    if (!accountSnap.exists) {
      throw new Error('not-found: Account not found.');
    }

    await accountRef.update({
      lastLogin: admin.firestore.Timestamp.now(),
      lastIp: ip,
      lastSessionToken: sessionToken,
      lastActivity: admin.firestore.Timestamp.now()
    });

    return { success: true };
  }
);

/**
 * Merge account when a user's Firebase UID changes (replaces client-side merge)
 * Updates account UID fields and migrates transactions/withdrawal_tasks
 */
exports.mergeAccount = onCall(
  { timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new Error('unauthenticated: Must be authenticated to merge account.');
    }

    const email = request.auth.token.email;
    const newUid = request.auth.uid;

    // Try UID-keyed doc first, fall back to email-keyed for transition
    let accountRef = db.collection('accounts').doc(newUid);
    let accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      accountRef = db.collection('accounts').doc(email);
      accountSnap = await accountRef.get();
    }

    if (!accountSnap.exists) {
      throw new Error('not-found: Account not found for merge.');
    }

    const accountData = accountSnap.data();
    const oldUid = accountData.user_id;

    if (oldUid === newUid && accountSnap.id === newUid) {
      return { success: true, message: 'No merge needed', migratedTransactions: 0 };
    }

    console.log(`🔄 Merging account ${email}: ${oldUid} → ${newUid}`);

    // If doc is still email-keyed, re-key it to UID
    if (accountSnap.id !== newUid) {
      const newRef = db.collection('accounts').doc(newUid);
      const batch = db.batch();
      batch.set(newRef, {
        ...accountData,
        user_id: newUid,
        uid: newUid,
        email: email,
        previousUserId: oldUid,
        lastMerged: admin.firestore.Timestamp.now(),
        photoURL: request.auth.token.picture || accountData.photoURL || '',
        displayName: request.auth.token.name || accountData.displayName || email,
        emailVerified: request.auth.token.email_verified || false,
        _migrated_from: accountSnap.id
      });
      batch.delete(accountRef);
      await batch.commit();
      accountRef = newRef;
    } else {
      // Doc is already UID-keyed, just update fields
      await accountRef.update({
        user_id: newUid,
        uid: newUid,
        previousUserId: oldUid,
        lastMerged: admin.firestore.Timestamp.now(),
        photoURL: request.auth.token.picture || accountData.photoURL || '',
        displayName: request.auth.token.name || accountData.displayName || email,
        emailVerified: request.auth.token.email_verified || false
      });
    }

    // Migrate transactions in batches of 500
    let totalMigrated = 0;
    const txnQuery = await db.collection('transactions')
      .where('user_id', '==', oldUid).get();

    let txnBatch = db.batch();
    let batchCount = 0;
    for (const txnDoc of txnQuery.docs) {
      txnBatch.update(txnDoc.ref, { user_id: newUid });
      batchCount++;
      totalMigrated++;
      if (batchCount >= 500) {
        await txnBatch.commit();
        txnBatch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await txnBatch.commit();
    }

    // Migrate withdrawal tasks
    const taskQuery = await db.collection('withdrawal_tasks')
      .where('user_id', '==', oldUid).get();

    if (!taskQuery.empty) {
      let taskBatch = db.batch();
      let taskBatchCount = 0;
      for (const taskDoc of taskQuery.docs) {
        taskBatch.update(taskDoc.ref, { user_id: newUid });
        taskBatchCount++;
        if (taskBatchCount >= 500) {
          await taskBatch.commit();
          taskBatch = db.batch();
          taskBatchCount = 0;
        }
      }
      if (taskBatchCount > 0) {
        await taskBatch.commit();
      }
    }

    console.log(`✅ Account merged for ${email}: migrated ${totalMigrated} transactions`);

    return {
      success: true,
      message: `Account merged successfully`,
      migratedTransactions: totalMigrated
    };
  }
);

// Helper function to create and send individual statement
const createAndSendStatement = async (userId, userEmail) => {
  // Get previous month's date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  // Generate statement
  const statement = await createMonthlyStatement(userId, startOfMonth, endOfMonth);
  
  if (statement.transactions.length === 0) {
    console.log(`📭 No transactions for ${userEmail}, skipping statement`);
    return { success: true, statementId: null, skipped: true };
  }
  
  // Send statement email
  await sendStatementEmail(userEmail, statement);
  
  return {
    success: true,
    statementId: statement.id,
    transactionCount: statement.transactions.length
  };
};