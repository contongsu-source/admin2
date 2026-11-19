import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

const formatIdToEmail = (id: string) => `${id.toLowerCase().replace(/[^a-z0-9]/g, '')}@sbm.app`;

export const loginWithId = async (id: string, pin: string) => {
  try {
    const email = formatIdToEmail(id);
    const result = await signInWithEmailAndPassword(auth, email, pin);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
            // Auto sign up if not found
            const email = formatIdToEmail(id);
            const result = await createUserWithEmailAndPassword(auth, email, pin);
            return result.user;
        } catch (signupError) {
             console.error("Error signing up with ID", signupError);
             throw signupError;
        }
    }
    console.error("Error signing in with ID", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
