#!/bin/bash

# McDuck Bank Deployment Script
# This script deploys the application to Google Cloud Platform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${PROJECT_ID:-""}
REGION=${REGION:-"us-central1"}
SERVICE_NAME="mcduck-bank"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if PROJECT_ID is set
    if [ -z "$PROJECT_ID" ]; then
        log_error "PROJECT_ID environment variable is not set."
        echo "Please set it with: export PROJECT_ID=your-project-id"
        exit 1
    fi
    
    log_info "Prerequisites check passed!"
}

setup_gcp() {
    log_info "Setting up GCP configuration..."
    
    # Set the project
    gcloud config set project $PROJECT_ID
    
    # Enable required APIs
    log_info "Enabling required APIs..."
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable appengine.googleapis.com
    
    # Create App Engine application if it doesn't exist
    log_info "Checking App Engine application..."
    if ! gcloud app describe --project=$PROJECT_ID > /dev/null 2>&1; then
        log_info "Creating App Engine application..."
        gcloud app create --region=$REGION --project=$PROJECT_ID
    else
        log_info "App Engine application already exists"
    fi
    
    log_info "GCP setup completed!"
}

build_and_deploy() {
    log_info "Building and deploying application..."
    
    # Option 1: Direct deployment (faster for small apps)
    if [ "${USE_CLOUD_BUILD:-false}" = "true" ]; then
        log_info "Using Cloud Build for deployment..."
        gcloud builds submit --config cloudbuild.yaml
    else
        log_info "Using direct App Engine deployment..."
        
        # Build the React app locally
        log_info "Building React application..."
        npm ci
        npm run build
        
        # Deploy to App Engine
        log_info "Deploying to App Engine..."
        gcloud app deploy --quiet --promote --stop-previous-version
    fi
    
    log_info "Deployment completed!"
}

get_service_url() {
    log_info "Getting service URL..."
    
    SERVICE_URL="https://${PROJECT_ID}.appspot.com"
    
    # Verify the service is accessible
    if curl -s --head --request GET "$SERVICE_URL" | grep "200 OK" > /dev/null; then
        log_info "Application deployed successfully!"
        echo -e "${GREEN}Service URL: ${SERVICE_URL}${NC}"
    else
        log_warn "Service deployed but may not be ready yet"
        echo -e "${YELLOW}Service URL: ${SERVICE_URL}${NC}"
        echo -e "${YELLOW}Note: It may take a few minutes for the service to be fully available${NC}"
    fi
}

# Main execution
main() {
    echo "🚀 McDuck Bank Deployment Script"
    echo "=================================="
    
    check_prerequisites
    setup_gcp
    build_and_deploy
    get_service_url
    
    echo ""
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "🌐 Your application is now running at: ${SERVICE_URL}"
    echo ""
    echo "Next steps:"
    echo "1. Configure your Firebase project settings"
    echo "2. Set up monitoring and alerting"
    echo "3. Configure custom domain (if needed)"
}

# Run main function
main "$@"