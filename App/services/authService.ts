import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';

/**
 * Sign up a new user with email and password
 */
export async function signup(email: string, password: string): Promise<void> {
  try {
    const { auth } = await import('../config/firebaseConfig.ts');
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log in an existing user with email and password
 */
export async function login(email: string, password: string): Promise<void> {
  try {
    const { auth } = await import('../config/firebaseConfig.ts');
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Log out the currently signed-in user
 */
export async function logout(): Promise<void> {
  try {
    const { auth } = await import('../config/firebaseConfig.ts');
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    const { auth } = await import('../config/firebaseConfig.ts');
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    throw new Error(error.message);
  }
}
