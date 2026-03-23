import { GoogleGenAI, Type } from '@google/genai';
import { JiraMcpServer } from '../mcp/jira-mcp-server.js';
import { MemoryService } from '../memory/memory.service.js';
import type { ChatMessage } from '../memory/memory.service.js';
import dotenv from 'dotenv';
dotenv.config();

// Safety: Maximum number of tool calls allowed per single user request
const MAX_TOOL_CALLS = 3;

export class JiraGeminiAgent {
  private ai: GoogleGenAI;
  private jiraServer: JiraMcpServer;
  private memory: MemoryService;

  constructor(memoryService: MemoryService) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    this.jiraServer = new JiraMcpServer();
    this.memory = memoryService;
  }

  // Tell Gemini exactly what tools it has access to
  private getJiraTools() {
    return {
      functionDeclarations: [
        {
          name: 'executeJqlSearch',
          description: 'Search Jira for tickets. Always formulate valid Atlassian JQL.',
          parameters: {
            type: Type.OBJECT,
            properties: { jql: { type: Type.STRING, description: 'The strict JQL string.' } },
            required: ['jql']
          }
        },
        {
          name: 'createIssue',
          description: 'Create a new Jira ticket.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              projectKey: { type: Type.STRING, description: 'The exact Jira Project Key (e.g., APP, PROJ).' },
              summary: { type: Type.STRING, description: 'A short 3-6 word professional title extracted from user text.' },
              description: { type: Type.STRING, description: 'A detailed description of the task or bug.' },
              issueType: { type: Type.STRING, description: 'Must be exactly: Bug, Task, or Story' },
              priority: { type: Type.STRING, description: 'Optional. Extract if the user says High, Medium, Low, or Highest.' },
              assigneeId: { type: Type.STRING, description: 'Optional. The Atlassian accountId. Only set this if you already have an accountId from a searchUser call.' }
            },
            required: ['projectKey', 'issueType']
          }
        },
        {
          name: 'addComment',
          description: 'Add a text comment to an existing Jira ticket.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              ticketId: { type: Type.STRING, description: 'The ticket ID (e.g., APP-123)' },
              commentText: { type: Type.STRING, description: 'The text snippet to post.' }
            },
            required: ['ticketId', 'commentText']
          }
        },
        {
          name: 'updateTicketStatus',
          description: 'Change the status of an existing Jira ticket (e.g. move it to In Progress, Done, In Review).',
          parameters: {
            type: Type.OBJECT,
            properties: {
              ticketId: { type: Type.STRING, description: 'The ticket ID (e.g., KAN-123)' },
              desiredStatus: { type: Type.STRING, description: 'The new status name (e.g. In Review, Done).' }
            },
            required: ['ticketId', 'desiredStatus']
          }
        },
        {
          name: 'searchUser',
          description: 'Search for a Jira user by name or email to get their accountId for assignment.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              displayName: { type: Type.STRING, description: 'The display name or partial name of the user to search for.' }
            },
            required: ['displayName']
          }
        }
      ]
    };
  }

  public async handleRequest(userInput: string, sessionId: string) {
    console.log(`\n💭  [Agent] Processing request for session [${sessionId}]...`);

    try {
      // Load previous conversation history from memory
      const history = await this.memory.getHistory(sessionId);
      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

      const chat = this.ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: `You are the Premium AI Jira Orchestrator. Your mission is to provide world-class, high-fidelity Jira updates that are both deeply informative and visually stunning.
          
          STYLE & FORMATTING RULES:
          1. 📊 FOR LISTS/SUMMARIES: Always use a clean Markdown Table: [ Key | Summary | Status | Priority ].
          2. 🎫 FOR SINGLE TICKET DETAILS: Use this Premium Card Template:
             ### [KEY-123] Summary Title
             **Status:** 🟢 StatusName | **Priority:** ⚡ PriorityName | **Assignee:** 👤 Name
             ---
             #### 📝 Description
             > Provide the full description in a clean, professional quote block. Use line breaks for readability.
             
             #### 💬 Recent Activity
             - **Author**: "Comment text here..."
             ---
          3. 🔍 SEARCH SAFETY: JQL searches MUST always include a filter (e.g., project = "KEY" or status != Done).
          4. ✨ AESTHETICS: Use bold headers, clear horizontal separators (---), and relevant emojis (🟢, ⚡, 👤, 🎫, 📝) sparingly but effectively to create a premium feel.
          5. 🚫 NO GHOST CARDS: Never invent or placeholder ticket data. Only present what is returned by your tools.`,
          tools: [this.getJiraTools()]
        },
        history: history
      });

      let lastUserMessage = userInput;
      let toolCallCount = 0;
      const steps: string[] = [];

      // Send the initial user message
      let response = await chat.sendMessage({ message: lastUserMessage });

      // Loop: Keep processing tool calls until AI gives a final text answer
      while (response.functionCalls && response.functionCalls.length > 0) {
        if (toolCallCount >= MAX_TOOL_CALLS) {
          console.warn(`⚠️  [Agent] Max tool calls reached.`);
          break;
        }
        toolCallCount++;

        const currentCalls = response.functionCalls;
        console.log(`⚡ [Agent] turn #${toolCallCount}: ${currentCalls.length} parallel calls`);

        const toolResponses = await Promise.all(currentCalls.map(async (toolCall: any) => {
          const args = toolCall.args;
          let result: any;
          
          const stepDesc = this.generateStepDescription(toolCall.name, args);
          steps.push(stepDesc);

          try {
            if (toolCall.name === 'executeJqlSearch') {
              result = await this.jiraServer.executeJqlSearch(args.jql);
            } else if (toolCall.name === 'createIssue') {
              result = await this.jiraServer.createIssue(args.projectKey, args.summary, args.description, args.issueType, args.priority, args.assigneeId);
            } else if (toolCall.name === 'addComment') {
              result = await this.jiraServer.addComment(args.ticketId, args.commentText);
            } else if (toolCall.name === 'updateTicketStatus') {
              result = await this.jiraServer.updateTicketStatus(args.ticketId, args.desiredStatus);
            } else if (toolCall.name === 'searchUser') {
              result = await this.jiraServer.searchUser(args.displayName);
            }
            return {
              functionResponse: {
                name: toolCall.name!,
                response: { result }
              }
            };
          } catch (err: any) {
            return {
              functionResponse: {
                name: toolCall.name!,
                response: { error: err.message }
              }
            };
          }
        }));

        response = await chat.sendMessage({ message: toolResponses });
      }

      const finalText = response.text ?? 'Done.';
      
      this.memory.addMessage(sessionId, 'user', userInput);
      this.memory.addMessage(sessionId, 'model', finalText);
      
      return { reply: finalText, steps };

    } catch (error: any) {
      console.error('❌ [Agent] Fatal Error:', error.message);
      
      if (error.message?.includes('429') || error.status === 'RESOURCE_EXHAUSTED') {
        return { 
          reply: 'I have reached my Gemini API quota limit (429). Please wait a moment or switch to a different model in your .env file.', 
          steps: [] 
        };
      }

      return { reply: 'Sorry, my brain encountered a critical error: ' + (error.message || 'Unknown error'), steps: [] };
    }
  }

  private generateStepDescription(name: string, args: any): string {
    switch (name) {
      case 'executeJqlSearch': return `🔍 Searching Jira for: ${args.jql}`;
      case 'createIssue': return `📝 Creating ${args.issueType}: ${args.summary}`;
      case 'addComment': return `💬 Adding comment to ${args.ticketId}`;
      case 'updateTicketStatus': return `⚙️ Moving ${args.ticketId} to ${args.desiredStatus}`;
      case 'searchUser': return `👥 Searching for user: ${args.displayName}`;
      default: return `🛠️ Executing ${name}`;
    }
  }

  public async getRecentIssues() {
    return this.jiraServer.getRecentIssues();
  }

  public async getMyActiveIssues() {
    return this.jiraServer.getMyActiveIssues();
  }
}
