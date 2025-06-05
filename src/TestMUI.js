import React from 'react';
import { Button } from '@mui/material';

function TestMUI() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>McDuck Bank - Testing MUI Button Only</h1>
      <p>Testing with just Material-UI Button component.</p>
      <Button variant="contained">MUI Button</Button>
    </div>
  );
}

export default TestMUI;