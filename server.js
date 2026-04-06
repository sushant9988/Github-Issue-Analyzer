const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function fetchIssue(url) {
  const parts = url.trim().split('/');
  const owner = parts[3];
  const repo  = parts[4];
  const num   = parts[6];

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${num}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'issue-analyzer'
      }
    }
  );
  return await res.json();
}

app.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL daalo' });
    }

    const issue = await fetchIssue(url);

    if (issue.message) {
      return res.status(400).json({ error: issue.message });
    }

    const prompt = `
Analyze this GitHub issue and return ONLY JSON no extra text:

Title: ${issue.title}
Body: ${issue.body}

{
  "type": "Bug / Feature / Question",
  "priority": "Critical / High / Medium / Low",
  "root_cause": "why this happened",
  "solution": "how to fix it",
  "reply": "reply to post on github",
  "mood": "Frustrated / Calm / Confused",
  "fix_time": "1 hour / 1 day / 1 week"
}`;

    const ai = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let clean = ai.choices[0].message.content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const analysis = JSON.parse(clean);

    res.json({
      title:    issue.title,
      author:   issue.user.login,
      state:    issue.state,
      issueUrl: issue.html_url,
      analysis
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log('✅ Server chal raha hai: https://github-issue-analyzer-6obx.onrender.com');
});
