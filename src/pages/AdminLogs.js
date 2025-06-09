import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';
import {
  Container,
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, subDays, subHours } from 'date-fns';
import auditService, { AUDIT_EVENTS } from '../services/auditService';

const AdminLogs = () => {
  const { user, isAdmin, updateActivity } = useUnifiedAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedLog, setSelectedLog] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    event_type: '',
    user_id: '',
    timeframe: '30d',
    search: ''
  });

  // Check admin access
  useEffect(() => {
    if (!user || !isAdmin) {
      navigate('/');
    }
  }, [user, isAdmin, navigate]);

  // Load logs and stats
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const startDate = getStartDate(filters.timeframe);
      console.log('🕒 AdminLogs loading data with timeframe:', filters.timeframe, 'start_date:', startDate);

      const [logsData, statsData] = await Promise.all([
        auditService.getAuditLogs(
          {
            event_type: filters.event_type || undefined,
            user_id: filters.user_id || undefined,
            start_date: startDate
          },
          100
        ),
        auditService.getAuditStats(filters.timeframe)
      ]);

      console.log('📈 AdminLogs loaded:', logsData.length, 'logs');
      setLogs(logsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading audit data:', error);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Get start date based on timeframe
  const getStartDate = (timeframe) => {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return subHours(now, 1);
      case '24h':
        return subDays(now, 1);
      case '7d':
        return subDays(now, 7);
      case '30d':
        return subDays(now, 30);
      default:
        return subDays(now, 1);
    }
  };

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!filters.search) return logs;
    
    const searchLower = filters.search.toLowerCase();
    return logs.filter(log => 
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.ip_address?.includes(searchLower) ||
      log.event_type?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.details)?.toLowerCase().includes(searchLower)
    );
  }, [logs, filters.search]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page
  };

  // Get event type color
  const getEventTypeColor = (eventType) => {
    switch (eventType) {
      case AUDIT_EVENTS.LOGIN_SUCCESS:
        return 'success';
      case AUDIT_EVENTS.LOGIN_FAILURE:
        return 'error';
      case AUDIT_EVENTS.LOGOUT:
        return 'info';
      case AUDIT_EVENTS.TRANSACTION_CREATED:
        return 'primary';
      case AUDIT_EVENTS.TRANSACTION_EDITED:
        return 'warning';
      case AUDIT_EVENTS.TRANSACTION_DELETED:
        return 'error';
      case AUDIT_EVENTS.PROFILE_UPDATED:
        return 'info';
      case AUDIT_EVENTS.UNAUTHORIZED_ACCESS_ATTEMPT:
        return 'error';
      default:
        return 'default';
    }
  };

  // Format event type for display
  const formatEventType = (eventType) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Render event details in human-readable format
  const renderEventDetails = (log) => {
    const details = log.details || {};
    const eventType = log.event_type;

    // Transaction Edit Details
    if (eventType === AUDIT_EVENTS.TRANSACTION_EDITED && details.changes_made) {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Transaction Edit Details
          </Typography>
          
          {/* Account Information */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Account Affected:</Typography>
            <Typography variant="body1">
              {details.account_name || 'Unknown'} ({details.account_email || details.account_edited || 'Unknown'})
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Edited From:</Typography>
            <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
              {details.edited_from?.replace('_', ' ') || 'Unknown'}
            </Typography>
          </Box>

          {/* Changes Made */}
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
            Changes Made ({details.total_changes || 0})
          </Typography>
          
          {details.changes_made?.map((change, index) => (
            <Box key={index} sx={{ mb: 2, p: 1.5, bgcolor: 'background.default', color: 'text.primary', borderRadius: 1, border: 1, borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                {change.field}:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip 
                  label={change.formatted_old || change.old_value} 
                  size="small" 
                  color="error" 
                  variant="outlined"
                />
                <Typography variant="body2">→</Typography>
                <Chip 
                  label={change.formatted_new || change.new_value} 
                  size="small" 
                  color="success" 
                  variant="outlined"
                />
              </Box>
            </Box>
          ))}

          {/* Transaction ID */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">Transaction ID:</Typography>
            <Typography variant="body2" fontFamily="monospace">
              {details.transaction_id || details.id || 'Unknown'}
            </Typography>
          </Box>
        </Box>
      );
    }

    // Transaction Deletion Details
    if (eventType === AUDIT_EVENTS.TRANSACTION_DELETED && details.deleted_transaction) {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Transaction Deletion Details
          </Typography>
          
          {/* Account Information */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Account Affected:</Typography>
            <Typography variant="body1">
              {details.account_name || 'Unknown'} ({details.account_email || details.account_affected || 'Unknown'})
            </Typography>
          </Box>

          {/* Deleted Transaction Details */}
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>
            Deleted Transaction
          </Typography>
          
          <Box sx={{ p: 1.5, bgcolor: 'background.default', color: 'text.primary', borderRadius: 1, border: '1px solid', borderColor: 'error.main' }}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Amount:</Typography>
                <Typography variant="body1">${details.deleted_transaction.amount?.toFixed(2)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Type:</Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {details.deleted_transaction.transaction_type}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Description:</Typography>
                <Typography variant="body1">
                  {details.deleted_transaction.description || '(No description)'}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">Transaction ID:</Typography>
            <Typography variant="body2" fontFamily="monospace">
              {details.transaction_id || 'Unknown'}
            </Typography>
          </Box>
        </Box>
      );
    }

    // Transaction Creation Details
    if (eventType === AUDIT_EVENTS.TRANSACTION_CREATED && details.transaction_details) {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Transaction Creation Details
          </Typography>
          
          {/* Account Information */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Account Affected:</Typography>
            <Typography variant="body1">
              {details.account_name || 'Unknown'} ({details.account_email || details.account_affected || 'Unknown'})
            </Typography>
          </Box>

          {/* Transaction Details */}
          <Box sx={{ p: 1.5, bgcolor: 'background.default', color: 'text.primary', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Amount:</Typography>
                <Typography variant="body1">${details.transaction_details.amount?.toFixed(2)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Type:</Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {details.transaction_details.transaction_type}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Description:</Typography>
                <Typography variant="body1">
                  {details.transaction_details.description || '(No description)'}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">Transaction ID:</Typography>
            <Typography variant="body2" fontFamily="monospace">
              {details.transaction_id || 'Unknown'}
            </Typography>
          </Box>
        </Box>
      );
    }

    // Profile Update Details
    if (eventType === AUDIT_EVENTS.PROFILE_UPDATED) {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Profile Update Details
          </Typography>
          
          <Grid container spacing={2}>
            {details.displayName && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Display Name:</Typography>
                <Typography variant="body1">{details.displayName}</Typography>
              </Grid>
            )}
            {details.mobile && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Mobile:</Typography>
                <Typography variant="body1">{details.mobile}</Typography>
              </Grid>
            )}
            {details.preferences && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Notification Preferences:</Typography>
                <Box sx={{ mt: 1 }}>
                  {Object.entries(details.preferences).map(([key, value]) => (
                    <Chip 
                      key={key}
                      label={`${key}: ${value ? 'Enabled' : 'Disabled'}`}
                      size="small"
                      color={value ? 'success' : 'default'}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>
      );
    }

    // Login/Logout Details
    if ([AUDIT_EVENTS.LOGIN_SUCCESS, AUDIT_EVENTS.LOGIN_FAILURE, AUDIT_EVENTS.LOGOUT].includes(eventType)) {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Authentication Details
          </Typography>
          
          <Grid container spacing={2}>
            {details.login_method && (
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Login Method:</Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {details.login_method.replace('_', ' ')}
                </Typography>
              </Grid>
            )}
            {details.session_token && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Session Token:</Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {details.session_token}
                </Typography>
              </Grid>
            )}
            {details.lastLogin && (
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Last Login:</Typography>
                <Typography variant="body1">
                  {new Date(details.lastLogin).toLocaleString()}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>
      );
    }

    // Default fallback to formatted JSON for other events
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
          Event Details
        </Typography>
        <Box component="pre" sx={{ 
          margin: 0, 
          fontFamily: 'monospace', 
          fontSize: '0.8em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          bgcolor: 'background.default',
          color: 'text.primary',
          p: 1,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider'
        }}>
          {JSON.stringify(details, null, 2)}
        </Box>
      </Box>
    );
  };

  // Export logs (simplified - just console log for now)
  const handleExport = () => {
    const exportData = filteredLogs.map(log => ({
      timestamp: (() => {
        try {
          return format(log.timestamp, 'yyyy-MM-dd HH:mm:ss');
        } catch (error) {
          console.warn('Error formatting timestamp for export:', log.id, error);
          return 'Invalid date';
        }
      })(),
      event_type: log.event_type,
      user_email: log.user_email,
      ip_address: log.ip_address,
      details: JSON.stringify(log.details)
    }));
    
    console.log('Exported audit logs:', exportData);
    // In a real implementation, you'd download as CSV/JSON
  };

  // Load data on mount and filter changes
  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin, loadData]);

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Audit Logs
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton onClick={handleExport} disabled={loading}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Events
                </Typography>
                <Typography variant="h4">
                  {stats.total_events}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Unique Users
                </Typography>
                <Typography variant="h4">
                  {stats.unique_users}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Unique IPs
                </Typography>
                <Typography variant="h4">
                  {stats.unique_ips}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Timeframe
                </Typography>
                <Typography variant="h4">
                  All Time
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Filters</Typography>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Timeframe</InputLabel>
              <Select
                value={filters.timeframe}
                label="Timeframe"
                onChange={(e) => handleFilterChange('timeframe', e.target.value)}
              >
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Event Type</InputLabel>
              <Select
                value={filters.event_type}
                label="Event Type"
                onChange={(e) => handleFilterChange('event_type', e.target.value)}
              >
                <MenuItem value="">All Events</MenuItem>
                {Object.values(AUDIT_EVENTS).map(eventType => (
                  <MenuItem key={eventType} value={eventType}>
                    {formatEventType(eventType)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="User ID"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
              placeholder="Filter by user ID"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search logs..."
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Logs Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Event Type</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>IP Address</TableCell>
                    {!isMobile && <TableCell>Browser</TableCell>}
                    {!isMobile && <TableCell>Details</TableCell>}
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {(() => {
                              try {
                                // Additional validation before formatting
                                if (!log.timestamp || isNaN(log.timestamp.getTime())) {
                                  console.warn('Invalid timestamp object for log:', log.id, 'timestamp:', log.timestamp);
                                  return 'Invalid date';
                                }
                                return format(log.timestamp, 'MMM d, HH:mm:ss');
                              } catch (error) {
                                console.warn('Error formatting timestamp for log:', log.id, error, 'timestamp:', log.timestamp);
                                return 'Invalid date';
                              }
                            })()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatEventType(log.event_type)}
                            color={getEventTypeColor(log.event_type)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {log.user_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {log.user_email}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {log.ip_address}
                          </Typography>
                        </TableCell>
                        {!isMobile && (
                          <TableCell>
                            <Typography variant="body2">
                              {log.browser}
                            </Typography>
                          </TableCell>
                        )}
                        {!isMobile && (
                          <TableCell>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                maxWidth: 200, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {JSON.stringify(log.details)}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small"
                              onClick={() => setSelectedLog(log)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredLogs.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>

      {/* Log Details Dialog */}
      <Dialog 
        open={Boolean(selectedLog)} 
        onClose={() => setSelectedLog(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedLog && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Log Details
              <IconButton onClick={() => setSelectedLog(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Event Type</Typography>
                  <Chip
                    label={formatEventType(selectedLog.event_type)}
                    color={getEventTypeColor(selectedLog.event_type)}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {(() => {
                      try {
                        if (!selectedLog.timestamp || isNaN(selectedLog.timestamp.getTime())) {
                          return 'Invalid date';
                        }
                        return format(selectedLog.timestamp, 'PPpp');
                      } catch (error) {
                        return 'Invalid date';
                      }
                    })()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">User</Typography>
                  <Typography variant="body1">{selectedLog.user_name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {selectedLog.user_email}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">IP Address</Typography>
                  <Typography variant="body1" fontFamily="monospace" sx={{ mb: 2 }}>
                    {selectedLog.ip_address}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Browser</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedLog.browser}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Platform</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedLog.platform}
                  </Typography>
                </Grid>
                {selectedLog.session_id && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Session ID</Typography>
                    <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2 }}>
                      {selectedLog.session_id}
                    </Typography>
                  </Grid>
                )}
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Event Details
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  bgcolor: 'background.default',
                  maxHeight: 400,
                  overflow: 'auto'
                }}
              >
                {renderEventDetails(selectedLog)}
              </Paper>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedLog(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminLogs;