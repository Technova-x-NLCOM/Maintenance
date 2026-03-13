const CACHE_NAME = 'inventory-app-v1';
const OFFLINE_URL = '/offline.html';

// Critical resources to cache for offline functionality
const CRITICAL_RESOURCES = [
  '/',
  '/offline.html',
  '/assets/css/styles.css',
  '/assets/js/main.js',
  // Add other critical assets
];

// API endpoints that can work offline with cached data
const CACHEABLE_APIS = [
  '/api/alerts',
  '/api/alerts/settings',
  '/api/alerts/analytics'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching critical resources');
        return cache.addAll(CRITICAL_RESOURCES);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle other requests (assets, etc.)
  event.respondWith(handleResourceRequest(request));
});

async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isCacheableApi = CACHEABLE_APIs.some(api => url.pathname.startsWith(api));

  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests for cacheable APIs
    if (networkResponse.ok && request.method === 'GET' && isCacheableApi) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache for GET requests
    if (request.method === 'GET' && isCacheableApi) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Add offline indicator header
        const response = cachedResponse.clone();
        response.headers.set('X-Served-From', 'cache');
        return response;
      }
    }

    // Return offline response for failed API requests
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This feature requires an internet connection',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Network failed, serve cached page or offline page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Serve offline page
    const offlineResponse = await caches.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }

    // Fallback response
    return new Response(
      '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function handleResourceRequest(request) {
  try {
    // Try cache first for resources
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a fallback response for failed resource requests
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Handle background sync for when the app comes back online
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Performing background sync');
  
  // Notify the app that sync is happening
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'BACKGROUND_SYNC',
      payload: { status: 'syncing' }
    });
  });

  try {
    // Perform any pending sync operations
    // This would typically involve syncing cached changes back to the server
    
    // Notify success
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        payload: { status: 'success' }
      });
    });
  } catch (error) {
    // Notify failure
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        payload: { status: 'failed', error: error.message }
      });
    });
  }
}

// Handle push notifications for alerts
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.message,
    icon: '/assets/icons/alert-icon.png',
    badge: '/assets/icons/badge-icon.png',
    tag: `alert-${data.alertId}`,
    data: data,
    actions: [
      {
        action: 'acknowledge',
        title: 'Acknowledge'
      },
      {
        action: 'view',
        title: 'View Details'
      }
    ],
    requireInteraction: data.severity === 'critical'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Inventory Alert', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'acknowledge') {
    // Handle acknowledge action
    event.waitUntil(
      fetch(`/api/alerts/${data.alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.token}`,
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        console.error('Failed to acknowledge alert:', error);
      })
    );
  } else {
    // Open the app to view details
    event.waitUntil(
      clients.openWindow(`/alerts?highlight=${data.alertId}`)
    );
  }
});