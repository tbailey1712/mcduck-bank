const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const cors = require("cors")({ origin: true });

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
const getAccountBalance = async (userId, emailForCache = null) => {
  try {
    // Find the existing account document first
    let accountRef;
    let accountSnapshot;
    
    if (emailForCache) {
      // Look for existing account by user_id first, not by email
      const accountQuery = await db.collection('accounts').where('user_id', '==', userId).limit(1).get();
      if (!accountQuery.empty) {
        accountRef = accountQuery.docs[0].ref;
        accountSnapshot = accountQuery.docs[0];
      } else {
        // Fallback to user_id as document ID if no account found
        accountRef = db.collection('accounts').doc(userId);
        accountSnapshot = await accountRef.get();
      }
    } else {
      accountRef = db.collection('accounts').doc(userId);
      accountSnapshot = await accountRef.get();
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
    const balance = await getAccountBalance(account.user_id, account.email);
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

// One-time admin setup function
exports.setupAdmin = onCall(
  {
    timeoutSeconds: 60,
    memory: "128MiB"
  },
  async (request) => {
    try {
      // This function can only be called by authenticated users
      if (!request.auth) {
        throw new Error('unauthenticated: Must be authenticated to call this function.');
      }
      
      const userEmail = request.auth.token.email;
      console.log(`Setting up admin claim for: ${userEmail}`);
      
      // Set admin custom claim for the calling user
      await admin.auth().setCustomUserClaims(request.auth.uid, {
        administrator: true
      });
      
      console.log(`✅ Successfully set administrator claim for ${userEmail}`);
      
      return {
        success: true,
        message: `Admin claim set for ${userEmail}. Please refresh your browser to apply changes.`,
        userEmail: userEmail,
        uid: request.auth.uid
      };
      
    } catch (error) {
      console.error('❌ Error in setupAdmin:', error);
      throw new Error(`Admin setup failed: ${error.message}`);
    }
  }
);

// Emergency cleanup function to delete wrong account documents
exports.cleanupWrongAccounts = onCall(
  {
    timeoutSeconds: 60,
    memory: "128MiB"
  },
  async (request) => {
    try {
      // Only allow admin users
      if (!request.auth) {
        throw new Error('unauthenticated: Must be authenticated to call this function.');
      }
      
      const isAdmin = request.auth.token.administrator === true;
      if (!isAdmin) {
        throw new Error('permission-denied: Only admins can cleanup accounts.');
      }
      
      // These are the wrong account documents that were created (using UIDs as doc IDs)
      const wrongAccountIds = [
        'PK5DaE2Cd2cE1KynZuSyawkRmZA3',
        'TJEZ0fCPMESFez0HNCl0dEu8UlA3', 
        'drgZjPBSvXRQTwOoitunqmzkg1n2'
      ];
      
      console.log('🗑️ Deleting incorrectly created account documents...');
      
      const results = [];
      for (const wrongId of wrongAccountIds) {
        try {
          await db.collection('accounts').doc(wrongId).delete();
          console.log(`✅ Deleted wrong account document: ${wrongId}`);
          results.push(`✅ Deleted: ${wrongId}`);
        } catch (error) {
          console.error(`❌ Error deleting ${wrongId}:`, error);
          results.push(`❌ Failed to delete: ${wrongId} - ${error.message}`);
        }
      }
      
      return {
        success: true,
        message: 'Cleanup completed',
        results: results
      };
      
    } catch (error) {
      console.error('❌ Error in cleanupWrongAccounts:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }
);

/**
 * Cloud Functions
 */

// Calculate Interest Payment Function
exports.calculateMonthlyInterest = onCall(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: "256MiB"
  },
  async (request) => {
    try {
      // 1. Enforce authentication
      if (!request.auth) {
        throw new Error('unauthenticated: The function must be called while authenticated.');
      }
      
      // Debug logging for auth token
      console.log('Auth token details:', {
        uid: request.auth.uid,
        email: request.auth.token.email,
        administrator: request.auth.token.administrator,
        customClaims: request.auth.token,
        tokenKeys: Object.keys(request.auth.token)
      });
      
      // 2. Enforce authorization (check for admin custom claim)
      const isAdmin = request.auth.token.administrator === true;
      if (!isAdmin) {
        throw new Error('permission-denied: Only admins can trigger this function.');
      }
        console.log('Starting interest calculation job...');
        
        const jobStartTime = new Date();
        const results = {
          totalProcessed: 0,
          totalInterestPaid: 0,
          alreadyPaid: 0,
          skippedZeroBalance: 0,
          errors: [],
          startTime: jobStartTime.toISOString(),
          triggeredBy: request.auth.email || 'Unknown'
        };

        const interestRate = (await fetchInterestRate()) / 100;
        console.log(`Starting interest calculation with rate: ${interestRate * 100}%`);
        console.log(`Job triggered by: ${results.triggeredBy}`);
        
        if (interestRate <= 0) {
          throw new Error('Interest rate is 0% or invalid. Please check system configuration.');
        }

        // Get all accounts
        const accountsRef = db.collection('accounts');
        const accountsSnapshot = await accountsRef.get();

        for (const accountDoc of accountsSnapshot.docs) {
          const accountData = accountDoc.data();
          const userId = accountData.user_id;
          const name = accountData.displayName || accountData.name || accountDoc.id;
          const email = accountDoc.id;

          try {
            // Check if interest already paid this month
            const alreadyPaid = await hasInterestPaidThisMonth(userId);
            if (alreadyPaid) {
              console.log(`calculate_interest(${name}): Interest already paid this month.`);
              results.alreadyPaid++;
              continue;
            }

            // Get current balance
            const balance = await getAccountBalance(userId, email);
            console.log(`calculate_interest(${name}): Account Balance $${balance}`);

            // Calculate interest (only if balance > 0)
            if (balance <= 0) {
              console.log(`calculate_interest(${name}): No balance ($${balance}), skipping interest`);
              results.skippedZeroBalance++;
              continue;
            }

            const interestPayment = balance * interestRate;
            const interestAmountRounded = Math.round(interestPayment * 100) / 100;
            console.log(`calculate_interest(${name}): Interest to pay $${interestAmountRounded} on balance $${balance}`);

            if (interestAmountRounded > 0.01) { // Only process if interest is at least 1 cent
              // Use transaction for atomicity
              const batch = db.batch();
              
              // Create interest transaction
              const transactionRef = db.collection('transactions').doc();
              const newTransaction = {
                user_id: userId,
                amount: interestAmountRounded,
                comment: `Monthly Interest Payment - ${(interestRate * 100).toFixed(2)}% on $${balance.toFixed(2)}`,
                description: `Monthly Interest Payment - ${(interestRate * 100).toFixed(2)}% on $${balance.toFixed(2)}`,
                transaction_type: 'interest',
                timestamp: admin.firestore.Timestamp.now(),
                interest_rate: interestRate * 100,
                balance_at_calculation: balance,
                job_id: `interest_${jobStartTime.getTime()}`,
                processed_by: results.triggeredBy
              };

              batch.set(transactionRef, newTransaction);
              
              // Update account balance cache
              const accountRef = db.collection('accounts').doc(email);
              batch.set(accountRef, {
                balance: balance + interestAmountRounded,
                lastBalanceUpdate: admin.firestore.Timestamp.now(),
                lastInterestPayment: admin.firestore.Timestamp.now(),
                lastInterestAmount: interestAmountRounded
              }, { merge: true });

              // Commit the batch
              await batch.commit();
              
              results.totalInterestPaid += interestAmountRounded;
              results.totalProcessed++;
              
              // Log to audit system
              try {
                await logJobExecution('interest_payment', {
                  user_id: userId,
                  user_email: email,
                  user_name: name,
                  amount: interestAmountRounded,
                  balance_before: balance,
                  balance_after: balance + interestAmountRounded,
                  interest_rate: interestRate * 100,
                  transaction_id: transactionRef.id,
                  job_id: `interest_${jobStartTime.getTime()}`,
                  triggered_by: results.triggeredBy
                });
              } catch (auditError) {
                console.warn(`Failed to log audit for ${name}:`, auditError);
              }
              
              // Note: Email notifications are handled by monthly statements, not individual interest payments
              
              console.log(`✅ Processed interest for ${name}: $${interestAmountRounded}`);
            } else {
              console.log(`calculate_interest(${name}): Interest amount too small ($${interestAmountRounded}), skipping`);
              results.skippedZeroBalance++;
            }
          } catch (error) {
            console.error(`Error processing interest for ${name}:`, error);
            results.errors.push(`${name}: ${error.message}`);
          }
        }

        // Add completion time to results
        const jobEndTime = new Date();
        results.endTime = jobEndTime.toISOString();
        results.executionTimeMs = jobEndTime.getTime() - jobStartTime.getTime();
        results.executionTimeMinutes = Math.round(results.executionTimeMs / 60000 * 100) / 100;

        // Log the job execution
        await logJobExecution('calculate_interest', results);

        console.log('Interest calculation completed:', results);
        console.log(`Execution summary: ${results.totalProcessed} accounts processed, $${results.totalInterestPaid.toFixed(2)} total interest paid in ${results.executionTimeMinutes} minutes`);
        
        return {
          success: true,
          message: `Interest calculation completed. Processed ${results.totalProcessed} accounts, paid $${results.totalInterestPaid.toFixed(2)} total interest.`,
          results: results
        };

      } catch (error) {
        console.error('Error in calculateInterest function:', error);
        throw new Error(`Interest calculation failed: ${error.message}`);
      }
    }
);

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
          // Filter to specific customer by document ID (email)
          const specificDoc = await accountsRef.doc(targetCustomerEmail).get();
          if (specificDoc.exists) {
            accountsSnapshot = { docs: [specificDoc] };
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
            const email = accountDoc.id;
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
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: ['calculateMonthlyInterest', 'sendStatements', 'scheduledPayInterest', 'scheduledSendStatements']
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
    
    const interestRate = await fetchInterestRate();
    console.log(`📊 Current interest rate: ${(interestRate * 100).toFixed(2)}%`);
    
    for (const accountDoc of accountsSnapshot.docs) {
      const accountData = accountDoc.data();
      const userId = accountData.user_id || accountDoc.id;
      
      try {
        // Check if interest already paid this month
        const hasInterest = await hasInterestPaidThisMonth(userId);
        if (hasInterest) {
          console.log(`⏭️ Interest already paid this month for user: ${userId}`);
          continue;
        }
        
        // Calculate current balance
        const balance = await getAccountBalance(userId);
        
        if (balance > 0) {
          const interestAmount = Math.round(balance * interestRate * 100) / 100;
          
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