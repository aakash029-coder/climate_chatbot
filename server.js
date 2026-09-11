require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'not-configured');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'not-configured' });

const SYSTEM_PROMPT = `You are the "Global Climate & Sustainability Coach," a high-performance, data-driven AI assistant dedicated to SDG 12 and 13. Your objective is to guide users toward sustainable consumption, waste reduction, and lower-impact lifestyle choices on a universal, global scale.

Operational Guidelines:

Precision & Action: Deliver clear, actionable, and structured steps. Avoid fluff. Format responses with concise bullet points.

Global Scope: Ensure all advice, metrics, and examples are globally applicable. Do not restrict solutions to a single local region or country.

Accuracy & Reliability: Ground all claims in established climate science. If a user asks a question outside the scope of climate action or sustainability, you must politely decline and state your focus on SDG 12 & 13. Handle uncertainty responsibly; never fabricate data or environmental claims.

Safety & Guardrails: Avoid any harmful, discriminatory, or overconfident advice. Do not provide medical, legal, or financial counseling.

Tone: Maintain a professional, analytical, and highly efficient persona.

FORMATTING RULES (MANDATORY):

1. NEVER use LaTeX, $$, $, or any special math render symbols. Write all formulas, units, and equations in standard plain text (e.g., write "sq meters" instead of $m^2$, "Liters" not $$...$$). Use "°C" for degrees Celsius and write simple equations inline like "Annual Yield (Liters) = Rainfall (mm) x Roof Area (sq m) x Runoff Coefficient".
2. Structure every answer with clear markdown: use "###" for section headings, each item as a bullet starting with "*", and emphasize key terms with "**bold**". Use markdown tables (rows separated by " | " with a header divider line) whenever comparing data, metrics, or options.
3. Always produce the COMPLETE answer. Never truncate, never end with an unfinished heading, sentence, or symbol. Cover every point you start.`;

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'climate_data')
  : path.join(__dirname, 'data');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  console.warn('Could not create data dir:', err.message);
}

function getSafeUserId(rawId) {
  return String(rawId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64) || 'guest';
}

function readJSON(file) {
  try {
    const fp = path.join(DATA_DIR, file);
    if (!fs.existsSync(fp)) return file.endsWith('.json') && !file.startsWith('chat-') ? [] : null;
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch (err) {
    console.warn(`readJSON error for ${file}:`, err.message);
    return file.endsWith('.json') && !file.startsWith('chat-') ? [] : null;
  }
}

function writeJSON(file, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn(`writeJSON error for ${file}:`, err.message);
  }
}

// ===== CHAT HISTORY ENDPOINTS =====

app.get('/api/conversations/:userId', (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const convFile = `chat-${userId}.json`;
  const conversations = readJSON(convFile) || [];
  const summaries = conversations.map(c => ({
    id: c.id,
    title: c.title,
    messageCount: c.messages.length,
    lastMessage: c.messages[c.messages.length - 1]?.content?.substring(0, 60) || '',
    date: c.date,
    updatedAt: c.updatedAt
  }));
  res.json({ conversations: summaries });
});

app.get('/api/conversations/:userId/:convId', (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const convFile = `chat-${userId}.json`;
  const conversations = readJSON(convFile) || [];
  const conv = conversations.find(c => c.id === req.params.convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ conversation: conv });
});

app.post('/api/conversations/:userId', (req, res) => {
  const { title } = req.body;
  const userId = getSafeUserId(req.params.userId);
  const convFile = `chat-${userId}.json`;
  const conversations = readJSON(convFile) || [];
  const newConv = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: title || 'New Conversation',
    messages: [],
    date: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  conversations.unshift(newConv);
  if (conversations.length > 50) conversations.length = 50;
  writeJSON(convFile, conversations);
  res.json({ conversation: newConv });
});

