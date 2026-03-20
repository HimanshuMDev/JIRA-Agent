# JIRA-AI Frontend: The Command Center

Welcome to the premium frontend for JIRA-AI. This is where the magic happens visually.

## 🎨 Professional Design System
- **Maximum Curvature**: Every element uses `--radius-xl` (3.2rem) for a sleek, modern look.
- **Real-Time Reasoning**: Integrated `ReasoningLog.tsx` component to visualize AI execution steps.
- **Premium Cards**: `IssueCard.tsx` with status-specific colored triggers and lighting.
- **Animations**: Driven by `framer-motion` for buttery smooth transitions and page-layout entries.

## 📦 Components
- `ChatContainer`: The glassmorphic main card housing the entire application.
- `MessageList`: Intelligent message flow with anchored Jira cards and execution consoles.
- `ActiveTasks`: Interactive scroller for real-time monitoring of assigned work.
- `Composer`: Organic input area with translucent backgrounds and pulsing focus.

## 🔧 Development
```bash
npm install
npm run dev
```
The frontend connects to the backend at `http://localhost:5050/api/`.
