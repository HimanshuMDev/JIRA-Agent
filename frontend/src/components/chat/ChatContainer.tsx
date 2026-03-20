import React, { useEffect } from "react";
import { useChatStore } from "../../store/useChatStore";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { Header } from "../ui/Header";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Layers, RotateCcw, ChevronRight } from "lucide-react";

export const ChatContainer: React.FC = () => {
  const { messages, loading, sendMessage, error, activeIssues, fetchActiveIssues } = useChatStore();
  const [isExpanded, setIsExpanded] = React.useState(true);

  useEffect(() => {
    fetchActiveIssues();
  }, [fetchActiveIssues]);

  return (
    <div className="chat-layout-centered">
      <Header />
      
      <section className="active-work-section">
        <div 
          className="section-label" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="status-orb" />
          <Briefcase size={11} />
          <span>Active Tasks</span>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            className="chevron-icon"
          >
            <ChevronRight size={11} />
          </motion.div>
          <div style={{ flex: 1 }} />
          <motion.button 
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); fetchActiveIssues(); }} 
            className="refresh-mini-btn" 
            disabled={loading}
          >
            <RotateCcw size={11} className={loading ? 'spinning' : ''} />
          </motion.button>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              style={{ overflow: 'hidden' }}
            >
              <div className="active-issues-list">
                {activeIssues.length === 0 && !loading ? (
                  <div className="issue-mini-card placeholder">
                    <span>No active tasks found in workspace</span>
                  </div>
                ) : (
                  activeIssues.map((issue, idx) => (
                    <motion.div 
                      key={issue.key}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ y: -5, scale: 1.01 }}
                      onClick={() => sendMessage(`Show details for ${issue.key}`)}
                      className="issue-mini-card"
                    >
                      <div className="card-content">
                        <div className="card-key">
                          <Layers size={10} style={{ marginRight: '4px' }} />
                          {issue.key}
                        </div>
                        <div className="card-summary">{issue.summary}</div>
                        <div className="card-badge">
                          <div className="dot" />
                          <span>{issue.status}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <main className="chat-main">
        <div className="chat-scroller">
          <MessageList messages={messages} loading={loading} />
        </div>

        <div className="input-area">
          <Composer onSend={sendMessage} loading={loading} />
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="error-toast"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
