import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Stepper,
    Step,
    StepLabel
} from '@mui/material';
import {
    Refresh,
    DeleteSweep,
    Storage,
    CheckCircle,
    Security
} from '@mui/icons-material';

const ForceUpdatePage = () => {
    const [isClearing, setIsClearing] = useState(false);
    const [clearStep, setClearStep] = useState(0);
    const [cleared, setCleared] = useState([]);

    const clearSteps = [
        'Clearing localStorage',
        'Clearing sessionStorage', 
        'Clearing IndexedDB',
        'Clearing service worker cache',
        'Unregistering service workers',
        'Forcing page reload'
    ];

    const clearEverything = async () => {
        setIsClearing(true);
        setClearStep(0);
        setCleared([]);

        const browserInfo = getBrowserInfo();

        try {
            // Step 1: Clear localStorage
            setClearStep(1);
            localStorage.clear();
            setCleared(prev => [...prev, 'localStorage cleared']);
            await sleep(300);

            // Step 2: Clear sessionStorage
            setClearStep(2);
            sessionStorage.clear();
            setCleared(prev => [...prev, 'sessionStorage cleared']);
            await sleep(300);

            // Step 3: Clear IndexedDB
            setClearStep(3);
            try {
                await clearIndexedDB();
                setCleared(prev => [...prev, 'IndexedDB cleared']);
            } catch (error) {
                setCleared(prev => [...prev, 'IndexedDB cleared (with warnings)']);
            }
            await sleep(300);

            // Step 4: Clear service worker caches (skip on iOS if problematic)
            setClearStep(4);
            try {
                if (browserInfo.isIOS) {
                    // Shorter timeout for iOS
                    await Promise.race([
                        clearServiceWorkerCaches(),
                        new Promise(resolve => setTimeout(resolve, 2000))
                    ]);
                } else {
                    await clearServiceWorkerCaches();
                }
                setCleared(prev => [...prev, 'Service worker caches cleared']);
            } catch (error) {
                setCleared(prev => [...prev, 'Service worker caches cleared (with warnings)']);
            }
            await sleep(300);

            // Step 5: Unregister service workers (skip on iOS if problematic)
            setClearStep(5);
            try {
                if (browserInfo.isIOS) {
                    // Shorter timeout for iOS
                    await Promise.race([
                        unregisterServiceWorkers(),
                        new Promise(resolve => setTimeout(resolve, 2000))
                    ]);
                } else {
                    await unregisterServiceWorkers();
                }
                setCleared(prev => [...prev, 'Service workers unregistered']);
            } catch (error) {
                setCleared(prev => [...prev, 'Service workers unregistered (with warnings)']);
            }
            await sleep(300);

            // Step 6: Force reload
            setClearStep(6);
            setCleared(prev => [...prev, 'Forcing page reload...']);
            await sleep(1000);

            // iOS-specific reload method
            if (browserInfo.isIOS) {
                // Use multiple methods for iOS
                window.location.href = window.location.href + '?t=' + Date.now();
            } else {
                // Force hard reload with cache bypass
                window.location.reload(true);
            }
            
        } catch (error) {
            console.error('Error during force update:', error);
            setCleared(prev => [...prev, `Error: ${error.message}`]);
            
            // Still try to reload even if there was an error
            setTimeout(() => {
                window.location.href = window.location.href + '?t=' + Date.now();
            }, 2000);
        }
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const clearIndexedDB = async () => {
        try {
            if ('indexedDB' in window) {
                // Get all databases (this is not standard but works in some browsers)
                const databases = await indexedDB.databases?.() || [];
                
                for (const db of databases) {
                    if (db.name) {
                        const deleteReq = indexedDB.deleteDatabase(db.name);
                        await new Promise((resolve, reject) => {
                            deleteReq.onsuccess = () => resolve();
                            deleteReq.onerror = () => reject(deleteReq.error);
                        });
                    }
                }

                // Also try to delete common Firebase/React app databases
                const commonDatabases = [
                    'firebaseLocalStorageDb',
                    'firebase-installations-database',
                    'firebase-messaging-database',
                    'mcduck-bank'
                ];

                for (const dbName of commonDatabases) {
                    try {
                        const deleteReq = indexedDB.deleteDatabase(dbName);
                        await new Promise((resolve) => {
                            deleteReq.onsuccess = () => resolve();
                            deleteReq.onerror = () => resolve(); // Ignore errors for non-existent DBs
                        });
                    } catch (e) {
                        // Ignore errors for databases that don't exist
                    }
                }
            }
        } catch (error) {
            console.warn('Error clearing IndexedDB:', error);
        }
    };

    const clearServiceWorkerCaches = async () => {
        try {
            if ('caches' in window) {
                // Add timeout for iOS Chrome issues
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        console.warn('Cache clearing timed out, continuing...');
                        resolve();
                    }, 3000); // 3 second timeout
                });

                const clearPromise = (async () => {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                })();

                await Promise.race([clearPromise, timeoutPromise]);
            }
        } catch (error) {
            console.warn('Error clearing service worker caches:', error);
        }
    };

    const unregisterServiceWorkers = async () => {
        try {
            if ('serviceWorker' in navigator) {
                // Add timeout for iOS service worker issues
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        console.warn('Service worker unregistration timed out, continuing...');
                        resolve();
                    }, 3000); // 3 second timeout
                });

                const unregisterPromise = (async () => {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(
                        registrations.map(registration => registration.unregister())
                    );
                })();

                await Promise.race([unregisterPromise, timeoutPromise]);
            }
        } catch (error) {
            console.warn('Error unregistering service workers:', error);
        }
    };

    const getBrowserInfo = () => {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua);
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
        const isChrome = /Chrome/.test(ua);
        const isFirefox = /Firefox/.test(ua);
        
        return { isIOS, isSafari, isChrome, isFirefox, userAgent: ua };
    };

    const browserInfo = getBrowserInfo();

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Card>
                <CardContent>
                    <Box textAlign="center" mb={3}>
                        <Typography variant="h4" component="h1" gutterBottom>
                            🔄 Force App Update
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            Clear all cached data and force refresh
                        </Typography>
                    </Box>

                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography variant="body2">
                            <strong>Warning:</strong> This will clear ALL local data including:
                            login sessions, preferences, and cached content. You will need to log in again.
                        </Typography>
                    </Alert>

                    {browserInfo.isIOS && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                <strong>iOS Detected:</strong> Safari and Chrome on iOS aggressively cache web apps. 
                                This tool will help clear everything and force a fresh load.
                            </Typography>
                        </Alert>
                    )}

                    <Box mb={3}>
                        <Typography variant="h6" gutterBottom>
                            Browser Information:
                        </Typography>
                        <List dense>
                            <ListItem>
                                <ListItemIcon>
                                    <Security />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="Platform" 
                                    secondary={browserInfo.isIOS ? 'iOS' : 'Other'}
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    <Storage />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="Browser" 
                                    secondary={
                                        browserInfo.isSafari ? 'Safari' :
                                        browserInfo.isChrome ? 'Chrome' :
                                        browserInfo.isFirefox ? 'Firefox' : 'Other'
                                    }
                                />
                            </ListItem>
                        </List>
                    </Box>

                    {isClearing && (
                        <Box mb={3}>
                            <Typography variant="h6" gutterBottom>
                                Clearing Progress:
                            </Typography>
                            <Stepper activeStep={clearStep} orientation="vertical">
                                {clearSteps.map((label, index) => (
                                    <Step key={label}>
                                        <StepLabel>
                                            {label}
                                            {index < clearStep && <CheckCircle color="success" sx={{ ml: 1 }} />}
                                            {index === clearStep && <CircularProgress size={16} sx={{ ml: 1 }} />}
                                        </StepLabel>
                                    </Step>
                                ))}
                            </Stepper>
                        </Box>
                    )}

                    {cleared.length > 0 && (
                        <Box mb={3}>
                            <Typography variant="h6" gutterBottom>
                                Completed Actions:
                            </Typography>
                            <List dense>
                                {cleared.map((action, index) => (
                                    <ListItem key={index}>
                                        <ListItemIcon>
                                            <CheckCircle color="success" />
                                        </ListItemIcon>
                                        <ListItemText primary={action} />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}

                    <Box textAlign="center">
                        <Button
                            variant="contained"
                            color="warning"
                            size="large"
                            startIcon={isClearing ? <CircularProgress size={20} /> : <DeleteSweep />}
                            onClick={clearEverything}
                            disabled={isClearing}
                            sx={{ mr: 2 }}
                        >
                            {isClearing ? 'Clearing...' : 'Clear Everything & Refresh'}
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={() => window.location.reload(true)}
                            disabled={isClearing}
                            sx={{ mr: 1 }}
                        >
                            Simple Refresh
                        </Button>

                        {isClearing && (
                            <Button
                                variant="contained"
                                color="error"
                                onClick={() => {
                                    window.location.href = window.location.href + '?t=' + Date.now();
                                }}
                            >
                                Skip to Reload
                            </Button>
                        )}
                    </Box>

                    <Box mt={3}>
                        <Typography variant="body2" color="text.secondary" align="center">
                            If problems persist after using this tool, try:
                            <br />
                            • iOS Safari: Settings → Safari → Clear History and Website Data
                            <br />
                            • iOS Chrome: Chrome Menu → Settings → Privacy → Clear Browsing Data
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        </Container>
    );
};

export default ForceUpdatePage;