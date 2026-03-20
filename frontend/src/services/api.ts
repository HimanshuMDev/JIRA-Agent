import axios from "axios";
import { ChatResponse } from "../types/chat";

const envAgentToken = (import.meta.env.VITE_AGENT_TOKEN as string | undefined)?.trim() ?? "";

export const api = axios.create({
  baseURL: "http://localhost:5050/api/",
  headers: {
    "Content-Type": "application/json",
    ...(envAgentToken ? { "x-agent-token": envAgentToken } : {}),
  },
});

export const chatService = {
  sendMessage: async (message: string, sessionId: string): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>("/chat", {
      message,
      sessionId,
    });
    return response.data;
  },
};
