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

      const chat = this.ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: 'You are an explicit Jira Assistant. CRITICAL RULES: 1. Do not invent project keys. 2. If user sends a large text block, generate a clean 3-6 word "summary" and use full text as "description". 3. Extract priority (High, Low, etc) if mentioned. 4. To assign a ticket to a person by name, ALWAYS first call searchUser to get their accountId, then createIssue with that accountId. 5. When asked for a summary of tasks or issues, identify ALL relevant issues and provide a comprehensive overview of each. 6. For summaries and task lists, ALWAYS use Markdown Tables with columns [Key, Summary, Status, Priority]. Avoid large plain text passages.',
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
      return { reply: 'Sorry, my brain encountered a critical error.', steps: [] };
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
