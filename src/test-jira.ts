import { JiraMcpServer } from './mcp/jira-mcp-server.js';

async function runTest() {
  console.log("🚀 Testing Jira API Connection...");
  const jiraServer = new JiraMcpServer();
  
  // This standard JQL query fetches tickets assigned to the user owning the API Token
  const result = await jiraServer.executeJqlSearch('assignee = currentUser()');
  
  console.log("\n📦 Result from Jira:");
  console.dir(result, { depth: null, colors: true });
}

runTest();
