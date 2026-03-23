import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export class JiraMcpServer {
  private domain: string;
  private email: string;
  private apiToken: string;

  private currentUserAccountId: string | null = null;

  constructor() {
    this.domain = (process.env.JIRA_DOMAIN || '').replace(/\/$/, '');
    this.email = process.env.JIRA_EMAIL || '';
    this.apiToken = process.env.JIRA_API_TOKEN || '';
    
    // Proactively fetch the current user's ID
    this.getMyself().catch(() => {});
  }

  private getAuthHeaders() {
    const token = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return {
      'Authorization': `Basic ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Helper: Converts plain text into the strict Atlassian Document Format (ADF)
   * required by the Jira API v3 for descriptions and comments.
   */
  private stringToADF(text: string) {
    return {
      version: 1,
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: text }] }]
    };
  }

  // -------------------------------------------------------------
  // TOOL 1: SEARCH
  // -------------------------------------------------------------
  async executeJqlSearch(jql: string) {
    try {
      let finalJql = jql;
      // Jira API v3 fails on "unbounded" JQL (e.g. just "order by...").
      // We must ensure there is always a base filter.
      if (!jql || jql.toLowerCase().trim().startsWith('order by')) {
          const filter = 'statusCategory != Done';
          finalJql = jql ? `${filter} ${jql}` : filter;
      }

      console.log(`[Jira MCP] 🔍 Search JQL: ${finalJql}`);
      const endpoint = `${this.domain}/rest/api/3/search/jql`;
      const response = await axios.post(endpoint, {
        jql: finalJql,
        maxResults: 10,
        fields: ['summary', 'status', 'assignee', 'priority', 'issuetype', 'description', 'comment']
      }, {
        headers: this.getAuthHeaders()
      });

      const issues = response.data.issues || [];
      if (issues.length === 0) return [];

      return issues.map((issue: any) => {
        const descriptionADF = issue.fields.description;
        // Simple extraction of text from ADF for the AI to read easily
        let descriptionText = '';
        if (descriptionADF && descriptionADF.content) {
            descriptionText = descriptionADF.content
                .map((p: any) => p.content ? p.content.map((t: any) => t.text).join('') : '')
                .join('\n');
        }

        const comments = issue.fields.comment?.comments || [];
        const lastComments = comments.slice(-3).map((c: any) => ({
            author: c.author?.displayName || 'Unknown',
            body: c.body?.content ? c.body.content.map((p: any) => p.content ? p.content.map((t: any) => t.text).join('') : '').join('\n') : 'Empty'
        }));

        return {
          id: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status?.name || 'Unknown',
          assignee: issue.fields.assignee?.displayName || 'Unassigned',
          priority: issue.fields.priority?.name || 'None',
          type: issue.fields.issuetype?.name || 'Unknown',
          description: descriptionText,
          comments: lastComments
        };
      });
    } catch (e: any) {
      const errorDetail = e.response?.data || e.message;
      console.error(`[Jira MCP] ❌ Search FAILED. Status: ${e.response?.status}. Details:`, JSON.stringify(errorDetail, null, 2));
      return { error: 'Search failed', details: errorDetail };
    }
  }

  // -------------------------------------------------------------
  // TOOL 2: CREATE TICKET
  // -------------------------------------------------------------
  async createIssue(projectKey: string, summary: string, description: string, issueType: string = 'Bug', priority?: string, assigneeId?: string) {
    try {
      console.log(`[Jira MCP] 📝 Creating ${issueType} in Project [${projectKey}]`);
      const endpoint = `${this.domain}/rest/api/3/issue`;
      
      const payload: any = {
        fields: {
           project: { key: projectKey },
           summary: summary,
           description: this.stringToADF(description),
           issuetype: { name: issueType }
        }
      };

      if (priority) {
          payload.fields.priority = { name: priority };
      }

      if (assigneeId) {
          payload.fields.assignee = { accountId: assigneeId };
      }

      const response = await axios.post(endpoint, payload, { headers: this.getAuthHeaders() });
      return { 
        success: true, 
        ticketId: response.data.key, 
        link: `${this.domain}/browse/${response.data.key}` 
      };
    } catch (e: any) {
      console.error("[Jira MCP] Create Failed:", e.response?.data?.errors);
      return { error: 'Failed to create issue', details: e.response?.data?.errors || e.message };
    }
  }

  // -------------------------------------------------------------
  // TOOL 6: GET MYSELF (Internal helper for 'Assign to Me')
  // -------------------------------------------------------------
  async getMyself() {
    if (this.currentUserAccountId) return this.currentUserAccountId;
    try {
      const endpoint = `${this.domain}/rest/api/3/myself`;
      const response = await axios.get(endpoint, { headers: this.getAuthHeaders() });
      this.currentUserAccountId = response.data.accountId;
      console.log(`[Jira MCP] 👤 Identity loaded: ${response.data.displayName} (${this.currentUserAccountId})`);
      return this.currentUserAccountId;
    } catch (e: any) {
      console.error("[Jira MCP] Failed to fetch myself:", e.message);
      return null;
    }
  }

  // -------------------------------------------------------------
  // TOOL 5: SEARCH USER (to get accountId for assignment)
  // -------------------------------------------------------------
  async searchUser(displayName: string) {
    try {
      // Shortcut for "me" or "myself"
      if (displayName.toLowerCase() === 'me' || displayName.toLowerCase() === 'myself') {
        const myId = await this.getMyself();
        if (myId) {
          return [{ accountId: myId, displayName: 'You', email: this.email }];
        }
      }

      console.log(`[Jira MCP] 👤 Looking up user: [${displayName}]`);
      const endpoint = `${this.domain}/rest/api/3/user/search`;
      const response = await axios.get(endpoint, {
        headers: this.getAuthHeaders(),
        params: { query: displayName, maxResults: 3 }
      });
      
      const users = response.data;
      if (!users || users.length === 0) {
        return { error: `No user found matching "${displayName}"` };
      }

      // Return the top results so Gemini can pick the right one
      return users.map((u: any) => ({
        accountId: u.accountId,
        displayName: u.displayName,
        email: u.emailAddress
      }));
    } catch (e: any) {
      console.error("[Jira MCP] User Search Failed:", e.response?.data || e.message);
      return { error: 'Failed to search user', details: e.response?.data || e.message };
    }
  }

  // -------------------------------------------------------------
  // TOOL 3: ADD COMMENT
  // -------------------------------------------------------------
  async addComment(ticketId: string, commentText: string) {
    try {
      console.log(`[Jira MCP] 💬 Adding comment to [${ticketId}]`);
      const endpoint = `${this.domain}/rest/api/3/issue/${ticketId}/comment`;
      
      const payload = {
        body: this.stringToADF(commentText)
      };

      await axios.post(endpoint, payload, { headers: this.getAuthHeaders() });
      return { success: true, message: `Comment successfully added to ${ticketId}` };
    } catch (e: any) {
      console.error("[Jira MCP] Comment Failed:", e.response?.data?.errors);
      return { error: 'Failed to add comment', details: e.response?.data?.errors || e.message };
    }
  }
  // -------------------------------------------------------------
  // TOOL 4: UPDATE STATUS (TRANSITIONS)
  // -------------------------------------------------------------
  async updateTicketStatus(ticketId: string, desiredStatus: string) {
    try {
      console.log(`[Jira MCP] 🔄 Updating status of [${ticketId}] to [${desiredStatus}]`);
      
      // Step 1: Get available transitions for this specific ticket
      const getTransitionsEndpoint = `${this.domain}/rest/api/3/issue/${ticketId}/transitions`;
      const transitionsResponse = await axios.get(getTransitionsEndpoint, { headers: this.getAuthHeaders() });
      
      const transitions = transitionsResponse.data.transitions || [];
      
      // Step 2: Find the matching transition by name (case-insensitive)
      const targetTransition = transitions.find((t: any) => 
        t.name.toLowerCase() === desiredStatus.toLowerCase() || 
        t.to.name.toLowerCase() === desiredStatus.toLowerCase()
      );

      if (!targetTransition) {
        const availableNames = transitions.map((t: any) => t.name).join(', ');
        return { 
          error: `Status '${desiredStatus}' is not available for this ticket.`, 
          availableStatuses: availableNames 
        };
      }

      // Step 3: Execute the transition using the hidden ID
      const postTransitionEndpoint = `${this.domain}/rest/api/3/issue/${ticketId}/transitions`;
      await axios.post(postTransitionEndpoint, {
        transition: { id: targetTransition.id }
      }, { headers: this.getAuthHeaders() });

      return { success: true, message: `Successfully moved ${ticketId} to ${targetTransition.name}` };

    } catch (e: any) {
      console.error("[Jira MCP] Status Update Failed:", e.response?.data?.errors || e.message);
      return { error: 'Failed to update status', details: e.response?.data?.errors || e.message };
    }
  }

  // -------------------------------------------------------------
  // TOOL 7: GET RECENT ISSUES (for suggestions)
  // -------------------------------------------------------------
  async getRecentIssues() {
    try {
      console.log(`[Jira MCP] 🔍 Fetching recent issues for context`);
      const endpoint = `${this.domain}/rest/api/3/search/jql`;
      const response = await axios.post(endpoint, {
        jql: "order by created desc",
        maxResults: 5,
        fields: ['summary', 'project']
      }, {
        headers: this.getAuthHeaders()
      });

      return (response.data.issues || []).map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary,
        project: issue.fields.project.name
      }));
    } catch (e: any) {
      console.error("[Jira MCP] Failed to fetch recent issues:", e.message);
      return [];
    }
  }

  // -------------------------------------------------------------
  // TOOL 8: GET MY ACTIVE ISSUES (for v3 startup view)
  // -------------------------------------------------------------
  async getMyActiveIssues() {
    try {
      const myId = await this.getMyself();
      if (!myId) {
        console.warn("[Jira MCP] ⚠️ No ID found. Returning empty.");
        return [];
      }

      console.log(`[Jira MCP] 🔍 Fetching for AccountID: ${myId}`);
      const endpoint = `${this.domain}/rest/api/3/search/jql`;
      // Try both accountId and currentUser()
      const jql = `assignee = currentUser() AND statusCategory != "done" order by updated desc`;
      console.log(`[Jira MCP] 📝 JQL: ${jql}`);

      const response = await axios.post(endpoint, {
        jql,
        maxResults: 6,
        fields: ['summary', 'status', 'priority', 'issuetype']
      }, {
        headers: this.getAuthHeaders()
      });

      const issues = (response.data.issues || []).map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name || 'Unknown',
        priority: issue.fields.priority?.name || 'Medium',
        type: issue.fields.issuetype?.name || 'Task'
      }));

      console.log(`[Jira MCP] ✅ API returned ${issues.length} issues.`);
      return issues;
    } catch (e: any) {
      console.error("[Jira MCP] ❌ Error:", e.response?.data || e.message);
      return [];
    }
  }
}
