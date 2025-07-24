/**
 * Build the Firestore document path for a region ID.
 * Region IDs are stored lowercase in Firestore.
 */
export function getRegionDocPath(regionId: string): string {
  return `regions/${regionId.toLowerCase()}`;
}