app.post('/api/conversations/:userId/:convId/messages', (req, res) => {
  const { role, content } = req.body;
  const userId = getSafeUserId(req.params.userId);
  const convFile = `chat-${userId}.json`;
  const conversations = readJSON(convFile) || [];
  const conv = conversations.find(c => c.id === req.params.convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  conv.messages.push({ role, content, timestamp: new Date().toISOString() });
  conv.updatedAt = new Date().toISOString();

  if (conv.messages.length === 1 && role === 'user') {
    conv.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }

  writeJSON(convFile, conversations);
  res.json({ success: true });
});

app.delete('/api/conversations/:userId/:convId', (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const convFile = `chat-${userId}.json`;
  let conversations = readJSON(convFile) || [];
  conversations = conversations.filter(c => c.id !== req.params.convId);
  writeJSON(convFile, conversations);
  res.json({ success: true });
});

app.delete('/api/conversations/:userId', (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const convFile = `chat-${userId}.json`;
  writeJSON(convFile, []);
  res.json({ success: true });
});

// ===== CHAT WITH GEMINI =====

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Valid message string is required.' });
  }

  // ===== Attempt 1: Gemini =====
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const activeGenAI = new GoogleGenerativeAI(geminiKey);
      const modelName = 'gemini-3.6-flash';
      const model = activeGenAI.getGenerativeModel({ model: modelName });
      const chatHistory = (history || []).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nNow follow these instructions for the conversation.' }] },
          { role: 'model', parts: [{ text: 'Understood. I am the Global Climate & Sustainability Coach, ready to help with SDG 12 and 13 topics.' }] },
          ...chatHistory
        ],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
      });

      const result = await chat.sendMessage(message);
      return res.json({ response: result.response.text() });
    } catch (geminiError) {
      console.error('Gemini failed (falling back to Groq):', geminiError.message);
    }
  }

  // ===== Attempt 2: Groq (backup) =====
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const activeGroq = new Groq({ apiKey: groqKey });
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(history || []).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: message }
      ];

      const completion = await activeGroq.chat.completions.create({
        model: 'qwen/qwen3.8-27b',
        messages,
        max_tokens: 4096,
        temperature: 0.7
      });

      return res.json({ response: completion.choices[0].message.content });
    } catch (groqError) {
      console.error('Groq fallback failed:', groqError.message);
    }
  }

  return res.status(500).json({
    error: 'AI service unavailable. Please make sure GEMINI_API_KEY or GROQ_API_KEY is configured in your environment.'
  });
});

// ===== QUIZ =====

