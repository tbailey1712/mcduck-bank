# Automated Monthly Tasks Setup

## Overview
McDuck Bank now includes automated monthly tasks that run on the 1st of each month:
- **1:00 AM CT**: Pay interest to all accounts with positive balances
- **2:00 AM CT**: Generate and send monthly statements

## Deployment Requirements

### 1. Enable Cloud Scheduler API
Before deploying, you must enable the Cloud Scheduler API in your Firebase project:

```bash
# Using Firebase CLI
firebase projects:list  # Get your project ID
gcloud config set project YOUR_PROJECT_ID
gcloud services enable cloudscheduler.googleapis.com
```

Or enable via Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to "APIs & Services" > "Library"
4. Search for "Cloud Scheduler API"
5. Click "Enable"

### 2. Deploy Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

### 3. Verify Deployment
After deployment, check the Firebase Console:
1. Go to Functions tab
2. Look for `scheduledPayInterest` and `scheduledSendStatements`
3. Check Cloud Scheduler in Google Cloud Console for created jobs

## Scheduled Functions

### scheduledPayInterest
- **Schedule**: `0 1 1 * *` (1:00 AM on 1st of each month, Central Time)
- **Function**: Pays monthly interest to all accounts with positive balances
- **Features**:
  - Checks if interest already paid this month (prevents duplicates)
  - Uses configurable interest rate from system config
  - Creates audit trail for each interest payment
  - Logs comprehensive results

### scheduledSendStatements
- **Schedule**: `0 2 1 * *` (2:00 AM on 1st of each month, Central Time) 
- **Function**: Generates and emails monthly statements to all users
- **Features**:
  - Generates statements for previous month's transactions
  - Skips users with no transactions
  - Includes rate limiting to avoid email API limits
  - Tracks success/failure for each statement

## Manual Testing

You can manually trigger these functions for testing:

```bash
# Test interest payment
firebase functions:shell
> scheduledPayInterest()

# Test statement generation  
> scheduledSendStatements()
```

## Monitoring

### Cloud Console
- **Cloud Scheduler**: View job history and execution logs
- **Cloud Functions**: Monitor function executions and errors
- **Cloud Logging**: Detailed execution logs with emoji indicators

### Function Logs
Look for these log indicators:
- 🕐 Interest payment started
- 💰 Interest paid to user
- 📧 Statement generation started  
- 📋 Statement sent to user
- ✅ Process completed successfully
- ❌ Errors encountered

## Cost Considerations

### Cloud Scheduler
- Free tier: 3 jobs per month
- McDuck Bank uses 2 scheduled jobs
- No additional cost for free tier usage

### Cloud Functions
- Execution time: ~1-5 minutes per month depending on user count
- Memory usage: Standard (256MB default)
- Estimated cost: $0.01-0.10 per month for typical usage

## Configuration

### Interest Rate
Interest rate is pulled from `system/config` document in Firestore:
```json
{
  "interest_rate": 0.05  // 5% annual rate
}
```

### Time Zone
Functions run in Central Time (`America/Chicago`). To change:
1. Update `timeZone` in both functions
2. Redeploy functions

### Schedule Modification
To change timing, update the `schedule` cron expressions:
- Format: `"minute hour day month dayOfWeek"`
- Current: `"0 1 1 * *"` = 1:00 AM on 1st of month
- Example: `"0 9 1 * *"` = 9:00 AM on 1st of month

## Troubleshooting

### Common Issues

1. **Cloud Scheduler API not enabled**
   - Error: "API cloudscheduler.googleapis.com not found"
   - Solution: Enable the API as described above

2. **Permission errors**
   - Ensure Firebase service account has Cloud Scheduler permissions
   - May require upgrading to Blaze plan for external API access

3. **Function timeout**
   - Large user bases may need increased timeout
   - Modify function configuration if needed

4. **Email delivery issues**
   - Check SendGrid API key configuration
   - Monitor SendGrid delivery logs
   - Verify email templates render correctly

### Manual Recovery
If a scheduled run fails, you can manually execute:
```bash
# Calculate interest for specific user
calculateMonthlyInterest({data: {userId: "USER_ID"}})

# Send statement to specific user  
sendStatements({data: {userEmail: "user@example.com"}})
```

## Security Notes

- Functions run with system privileges
- All operations are logged for audit trail
- Interest payments include duplicate prevention
- Email addresses are validated before sending