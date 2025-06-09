/**
 * SendGrid Email Service
 * Handles HTML-based email sending with template substitution
 */

import { formatCurrency } from '../utils/formatUtils';
import { format } from 'date-fns';

class SendGridService {
  constructor() {
    this.apiKey = process.env.REACT_APP_SENDGRID_API_KEY;
    this.apiUrl = 'https://api.sendgrid.com/v3/mail/send';
    this.templatesApiUrl = 'https://api.sendgrid.com/v3/templates';
    this.fromEmail = process.env.REACT_APP_FROM_EMAIL || 'noreply@mcduckbank.com';
    this.fromName = process.env.REACT_APP_FROM_NAME || 'McDuck Bank';
    
    // Local storage key for templates
    this.storageKey = 'mcduck_email_templates';
  }

  /**
   * Replace template substitutions in HTML content
   * @param {string} htmlTemplate - HTML template with {{field}} placeholders
   * @param {Object} substitutions - Object with field values
   * @returns {string} - HTML with substitutions applied
   */
  applySubstitutions(htmlTemplate, substitutions = {}) {
    let processedHtml = htmlTemplate;

    // Process each substitution
    Object.entries(substitutions).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      let processedValue = value;

      // Format specific field types
      switch (key) {
        case 'balance':
        case 'interest':
        case 'amount':
          processedValue = formatCurrency(value);
          break;
        case 'date':
        case 'statementDate':
          if (value instanceof Date) {
            processedValue = format(value, 'MMMM d, yyyy');
          } else if (typeof value === 'string') {
            processedValue = format(new Date(value), 'MMMM d, yyyy');
          }
          break;
        case 'time':
          if (value instanceof Date) {
            processedValue = format(value, 'h:mm a');
          } else if (typeof value === 'string') {
            processedValue = format(new Date(value), 'h:mm a');
          }
          break;
        default:
          processedValue = String(value || '');
      }

      processedHtml = processedHtml.replace(placeholder, processedValue);
    });

    // Clean up any remaining placeholders
    processedHtml = processedHtml.replace(/{{.*?}}/g, '');

    return processedHtml;
  }

  /**
   * Generate default substitutions from user data
   * @param {Object} userData - User account data
   * @param {Object} additionalData - Additional context data
   * @returns {Object} - Substitution object
   */
  generateSubstitutions(userData, additionalData = {}) {
    const now = new Date();
    
    const baseSubstitutions = {
      name: userData?.displayName || userData?.email?.split('@')[0] || 'Valued Customer',
      email: userData?.email || '',
      date: now,
      time: now,
      statementDate: now,
      balance: userData?.balance || 0,
      accountNumber: userData?.accountNumber || '****1234',
      bankName: 'McDuck Bank',
      supportEmail: 'support@mcduckbank.com',
      supportPhone: '1-800-MCDUCK',
      year: now.getFullYear()
    };

    return { ...baseSubstitutions, ...additionalData };
  }

  /**
   * Send email via SendGrid API
   * @param {Object} emailData - Email configuration
   * @returns {Promise<Object>} - Send result
   */
  async sendEmail({ to, subject, htmlTemplate, substitutions = {}, isTest = false }) {
    try {
      if (!this.apiKey) {
        throw new Error('SendGrid API key not configured');
      }

      // Apply substitutions to the template
      const processedHtml = this.applySubstitutions(htmlTemplate, substitutions);

      // Prepare SendGrid payload
      const payload = {
        personalizations: [{
          to: [{ email: to }],
          subject: isTest ? `[TEST] ${subject}` : subject
        }],
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        content: [{
          type: 'text/html',
          value: processedHtml
        }]
      };

      // Add test marker to content if this is a test email
      if (isTest) {
        payload.content[0].value = `
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin-bottom: 20px; border-radius: 4px;">
            <strong>🧪 TEST EMAIL</strong> - This is a test message sent from McDuck Bank's messaging system.
          </div>
          ${payload.content[0].value}
        `;
      }

      console.log('📧 Sending email via SendGrid:', {
        to,
        subject: payload.personalizations[0].subject,
        isTest,
        hasApiKey: !!this.apiKey
      });

      // In development, just log the email instead of sending
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEV MODE] Email would be sent:', {
          payload,
          processedHtml: processedHtml.substring(0, 200) + '...'
        });
        
        return {
          success: true,
          messageId: `dev_${Date.now()}`,
          message: 'Email logged in development mode'
        };
      }

      // Send via SendGrid API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SendGrid API error: ${response.status} ${errorText}`);
      }

      const responseHeaders = response.headers;
      const messageId = responseHeaders.get('x-message-id');

      console.log('✅ Email sent successfully:', { messageId, to, subject });

      return {
        success: true,
        messageId,
        message: 'Email sent successfully'
      };

    } catch (error) {
      console.error('❌ Error sending email:', error);
      
      return {
        success: false,
        error: error.message,
        message: `Failed to send email: ${error.message}`
      };
    }
  }

  /**
   * Send a test email using current admin data
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} htmlTemplate - HTML template
   * @param {Object} userData - User data for substitutions
   * @param {Object} additionalData - Additional substitution data
   * @returns {Promise<Object>} - Send result
   */
  async sendTestEmail(to, subject, htmlTemplate, userData, additionalData = {}) {
    const substitutions = this.generateSubstitutions(userData, additionalData);
    
    return this.sendEmail({
      to,
      subject,
      htmlTemplate,
      substitutions,
      isTest: true
    });
  }

  /**
   * Preview email by applying substitutions without sending
   * @param {string} htmlTemplate - HTML template
   * @param {Object} userData - User data for substitutions
   * @param {Object} additionalData - Additional substitution data
   * @returns {Object} - Preview data
   */
  previewEmail(htmlTemplate, userData, additionalData = {}) {
    const substitutions = this.generateSubstitutions(userData, additionalData);
    const processedHtml = this.applySubstitutions(htmlTemplate, substitutions);

    return {
      processedHtml,
      substitutions,
      originalTemplate: htmlTemplate
    };
  }

  /**
   * Validate HTML template for common issues
   * @param {string} htmlTemplate - HTML template to validate
   * @returns {Object} - Validation result
   */
  validateTemplate(htmlTemplate) {
    const issues = [];
    const warnings = [];

    // Check for basic HTML structure
    if (!htmlTemplate.includes('<html>') && !htmlTemplate.includes('<body>')) {
      warnings.push('Template should include basic HTML structure (<html>, <body>)');
    }

    // Check for unmatched substitution brackets
    const unmatchedOpen = (htmlTemplate.match(/{{/g) || []).length;
    const unmatchedClose = (htmlTemplate.match(/}}/g) || []).length;
    if (unmatchedOpen !== unmatchedClose) {
      issues.push('Unmatched substitution brackets found ({{ }})');
    }

    // Check for potentially unsafe content
    if (htmlTemplate.includes('<script')) {
      issues.push('Script tags are not allowed in email templates');
    }

    // Extract substitution fields
    const substitutionFields = [...htmlTemplate.matchAll(/{{(.*?)}}/g)]
      .map(match => match[1].trim())
      .filter(field => field.length > 0);

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      substitutionFields: [...new Set(substitutionFields)]
    };
  }

  // Template Management Methods

  /**
   * Get all stored email templates
   * @returns {Promise<Array>} - Array of template objects
   */
  async getTemplates() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const templates = stored ? JSON.parse(stored) : [];
      
      // Load built-in templates on first run
      if (templates.length === 0) {
        await this.loadBuiltInTemplates();
        return this.getTemplates();
      }
      
      return templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  }

  /**
   * Upload and save a new email template
   * @param {string} name - Template name
   * @param {string} htmlContent - HTML content
   * @param {string} description - Template description
   * @returns {Promise<Object>} - Upload result
   */
  async uploadTemplate(name, htmlContent, description = '') {
    try {
      // Validate the template
      const validation = this.validateTemplate(htmlContent);
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.issues.join(', ')}`);
      }

      const templates = await this.getTemplates();
      
      // Check for duplicate names
      if (templates.find(t => t.name === name)) {
        throw new Error(`Template with name "${name}" already exists`);
      }

      const newTemplate = {
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        htmlContent,
        type: 'custom',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        substitutionFields: validation.substitutionFields
      };

      templates.push(newTemplate);
      localStorage.setItem(this.storageKey, JSON.stringify(templates));

      console.log('✅ Template uploaded successfully:', newTemplate.id);
      return { success: true, template: newTemplate };
    } catch (error) {
      console.error('❌ Error uploading template:', error);
      throw error;
    }
  }

  /**
   * Delete a template by ID
   * @param {string} templateId - Template ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteTemplate(templateId) {
    try {
      const templates = await this.getTemplates();
      const filtered = templates.filter(t => t.id !== templateId);
      
      if (filtered.length === templates.length) {
        throw new Error('Template not found');
      }

      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      console.log('✅ Template deleted:', templateId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Preview a template with substitutions
   * @param {string} templateId - Template ID
   * @param {Object} substitutions - Substitution values
   * @returns {Promise<string>} - Processed HTML
   */
  async previewTemplate(templateId, substitutions = {}) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find(t => t.id === templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      return this.applySubstitutions(template.htmlContent, substitutions);
    } catch (error) {
      console.error('❌ Error previewing template:', error);
      throw error;
    }
  }

  /**
   * Send email using a stored template
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} templateId - Template ID
   * @param {Object} substitutions - Substitution values
   * @param {boolean} isTest - Whether this is a test email
   * @returns {Promise<Object>} - Send result
   */
  async sendEmailWithTemplate(to, subject, templateId, substitutions = {}, isTest = false) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find(t => t.id === templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      return this.sendEmail({
        to,
        subject,
        htmlTemplate: template.htmlContent,
        substitutions,
        isTest
      });
    } catch (error) {
      console.error('❌ Error sending email with template:', error);
      throw error;
    }
  }

  /**
   * Load built-in email templates
   * @returns {Promise<void>}
   */
  async loadBuiltInTemplates() {
    try {
      // Load statement template
      const statementResponse = await fetch('/src/templates/email_statement.html');
      const statementHtml = await statementResponse.text();
      
      // Load alert template
      const alertResponse = await fetch('/src/templates/email_alert.html');
      const alertHtml = await alertResponse.text();

      const builtInTemplates = [
        {
          id: 'builtin_statement',
          name: 'Monthly Statement',
          description: 'Professional monthly account statement template',
          htmlContent: statementHtml,
          type: 'builtin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          substitutionFields: ['name', 'bankName', 'balance', 'date', 'statementDate', 'accountNumber', 'interest', 'supportEmail', 'supportPhone', 'year']
        },
        {
          id: 'builtin_alert',
          name: 'Security Alert',
          description: 'Security alert template for account notifications',
          htmlContent: alertHtml,
          type: 'builtin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          substitutionFields: ['name', 'bankName', 'alertTitle', 'alertMessage', 'alertLevel', 'alertType', 'accountNumber', 'timestamp', 'amount', 'location', 'detailedDescription', 'actionRequired', 'actionUrl', 'actionButtonText', 'contactUrl', 'supportEmail', 'supportPhone', 'year']
        }
      ];

      localStorage.setItem(this.storageKey, JSON.stringify(builtInTemplates));
      console.log('✅ Built-in templates loaded');
    } catch (error) {
      console.warn('⚠️ Could not load built-in templates:', error);
      // Create minimal fallback templates
      const fallbackTemplates = [
        {
          id: 'fallback_basic',
          name: 'Basic Email',
          description: 'Simple email template',
          htmlContent: '<html><body><h1>{{title}}</h1><p>Dear {{name}},</p><p>{{message}}</p><p>Best regards,<br>{{bankName}}</p></body></html>',
          type: 'builtin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          substitutionFields: ['title', 'name', 'message', 'bankName']
        }
      ];
      localStorage.setItem(this.storageKey, JSON.stringify(fallbackTemplates));
    }
  }
}

// Export singleton instance
const sendGridService = new SendGridService();
export default sendGridService;