const QUIZ_BANK = [
  { id:1, category:"Carbon Footprint", question:"What is the single largest source of greenhouse gas emissions globally?", options:["Transportation","Electricity & Heat Production","Agriculture","Manufacturing"], correct:1, explanation:"Electricity and heat production account for ~25% of global GHG emissions, primarily from burning coal, natural gas, and oil." },
  { id:2, category:"Waste Reduction", question:"How much of the world's plastic waste has ever been recycled?", options:["About 50%","About 25%","About 9%","About 40%"], correct:2, explanation:"Only about 9% of all plastic ever produced has been recycled. The rest ends up in landfills, incinerated, or in the environment." },
  { id:3, category:"Sustainable Consumption", question:"Which SDG focuses specifically on Responsible Consumption and Production?", options:["SDG 11","SDG 12","SDG 13","SDG 15"], correct:1, explanation:"SDG 12 — Responsible Consumption and Production — aims to ensure sustainable consumption and production patterns globally." },
  { id:4, category:"Climate Science", question:"What is the current approximate global average temperature rise above pre-industrial levels?", options:["0.5°C","1.1°C","2.0°C","1.8°C"], correct:1, explanation:"As of recent data, the global average temperature has risen approximately 1.1°C above pre-industrial (1850-1900) levels." },
  { id:5, category:"Food & Agriculture", question:"Approximately what percentage of global food production is wasted each year?", options:["10%","20%","33%","50%"], correct:2, explanation:"Roughly one-third (~1.3 billion tonnes) of all food produced globally is lost or wasted annually according to the UN FAO." },
  { id:6, category:"Energy", question:"Which renewable energy source currently generates the most electricity worldwide?", options:["Solar","Wind","Hydropower","Geothermal"], correct:2, explanation:"Hydropower remains the largest source of renewable electricity generation globally, followed by wind and solar." },
  { id:7, category:"Water Conservation", question:"What percentage of the world's freshwater is accessible for human use?", options:["About 10%","About 1%","About 25%","About 5%"], correct:1, explanation:"Only about 1% of the world's freshwater is readily accessible for human use; the rest is locked in ice caps, glaciers, or deep underground." },
  { id:8, category:"Biodiversity", question:"What is the primary driver of species extinction in the modern era?", options:["Climate change","Habitat destruction","Pollution","Overhunting"], correct:1, explanation:"Habitat destruction through deforestation, agriculture, and urbanization is the leading cause of biodiversity loss globally." },
  { id:9, category:"Circular Economy", question:"What does 'cradle-to-cradle' design refer to?", options:["Using recycled materials only","Designing products so all materials can be fully recycled or composted","Building products to last 100 years","Using biodegradable packaging"], correct:1, explanation:"Cradle-to-cradle design ensures that all product materials can be fully recycled or returned to the biosphere, eliminating waste." },
  { id:10, category:"Carbon Footprint", question:"Which has the highest carbon footprint per unit?", options:["1 kg of beef","1 kg of chicken","1 kg of tofu","1 kg of rice"], correct:0, explanation:"Beef production generates ~27 kg CO2e per kg, far exceeding chicken (~6.9 kg), tofu (~2 kg), or rice (~2.7 kg)." },
  { id:11, category:"Waste Reduction", question:"How long does a typical plastic bottle take to decompose in a landfill?", options:["50 years","200 years","450+ years","100 years"], correct:2, explanation:"Plastic bottles can take 450 years or more to decompose in a landfill, and may never fully break down into harmless components." },
  { id:12, category:"Sustainable Consumption", question:"What is 'fast fashion' primarily criticized for?", options:["Being too expensive","Rapid production cycles causing waste and pollution","Using only natural fibers","Being available only in stores"], correct:1, explanation:"Fast fashion is criticized for overproduction, textile waste, water pollution, and exploitative labor practices driven by rapid trend cycles." },
  { id:13, category:"Climate Science", question:"What is the Paris Agreement's primary temperature target?", options:["Limit warming to 1.5°C above pre-industrial levels","Limit warming to 2°C with efforts toward 1.5°C","Stop all emissions by 2030","Limit warming to 3°C"], correct:1, explanation:"The Paris Agreement aims to limit global warming to well below 2°C, with efforts to pursue limiting it to 1.5°C above pre-industrial levels." },
  { id:14, category:"Energy", question:"What percentage of global energy currently comes from renewable sources?", options:["About 5%","About 15%","About 30%","About 50%"], correct:2, explanation:"Approximately 30% of global electricity generation comes from renewable sources, with the share growing rapidly each year." },
  { id:15, category:"Food & Agriculture", question:"Which diet generally has the lowest carbon footprint?", options:["Mediterranean diet","Vegan/plant-based diet","Keto diet","Omnivorous diet"], correct:1, explanation:"Plant-based diets typically produce 50-73% fewer greenhouse gas emissions than high meat-consuming diets." },
  { id:16, category:"Water Conservation", question:"How many litres of water are needed to produce 1 kg of cotton?", options:["500 litres","2,700 litres","10,000 litres","500 litres"], correct:1, explanation:"Producing 1 kg of cotton requires approximately 2,700 litres of water, highlighting the water intensity of textile production." },
  { id:17, category:"Circular Economy", question:"What is 'industrial symbiosis'?", options:["Using robots in factories","Waste from one industry becoming raw material for another","Sharing factories between companies","Using solar panels in industry"], correct:1, explanation:"Industrial symbiosis is when waste or by-products from one industrial process become inputs for another, reducing overall waste." },
  { id:18, category:"Waste Reduction", question:"What is 'e-waste'?", options:["Electronic waste from discarded devices","Waste from e-commerce packaging","Paper waste from offices","Food waste from restaurants"], correct:0, explanation:"E-waste refers to discarded electrical and electronic equipment, one of the fastest-growing waste streams globally." },
  { id:19, category:"Carbon Footprint", question:"What is 'carbon offsetting'?", options:["Eliminating all carbon emissions","Compensating for emissions by funding projects that reduce CO2 elsewhere","Planting trees only","Using electric cars only"], correct:1, explanation:"Carbon offsetting involves investing in projects (reforestation, renewable energy, etc.) that reduce or remove greenhouse gases to compensate for emissions produced elsewhere." },
  { id:20, category:"Sustainable Consumption", question:"What does 'life cycle assessment' (LCA) evaluate?", options:["How long a product lasts","Environmental impact of a product from raw material to disposal","The price of a product over time","Consumer satisfaction with a product"], correct:1, explanation:"LCA evaluates the total environmental impact of a product throughout its entire life cycle — from raw material extraction to manufacturing, use, and end-of-life disposal." }
];

