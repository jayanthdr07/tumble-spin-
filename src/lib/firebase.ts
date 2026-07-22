import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  getDocs 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBGnKj3y1wt2Mp_kuetGhMYvxRlAfyR7M0",
  authDomain: "gen-lang-client-0275727746.firebaseapp.com",
  projectId: "gen-lang-client-0275727746",
  storageBucket: "gen-lang-client-0275727746.firebasestorage.app",
  messagingSenderId: "848284584751",
  appId: "1:848284584751:web:272cb70c60309714c2afda"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-tumblespinlaundr-f18be68a-4401-425e-bfdb-877d06e83f10");

// Keys we want to sync
const SYNC_KEYS = [
  'tumblespin_orders',
  'tumblespin_admin_profile',
  'tumblespin_promo',
  'tumblespin_dynamic_pricing',
  'tumblespin_custom_prices',
  'tumblespin_reviews',
  'tumblespin_admin_password',
  'tumblespin_master_password',
  'tumblespin_deleted_orders',
  'tumblespin_business_info',
  'tumblespin_inventory',
  'tumblespin_memberships'
];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export let isFirestoreSuspended = false;
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tumblespin_firestore_suspended');
  }
} catch (e) {}

let activeUnsubscribes: (() => void)[] = [];

export function suspendFirestoreSync() {
  // Disable suspension to keep Cloud Sync active and auto-resuming
  console.warn('⚠️ Firestore suspension bypassed. Cloud Sync remains active.');
}

export function unsuspendFirestoreSync() {
  if (isFirestoreSuspended) {
    isFirestoreSuspended = false;
    try {
      localStorage.removeItem('tumblespin_firestore_suspended');
    } catch (e) {}
    console.log('🔄 Resuming Firestore Live Sync and re-initializing listeners...');
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tumblespin_firestore_suspended_change', { detail: false }));
    }
    
    initializeFirebaseSync();
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  
  // Note: We bypass automatic suspension to ensure CLOUD SYNCED is always active and auto-resuming.

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Warn (Non-blocking offline sync): ', JSON.stringify(errInfo));
}

let isSyncingIncoming = false;
let isSyncAdmin = false;

// Helper to push a key and value to Firestore
async function pushToFirestore(key: string, valueStr: string) {
  if (isFirestoreSuspended) {
    return;
  }
  try {
    let data;
    if (key === 'tumblespin_admin_password' || key === 'tumblespin_master_password') {
      data = valueStr;
    } else {
      try {
        data = JSON.parse(valueStr);
      } catch (parseErr) {
        data = valueStr;
      }
    }
    
    if (key === 'tumblespin_orders') {
      const newOrders = Array.isArray(data) ? data : [];
      
      // Get deleted order IDs to filter them out from the sync
      const deletedStr = localStorage.getItem('tumblespin_deleted_orders') || '[]';
      let deletedIds: string[] = [];
      try {
        const parsedDeleted = JSON.parse(deletedStr);
        if (Array.isArray(parsedDeleted)) {
          deletedIds = parsedDeleted.map((o: any) => o.orderId).filter(Boolean);
        }
      } catch (e) {}

      const filteredOrders = newOrders.filter((order: any) => order && order.orderId && !deletedIds.includes(order.orderId) && !order.isMock);
      
      // Update/Set each non-mock order with merge to preserve fields
      for (const order of filteredOrders) {
        if (isFirestoreSuspended) return;
        if (order && order.orderId) {
          try {
            await setDoc(doc(db, 'orders', order.orderId), order, { merge: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `orders/${order.orderId}`);
          }
        }
      }
      
      if (isFirestoreSuspended) return;

      // Only delete orders from Firestore if admin and explicitly deleted
      if (isSyncAdmin) {
        for (const docId of deletedIds) {
          if (isFirestoreSuspended) return;
          try {
            await deleteDoc(doc(db, 'orders', docId));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `orders/${docId}`);
          }
        }
      }
    } else if (key === 'tumblespin_reviews') {
      const newReviews = Array.isArray(data) ? data : [];
      for (const review of newReviews) {
        if (isFirestoreSuspended) return;
        if (review && review.id) {
          try {
            await setDoc(doc(db, 'reviews', review.id), review);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `reviews/${review.id}`);
          }
        }
      }
    } else if (key === 'tumblespin_memberships') {
      const newMemberships = Array.isArray(data) ? data : [];
      for (const m of newMemberships) {
        if (isFirestoreSuspended) return;
        if (m && m.phone) {
          try {
            await setDoc(doc(db, 'memberships', m.phone), m);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `memberships/${m.phone}`);
          }
        }
      }
    } else {
      if (isFirestoreSuspended) return;
      const docId = key.replace('tumblespin_', '');
      try {
        await setDoc(doc(db, 'settings', docId), { data });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `settings/${docId}`);
      }
    }
  } catch (err) {
    console.error(`Error syncing ${key} to Firestore:`, err);
  }
}

