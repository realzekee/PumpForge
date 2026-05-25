import { initializeApp } from 'firebase/app';
import { initializeAuth, browserPopupRedirectResolver, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "grandmaster-chess-8xev6",
  appId: "1:460660435436:web:1ec615034ada46c89778c9",
  apiKey: "AIzaSyANlI4CB4RCofpsCPv-qIBKVNHmHosItB4",
  authDomain: "grandmaster-chess-8xev6.firebaseapp.com",
  storageBucket: "grandmaster-chess-8xev6.firebasestorage.app",
  messagingSenderId: "460660435436",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);

// Silence internal Firestore warning/info logs in browser console
try {
  setLogLevel('silent');
} catch (e) {
  // Safe fallback
}

// Initialize Firestore with experimentalForceLongPolling to bypass sandboxed container/proxy websocket blocks
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = initializeAuth(app, {
  popupRedirectResolver: browserPopupRedirectResolver
});
export const googleProvider = new GoogleAuthProvider();

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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  const errStr = error instanceof Error ? error.message : String(error);
  const isPermissionError = errStr.toLowerCase().includes('permission') || 
                            errStr.toLowerCase().includes('insufficient') ||
                            (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied');

  if (isPermissionError) {
    console.error('Firestore Security Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    // Log a non-blocking warning for connection-offline and unreachable exceptions
    console.error('Firestore Non-Security Network/Offline Warning: ', JSON.stringify(errInfo));
  }
}

// Test connectivity on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Silently swallow permission denied or other harmless errors on locked test path
  }
}
testConnection();
