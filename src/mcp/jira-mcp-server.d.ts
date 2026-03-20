export declare class JiraMcpServer {
    private domain;
    private email;
    private apiToken;
    private currentUserAccountId;
    constructor();
    private getAuthHeaders;
    /**
     * Helper: Converts plain text into the strict Atlassian Document Format (ADF)
     * required by the Jira API v3 for descriptions and comments.
     */
    private stringToADF;
    executeJqlSearch(jql: string): Promise<any>;
    createIssue(projectKey: string, summary: string, description: string, issueType?: string, priority?: string, assigneeId?: string): Promise<{
        success: boolean;
        ticketId: any;
        link: string;
        error?: never;
        details?: never;
    } | {
        error: string;
        details: any;
        success?: never;
        ticketId?: never;
        link?: never;
    }>;
    getMyself(): Promise<string | null>;
    searchUser(displayName: string): Promise<any>;
    addComment(ticketId: string, commentText: string): Promise<{
        success: boolean;
        message: string;
        error?: never;
        details?: never;
    } | {
        error: string;
        details: any;
        success?: never;
        message?: never;
    }>;
    updateTicketStatus(ticketId: string, desiredStatus: string): Promise<{
        error: string;
        availableStatuses: any;
        success?: never;
        message?: never;
        details?: never;
    } | {
        success: boolean;
        message: string;
        error?: never;
        availableStatuses?: never;
        details?: never;
    } | {
        error: string;
        details: any;
        availableStatuses?: never;
        success?: never;
        message?: never;
    }>;
    getRecentIssues(): Promise<any>;
    getMyActiveIssues(): Promise<any>;
}
//# sourceMappingURL=jira-mcp-server.d.ts.map