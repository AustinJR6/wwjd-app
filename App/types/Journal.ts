export type JournalStage =
  | 'reflection'
  | 'gratitude'
  | 'spiritual'
  | 'forgiveness'
  | 'compassion';

export interface JournalEntry {
  id?: string;
  stage: JournalStage;
  aiPrompt: string;
  aiResponse: string;
  userEntry: string;
  timestamp: string;
  tokensUsed?: number;
}
