#!/bin/bash

# McDuck Bank Development Setup Script
# This script sets up the local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 16 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        log_error "Node.js version 16 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed."
        exit 1
    fi
    
    log_info "Prerequisites check passed!"
}

install_dependencies() {
    log_step "Installing dependencies..."
    
    npm install
    
    log_info "Dependencies installed successfully!"
}

setup_environment() {
    log_step "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warn "Environment file created from .env.example"
            log_warn "Please update .env with your actual Firebase configuration!"
        else
            log_error ".env.example file not found!"
            exit 1
        fi
    else
        log_info "Environment file already exists"
    fi
}

setup_firebase_emulators() {
    log_step "Setting up Firebase emulators (optional)..."
    
    if command -v firebase &> /dev/null; then
        log_info "Firebase CLI is installed"
        
        # Check if firebase.json exists
        if [ ! -f "firebase.json" ]; then
            log_info "Creating Firebase configuration..."
            firebase init emulators --project demo-project
        fi
        
        log_info "To use Firebase emulators, run:"
        echo "  1. firebase emulators:start"
        echo "  2. Set REACT_APP_USE_FIREBASE_EMULATOR=true in .env"
    else
        log_warn "Firebase CLI not found. Install it with:"
        echo "  npm install -g firebase-tools"
    fi
}

setup_git_hooks() {
    log_step "Setting up Git hooks..."
    
    if [ -d ".git" ]; then
        # Create pre-commit hook for linting
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Run linting before commit
npm run lint
EOF
        chmod +x .git/hooks/pre-commit
        log_info "Git pre-commit hook installed"
    else
        log_warn "Not a Git repository - skipping Git hooks setup"
    fi
}

run_tests() {
    log_step "Running tests to verify setup..."
    
    npm test -- --watchAll=false --coverage=false
    
    if [ $? -eq 0 ]; then
        log_info "All tests passed!"
    else
        log_error "Some tests failed. Please check the output above."
    fi
}

display_next_steps() {
    echo ""
    echo -e "${GREEN}✅ Development setup completed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Update .env file with your Firebase configuration"
    echo "2. Start the development server: npm start"
    echo "3. Open http://localhost:3000 in your browser"
    echo ""
    echo "Available commands:"
    echo "  npm start          - Start development server"
    echo "  npm test           - Run tests"
    echo "  npm run build      - Build for production"
    echo "  npm run lint       - Run ESLint"
    echo ""
    echo "For Firebase emulators:"
    echo "  firebase emulators:start"
    echo ""
}

# Main execution
main() {
    echo "🛠️  McDuck Bank Development Setup"
    echo "=================================="
    
    check_prerequisites
    install_dependencies
    setup_environment
    setup_firebase_emulators
    setup_git_hooks
    run_tests
    display_next_steps
}

# Run main function
main "$@"