// Firebase Messaging Service Worker
// This file must be in the public directory to work properly

// Import Firebase scripts (using CDN for service worker)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration - same as your main app config
const firebaseConfig = {
  apiKey: "AIzaSyCS7vJrD3hD8_1rPJ2NcRLo9DqyhlzFaJ0",
  authDomain: "mcduck-bank-2025.firebaseapp.com",
  projectId: "mcduck-bank-2025",
  storageBucket: "mcduck-bank-2025.appspot.com",
  messagingSenderId: "110215067391",
  appId: "1:110215067391:web:0cbc2a0e65f2b79fd03eca"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('💬 Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'McDuck Bank';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'mcduck-bank-notification',
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'View Details',
        icon: '/logo192.png'
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
        if (client.url.includes('mcduck-bank') && 'focus' in client) {
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