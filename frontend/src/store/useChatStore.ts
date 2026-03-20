import { create } from "zustand";
import { ChatMessage, IssueCard, ReasoningStep, Role } from "../types/chat";
import { chatService, api } from "../services/api";

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  lastIntent: string;
  sessionId: string;
  reasoningSteps: ReasoningStep[];
  activeIssues: IssueCard[];
  
  // Actions
  addMessage: (role: Role, content: string, issues?: IssueCard[]) => string;
  sendMessage: (content: string) => Promise<void>;
  fetchActiveIssues: () => Promise<void>;
  setError: (error: string | null) => void;
  resetChat: () => void;
}

const getInitialSessionId = () => {
  const saved = localStorage.getItem("jira_agent_session");
  if (saved) return saved;
  const newId = `session-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("jira_agent_session", newId);
  return newId;
};

const parseIssueCards = (text: string): IssueCard[] => {
  const keys = [...text.matchAll(/\b[A-Z][A-Z0-9]+-\d+\b/g)].map((m) => m[0]);
  if (!keys.length) return [];
  return [...new Set(keys)].slice(0, 4).map((key) => ({
    key,
    summary: "Refenced Jira Issue",
    status: "Synced",
    priority: "Medium"
  }));
};

export const useChatStore = create<ChatState>((set, get) => ({
  // ... existing state ...
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content: "Greetings. I am JIRA-AI. I've retrieved your active tasks from the workspace. How can I help you progress today?",
      timestamp: Date.now(),
    },
  ],
  loading: false,
  error: null,
  lastIntent: "GENERAL_CHAT",
  sessionId: getInitialSessionId(),
  reasoningSteps: [],
  activeIssues: [],

  addMessage: (role: Role, content: string, issues?: IssueCard[]) => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [...state.messages, { id, role, content, timestamp: Date.now(), issues }],
    }));
    return id;
  },

  sendMessage: async (content: string) => {
    const { sessionId, addMessage } = get();
    const clean = content.trim();
    if (!clean) return;

    set({ loading: true, error: null, reasoningSteps: [] });
    addMessage("user", clean);

    try {
      const data = await chatService.sendMessage(clean, sessionId);
      set({ lastIntent: data.intent || "GENERAL_CHAT" });
      
      const assistantIssues = parseIssueCards(data.reply || "");
      
      // Convert string steps to reasoning objects
      if (data.steps && data.steps.length > 0) {
        const steps: ReasoningStep[] = data.steps.map((text: string, i: number) => ({
          id: `step-${i}`,
          text,
          status: "completed",
          timestamp: Date.now()
        }));
        set({ reasoningSteps: steps });
      }

      addMessage("assistant", data.reply || "Done.", assistantIssues);
      
      get().fetchActiveIssues();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || "Unexpected server error.";
      set({ error: errorMessage });
      addMessage("assistant", "I could not reach your Jira agent right now.");
    } finally {
      set({ loading: false });
    }
  },

  fetchActiveIssues: async () => {
    try {
      console.log("🛠️ Store: Triggering fetchActiveIssues...");
      const response = await api.get("my-active-issues");
      console.log("🛠️ Store: Received active issues:", response.data.issues?.length);
      set({ activeIssues: response.data.issues || [] });
    } catch (error) {
      console.error("Failed to fetch active issues:", error);
    }
  },

  setError: (error) => set({ error }),

  resetChat: () => {
    const newSessionId = `session-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("jira_agent_session", newSessionId);
    set({
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: "Greetings. I am JIRA-AI. I've retrieved your active tasks from the workspace. How can I help you progress today?",
          timestamp: Date.now(),
        },
      ],
      sessionId: newSessionId,
      lastIntent: "GENERAL_CHAT",
      error: null,
      loading: false,
    });
    console.log("🛠️ Store: Chat reset, fetching active issues...");
    get().fetchActiveIssues();
  },
}));
