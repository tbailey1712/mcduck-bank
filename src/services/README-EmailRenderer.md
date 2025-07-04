# EmailRenderer Service

The EmailRenderer service replaces the old string template system with a more robust, data-driven approach for generating HTML emails.

## Features

✅ **Dynamic transaction tables** - Programmatically generate table rows with proper formatting  
✅ **Type-safe data handling** - Pass structured data instead of string substitutions  
✅ **Better maintainability** - HTML generation in JavaScript functions  
✅ **Conditional sections** - Show/hide content based on data (interest, alerts, etc.)  
✅ **Proper formatting** - Currency, date, and number formatting built-in  
✅ **Designer-friendly** - Easy to update HTML structure and styling  

## Usage

### Sending Statement Emails

```javascript
// Import the service
import sendGridService from '../services/sendgridService';

// Send monthly statement
const result = await sendGridService.sendStatementEmail({
  to: 'customer@example.com',
  customerName: 'Alex Bailey',
  accountNumber: '****5678',
  balance: 1250.75,
  statementDate: 'June 2025',
  transactions: [
    {
      date: '2025-06-01',
      description: 'Direct Deposit - Salary',
      amount: 2500.00,
      runningBalance: 1250.75
    },
    {
      date: '2025-06-05',
      description: 'Coffee Shop Purchase',
      amount: -12.50,
      runningBalance: 1238.25
    }
  ],
  interestEarned: 15.25,
  isTest: false
});
```

### Sending Alert Emails

```javascript
// Send security alert
const result = await sendGridService.sendAlertEmail({
  to: 'customer@example.com',
  customerName: 'Alex Bailey',
  alertType: 'security', // 'security', 'balance', 'success', 'info'
  alertMessage: 'We detected a login from a new device.',
  actionRequired: true,
  actionUrl: 'https://bank.mcducklabs.com/security',
  isTest: false
});
```

### Email Preview

```javascript
// Generate preview HTML for testing
const previewHtml = sendGridService.generateEmailPreview('statement', {
  customerName: 'Test Customer',
  balance: 1500.00
});

// Use in React component
<div dangerouslySetInnerHTML={{ __html: previewHtml }} />
```

## Email Types

### Statement Email
- **Purpose**: Monthly account statements
- **Includes**: Balance, transaction history, interest earned
- **Data**: Customer info, transactions array, financial summary

### Alert Email  
- **Purpose**: Account notifications and security alerts
- **Includes**: Alert message, action buttons, styling based on alert type
- **Data**: Customer info, alert details, optional actions

## Customization

The EmailRenderer generates HTML with inline styles for maximum email client compatibility. To customize:

1. **Update EmailRenderer class** (`src/services/emailRenderer.js`)
2. **Modify template structure** - Change HTML layout and content
3. **Update styling** - Modify inline CSS and color schemes
4. **Add new email types** - Create new generation methods

## Migration from Old System

**Before** (String templates):
```javascript
// Old way - string substitution
const html = template.replace('{{name}}', userData.name);
```

**After** (EmailRenderer):
```javascript
// New way - structured data
const html = EmailRenderer.generateStatementEmail({
  customerName: userData.name,
  transactions: userData.transactions
});
```

## Benefits for Designers

1. **No template syntax** - Pure HTML/CSS structure
2. **Real data preview** - See actual transaction tables and formatting
3. **Version control friendly** - No more string escaping issues
4. **Component-based** - Easy to update specific sections
5. **Responsive design** - Better mobile email support

## Next Steps

Now that the EmailRenderer is in place, you can:

1. **Work with designer** on new HTML templates
2. **Update EmailRenderer methods** with new designs
3. **Test email rendering** in various email clients
4. **Add new email types** as needed (welcome emails, notifications, etc.)

The system is now ready for designer collaboration and easy template updates!