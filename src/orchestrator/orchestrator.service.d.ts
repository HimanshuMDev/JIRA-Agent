export declare class OrchestratorService {
    private ai;
    private jiraAgent;
    private memory;
    constructor();
    /**
     * The Central Router for all incoming text messages.
     * @param userMessage The raw user text
     * @param sessionId  A unique ID per user/conversation (e.g. "user-himanshu")
     */
    processMessage(userMessage: string, sessionId: string): Promise<{
        reply: string;
        intent: string;
    }>;
    getWorkspaceSuggestions(): Promise<string[]>;
    getMyActiveIssues(): Promise<any[]>;
}
//# sourceMappingURL=orchestrator.service.d.ts.map