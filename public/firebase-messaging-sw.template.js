// Firebase Messaging Service Worker Template
// This file gets processed during build to replace environment variables

// Import Firebase scripts (using CDN for service worker)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration - populated from environment variables during build
const firebaseConfig = {
  apiKey: "%REACT_APP_FIREBASE_API_KEY%",
  authDomain: "%REACT_APP_FIREBASE_AUTH_DOMAIN%",
  projectId: "%REACT_APP_FIREBASE_PROJECT_ID%",
  storageBucket: "%REACT_APP_FIREBASE_STORAGE_BUCKET%",
  messagingSenderId: "%REACT_APP_FIREBASE_MESSAGING_SENDER_ID%",
  appId: "%REACT_APP_FIREBASE_APP_ID%"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('💬 Background message received:', payload);

  const notificationTitle = payload.notification?.title || process.env.REACT_APP_BANK_NAME || 'Bank Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon_192x192.png',
    badge: '/icon_96x96.png',
    tag: 'bank-notification',
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'View Details',
        icon: '/icon_192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true,
    silent: false
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification click received:', event);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(window.location.hostname) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open new window
      if (clients.openWindow) {
        const targetUrl = event.notification.data?.url || '/';
        return clients.openWindow(targetUrl);
      }
    })
  );
});