# McDuck Bank Cloud Functions Setup

This document explains how to set up and deploy the automated banking cloud functions that handle interest payments and monthly statements.

## Prerequisites

1. **Firebase CLI** installed and logged in
2. **SendGrid Account** for email sending
3. **Firebase Project** with Firestore enabled

## Setup Steps

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Environment Variables

```bash
# Set SendGrid API Key
firebase functions:config:set sendgrid.api_key="your_sendgrid_api_key_here"

# Set from email address
firebase functions:config:set email.from="noreply@yourdomain.com"

# Set site URL
firebase functions:config:set site.url="https://your-app.web.app"
```

### 3. Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:calculateInterest
firebase deploy --only functions:sendMonthlyStatements
```

### 4. Test Functions Locally (Optional)

```bash
# Start emulator
firebase emulators:start --only functions,firestore

# Test endpoints
curl http://localhost:5001/YOUR-PROJECT-ID/us-central1/calculateInterest
curl http://localhost:5001/YOUR-PROJECT-ID/us-central1/sendMonthlyStatements
```

## Cloud Function Endpoints

After deployment, your functions will be available at:

### Calculate Interest
- **URL**: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/calculateInterest`
- **Method**: GET/POST
- **Description**: Calculates and pays monthly interest to all accounts

### Send Monthly Statements  
- **URL**: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements`
- **Method**: GET/POST
- **Query Params**: 
  - `year` (optional): Target year (default: current year)
  - `month` (optional): Target month (default: current month)
- **Description**: Generates and emails monthly statements

### Health Check
- **URL**: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/healthCheck`
- **Method**: GET
- **Description**: Checks if functions are healthy

## Setting Up Cron Jobs

### Option 1: Google Cloud Scheduler

1. Go to [Google Cloud Console > Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
2. Create jobs with these settings:

**Interest Payment Job:**
- Name: `monthly-interest-payment`
- Frequency: `0 2 1 * *` (1st day of month at 2 AM)
- Target Type: HTTP
- URL: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/calculateInterest`
- HTTP Method: POST

**Monthly Statements Job:**
- Name: `monthly-statements`
- Frequency: `0 3 1 * *` (1st day of month at 3 AM)
- Target Type: HTTP
- URL: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements`
- HTTP Method: POST

### Option 2: External Cron Service

Use services like:
- **Cron-job.org**
- **EasyCron**
- **Your own server's crontab**

Example crontab entries:
```bash
# Run interest calculation on 1st of every month at 2 AM
0 2 1 * * curl -X POST https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/calculateInterest

# Send statements on 1st of every month at 3 AM  
0 3 1 * * curl -X POST https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements
```

## Function Features

### Calculate Interest
- ✅ Fetches interest rate from system config
- ✅ Prevents duplicate payments (checks if already paid this month)
- ✅ Calculates interest based on account balance
- ✅ Creates interest payment transactions
- ✅ Sends notification emails to customers
- ✅ Logs execution results

### Send Monthly Statements
- ✅ Generates monthly transaction summaries
- ✅ Includes current account balance
- ✅ Sends formatted email statements
- ✅ Supports custom month/year parameters
- ✅ Logs execution results

### Monitoring & Logging
- All jobs log execution details to `job_logs` collection
- Cloud Functions logs available in Firebase Console
- Email delivery tracking through SendGrid

## Security Features

- ✅ **CORS enabled** for web app integration
- ✅ **Error handling** with detailed logging
- ✅ **Timeout protection** (9 minutes max)
- ✅ **Memory limits** configured appropriately
- ✅ **Environment variables** for sensitive data

## Testing

### Manual Testing
```bash
# Test interest calculation
curl -X POST https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/calculateInterest

# Test statements (current month)
curl -X POST https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements

# Test statements (specific month)
curl -X POST "https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/sendMonthlyStatements?year=2024&month=12"
```

### Expected Response
```json
{
  "success": true,
  "message": "Interest calculation completed",
  "results": {
    "totalProcessed": 5,
    "totalInterestPaid": 15.75,
    "alreadyPaid": 2,
    "errors": [],
    "emailsSent": 5
  }
}
```

## Troubleshooting

### Common Issues

1. **SendGrid API Key Not Set**
   - Error: "No API key provided"
   - Solution: Run `firebase functions:config:set sendgrid.api_key="your_key"`

2. **Email Delivery Fails**
   - Check SendGrid logs
   - Verify sender email is verified in SendGrid
   - Check spam folder

3. **Function Timeout**
   - Large number of accounts may exceed timeout
   - Consider increasing timeout or processing in batches

4. **Permission Errors**
   - Ensure Firebase project has proper billing enabled
   - Check Firestore security rules

## Cost Estimation

- **Function Invocations**: ~$0.40 per million invocations
- **Compute Time**: ~$0.0000025 per 100ms
- **SendGrid**: Starts at $14.95/month for 50k emails
- **Typical Monthly Cost**: < $5 for small/medium banks

## Migration Notes

This implementation migrates the original Python cloud functions to JavaScript/Node.js while maintaining the same functionality:

- ✅ **Interest calculation logic** preserved
- ✅ **Statement generation** preserved  
- ✅ **Email sending** via SendGrid
- ✅ **Duplicate prevention** maintained
- ✅ **Audit logging** enhanced
- ✅ **Error handling** improved