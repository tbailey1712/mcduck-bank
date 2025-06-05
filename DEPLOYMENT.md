# McDuck Bank - Deployment Guide

This guide covers how to deploy McDuck Bank to Google Cloud Platform (GCP) using App Engine Standard.

## Prerequisites

### Required Tools
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)
- [Terraform](https://www.terraform.io/downloads.html) (optional, for infrastructure as code)
- [Docker](https://docs.docker.com/get-docker/) (for local testing)
- [Node.js](https://nodejs.org/) 16 or higher
- [Firebase CLI](https://firebase.google.com/docs/cli) (optional, for emulators)

### GCP Setup
1. Create a GCP project
2. Enable billing for the project
3. Install and configure gcloud CLI:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## Quick Deploy

### Option 1: Using the Deploy Script (Recommended)
```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id

# Run the deployment script
./scripts/deploy.sh
```

### Option 2: Direct Deployment (Fastest)
```bash
# Enable required APIs
gcloud services enable appengine.googleapis.com

# Create App Engine application (one-time setup)
gcloud app create --region=us-central1

# Build and deploy
npm run build
gcloud app deploy --quiet
```

### Option 3: Using Cloud Build (CI/CD)
```bash
# Enable Cloud Build
gcloud services enable cloudbuild.googleapis.com

# Deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## Infrastructure as Code (Terraform)

### Setup
```bash
cd terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your actual values
# project_id, firebase_api_key, etc.

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan

# Apply the infrastructure
terraform apply
```

### Terraform Configuration
The Terraform configuration creates:
- App Engine application
- Cloud Build trigger for automatic deployments
- Secret Manager secrets for sensitive data
- Required API enablements
- Custom domain mapping (optional)

## Environment Configuration

### Production Environment Variables
Set these in Cloud Build substitutions or Cloud Run environment:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id

# Production Settings
REACT_APP_USE_FIREBASE_EMULATOR=false
REACT_APP_ENABLE_DEBUG=false
REACT_APP_ENABLE_ERROR_REPORTING=true
NODE_ENV=production
```

## CI/CD Pipeline

### Automatic Deployments
The Cloud Build trigger automatically deploys on pushes to the main branch.

### Manual Trigger
```bash
# Trigger build manually
gcloud builds triggers run mcduck-bank-prod --branch=main
```

### Build Configuration
The `cloudbuild.yaml` file defines the build process:
1. Build Docker image
2. Push to Container Registry
3. Deploy to Cloud Run
4. Set environment variables

## Security Considerations

### Secrets Management
- Firebase API keys are stored in Secret Manager
- Environment variables are set securely in Cloud Run
- No secrets are committed to the repository

### Network Security
- Cloud Run service uses HTTPS by default
- Security headers are configured in nginx
- CORS policies are properly configured

### Container Security
- Multi-stage Docker build for minimal image size
- Non-root user in container
- Health checks configured
- Resource limits set

## Monitoring and Logging

### Cloud Logging
Logs are automatically sent to Cloud Logging:
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision"
```

### Cloud Monitoring
Set up monitoring dashboards for:
- Request latency
- Error rates
- CPU and memory usage
- Container startup time

### Alerting
Create alerts for:
- High error rates
- Slow response times
- Service downtime

## Custom Domain Setup

### Using Cloud Run Domain Mappings
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service mcduck-bank \
  --domain yourdomain.com \
  --region us-central1
```

### DNS Configuration
Point your domain's DNS to Cloud Run:
```
yourdomain.com. IN CNAME ghs.googlehosted.com.
```

## Scaling Configuration

### Auto Scaling
Cloud Run automatically scales based on:
- Incoming requests
- CPU utilization
- Memory usage

### Configuration
```yaml
# In cloudbuild.yaml
--min-instances: 0
--max-instances: 100
--cpu: 1
--memory: 512Mi
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs
gcloud builds log [BUILD_ID]
```

#### Service Not Starting
```bash
# Check service logs
gcloud run services logs read mcduck-bank --region=us-central1
```

#### Environment Variables
```bash
# Check service configuration
gcloud run services describe mcduck-bank --region=us-central1
```

### Health Checks
The application includes a health check endpoint at `/health`:
```bash
curl https://your-service-url/health
```

## Local Development

### Setup
```bash
# Run setup script
./scripts/dev-setup.sh

# Start development server
npm start
```

### Firebase Emulators
```bash
# Start emulators
firebase emulators:start

# Set environment variable
export REACT_APP_USE_FIREBASE_EMULATOR=true
```

## Rollback Procedures

### Quick Rollback
```bash
# Deploy previous revision
gcloud run services update-traffic mcduck-bank \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1
```

### Emergency Procedures
1. Check service status
2. Review recent deployments
3. Roll back to last known good revision
4. Investigate and fix issues
5. Redeploy when ready

## Cost Optimization

### Cloud Run Pricing
- Pay per request and compute time
- No charges when not serving requests
- Configure minimum instances for consistent performance

### Resource Optimization
- Monitor CPU and memory usage
- Adjust resource limits as needed
- Use efficient Docker images

## Support and Maintenance

### Regular Tasks
- Monitor application performance
- Review and rotate secrets
- Update dependencies
- Security patches

### Backup and Recovery
- Firebase data is automatically backed up
- Container images are stored in Container Registry
- Infrastructure is defined in Terraform

For additional support, refer to:
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)