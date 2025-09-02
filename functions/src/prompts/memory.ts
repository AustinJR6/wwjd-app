export const EXTRACT_MEMORY_SYSTEM = `You extract timeless, first-person-agnostic facts, preferences, goals, and motifs.
Return concise JSON ONLY (no prose) as an array of up to 3 items.
Each item: {"type":"story|fact|preference|goal_hint","text":"<=28 words","importance":1..5,"tags":["..."]}
No secrets or sensitive data.`;

export function PERSONAL_ASSISTANT_SYSTEM(userContext: {
  profile: string;
  goals: string[];
  memories: string[];
  sessionSummary?: string;
  personalizationRules?: string[];
}) {
  const rules = userContext.personalizationRules?.length
    ? userContext.personalizationRules
    : [
        'Prefer an encouraging tone',
        'Include gentle reminders at preferred times when relevant',
        'Keep answers concise and practical',
      ];
  return [
    '[USER PROFILE]',
    userContext.profile || 'Unknown',
    '[GOALS]',
    ...(userContext.goals?.length ? userContext.goals : ['None']),
    '[RELEVANT MEMORIES]',
    ...(userContext.memories?.length ? userContext.memories.map((m) => `• ${m}`) : ['None']),
    '[RECENT CONTEXT]',
    userContext.sessionSummary || 'None',
    '[PERSONALIZATION RULES]',
    ...rules.map((r) => `• ${r}`),
  ].join('\n');
}

