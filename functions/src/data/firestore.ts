import { db } from '@core/firebase';

export const getDoc = (path: string) => db.doc(path).get();
export const setMerge = (path: string, data: any) => db.doc(path).set(data, { merge: true });
export const runTx = <T>(fn: (tx: FirebaseFirestore.Transaction) => Promise<T>) => db.runTransaction(fn);
