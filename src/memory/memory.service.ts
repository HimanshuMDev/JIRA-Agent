import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

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
  parts: [{ text: string }];
}

export class MemoryService {
  private redis: Redis | null = null;
  private readonly MAX_MESSAGES = 20;
  // Fallback for when Redis is unavailable
  private memoryFallback: Map<string, ChatMessage[]> = new Map();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true // Don't block startup if redis is down
      });

      this.redis.on('error', (err: any) => {
        console.error('[Memory] 🔴 Redis Error:', err.message);
        if (this.redis) {
          this.redis.disconnect();
          this.redis = null;
        }
      });

      this.redis.on('connect', () => {
        console.log('[Memory] 🟢 Redis Connected successfully.');
      });

      this.redis.connect().catch((err: any) => {
        console.warn('[Memory] ⚠️ Redis connection failed. Falling back to in-memory store.');
        if (this.redis) {
          this.redis.disconnect();
          this.redis = null;
        }
      });

    } catch (e) {
      console.warn('[Memory] ⚠️ Redis initialization failed. Using in-memory store.');
      this.redis = null;
    }
  }

  /**
   * Get the full chat history for a session.
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    if (this.redis) {
      try {
        const data = await this.redis.get(`session:${sessionId}`);
        return data ? JSON.parse(data) : [];
      } catch (e) {
        console.error(`[Memory] ❌ Failed to get Redis history for ${sessionId}:`, e);
      }
    }
    return this.memoryFallback.get(sessionId) || [];
  }

  /**
   * Append a new message to a session's history.
   */
  async addMessage(sessionId: string, role: 'user' | 'model', text: string): Promise<void> {
    const history = await this.getHistory(sessionId);
    history.push({ role, parts: [{ text }] });

    // Trim to enforce max message limit (sliding window)
    if (history.length > this.MAX_MESSAGES) {
      history.splice(0, history.length - this.MAX_MESSAGES);
    }

    if (this.redis) {
      try {
        // Save to Redis with 24-hour expiration
        await this.redis.set(`session:${sessionId}`, JSON.stringify(history), 'EX', 86400);
        return;
      } catch (e) {
        console.error(`[Memory] ❌ Failed to save to Redis for ${sessionId}:`, e);
      }
    }
    
    this.memoryFallback.set(sessionId, history);
  }

  /**
   * Wipe a session clean.
   */
  async clearSession(sessionId: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(`session:${sessionId}`);
      } catch (e) {
        console.error(`[Memory] ❌ Failed to delete Redis session ${sessionId}:`, e);
      }
    }
    this.memoryFallback.delete(sessionId);
    console.log(`[Memory] 🗑️ Session [${sessionId}] has been cleared.`);
  }
}
