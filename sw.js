// sw.js - Service Worker optimisé pour PWA et Notifications
const CACHE_NAME = 'hybrilink-v2.3.0';
const BACKGROUND_SYNC_TAG = 'background-sync-notifications';
const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-72x72.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js'
];

// Données en cache pour fonctionnement hors ligne
let cachedParentData = null;
let lastCheckTimestamp = 0;

// === INSTALLATION ===
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Installation v2.3.0');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('📦 Mise en cache des fichiers critiques');
          return cache.addAll(urlsToCache);
        }),
      self.skipWaiting()
    ])
  );
});

// === ACTIVATION ===
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker: Activation v2.3.0');
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`🗑️ Suppression ancien cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Prendre le contrôle immédiatement
      self.clients.claim(),
      // Initialiser la synchronisation en arrière-plan
      initializeBackgroundSync()
    ])
  );
});

// === INITIALISATION SYNCHRO ARRIÈRE-PLAN ===
function initializeBackgroundSync() {
  console.log('🔄 Initialisation synchronisation arrière-plan');
  
  // Programmer une synchronisation périodique
  setInterval(() => {
    checkForNewDataInBackground();
  }, SYNC_INTERVAL);
  
  // Synchroniser immédiatement
  setTimeout(checkForNewDataInBackground, 10000);
}

// === VÉRIFICATION DES DONNÉES EN ARRIÈRE-PLAN ===
async function checkForNewDataInBackground() {
  console.log('🔍 Vérification données arrière-plan...');
  
  try {
    // 1. Récupérer les données parent depuis le cache
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match('/parent-data.json');
    
    if (response) {
      cachedParentData = await response.json();
      console.log('📊 Données parent récupérées:', cachedParentData);
    }
    
    // 2. Vérifier si connecté à Internet
    if (!navigator.onLine) {
      console.log('🌐 Hors ligne - Report de la vérification');
      return;
    }
    
    // 3. Vérifier les nouvelles données
    await Promise.all([
      checkNewGrades(),
      checkNewIncidents(),
      checkNewHomework(),
      checkNewCommunications(),
      checkNewPresences()
    ]);
    
    lastCheckTimestamp = Date.now();
    
  } catch (error) {
    console.error('❌ Erreur vérification arrière-plan:', error);
  }
}

// === VÉRIFIER LES NOUVELLES NOTES ===
async function checkNewGrades() {
  if (!cachedParentData || !cachedParentData.children) return;
  
  try {
    // Utiliser l'API Firestore via import dynamique
    const firebaseAppScript = await importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js');
    const firestoreScript = await importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js');
    
    // Initialiser Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
      projectId: "theo1d",
      // Configuration minimale pour Firestore
    };
    
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    const db = firebase.firestore();
    
    for (const child of cachedParentData.children) {
      if (child.type === 'secondary') {
        const lastCheck = getLastCheckTime('grades', child.matricule);
        
        const gradesQuery = firebase.firestore()
          .collection('published_grades')
          .where('className', '==', child.class)
          .where('publishedAt', '>', new Date(lastCheck));
        
        const querySnapshot = await gradesQuery.get();
        
        querySnapshot.forEach((doc) => {
          const gradeData = doc.data();
          const hasStudentGrade = gradeData.grades?.some(g => 
            g.studentMatricule === child.matricule
          );
          
          if (hasStudentGrade) {
            showBackgroundNotification({
              title: '📊 Nouvelle note',
              body: `${child.fullName} a une nouvelle note en ${gradeData.subject}`,
              data: {
                type: 'grades',
                page: 'grades',
                childId: child.matricule,
                childName: child.fullName,
                gradeId: doc.id
              }
            });
            
            updateLastCheckTime('grades', child.matricule);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur vérification notes:', error);
  }
}

// === VÉRIFIER LES NOUVEAUX INCIDENTS ===
async function checkNewIncidents() {
  if (!cachedParentData || !cachedParentData.children) return;
  
  try {
    for (const child of cachedParentData.children) {
      const lastCheck = getLastCheckTime('incidents', child.matricule);
      
      // Ici, normalement vous feriez une requête Firestore
      // Pour l'exemple, on simule
      
      // Stocker la vérification
      updateLastCheckTime('incidents', child.matricule);
    }
  } catch (error) {
    console.error('❌ Erreur vérification incidents:', error);
  }
}

// === VÉRIFIER LES NOUVEAUX DEVOIRS ===
async function checkNewHomework() {
  if (!cachedParentData || !cachedParentData.children) return;
  
  try {
    for (const child of cachedParentData.children) {
      if (child.type === 'secondary') {
        const lastCheck = getLastCheckTime('homework', child.matricule);
        updateLastCheckTime('homework', child.matricule);
      }
    }
  } catch (error) {
    console.error('❌ Erreur vérification devoirs:', error);
  }
}

// === VÉRIFIER LES NOUVELLES COMMUNICATIONS ===
async function checkNewCommunications() {
  if (!cachedParentData) return;
  
  try {
    const lastCheck = getLastCheckTime('communications', cachedParentData.matricule);
    updateLastCheckTime('communications', cachedParentData.matricule);
  } catch (error) {
    console.error('❌ Erreur vérification communications:', error);
  }
}

// === VÉRIFIER LES NOUVELLES PRÉSENCES ===
async function checkNewPresences() {
  if (!cachedParentData || !cachedParentData.children) return;
  
  try {
    for (const child of cachedParentData.children) {
      const lastCheck = getLastCheckTime('presence', child.matricule);
      updateLastCheckTime('presence', child.matricule);
    }
  } catch (error) {
    console.error('❌ Erreur vérification présences:', error);
  }
}

// === NOTIFICATION ARRIÈRE-PLAN ===
function showBackgroundNotification(notificationData) {
  const { title, body, data } = notificationData;
  
  const options = {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data || {},
    requireInteraction: true,
    tag: data?.type || 'general',
    renotify: true,
    actions: [
      { action: 'view', title: '👁️ Voir' },
      { action: 'dismiss', title: '❌ Fermer' }
    ],
    silent: false
  };
  
  self.registration.showNotification(title, options)
    .then(() => {
      console.log('📨 Notification arrière-plan affichée:', title);
      
      // Mettre à jour le badge
      updateBadgeCount(1);
    })
    .catch(error => {
      console.error('❌ Erreur affichage notification:', error);
    });
}

// === GESTION DU TEMPS DE VÉRIFICATION ===
function getLastCheckTime(type, id) {
  const key = `lastCheck_${type}_${id}`;
  const timestamp = localStorage.getItem(key);
  return timestamp ? new Date(parseInt(timestamp)) : new Date(0);
}

function updateLastCheckTime(type, id) {
  const key = `lastCheck_${type}_${id}`;
  localStorage.setItem(key, Date.now().toString());
}

// === MISE À JOUR DU COMPTEUR DE BADGE ===
function updateBadgeCount(increment = 1) {
  let currentCount = parseInt(localStorage.getItem('notification_count') || '0');
  currentCount += increment;
  localStorage.setItem('notification_count', currentCount.toString());
  
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(currentCount).catch(console.error);
  }
}

// === GESTION DES MESSAGES ===
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SAVE_PARENT_DATA':
      console.log('💾 Sauvegarde données parent');
      cachedParentData = data;
      
      // Sauvegarder dans le cache
      caches.open(CACHE_NAME).then(cache => {
        cache.put(
          new Request('/parent-data.json'),
          new Response(JSON.stringify(data))
        );
      });
      break;
      
    case 'CHECK_NOW':
      console.log('🔔 Vérification immédiate demandée');
      checkForNewDataInBackground();
      break;
      
    case 'UPDATE_BADGE':
      updateBadgeCount(data.count || 0);
      break;
      
    case 'CLEAR_BADGE':
      localStorage.setItem('notification_count', '0');
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge();
      }
      break;
      
    case 'TEST_BACKGROUND_NOTIFICATION':
      showBackgroundNotification({
        title: '✅ Test notification',
        body: 'Les notifications arrière-plan fonctionnent !',
        data: { type: 'test', page: 'dashboard' }
      });
      break;
  }
});

// === ÉVÉNEMENT PUSH ===
self.addEventListener('push', (event) => {
  console.log('📨 Événement push reçu');
  
  let notificationData = {};
  
  try {
    notificationData = event.data ? event.data.json() : {};
  } catch (e) {
    notificationData = {
      title: 'hybrilink',
      body: 'Nouvelle mise à jour disponible',
      data: { type: 'push' }
    };
  }
  
  showBackgroundNotification(notificationData);
});

// === ÉVÉNEMENT SYNC ===
self.addEventListener('sync', (event) => {
  console.log('🔄 Événement sync:', event.tag);
  
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(
      checkForNewDataInBackground()
        .catch(error => {
          console.error('❌ Erreur sync:', error);
          // Réessayer plus tard
          return Promise.reject(error);
        })
    );
  }
});

// === ÉVÉNEMENT PERIODICSYNC (pour Chrome) ===
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-background-sync') {
    console.log('🔄 Synchronisation périodique déclenchée');
    event.waitUntil(checkForNewDataInBackground());
  }
});

// === ÉVÉNEMENT ONLINE/OFFLINE ===
self.addEventListener('online', () => {
  console.log('🌐 En ligne - Lancement synchronisation');
  checkForNewDataInBackground();
});

// === FETCH STRATÉGIE DE CACHE ===
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Ignorer les requêtes Firebase/Firestore
  if (request.url.includes('firebase') || 
      request.url.includes('googleapis.com/fcm') ||
      request.url.includes('cloudinary')) {
    return;
  }
  
  // Pour les pages HTML : Network First
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cachedResponse => cachedResponse || caches.match('/parent.html'));
        })
    );
    return;
  }
  
  // Pour les autres : Cache First
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then(response => {
            if (request.method === 'GET') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Fallback pour les images
            if (request.destination === 'image') {
              return caches.match('/icon-192x192.png');
            }
            return new Response('Ressource non disponible hors ligne', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// === FONCTION UTILITAIRE IMPORT SCRIPTS ===
function importScripts(url) {
  return new Promise((resolve, reject) => {
    try {
      importScripts(url);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

console.log('✅ Service Worker chargé - Notifications arrière-plan activées');