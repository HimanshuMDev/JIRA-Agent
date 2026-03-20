import React from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Sparkles } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="branding">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="nebula-orb"
        >
          <Sparkles size={16} />
        </motion.div>
        <div className="title-area">
          <h1>JIRA-AI</h1>
        </div>
      </div>
    </header>
  );
};
