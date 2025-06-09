import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tab,
    Tabs,
    Alert,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Snackbar
} from '@mui/material';
import {
    Upload,
    Send,
    Preview,
    Delete,
    FileCopy
} from '@mui/icons-material';
import sendgridService from '../services/sendgridService';

const MessagesPage = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [testSendDialogOpen, setTestSendDialogOpen] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

    // Form states
    const [templateFile, setTemplateFile] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [testSubstitutions, setTestSubstitutions] = useState('{}');
    const [previewHtml, setPreviewHtml] = useState('');

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const loadedTemplates = await sendgridService.getTemplates();
            setTemplates(loadedTemplates);
        } catch (error) {
            showNotification('Failed to load templates: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const showNotification = (message, severity = 'info') => {
        setNotification({ open: true, message, severity });
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/html') {
            setTemplateFile(file);
            setTemplateName(file.name.replace('.html', ''));
        } else {
            showNotification('Please select a valid HTML file', 'error');
        }
    };

    const handleUploadTemplate = async () => {
        if (!templateFile || !templateName) {
            showNotification('Please provide a file and template name', 'error');
            return;
        }

        setLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const htmlContent = e.target.result;
                await sendgridService.uploadTemplate(templateName, htmlContent, templateDescription);
                showNotification('Template uploaded successfully', 'success');
                setUploadDialogOpen(false);
                loadTemplates();
                resetUploadForm();
            };
            reader.readAsText(templateFile);
        } catch (error) {
            showNotification('Failed to upload template: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewTemplate = async (template) => {
        try {
            let substitutions = {};
            try {
                substitutions = JSON.parse(testSubstitutions);
            } catch {
                substitutions = {
                    name: 'John Doe',
                    bankName: 'McDuck Bank',
                    balance: '$12,345.67',
                    date: new Date().toLocaleDateString(),
                    accountNumber: '****1234',
                    supportEmail: 'support@mcduckbank.com',
                    supportPhone: '1-800-MCDUCK',
                    year: new Date().getFullYear()
                };
            }

            const previewContent = await sendgridService.previewTemplate(template.id, substitutions);
            setPreviewHtml(previewContent);
            setSelectedTemplate(template);
            setPreviewDialogOpen(true);
        } catch (error) {
            showNotification('Failed to preview template: ' + error.message, 'error');
        }
    };

    const handleTestSend = async () => {
        if (!testEmail || !selectedTemplate) {
            showNotification('Please provide an email address and select a template', 'error');
            return;
        }

        setLoading(true);
        try {
            let substitutions = {};
            try {
                substitutions = JSON.parse(testSubstitutions);
            } catch {
                substitutions = {
                    name: 'Test User',
                    bankName: 'McDuck Bank',
                    balance: '$12,345.67',
                    date: new Date().toLocaleDateString(),
                    accountNumber: '****1234',
                    supportEmail: 'support@mcduckbank.com',
                    supportPhone: '1-800-MCDUCK',
                    year: new Date().getFullYear()
                };
            }

            await sendgridService.sendEmailWithTemplate(
                testEmail,
                `Test: ${selectedTemplate.name}`,
                selectedTemplate.id,
                substitutions,
                true
            );

            showNotification(`Test email sent successfully to ${testEmail}`, 'success');
            setTestSendDialogOpen(false);
        } catch (error) {
            showNotification('Failed to send test email: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (templateId) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            setLoading(true);
            try {
                await sendgridService.deleteTemplate(templateId);
                showNotification('Template deleted successfully', 'success');
                loadTemplates();
            } catch (error) {
                showNotification('Failed to delete template: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const resetUploadForm = () => {
        setTemplateFile(null);
        setTemplateName('');
        setTemplateDescription('');
    };

    const renderTemplateCard = (template) => (
        <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Typography variant="h6" component="h3">
                            {template.name}
                        </Typography>
                        <Chip 
                            label={template.type || 'Custom'}
                            color="primary"
                            size="small"
                        />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                        {template.description || 'No description provided'}
                    </Typography>
                    
                    <Typography variant="caption" display="block" gutterBottom>
                        Created: {new Date(template.created_at || Date.now()).toLocaleDateString()}
                    </Typography>
                    
                    <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
                        <Tooltip title="Preview Template">
                            <IconButton
                                size="small"
                                onClick={() => handlePreviewTemplate(template)}
                                color="primary"
                            >
                                <Preview />
                            </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Send Test Email">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setSelectedTemplate(template);
                                    setTestSendDialogOpen(true);
                                }}
                                color="success"
                            >
                                <Send />
                            </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Copy Template ID">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    navigator.clipboard.writeText(template.id);
                                    showNotification('Template ID copied to clipboard', 'info');
                                }}
                            >
                                <FileCopy />
                            </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete Template">
                            <IconButton
                                size="small"
                                onClick={() => handleDeleteTemplate(template.id)}
                                color="error"
                            >
                                <Delete />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </CardContent>
            </Card>
        </Grid>
    );

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                📧 Email Templates & Messaging
            </Typography>
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab label="Template Library" />
                    <Tab label="Upload Template" />
                    <Tab label="Send History" />
                </Tabs>
            </Box>

            {/* Template Library Tab */}
            {activeTab === 0 && (
                <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Typography variant="h6">
                            Template Library ({templates.length})
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<Upload />}
                            onClick={() => setUploadDialogOpen(true)}
                        >
                            Upload New Template
                        </Button>
                    </Box>

                    {loading ? (
                        <Box display="flex" justifyContent="center" p={4}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            {templates.map(renderTemplateCard)}
                            {templates.length === 0 && (
                                <Grid item xs={12}>
                                    <Alert severity="info">
                                        No templates found. Upload your first template to get started.
                                    </Alert>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </Box>
            )}

            {/* Upload Template Tab */}
            {activeTab === 1 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Upload New Email Template
                        </Typography>
                        
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    fullWidth
                                    startIcon={<Upload />}
                                    sx={{ height: 56 }}
                                >
                                    {templateFile ? templateFile.name : 'Select HTML File'}
                                    <input
                                        type="file"
                                        hidden
                                        accept=".html"
                                        onChange={handleFileUpload}
                                    />
                                </Button>
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Template Name"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                />
                            </Grid>
                            
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label="Description (Optional)"
                                    value={templateDescription}
                                    onChange={(e) => setTemplateDescription(e.target.value)}
                                />
                            </Grid>
                            
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    onClick={handleUploadTemplate}
                                    disabled={!templateFile || !templateName || loading}
                                    startIcon={loading ? <CircularProgress size={20} /> : <Upload />}
                                >
                                    Upload Template
                                </Button>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Send History Tab */}
            {activeTab === 2 && (
                <Alert severity="info">
                    Send history feature coming soon. This will show email delivery statistics and logs.
                </Alert>
            )}

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Upload Email Template</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Button
                            variant="outlined"
                            component="label"
                            fullWidth
                            startIcon={<Upload />}
                            sx={{ mb: 2 }}
                        >
                            {templateFile ? templateFile.name : 'Select HTML File'}
                            <input
                                type="file"
                                hidden
                                accept=".html"
                                onChange={handleFileUpload}
                            />
                        </Button>
                        
                        <TextField
                            fullWidth
                            label="Template Name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Description (Optional)"
                            value={templateDescription}
                            onChange={(e) => setTemplateDescription(e.target.value)}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleUploadTemplate}
                        variant="contained"
                        disabled={!templateFile || !templateName || loading}
                    >
                        Upload
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Test Send Dialog */}
            <Dialog open={testSendDialogOpen} onClose={() => setTestSendDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Send Test Email</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Test Email Address"
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Test Substitutions (JSON)"
                            value={testSubstitutions}
                            onChange={(e) => setTestSubstitutions(e.target.value)}
                            placeholder='{"name": "John Doe", "balance": "$1,234.56"}'
                            helperText="Provide substitution values as JSON"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTestSendDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleTestSend}
                        variant="contained"
                        startIcon={<Send />}
                        disabled={!testEmail || loading}
                    >
                        Send Test Email
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    Template Preview: {selectedTemplate?.name}
                </DialogTitle>
                <DialogContent>
                    <Box 
                        sx={{ 
                            border: 1, 
                            borderColor: 'divider', 
                            borderRadius: 1,
                            maxHeight: 500,
                            overflow: 'auto'
                        }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewDialogOpen(false)}>
                        Close
                    </Button>
                    <Button 
                        variant="contained"
                        startIcon={<Send />}
                        onClick={() => {
                            setPreviewDialogOpen(false);
                            setTestSendDialogOpen(true);
                        }}
                    >
                        Send Test Email
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Notification Snackbar */}
            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={() => setNotification({ ...notification, open: false })}
            >
                <Alert 
                    onClose={() => setNotification({ ...notification, open: false })} 
                    severity={notification.severity}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default MessagesPage;