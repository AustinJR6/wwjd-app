import { firebaseAuth } from '../config/firebaseConfig'; // no .ts extension

/**
 * Sign up a new user with email and password
 */
export async function signup(email: string, password: string): Promise<void> {
  try {
    await firebaseAuth().createUserWithEmailAndPassword(email, password);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log in an existing user with email and password
 */
export async function login(email: string, password: string): Promise<void> {
  try {
    await firebaseAuth().signInWithEmailAndPassword(email, password);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log out the currently signed-in user
 */
export async function logout(): Promise<void> {
  try {
    await firebaseAuth().signOut();
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    await firebaseAuth().sendPasswordResetEmail(email);
  } catch (error: any) {
    throw new Error(error.message);
  }
}
