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

