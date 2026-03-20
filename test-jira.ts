import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const domain = process.env.JIRA_DOMAIN;
const email = process.env.JIRA_EMAIL;
const token = process.env.JIRA_API_TOKEN;

const auth = Buffer.from(`${email}:${token}`).toString('base64');
const headers = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

async function test() {
  try {
    console.log("--- JIRA DIAGNOSTIC ---");
    console.log(`Domain: ${domain}`);
    console.log(`Email: ${email}`);

    // 1. Get Myself
    const myself = await axios.get(`${domain}/rest/api/3/myself`, { headers });
    console.log(`Identity: ${myself.data.displayName} (${myself.data.accountId})`);

    // 2. Test JQL
    const jql = `assignee = currentUser()`;
    console.log(`Testing JQL: ${jql}`);
    const search = await axios.post(`${domain}/rest/api/3/search/jql`, {
      jql,
      maxResults: 5,
      fields: ['summary', 'status']
    }, { headers });

    console.log(`Results Found: ${search.data.total}`);
    search.data.issues.forEach((issue: any) => {
      console.log(`- ${issue.key}: ${issue.fields.summary} [${issue.fields.status.name}]`);
    });

  } catch (e: any) {
    console.error("DIAGNOSTIC FAILED:", e.response?.data || e.message);
  }
}

test();
