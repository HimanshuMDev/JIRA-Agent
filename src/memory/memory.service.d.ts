/**
 * MemoryService - Conversation Context Window with Redis Persistence
 *
 * This service manages chat histories for multiple sessions.
 * It uses Redis to ensure that conversation context is not lost
 * if the Node.js process restarts.
 *
 * FALLBACK: If Redis is not available, it gracefully falls back
 * to an in-memory Map to prevent the server from crashing.
 */
export interface ChatMessage {
    role: 'user' | 'model';
    parts: [{
        text: string;
    }];
}
export declare class MemoryService {
    private redis;
    private readonly MAX_MESSAGES;
    private memoryFallback;
    constructor();
    /**
     * Get the full chat history for a session.
     */
    getHistory(sessionId: string): Promise<ChatMessage[]>;
    /**
     * Append a new message to a session's history.
     */
    addMessage(sessionId: string, role: 'user' | 'model', text: string): Promise<void>;
    /**
     * Wipe a session clean.
     */
    clearSession(sessionId: string): Promise<void>;
}
//# sourceMappingURL=memory.service.d.ts.map