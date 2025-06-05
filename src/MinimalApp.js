import React from 'react';

function MinimalApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>McDuck Bank - Minimal Test</h1>
      <p>Testing with zero external dependencies.</p>
      <button onClick={() => alert('Working!')}>Test Button</button>
    </div>
  );
}

export default MinimalApp;