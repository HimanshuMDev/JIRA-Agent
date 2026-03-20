# Jira AI Agent Web App

This repository now includes a production-ready web UI to interact with your Jira agent.

## Run the app

1. Install dependencies:
   - `npm install`
   - `npm install --prefix frontend`
2. Start both backend and frontend:
   - `npm run dev`
3. Open:
   - `http://localhost:5173`

## Security / token

- If `AGENT_SECRET_TOKEN` is set in your backend `.env`, enter the same token in the web UI `Agent Token` field.
- If not set, the backend allows requests without a token in local development.

## Frontend environment

- Optional: create `frontend/.env` from `frontend/.env.example` if your backend is not on `http://localhost:5050`.
