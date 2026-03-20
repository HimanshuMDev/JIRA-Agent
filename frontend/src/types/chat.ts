export type Role = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  issues?: IssueCard[];
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  intent: string;
  steps?: string[];
  error?: string;
}

export interface IssueCard {
  key: string;
  summary: string;
  status: string;
  priority: string;
  type?: string;
}

export interface ReasoningStep {
  id: string;
  text: string;
  status: "pending" | "completed" | "error";
}
