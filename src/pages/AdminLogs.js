import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
  const { user, isAdmin } = useSelector((state) => state.auth);
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
                  backgroundColor: 'grey.50',
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              >
                <pre style={{ 
                  margin: 0, 
                  fontFamily: 'monospace', 
                  fontSize: '0.8em',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
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