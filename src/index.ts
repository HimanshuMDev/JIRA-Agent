import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { OrchestratorService } from './orchestrator/orchestrator.service.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Global logger
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`📡 [Incoming] ${req.method} ${req.url}`);
    next();
});

// Initialize our Central AI Router
const orchestrator = new OrchestratorService();

// =============================================================
// 🔐 SECURITY MIDDLEWARE: API Key Authentication
// All requests must include the header: x-agent-token: <value>
// Set AGENT_SECRET_TOKEN in your .env file to enable this.
// =============================================================
const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const secretToken = process.env.AGENT_SECRET_TOKEN;
    
    // If no token configured in .env, skip auth (dev mode)
    if (!secretToken) {
        next();
        return;
    }

    const providedToken = req.headers['x-agent-token'];
    if (!providedToken || providedToken !== secretToken) {
        console.warn(`🚨 [Security] Unauthorized request blocked. IP: ${req.ip}`);
        res.status(401).json({ error: 'Unauthorized. Invalid or missing x-agent-token header.' });
        return;
    }

    next();
};

// Apply security middleware to only the chat route
app.post('/api/chat', authMiddleware, async (req: Request, res: Response) => {
    const userMessage = req.body.message;
    
    // sessionId can be passed from the frontend, or defaults to "default"
    // In a real app, this would be a user's login ID (e.g. "user-123")
    const sessionId = req.body.sessionId || 'default';

    if (!userMessage) {
        console.warn("⚠️ Received request without a message.");
        res.status(400).json({ error: "Missing 'message' string in JSON body." });
        return;
    }

    try {
        console.log(`\n📨 [Server] New request | Session: [${sessionId}] | Message: "${userMessage}"`);
        const result = await orchestrator.processMessage(userMessage, sessionId);
        
        res.json({ reply: result.reply, sessionId: sessionId, intent: result.intent, steps: result.steps });
    } catch (error: any) {
        console.error("🔥 Server Error:", error);
        res.status(500).json({ error: "Internal Server System Error" });
    }
});

app.get('/api/suggestions', async (_req: Request, res: Response) => {
    try {
        const suggestions = await orchestrator.getWorkspaceSuggestions();
        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch suggestions" });
    }
});

app.get('/api/my-active-issues', authMiddleware, async (_req: Request, res: Response) => {
    try {
        const issues = await orchestrator.getMyActiveIssues();
        console.log(`📨 [Server] Returning ${issues.length} issues`);
        res.json({ issues });
    } catch (error) {
        console.error("📨 [Server] Error in /api/my-active-issues:", error);
        res.status(500).json({ error: "Failed to fetch active issues" });
    }
});

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'jira-ai-agent' });
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 AI Agent Server is officially running!`);
    console.log(`   Local URL: http://localhost:${PORT}`);
    console.log(`======================================================`);
    console.log(`📨 POST http://localhost:${PORT}/api/chat`);
    console.log(`   Body: { "message": "...", "sessionId": "user-123" }`);
    if (process.env.AGENT_SECRET_TOKEN) {
        console.log(`🔐 Security: ENABLED — Add header: x-agent-token: <your-token>`);
    } else {
        console.log(`⚠️  Security: DISABLED — Set AGENT_SECRET_TOKEN in .env to enable`);
    }
});