// Set up real-time snapshot listeners from Firestore to LocalStorage
export function initializeFirebaseSync(isAdmin: boolean = false) {
  isSyncAdmin = isAdmin;
  console.log(`Initializing Tumble Spin Firebase Real-Time Synchronization (Role: ${isAdmin ? 'Admin' : 'Visitor'})...`);

  // Initialize default business info if missing
  if (!localStorage.getItem('tumblespin_business_info')) {
    localStorage.setItem('tumblespin_business_info', JSON.stringify({
      name: "Tumble Spin",
      email: "Prakashcsat@gmail.com",
      phone: "9606032491",
      address: "Tumble Spin, #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, Karnataka 560056, India"
    }));
  }

  // Override localStorage.setItem to capture local writes and sync them to Firestore
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key: string, value: string) {
    originalSetItem.apply(this, [key, value]);

    if (isSyncingIncoming) return;

    if (SYNC_KEYS.includes(key)) {
      pushToFirestore(key, value);
    }
  };

  if (isFirestoreSuspended) {
    console.warn('⚡ Tumble Spin is running in high-availability offline fallback mode (Firestore listeners bypassed).');
    return;
  }

  // One-time startup check/seed routine to bootstrap Firestore from LocalStorage if completely empty.
  // Only executed by administrative portals to avoid clean customer sessions overwriting cloud data.
  const checkAndSeed = async () => {
    if (!isAdmin) return;
    try {
      // 1. Orders
      const ordersSnap = await getDocs(collection(db, 'orders'));
      if (ordersSnap.empty) {
        const local = localStorage.getItem('tumblespin_orders');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('🌱 Seed: Empty cloud database detected. Syncing local orders to Firestore...');
              await pushToFirestore('tumblespin_orders', local);
            }
          } catch (e) {}
        }
      }

      // 2. Memberships
      const membershipsSnap = await getDocs(collection(db, 'memberships'));
      if (membershipsSnap.empty) {
        const local = localStorage.getItem('tumblespin_memberships');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('🌱 Seed: Empty cloud database detected. Syncing local memberships to Firestore...');
              await pushToFirestore('tumblespin_memberships', local);
            }
          } catch (e) {}
        }
      }

      // 3. Reviews
      const reviewsSnap = await getDocs(collection(db, 'reviews'));
      if (reviewsSnap.empty) {
        const local = localStorage.getItem('tumblespin_reviews');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('🌱 Seed: Empty cloud database detected. Syncing local reviews to Firestore...');
              await pushToFirestore('tumblespin_reviews', local);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('One-time firestore seed check bypassed:', err);
    }
  };

  checkAndSeed();

  // Clear any existing active unsubscribes before assigning new ones
  activeUnsubscribes.forEach(unsub => {
    try {
      unsub();
    } catch (e) {}
  });
  activeUnsubscribes = [];

  // 1. Listen to 'orders' collection (Real-time synchronization & alerts)
  try {
    let isOrdersInitialLoad = true;
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      try {
        const rawOrders = snapshot.docs.map(docSnap => docSnap.data());
        
        // Detect newly added orders in real-time after initial load is complete
        if (!isOrdersInitialLoad) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const orderData = change.doc.data();
              // Ignore mock or blank orders
              if (orderData && orderData.orderId && !orderData.isMock) {
                console.log(`[Firebase Live Sync] New real-time booking detected: ${orderData.orderId}`);
                window.dispatchEvent(new CustomEvent('tumblespin_new_order_alert', { detail: orderData }));
              }
            }
          });
        }
        isOrdersInitialLoad = false;

        // Get deleted order IDs to filter out immediately
        const deletedStr = localStorage.getItem('tumblespin_deleted_orders') || '[]';
        let deletedIds: string[] = [];
        try {
          const parsedDeleted = JSON.parse(deletedStr);
          if (Array.isArray(parsedDeleted)) {
            deletedIds = parsedDeleted.map((o: any) => o.orderId).filter(Boolean);
          }
        } catch (e) {}

        // Deduplicate orders by orderId (keeping the latest createdAt)
        const uniqueMap = new Map();
        rawOrders.forEach(order => {
          if (!order || !order.orderId) return;
          if (deletedIds.includes(order.orderId)) return;
          if (!uniqueMap.has(order.orderId)) {
            uniqueMap.set(order.orderId, order);
          } else {
            const existing = uniqueMap.get(order.orderId);
            const timeExisting = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
            const timeCurrent = order.createdAt ? new Date(order.createdAt).getTime() : 0;
            if (timeCurrent > timeExisting) {
              uniqueMap.set(order.orderId, order);
            }
          }
        });
        const orders = Array.from(uniqueMap.values());

        // Sort orders by createdAt descending
        orders.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        const currentLocal = localStorage.getItem('tumblespin_orders');
        const incomingStr = JSON.stringify(orders);

        if (currentLocal !== incomingStr) {
          isSyncingIncoming = true;
          localStorage.setItem('tumblespin_orders', incomingStr);
          isSyncingIncoming = false;
          window.dispatchEvent(new Event('storage'));
        }
      } catch (err) {
        console.error('Error handling orders snapshot:', err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });
    activeUnsubscribes.push(unsubOrders);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'orders');
  }

  // 1b. Listen to 'memberships' collection (Admins only)
  try {
    const unsubMemberships = onSnapshot(collection(db, 'memberships'), (snapshot) => {
      try {
        const rawMemberships = snapshot.docs.map(docSnap => docSnap.data());
        // Deduplicate memberships by phone
        const uniqueMembershipMap = new Map();
        rawMemberships.forEach(m => {
          if (!m || !m.phone) return;
          uniqueMembershipMap.set(m.phone, m);
        });
        const memberships = Array.from(uniqueMembershipMap.values());

        const currentLocal = localStorage.getItem('tumblespin_memberships');
        const incomingStr = JSON.stringify(memberships);

        if (currentLocal !== incomingStr) {
          isSyncingIncoming = true;
          localStorage.setItem('tumblespin_memberships', incomingStr);
          isSyncingIncoming = false;
          window.dispatchEvent(new Event('storage'));
        }
      } catch (err) {
        console.error('Error handling memberships snapshot:', err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'memberships');
    });
    activeUnsubscribes.push(unsubMemberships);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'memberships');
  }

  // 2. Listen to 'reviews' collection
  try {
    const unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
      try {
        const rawReviews = snapshot.docs.map(docSnap => docSnap.data());
        // Deduplicate reviews by id
        const uniqueReviewMap = new Map();
        rawReviews.forEach(rev => {
          if (!rev || !rev.id) return;
          uniqueReviewMap.set(rev.id, rev);
        });
        const reviews = Array.from(uniqueReviewMap.values());

        const currentLocal = localStorage.getItem('tumblespin_reviews');
        const incomingStr = JSON.stringify(reviews);

        if (currentLocal !== incomingStr) {
          isSyncingIncoming = true;
          localStorage.setItem('tumblespin_reviews', incomingStr);
          isSyncingIncoming = false;
          window.dispatchEvent(new Event('storage'));
        }
      } catch (err) {}
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reviews');
    });
    activeUnsubscribes.push(unsubReviews);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'reviews');
  }

  // 3. Listen to 'settings' collection
  try {
    const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
      try {
        const docIds = snapshot.docs.map(doc => doc.id);
        const keysToSeed = ['admin_profile', 'promo', 'dynamic_pricing', 'custom_prices', 'admin_password', 'master_password', 'deleted_orders', 'business_info', 'inventory'];
        keysToSeed.forEach(id => {
          if (!docIds.includes(id)) {
            const key = `tumblespin_${id}`;
            const local = localStorage.getItem(key);
            if (local) {
              pushToFirestore(key, local);
            }
          }
        });

        snapshot.docs.forEach((docSnap) => {
          const docId = docSnap.id;
          const key = `tumblespin_${docId}`;
          const docData = docSnap.data();
          
          if (docData && docData.data !== undefined) {
            const currentLocal = localStorage.getItem(key);
            const incomingStr = (key === 'tumblespin_admin_password' || key === 'tumblespin_master_password')
              ? String(docData.data)
              : JSON.stringify(docData.data);

            if (currentLocal !== incomingStr) {
              isSyncingIncoming = true;
              localStorage.setItem(key, incomingStr);
              isSyncingIncoming = false;
              window.dispatchEvent(new Event('storage'));
            }
          }
        });
      } catch (err) {
        console.error('Error handling settings snapshot:', err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings');
    });
    activeUnsubscribes.push(unsubSettings);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings');
  }
}
