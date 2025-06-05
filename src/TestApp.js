import React from 'react';
import { Box, Typography } from '@mui/material';

function TestApp() {
  return (
    <Box p={4}>
      <Typography variant="h4">Simple Test App</Typography>
      <Typography>This is a minimal React component to test if the dev server works.</Typography>
    </Box>
  );
}

export default TestApp;