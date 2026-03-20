import React from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { ReasoningStep } from "../../types/chat";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  steps: ReasoningStep[];
}

export const ReasoningLog: React.FC<Props> = ({ steps }) => {
  if (steps.length === 0) return null;

  return (
    <div className="reasoning-console-v10">
      <div className="console-header">
        <div className="status-dot pulsing" />
        <span>Execution Logs</span>
      </div>
      <div className="console-steps">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="console-step-item"
          >
            <CheckCircle2 size={10} className="step-check" />
            <span className="step-text">{step.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
