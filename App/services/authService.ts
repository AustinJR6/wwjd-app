import { app } from '@/config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  getAuth,
} from 'firebase/auth';

/**
 * Sign up a new user with email and password
 */
export async function signup(email: string, password: string): Promise<void> {
  try {
    await createUserWithEmailAndPassword(getAuth(app), email, password);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log in an existing user with email and password
 */
export async function login(email: string, password: string): Promise<void> {
  try {
    await signInWithEmailAndPassword(getAuth(app), email, password);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log out the currently signed-in user
 */
export async function logout(): Promise<void> {
  try {
    await signOut(getAuth(app));
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getAuth(app), email);
  } catch (error: any) {
    throw new Error(error.message);
  }
}
