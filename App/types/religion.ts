export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts?: number;
};

export type ReligionMemory = {
  id: string;        // doc id
  title: string;     // user-specified or default
  createdAt: number; // ms epoch
  updatedAt: number; // ms epoch
  summary?: string;  // optional short blurb
  messages: ChatMessage[]; // raw chat slice saved
  tokensEstimate?: number; // optional
};

