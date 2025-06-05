import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Build as BuildIcon } from '@mui/icons-material';

const BuildInfo = React.memo(({ showDetailed = false }) => {
  const buildNumber = process.env.REACT_APP_BUILD_NUMBER;
  const buildDate = process.env.REACT_APP_BUILD_DATE;

  if (!buildNumber) {
    return null;
  }

  if (showDetailed) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 1,
        mt: 2 
      }}>
        <Chip
          icon={<BuildIcon />}
          label={`Build ${buildNumber}`}
          variant="outlined"
          size="small"
          color="primary"
        />
        {buildDate && (
          <Typography variant="caption" color="text.secondary">
            Built: {new Date(buildDate).toLocaleString()}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'fixed', 
      bottom: 16, 
      right: 16,
      zIndex: 1000
    }}>
      <Typography 
        variant="caption" 
        color="text.secondary"
        sx={{ 
          backgroundColor: 'background.paper',
          padding: '4px 8px',
          borderRadius: 1,
          boxShadow: 1,
          fontFamily: 'monospace'
        }}
      >
        v{buildNumber}
      </Typography>
    </Box>
  );
});

BuildInfo.displayName = 'BuildInfo';

export default BuildInfo;