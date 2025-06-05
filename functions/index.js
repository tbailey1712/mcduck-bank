const { onRequest } = require("firebase-functions/v2/https");
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

// Calculate account balance for a user
const getAccountBalance = async (userId) => {
  try {
    const transactionsRef = db.collection('transactions').where('user_id', '==', userId);
    const querySnapshot = await transactionsRef.get();
    
    let balance = 0;
    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      const type = transaction.transaction_type;
      const amount = transaction.amount;
      
      if (['deposit', 'interest'].includes(type)) {
        balance += amount;
      } else if (['withdrawal', 'service_charge', 'bankfee'].includes(type)) {
        balance -= amount;
      }
    });
    
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

// Create monthly statement text
const createMonthlyStatement = async (account, transactions, year, month) => {
  try {
    const statementLines = [
      `McDuck Bank - Monthly Statement`,
      ``,
      `Account Holder: ${account.displayName || account.name || 'Account Holder'}`,
      `Email: ${account.email || account.id}`,
      `Statement Period: ${month}/${year}`,
      ``,
      `TRANSACTIONS:`,
      `============================================`
    ];

    if (transactions.length === 0) {
      statementLines.push('No transactions this month.');
    } else {
      transactions.forEach(transaction => {
        const comment = transaction.comment || transaction.description || '';
        const typeDisplay = transaction.transaction_type.charAt(0).toUpperCase() + 
                          transaction.transaction_type.slice(1).replace('_', ' ');
        let line = `${transaction.timestamp} - ${typeDisplay}: $${transaction.amount.toFixed(2)}`;
        if (comment) {
          line += ` (${comment})`;
        }
        statementLines.push(line);
      });
    }

    // Calculate and display current balance
    const balance = await getAccountBalance(account.user_id);
    statementLines.push('');
    statementLines.push('============================================');
    statementLines.push(`Current Account Balance: $${balance.toFixed(2)}`);
    statementLines.push('');
    statementLines.push('Thank you for banking with McDuck Bank!');
    statementLines.push('Visit us at: ' + (process.env.SITE_URL || 'https://mcduck-bank.web.app'));

    return statementLines.join('\n');
  } catch (error) {
    console.error('Error creating monthly statement:', error);
    return 'Error generating statement';
  }
};

// Send email using SendGrid
const sendStatementEmail = async (email, subject, content) => {
  try {
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL || 'noreply@mcduckbank.com',
      subject: subject,
      text: content,
      html: `<pre style="font-family: monospace; white-space: pre-wrap;">${content}</pre>`
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
 * Cloud Functions
 */

// Calculate Interest Payment Function
exports.calculateInterest = onRequest(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: "256MiB"
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        console.log('Starting interest calculation job...');
        
        const results = {
          totalProcessed: 0,
          totalInterestPaid: 0,
          alreadyPaid: 0,
          errors: [],
          emailsSent: 0
        };

        const interestRate = (await fetchInterestRate()) / 100;
        console.log(`Starting interest calculation with rate: ${interestRate * 100}%`);

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
            const balance = await getAccountBalance(userId);
            console.log(`calculate_interest(${name}): Account Balance $${balance}`);

            // Calculate interest (only if balance > 0)
            if (balance <= 0) {
              console.log(`calculate_interest(${name}): No balance, skipping interest`);
              continue;
            }

            const interestPayment = balance * interestRate;
            const interestAmountRounded = Math.round(interestPayment * 100) / 100;
            console.log(`calculate_interest(${name}): Interest to pay $${interestAmountRounded}`);

            if (interestAmountRounded > 0) {
              // Create interest transaction
              const newTransaction = {
                user_id: userId,
                amount: interestAmountRounded,
                comment: 'Monthly Interest Payment - Automated',
                transaction_type: 'interest',
                timestamp: admin.firestore.Timestamp.now()
              };

              await db.collection('transactions').add(newTransaction);
              
              results.totalInterestPaid += interestAmountRounded;
              results.totalProcessed++;
              
              // Send notification email
              if (process.env.SENDGRID_API_KEY && email) {
                const emailResult = await sendStatementEmail(
                  email,
                  `McDuck Bank: Interest Payment - $${interestAmountRounded.toFixed(2)}`,
                  `Dear ${name},\n\nYour monthly interest payment of $${interestAmountRounded.toFixed(2)} has been credited to your account.\n\nCurrent Balance: $${(balance + interestAmountRounded).toFixed(2)}\n\nThank you for banking with McDuck Bank!\n\nBest regards,\nMcDuck Bank Team`
                );
                
                if (emailResult.success) {
                  results.emailsSent++;
                }
              }
              
              console.log(`Processed interest for ${name}: $${interestAmountRounded}`);
            }
          } catch (error) {
            console.error(`Error processing interest for ${name}:`, error);
            results.errors.push(`${name}: ${error.message}`);
          }
        }

        // Log the job execution
        await logJobExecution('calculate_interest', results);

        console.log('Interest calculation completed:', results);
        res.status(200).json({
          success: true,
          message: 'Interest calculation completed',
          results: results
        });

      } catch (error) {
        console.error('Error in calculateInterest function:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }
);

// Generate and Send Monthly Statements Function
exports.sendMonthlyStatements = onRequest(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: "512MiB"
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        console.log('Starting monthly statements job...');
        
        const results = {
          totalProcessed: 0,
          emailsSent: 0,
          emailErrors: 0,
          errors: []
        };

        // Get current month/year or from query params
        const now = new Date();
        const targetYear = parseInt(req.query.year) || now.getFullYear();
        const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1);

        console.log(`Generating statements for ${targetMonth}/${targetYear}`);

        // Get all accounts
        const accountsRef = db.collection('accounts');
        const accountsSnapshot = await accountsRef.get();

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
        res.status(200).json({
          success: true,
          message: 'Monthly statements job completed',
          results: results
        });

      } catch (error) {
        console.error('Error in sendMonthlyStatements function:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }
);

// Health check endpoint
exports.healthCheck = onRequest(async (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: ['calculateInterest', 'sendMonthlyStatements']
  });
});