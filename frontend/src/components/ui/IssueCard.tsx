import React from "react";
import { ExternalLink, Layers, Zap, CircleDashed } from "lucide-react";
import { IssueCard as IssueCardType } from "../../types/chat";
import { motion } from "framer-motion";

interface Props {
  issue: IssueCardType;
}

export const IssueCard: React.FC<Props> = ({ issue }) => {
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.98, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.01 }}
      className={`premium-issue-card status-${issue.status.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="card-top">
        <div className="issue-type-badge">
          <Layers size={11} />
          <span>{issue.type || "TASK"}</span>
        </div>
        <div className="issue-key-pill">{issue.key}</div>
        <a 
          href={`https://jira.atlassian.com/browse/${issue.key}`} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <ExternalLink size={13} className="external-link-icon" />
        </a>
      </div>

      <h3 className="card-summary">{issue.summary}</h3>

      <div className="card-footer">
        <div className="meta-pill">
          <CircleDashed size={10} />
          <span>{issue.status}</span>
        </div>
        <div className="meta-pill">
          <Zap size={10} />
          <span>{issue.priority}</span>
        </div>
      </div>
    </motion.article>
  );
};
