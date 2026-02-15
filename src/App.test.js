import React from 'react';
import { render } from './utils/test-utils';
import App from './App';

test('renders without crashing', () => {
  const { container } = render(<App />);
  expect(container).toBeTruthy();
});
