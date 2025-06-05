#!/usr/bin/env node

/**
 * Local HTTPS server for testing PWA features that require SSL
 */

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Check if build directory exists
const buildPath = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildPath)) {
  console.error('❌ Build directory not found. Run "npm run build" first.');
  process.exit(1);
}

const app = express();

// Serve static files from build directory
app.use(express.static(buildPath));

// Handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Create self-signed certificate for local testing
const serverOptions = {
  key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKBwx2s3OlOJnTaJHPBRzJTlrJIqHQj/7TklFUe3Pq1J/s8zRKL3Z7TG8K8aA5XmJ9EuF5rEZKYSyDTnMcq3xFsBvLdmQzpQk5gPlfh8Y1GTt/l6m0jHtYm8JGJWrStNfxBvw+Zq8x1QqtSHCPgKYT/yI2K+mD2fktNB2oSqe8HJDTnNH5YVYjBjT8nQ1XmJlp8HwBhQU/XLw7dFfr0S8YBKHyI/q6qU1yMQ7bYZcLCpfXjdqF7Gv8QO7k3KNZ5jTTB2LfqV4J/I5DwWgZ3HrKcGD4L0p/T1e1Y5i/lJd3PfFjR2w1kZ6CcbNp+LqIrn8RfIkAyC2qH+kR8mGfQO+NJk7AgMBAAECggEBALHBMWlKJeF5wJzAGKTqO3z0aJ5qLKOv3AqQJgNNr7U7GcJ6WxGBvN+TzFKkZmEkCJVp7J+dP5Q3zP8EkJvGcL+EuGtZFJ/J8K0HfK5kK3gU6gd3vGzO6I6gO8fGKOJo6pJ+WLqGD1zYrLJ7QL7OpZ2qF+g8fFa7H4O9g0dMcUzJa+wDJQKQ9KzO3z5ZJlzH2K6U6zB1P8CzBz6bEJQQe+K8qMg+5DkAKgxCzGYqSdT+sD8aT+3L6XK3UQm8OP5bOGYHg7QmQH3KgZwEqO0r3gL7K5Q6mEHxhcSd+3k7H9F4UQNKOgZnp4bOw+Wy7/D5gH9uKECggYBAN3yF8tQP4NQcT0F4D5C8P3j8W5T4aV+bO8gJ8oO3A8OJ3L+nF8Gvw==
-----END PRIVATE KEY-----`,
  cert: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKlhFJZGFqNQMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMjQxMjA2MDAwMDAwWhcNMjUxMjA2MDAwMDAwWjBFMQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1L7VLPHCgcMdrNzpTiZ02iRzwUcyU5aySKh0I/+05JRVHtz6tSf7PM0Si92e0xvCvGgOV5ifRLheaxGSmEsg05zHKt8RbAby3ZkM6UJOYhX0J+GfBk7f5eptIx7WJvCRiVq0rTX8Qb8PmavMdUKrUhwj4CmE/8iNivpg9n5LTQdqEqnvByQ05zR+WFWIwY0/J0NV5iZafB8AYUFPZkR4sN3RX69EvGASh8iP6uqlNcjEO22GXCwqX143ahexr/EDu5NyjWeY00wdi36leCfyOQ8FoGdx6ynBg+C9Kf09XtWOYv5SXdz3xY0dsNZGegnGzafi6iK5/EXyJAMgtqh/pEfJhn0DvjSZOawIDAQABo1AwTjAdBgNVHQ4EFgQUZ8zQ+Z6LpJ7UZKlT4VGK7Q3JL5cwHwYDVR0jBBgwFoAUZ8zQ+Z6LpJ7UZKlT4VGK7Q3JL5cwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEA==
-----END CERTIFICATE-----`
};

const server = https.createServer(serverOptions, app);

const PORT = 3001;

server.listen(PORT, () => {
  console.log('🔒 HTTPS Server running at:');
  console.log(`   https://localhost:${PORT}`);
  console.log('');
  console.log('⚠️  You\'ll see a security warning - click "Advanced" then "Proceed to localhost"');
  console.log('🔔 This allows testing push notifications locally');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Try a different port or stop the other server.`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});