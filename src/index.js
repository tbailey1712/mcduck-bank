import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import { store } from './store';
import { UnifiedAuthProvider } from './contexts/UnifiedAuthProvider';
import updateService from './services/updateService';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <UnifiedAuthProvider>
        <App />
      </UnifiedAuthProvider>
    </Provider>
  </React.StrictMode>
);

// Initialize PWA update service
updateService.init();

// Register Firebase messaging service worker for notifications only
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('📱 Firebase messaging SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('❌ Firebase messaging SW registration failed: ', registrationError);
      });
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
