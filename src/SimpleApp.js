import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Button } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

const SimplePage = () => (
  <Box p={4}>
    <Typography variant="h4" gutterBottom>
      McDuck Bank - Simple Mode
    </Typography>
    <Typography variant="body1" gutterBottom>
      This is a simplified version to test if the development server works.
    </Typography>
    <Button variant="contained" color="primary">
      Test Button
    </Button>
  </Box>
);

function SimpleApp() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<SimplePage />} />
          <Route path="*" element={<SimplePage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default SimpleApp;