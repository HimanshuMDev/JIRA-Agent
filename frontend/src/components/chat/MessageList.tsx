import React, { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatMessage } from "../../types/chat";
import { motion, AnimatePresence } from "framer-motion";
import { IssueCard } from "../ui/IssueCard";
import { ReasoningLog } from "../ui/ReasoningLog";
import { useChatStore } from "../../store/useChatStore";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
}

export const MessageList: React.FC<Props> = ({ messages, loading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { reasoningSteps } = useChatStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div className="messages-container" ref={scrollRef}>
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              duration: 0.4, 
              delay: idx === messages.length - 1 ? 0 : idx * 0.05,
              ease: [0.23, 1, 0.32, 1] 
            }}
          >
            <MessageBubble message={msg} />

            {/* Execution logs and redundant ghost cards removed for a cleaner, premium UI. */}
          </motion.div>
        ))}
      </AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="typing-indicator"
        >
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
          <span>JIRA AI is thinking...</span>
        </motion.div>
      )}
    </div>
  );
};
