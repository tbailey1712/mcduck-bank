# McDuck Bank Deployment Checklist
## New Project Setup & Go-Live

Use this checklist to ensure a smooth migration and deployment to your new Firebase project.

## 📋 Pre-Migration Checklist

### 1. Project Planning
- [ ] Choose new project name/ID
- [ ] Document current system configuration
- [ ] Plan migration downtime window
- [ ] Backup existing data
- [ ] Notify users of maintenance window

### 2. New Project Setup
- [ ] Create new Firebase project
- [ ] Enable Authentication (Google provider)
- [ ] Enable Firestore Database
- [ ] Configure authorized domains
- [ ] Set up billing (required for Cloud Functions)

## 🗃️ Data Migration Checklist

### 1. Migration Preparation
- [ ] Download service account keys for both projects
- [ ] Update migration script CONFIG with project IDs
- [ ] Test migration script on small dataset first
- [ ] Verify network connectivity to both projects

### 2. Execute Migration
- [ ] Run migration script: `cd migration && npm run migrate`
- [ ] Verify all collections migrated successfully
- [ ] Check sample documents for data integrity
- [ ] Confirm system configuration copied correctly
- [ ] Validate user account data

### 3. Post-Migration Verification
- [ ] Document count matches between projects
- [ ] Sample balance calculations are correct
- [ ] All timestamp fields converted properly
- [ ] Administrator flags preserved

## ⚙️ Configuration Update Checklist

### 1. Firebase Configuration
- [ ] Update `src/config/firebaseConfig.js` with new project values
- [ ] Update `.env.local` with new project ID
- [ ] Test local authentication works
- [ ] Verify Firestore connection

### 2. Cloud Functions Setup
- [ ] Install dependencies: `cd functions && npm install`
- [ ] Configure environment variables:
  - [ ] SendGrid API key: `firebase functions:config:set sendgrid.api_key="key"`
  - [ ] From email: `firebase functions:config:set email.from="email"`
  - [ ] Site URL: `firebase functions:config:set site.url="url"`
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Test function endpoints manually

### 3. Security Rules
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Test user can access own data
- [ ] Test admin can access all data
- [ ] Test unauthorized access is blocked

## 🚀 Deployment Checklist

### 1. Web Application
- [ ] Build application: `npm run build`
- [ ] Test build locally
- [ ] Deploy to hosting: `firebase deploy --only hosting`
- [ ] Verify deployed site loads correctly
- [ ] Test all major features work

### 2. Cloud Functions Testing
- [ ] Test health check endpoint
- [ ] Manually trigger interest calculation
- [ ] Manually trigger statement generation
- [ ] Verify emails are being sent
- [ ] Check function logs for errors

### 3. Automation Setup
- [ ] Set up Google Cloud Scheduler jobs:
  - [ ] Monthly interest calculation (1st of month, 2 AM)
  - [ ] Monthly statements (1st of month, 3 AM)
- [ ] Test cron job URLs respond correctly
- [ ] Verify jobs are scheduled properly

## 🔒 Security Checklist

### 1. Authentication
- [ ] Google OAuth configured correctly
- [ ] User can sign in and access their account
- [ ] Admin can access admin panel
- [ ] Unauthorized users blocked appropriately

### 2. Database Security
- [ ] Firestore rules prevent unauthorized access
- [ ] Users can only see own transactions
- [ ] Admins can access all data as needed
- [ ] System config protected from regular users

### 3. Functions Security
- [ ] Environment variables configured (not hardcoded)
- [ ] CORS configured appropriately
- [ ] Function URLs are HTTPS only
- [ ] SendGrid API key secured

## 🧪 Testing Checklist

### 1. User Functionality
- [ ] User login/logout works
- [ ] Account overview displays correctly
- [ ] Transaction history loads
- [ ] Profile picture displays
- [ ] Balance calculations correct

### 2. Admin Functionality  
- [ ] Admin login works
- [ ] Can create transactions for users
- [ ] Can edit/delete transactions
- [ ] System config panel works
- [ ] Cloud function triggers work

### 3. Automated Functions
- [ ] Interest calculation runs without errors
- [ ] Statement generation completes successfully
- [ ] Emails are delivered to recipients
- [ ] Job logs are created properly

### 4. Performance Testing
- [ ] Page load times acceptable
- [ ] Transaction table handles large datasets
- [ ] Cloud functions complete within timeout
- [ ] Database queries respond quickly

## 📊 Monitoring Setup

### 1. Firebase Console
- [ ] Set up alerts for function errors
- [ ] Monitor database usage
- [ ] Track authentication metrics
- [ ] Set up budget alerts

### 2. Third-Party Monitoring
- [ ] SendGrid delivery monitoring
- [ ] Uptime monitoring for web app
- [ ] Cloud Scheduler job monitoring
- [ ] Error tracking setup

## 📱 User Communication

### 1. Pre-Launch
- [ ] Notify users of upcoming maintenance
- [ ] Provide timeline for migration
- [ ] Share any new URLs or changes

### 2. Post-Launch
- [ ] Announce successful migration
- [ ] Provide new URLs if changed
- [ ] Share any new features available
- [ ] Create feedback channel for issues

## 🧹 Cleanup Checklist

### 1. Immediate Cleanup
- [ ] Delete service account keys from migration folder
- [ ] Remove old project references from code
- [ ] Update documentation with new URLs
- [ ] Clean up development environments

### 2. Post-Verification Cleanup (After 30 days)
- [ ] Archive old project data
- [ ] Remove old project access
- [ ] Update any external integrations
- [ ] Delete old project (if confident in migration)

## 🆘 Rollback Plan

If issues are discovered after migration:

### 1. Immediate Actions
- [ ] Stop automated cron jobs
- [ ] Revert DNS to old project (if applicable)
- [ ] Communicate issue to users
- [ ] Analyze root cause

### 2. Data Recovery
- [ ] Re-enable old project if needed
- [ ] Migrate any new transactions back
- [ ] Reconcile any data differences
- [ ] Plan re-migration strategy

## 🎯 Success Criteria

Migration is considered successful when:

- [ ] All users can log in and access their accounts
- [ ] All transaction data is present and accurate
- [ ] Admin functions work properly
- [ ] Automated jobs run successfully
- [ ] Emails are being delivered
- [ ] No critical errors in logs
- [ ] Performance meets expectations
- [ ] Security rules are functioning

## 📞 Support Contacts

Have these ready during migration:

- **Firebase Support**: [Firebase Support Center](https://firebase.google.com/support)
- **SendGrid Support**: [SendGrid Support](https://sendgrid.com/contact-us/)
- **Google Cloud Support**: [Cloud Console Support](https://cloud.google.com/support)

## 🏁 Final Verification

After completing all checklists:

1. **User Testing**: Have real users test the system
2. **Admin Testing**: Verify all admin functions work
3. **Monitor for 24 hours**: Watch for any issues
4. **Performance baseline**: Document performance metrics
5. **Backup verification**: Ensure backup systems work

**✅ Migration Complete!**

Your McDuck Bank application is now running on a clean, modern Firebase project with all legacy baggage removed. Enjoy improved performance, security, and maintainability! 🎉