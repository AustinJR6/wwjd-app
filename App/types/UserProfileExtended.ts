export type UserProfileExtended = {
  bio?: string;
  goals?: string[];
  dreams?: string[];
  beliefs?: string[];
  updatedAt?: any; // Firebase Timestamp
};

export const MAX_BIO_LEN = 1000;
export const MAX_TAG_LEN = 100;
export const MAX_TAGS = 15;

