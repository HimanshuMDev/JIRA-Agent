import { GoogleGenAI, Type } from '@google/genai';
import { JiraGeminiAgent } from '../agents/jira.agent.js';
import { MemoryService } from '../memory/memory.service.js';
import dotenv from 'dotenv';
dotenv.config();

export class OrchestratorService {
  private ai: GoogleGenAI;
  private jiraAgent: JiraGeminiAgent;
  private memory: MemoryService;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    // Single shared memory instance so all sessions are remembered
    this.memory = new MemoryService();
    this.jiraAgent = new JiraGeminiAgent(this.memory);
  }

  /**
   * The Central Router for all incoming text messages.
   * @param userMessage The raw user text
   * @param sessionId  A unique ID per user/conversation (e.g. "user-himanshu")
   */
  async processMessage(
    userMessage: string,
    sessionId: string
  ): Promise<{ reply: string; intent: string; steps?: string[] }> {
    console.log(`\n🧭 [Orchestrator] Analyzing intent for: "${userMessage}"`);

    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const response = await this.ai.models.generateContent({
          model: modelName,
          contents: `Analyze this user message and determine their goal. It MUST be one of: SEARCH_JIRA, CREATE_TICKET, UPDATE_TICKET, ADD_COMMENT, CLEAR_MEMORY, or GENERAL_CHAT. Message: "${userMessage}"`,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      intent: { type: Type.STRING }
                  },
                  required: ["intent"]
              }
          }
      });

      const resultObj = JSON.parse(response.text || '{}');
      const intent = resultObj.intent || 'GENERAL_CHAT';

      console.log(`🧭 [Orchestrator] Intent classified as: [${intent}]`);

      if (['SEARCH_JIRA', 'CREATE_TICKET', 'UPDATE_TICKET', 'ADD_COMMENT'].includes(intent)) {
          console.log(`🧭 [Orchestrator] Passing control to the Jira Specialist Agent...`);
          const result = await this.jiraAgent.handleRequest(userMessage, sessionId) as any;
          return { reply: result.reply, intent, steps: result.steps };
      }
      else if (intent === 'CLEAR_MEMORY') {
          await this.memory.clearSession(sessionId);
          return {
            reply: `Your conversation history for this session has been cleared! We can start fresh now.`,
            intent,
          };
      }
      else {
          // GENERAL_CHAT or unrecognized
          console.log(`🧭 [Orchestrator] Handled by baseline fallback.`);
          return {
            reply: "Hello! I am your AI Jira Assistant. I can Search, Create, Comment, and Update Jira tickets. Try asking about your assigned tasks!",
            intent: 'GENERAL_CHAT',
          };
      }

    } catch (error: any) {
       console.error("🧭 [Orchestrator] Fatal Error:", error.message || error);
       
       if (error.message?.includes('429') || error.status === 'RESOURCE_EXHAUSTED') {
         return {
           reply: "I've hit my API quota limit (429). Please try again in a few seconds or check your Gemini plan and billing details.",
           intent: 'ERROR'
         };
       }

       return { 
         reply: "An error occurred in the Orchestrator layer: " + (error.message || "Unknown error"), 
         intent: 'ERROR' 
       };
    }
  }

  async getWorkspaceSuggestions(): Promise<string[]> {
    try {
      // 1. Get recent issues from Jira via the agent
      const recent = await this.jiraAgent.getRecentIssues();
      
      if (recent.length === 0) {
        return [
          "Show all bugs in progress",
          "Create a new story for UI refinement",
          "Summarize my assigned tasks",
          "Check status of recent tickets"
        ];
      }

      // 2. Generate contextual suggestions
      const suggestions = [
        `Check status of ${recent[0].key}`,
        `Find more tasks in ${recent[0].project}`,
        "Show blocked tickets",
        "Create high-priority bug"
      ];

      return suggestions;
    } catch (error) {
      return ["Show all projects", "Summarize my sprint", "Find high priority bugs"];
    }
  }

  async getMyActiveIssues(): Promise<any[]> {
    return this.jiraAgent.getMyActiveIssues();
  }
}
