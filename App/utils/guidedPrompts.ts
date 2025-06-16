export const guidedPrompts: Record<string, string[]> = {
  Christianity: [
    'What blessing did you notice today?',
    'Where did you practice forgiveness?',
    'How can you walk closer with Christ tomorrow?',
  ],
  Islam: [
    'Which verse of the Quran inspired you today?',
    'How did you show compassion?',
    'What intention will guide your next prayer?',
  ],
  Hinduism: [
    'Recall a moment of selfless service today.',
    'What teaching from the Gita resonates now?',
    'How will you honor the divine within you tomorrow?',
  ],
  Buddhism: [
    'When did you feel most mindful today?',
    'What emotion challenged your peace?',
    'How can you cultivate compassion next?',
  ],
  Judaism: [
    'Which teaching from the Torah guided you today?',
    'How did you embrace community?',
    'Where will you seek wisdom tomorrow?',
  ],
};

export function getPromptsForReligion(religion: string): string[] {
  return guidedPrompts[religion] || [
    'What are you grateful for today?',
    'Who did you help?',
    'What do you hope for tomorrow?',
  ];
}
