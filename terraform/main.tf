# Terraform configuration for McDuck Bank GCP infrastructure

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "firebase_api_key" {
  description = "Firebase API Key"
  type        = string
  sensitive   = true
}

variable "firebase_auth_domain" {
  description = "Firebase Auth Domain"
  type        = string
}

variable "firebase_project_id" {
  description = "Firebase Project ID"
  type        = string
}

variable "firebase_storage_bucket" {
  description = "Firebase Storage Bucket"
  type        = string
}

variable "firebase_messaging_sender_id" {
  description = "Firebase Messaging Sender ID"
  type        = string
}

variable "firebase_app_id" {
  description = "Firebase App ID"
  type        = string
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "appengine.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudtrace.googleapis.com",
    "clouderrorreporting.googleapis.com"
  ])

  service = each.key
  project = var.project_id

  disable_dependent_services = true
}

# App Engine application
resource "google_app_engine_application" "mcduck_bank" {
  project     = var.project_id
  location_id = var.region

  depends_on = [google_project_service.required_apis]
}

# Cloud Build trigger for automatic deployments
resource "google_cloudbuild_trigger" "mcduck_bank_trigger" {
  name        = "mcduck-bank-${var.environment}"
  description = "Deploy McDuck Bank on push to main branch"

  github {
    owner = "your-github-username"  # Replace with actual GitHub username
    name  = "mcduck-bank-2025"      # Replace with actual repo name
    push {
      branch = "^main$"
    }
  }

  filename = "cloudbuild.yaml"

  substitutions = {
    _FIREBASE_API_KEY                     = var.firebase_api_key
    _FIREBASE_AUTH_DOMAIN                 = var.firebase_auth_domain
    _FIREBASE_PROJECT_ID                  = var.firebase_project_id
    _FIREBASE_STORAGE_BUCKET             = var.firebase_storage_bucket
    _FIREBASE_MESSAGING_SENDER_ID        = var.firebase_messaging_sender_id
    _FIREBASE_APP_ID                     = var.firebase_app_id
  }

  depends_on = [google_app_engine_application.mcduck_bank]
}

# Secret Manager secrets for sensitive configuration
resource "google_secret_manager_secret" "firebase_api_key" {
  secret_id = "firebase-api-key"
  
  replication {
    automatic = true
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "firebase_api_key_version" {
  secret      = google_secret_manager_secret.firebase_api_key.id
  secret_data = var.firebase_api_key
}

# Custom domain mapping (optional)
resource "google_app_engine_domain_mapping" "mcduck_bank_domain" {
  count       = var.custom_domain != "" ? 1 : 0
  domain_name = var.custom_domain

  ssl_settings {
    ssl_management_type = "AUTOMATIC"
  }

  depends_on = [google_app_engine_application.mcduck_bank]
}

variable "custom_domain" {
  description = "Custom domain for the application (optional)"
  type        = string
  default     = ""
}

# Outputs
output "app_engine_url" {
  description = "URL of the deployed App Engine service"
  value       = "https://${var.project_id}.appspot.com"
}

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}