import { Firestore, DocumentReference, doc } from 'firebase/firestore';

/**
 * Helper to build a reference to a region document.
 * Region IDs in Firestore are stored lowercase so we always
 * normalize the provided ID before creating the reference.
 */
export function getRegionDocRef(
  firestore: Firestore,
  regionId: string,
): DocumentReference {
  return doc(firestore, 'regions', regionId.toLowerCase());
}
