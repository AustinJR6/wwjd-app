export const makeTitle = (text: string) =>
  text
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ') || 'New Conversation';
