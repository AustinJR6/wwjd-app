import type { JournalStage } from '@/types';

export const JOURNAL_STAGES: { key: JournalStage; label: string }[] = [
  { key: 'reflection', label: 'Daily Reflection' },
  { key: 'gratitude', label: 'Gratitude Practice' },
  { key: 'spiritual', label: 'Spiritual Insight' },
  { key: 'forgiveness', label: 'Forgiveness / Letting Go' },
  { key: 'compassion', label: 'Compassion for Others' },
];

export const JOURNAL_PROMPTS: Record<JournalStage, string> = {
  reflection: 'Help me reflect honestly on today.',
  gratitude:
    "Guide me to reflect on something I'm deeply grateful for today. Help me open my heart.",
  spiritual: 'Share a brief spiritual insight to inspire me.',
  forgiveness: 'Invite me to release resentment and practice forgiveness.',
  compassion: 'Help me see how I can show compassion to someone today.',
};

