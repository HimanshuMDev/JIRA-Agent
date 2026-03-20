import React, { useState } from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceRecognition } from "../../hooks/useVoiceRecognition";

interface Props {
  onSend: (message: string) => void;
  loading: boolean;
}

export const Composer: React.FC<Props> = ({ onSend, loading }) => {
  const [text, setText] = useState("");
  
  const { isListening, startListening, stopListening } = useVoiceRecognition((transcript) => {
    setText(transcript);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !loading) {
      onSend(text);
      setText("");
    }
  };

  return (
    <form className="composer-wrapper" onSubmit={handleSubmit}>
      <motion.div 
        className="composer-v3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your Jira command..."
          disabled={loading}
          style={{ fontSize: '0.9rem' }}
        />
        
        <div className="btn-group">
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={isListening ? stopListening : startListening}
            className={`icon-btn ${isListening ? "active-mic" : ""}`}
            title={isListening ? "Stop listening" : "Voice search"}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={loading || !text.trim()}
            className="icon-btn primary-btn"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Send size={18} />
              </motion.div>
            ) : <Send size={18} />}
          </motion.button>
        </div>
      </motion.div>
    </form>
  );
};
