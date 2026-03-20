import { MemoryService } from '../memory/memory.service.js';
export declare class JiraGeminiAgent {
    private ai;
    private jiraServer;
    private memory;
    constructor(memoryService: MemoryService);
    private getJiraTools;
    handleRequest(userInput: string, sessionId: string): Promise<string>;
    getRecentIssues(): Promise<any>;
    getMyActiveIssues(): Promise<any>;
}
//# sourceMappingURL=jira.agent.d.ts.map