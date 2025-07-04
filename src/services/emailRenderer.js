/**
 * Email Rendering Service
 * Handles dynamic email generation with proper data injection
 */

class EmailRenderer {
  /**
   * Generate monthly statement email with transaction table
   */
  static generateStatementEmail({
    customerName,
    accountNumber,
    balance,
    statementDate,
    transactions = [],
    interestEarned = 0,
    totalDeposits = 0,
    totalWithdrawals = 0,
    pendingWithdrawals = 0,
    accountType = 'Checking'
  }) {
    // Calculate totals if not provided
    if (totalDeposits === 0 || totalWithdrawals === 0) {
      totalDeposits = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      totalWithdrawals = Math.abs(transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));
    }

    // Generate transaction rows HTML
    const transactionRows = transactions.map(transaction => {
      const isDeposit = transaction.amount >= 0;
      const typeClass = isDeposit ? 'type-deposit' : 'type-withdrawal';
      const typeName = isDeposit ? 'Deposit' : 'Withdrawal';
      const amountClass = isDeposit ? 'amount-positive' : 'amount-negative';
      
      return `
        <tr>
          <td>${this.formatDate(transaction.date)}</td>
          <td><span class="type-pill ${typeClass}">${typeName}</span></td>
          <td class="${amountClass}">${this.formatCurrency(Math.abs(transaction.amount))}</td>
          <td>${this.escapeHtml(transaction.description)}</td>
        </tr>
      `;
    }).join('');

    // Generate statement period dates
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const statementPeriod = `${this.formatDate(startOfMonth)} - ${this.formatDate(endOfMonth)}`;
    const statementGeneratedDate = this.formatDate(currentDate);

    return `
<!DOCTYPE html>
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
            <p>Statement Period: ${statementPeriod}</p>
        </div>
        <div class="account-info">
            <div class="info-grid">
                <div class="info-card"><div class="info-label">Account Holder</div><div class="info-value">${this.escapeHtml(customerName)}</div></div>
                <div class="info-card"><div class="info-label">Account Number</div><div class="info-value">${this.escapeHtml(accountNumber)}</div></div>
                <div class="info-card"><div class="info-label">Account Type</div><div class="info-value">${this.escapeHtml(accountType)}</div></div>
                <div class="info-card"><div class="info-label">Statement Date</div><div class="info-value">${statementGeneratedDate}</div></div>
            </div>
        </div>
        <div class="snapshot">
            <div class="card card-balance">
                <div class="card-label">Current Balance</div>
                <div class="card-value">${this.formatCurrency(balance)}</div>
            </div>
            <div class="card card-deposits">
                <div class="card-label">Total Deposits</div>
                <div class="card-value">${this.formatCurrency(totalDeposits)}</div>
            </div>
            <div class="card card-withdrawals">
                <div class="card-label">Total Withdrawals</div>
                <div class="card-value">${this.formatCurrency(totalWithdrawals)}</div>
            </div>
            <div class="card card-interest">
                <div class="card-label">Interest Paid</div>
                <div class="card-value">${this.formatCurrency(interestEarned)}</div>
            </div>
            <div class="card card-pending">
                <div class="card-label">Pending Withdrawal</div>
                <div class="card-value">${this.formatCurrency(pendingWithdrawals)}</div>
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
                ${transactionRows}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate alert email for important notifications
   */
  static generateAlertEmail({
    customerName,
    alertType,
    alertMessage,
    actionRequired = false,
    actionUrl = null
  }) {
    const alertStyles = {
      security: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
      balance: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa' },
      success: { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
      info: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' }
    };

    const style = alertStyles[alertType] || alertStyles.info;
    
    const actionSection = actionRequired && actionUrl ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${actionUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #3FB984 0%, #2EA370 100%); 
                  color: white; padding: 16px 32px; text-decoration: none; 
                  border-radius: 16px; font-weight: 600;">
          Take Action
        </a>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>McDuck Bank Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f7fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
              <div style="background: linear-gradient(135deg, #F4C14D 0%, #E6B143 100%); color: #1a1a1a; padding: 32px; text-align: center;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700;">McDuck Bank</h1>
                  <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 500; opacity: 0.8;">Important Account Alert</p>
              </div>
              
              <div style="padding: 32px;">
                  <h2 style="color: #1a1a1a; margin: 0 0 24px 0;">Dear ${this.escapeHtml(customerName)},</h2>
                  
                  <div style="margin: 24px 0; padding: 20px; background-color: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 8px;">
                      <p style="margin: 0; color: ${style.color}; font-weight: 600; font-size: 18px;">
                          ${this.escapeHtml(alertMessage)}
                      </p>
                  </div>
                  
                  ${actionSection}
                  
                  <p style="margin: 32px 0 0 0; font-size: 14px; color: #6b7280;">
                      If you have questions, contact us at support@mcducklabs.com
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Base email template
   */
  static getEmailTemplate({
    customerName,
    accountNumber,
    balance,
    statementDate,
    transactionsSection,
    interestSection
  }) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>McDuck Bank - Monthly Statement</title>
          <style>
              .amount-positive { color: #059669; font-weight: 600; }
              .amount-negative { color: #dc2626; font-weight: 600; }
          </style>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f5f7fa;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
              <div style="background: linear-gradient(135deg, #F4C14D 0%, #E6B143 100%); color: #1a1a1a; padding: 32px; text-align: center;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700;">McDuck Bank</h1>
                  <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 500; opacity: 0.8;">Your Monthly Statement</p>
              </div>
              
              <div style="padding: 32px;">
                  <h2 style="color: #1a1a1a; margin: 0 0 24px 0;">Dear ${customerName},</h2>
                  
                  <p style="margin: 0 0 24px 0; color: #4b5563;">Here's your monthly account summary for ${statementDate}.</p>
                  
                  <div style="margin: 24px 0;">
                      <strong>Account Number:</strong> ${accountNumber}<br>
                      <strong>Statement Period:</strong> ${statementDate}
                  </div>
                  
                  <div style="background: linear-gradient(135deg, #3FB984 0%, #2EA370 100%); color: white; padding: 24px; border-radius: 16px; text-align: center; margin: 24px 0;">
                      <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${balance}</div>
                      <div>Current Balance</div>
                  </div>
                  
                  ${interestSection}
                  
                  ${transactionsSection}
                  
                  <div style="text-align: center; margin: 32px 0;">
                      <a href="https://bank.mcducklabs.com/account" 
                         style="display: inline-block; background: linear-gradient(135deg, #3FB984 0%, #2EA370 100%); 
                                color: white; padding: 16px 32px; text-decoration: none; 
                                border-radius: 16px; font-weight: 600;">
                          View Full Account Details
                      </a>
                  </div>
                  
                  <p style="margin: 32px 0 0 0; font-size: 14px; color: #6b7280;">
                      If you have questions, contact us at support@mcducklabs.com
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Utility methods
   */
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  static formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  static escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

export default EmailRenderer;