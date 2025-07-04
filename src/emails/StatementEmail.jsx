import React from 'react';

const StatementEmail = ({ 
  customerName, 
  accountNumber, 
  balance, 
  statementDate, 
  transactions = [],
  interestEarned 
}) => {
  const formatCurrency = (amount) => `$${amount.toFixed(2)}`;
  const formatDate = (date) => new Date(date).toLocaleDateString();

  return (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>McDuck Bank - Monthly Statement</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f7fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #F4C14D 0%, #E6B143 100%);
            color: #1a1a1a;
            padding: 32px;
            text-align: center;
          }
          .content {
            padding: 32px;
          }
          .balance-card {
            background: linear-gradient(135deg, #3FB984 0%, #2EA370 100%);
            color: white;
            padding: 24px;
            border-radius: 16px;
            text-align: center;
            margin: 24px 0;
          }
          .balance-amount {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .transactions-table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
          }
          .transactions-table th,
          .transactions-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          .transactions-table th {
            background-color: #f9fafb;
            font-weight: 600;
          }
          .amount-positive {
            color: #059669;
            font-weight: 600;
          }
          .amount-negative {
            color: #dc2626;
            font-weight: 600;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #3FB984 0%, #2EA370 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 600;
            margin: 24px 0;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>McDuck Bank</h1>
            <p>Your Monthly Statement</p>
          </div>
          
          <div className="content">
            <h2>Dear {customerName},</h2>
            
            <p>Here's your monthly account summary for {statementDate}.</p>
            
            <div style={{ marginBottom: '24px' }}>
              <strong>Account Number:</strong> {accountNumber}<br />
              <strong>Statement Period:</strong> {statementDate}
            </div>
            
            <div className="balance-card">
              <div className="balance-amount">{formatCurrency(balance)}</div>
              <div>Current Balance</div>
            </div>
            
            {interestEarned > 0 && (
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <strong>Interest Earned This Month:</strong> {formatCurrency(interestEarned)}
              </div>
            )}
            
            <h3>Recent Transactions</h3>
            
            {transactions.length > 0 ? (
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => (
                    <tr key={index}>
                      <td>{formatDate(transaction.date)}</td>
                      <td>{transaction.description}</td>
                      <td className={transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                        {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                      </td>
                      <td>{formatCurrency(transaction.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontStyle: 'italic', color: '#6b7280' }}>
                No transactions this period.
              </p>
            )}
            
            <center>
              <a href="https://bank.mcducklabs.com/account" className="cta-button">
                View Full Account Details
              </a>
            </center>
            
            <p style={{ marginTop: '32px', fontSize: '14px', color: '#6b7280' }}>
              If you have questions, contact us at support@mcducklabs.com
            </p>
          </div>
        </div>
      </body>
    </html>
  );
};

export default StatementEmail;