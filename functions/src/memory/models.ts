export type MemoryType = 'story' | 'fact' | 'preference' | 'goal_hint';

export interface UserMemory {
  id?: string;
  uid: string;
  type: MemoryType;
  text: string;
  importance: number; // 1..5
  tags: string[];
  embedding: number[];
  novelty: number; // max cosine vs recent
  decayScore: number; // starts at 1.0
  pinned?: boolean;
  source?: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

export interface SessionSummary {
  id?: string;
  uid: string;
  text: string;
  tokens?: number;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

export interface UserFact {
  id?: string;
  uid: string;
  key: string;
  value: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}