const QUIZ_API_KEY = process.env.QUIZ_API_KEY;

app.get('/api/config', (req, res) => {
  res.json({ quizApiKey: QUIZ_API_KEY });
});

function verifyQuizKey(req, res, next) {
  if (req.headers['x-quiz-api-key'] !== QUIZ_API_KEY) return res.status(401).json({ error: 'Invalid API key.' });
  next();
}

app.get('/api/quiz/questions', verifyQuizKey, (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 10, QUIZ_BANK.length);
  const shuffled = [...QUIZ_BANK].sort(() => Math.random() - 0.5);
  res.json({ questions: shuffled.slice(0, count).map(q => ({ id: q.id, category: q.category, question: q.question, options: q.options, correct: q.correct, correctAnswer: q.options[q.correct], explanation: q.explanation })), total: count });
});

app.get('/api/quiz/check/:questionId/:selected', verifyQuizKey, (req, res) => {
  const q = QUIZ_BANK.find(qb => qb.id === parseInt(req.params.questionId));
  if (!q) return res.status(404).json({ error: 'Question not found' });
  const selected = parseInt(req.params.selected);
  const isCorrect = q.correct === selected;
  res.json({ isCorrect, correct: q.correct, correctAnswer: q.options[q.correct], explanation: q.explanation, yourAnswer: q.options[selected] });
});

app.post('/api/quiz/submit', verifyQuizKey, (req, res) => {
  const { userId: rawUserId, answers, timeTaken } = req.body;
  const userId = getSafeUserId(rawUserId);
  if (!userId || !answers) return res.status(400).json({ error: 'userId and answers required.' });

  let score = 0;
  const results = answers.map(a => {
    const q = QUIZ_BANK.find(qb => qb.id === a.questionId);
    if (!q) return null;
    const isCorrect = q.correct === a.selected;
    if (isCorrect) score++;
    return { questionId: a.questionId, question: q.question, category: q.category, selected: a.selected, correct: q.correct, isCorrect, correctAnswer: q.options[q.correct], explanation: q.explanation };
  }).filter(Boolean);

  const record = {
    id: `quiz_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
    userId, score, total: results.length, percentage: Math.round((score / results.length) * 100),
    timeTaken: timeTaken || 0, results, date: new Date().toISOString()
  };

  const history = readJSON('quiz-history.json') || [];
  history.unshift(record);
  if (history.length > 50) history.length = 50;
  writeJSON('quiz-history.json', history);
  res.json({ record });
});

app.get('/api/quiz/history/:userId', verifyQuizKey, (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const history = (readJSON('quiz-history.json') || []).filter(h => h.userId === userId);
  res.json({ history, total: history.length });
});

app.get('/api/quiz/stats/:userId', verifyQuizKey, (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const history = (readJSON('quiz-history.json') || []).filter(h => h.userId === userId);
  if (!history.length) return res.json({ totalQuizzes: 0, avgScore: 0, bestScore: 0 });
  res.json({
    totalQuizzes: history.length,
    avgScore: Math.round(history.reduce((s, h) => s + h.percentage, 0) / history.length),
    bestScore: Math.max(...history.map(h => h.percentage))
  });
});

app.delete('/api/quiz/history/:userId', verifyQuizKey, (req, res) => {
  const userId = getSafeUserId(req.params.userId);
  const history = (readJSON('quiz-history.json') || []).filter(h => h.userId !== userId);
  writeJSON('quiz-history.json', history);
  res.json({ success: true });
});

// Fallback to index.html for non-API client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Climate & Sustainability Coach running on http://localhost:${PORT}`));
}

module.exports = app;