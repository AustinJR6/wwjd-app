import { firebaseAuth } from '../config/firebaseConfig.ts'; // Import aligned auth instance
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from '@react-native-firebase/auth'; // Import functions from @react-native-firebase/auth

/**
 * Sign up a new user with email and password
 */
export async function signup(email: string, password: string): Promise<void> {
  try {
    await createUserWithEmailAndPassword(firebaseAuth, email, password); // Use firebaseAuth instance
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log in an existing user with email and password
 */
export async function login(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(firebaseAuth, email, password); // Use firebaseAuth instance
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log out the currently signed-in user
 */
export async function logout(): Promise<void> {
  try {
    await signOut(firebaseAuth); // Use firebaseAuth instance
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(firebaseAuth, email); // Use firebaseAuth instance
  } catch (error: any) {
    throw new Error(error.message);
  }
}