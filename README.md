# 🌍 Global Climate & Sustainability Coach

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-success?style=for-the-badge&logo=vercel)](https://climatechatbot.vercel.app/)
[![SDG 12](https://img.shields.io/badge/UN%20SDG-12%20Responsible%20Consumption-orange?style=flat-square)](https://sdgs.un.org/goals/goal12)
[![SDG 13](https://img.shields.io/badge/UN%20SDG-13%20Climate%20Action-darkgreen?style=flat-square)](https://sdgs.un.org/goals/goal13)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

> **"The planet doesn't need a handful of people doing zero-waste perfectly. It needs millions of people making better choices every day."**

An intelligent, interactive sustainability guide built to turn abstract environmental statistics into clear, empowering, and realistic everyday habits. Grounded in United Nations Sustainable Development Goals **SDG 12 (Responsible Consumption & Production)** and **SDG 13 (Climate Action)**.

🔗 **Try it live right now:** **[https://climatechatbot.vercel.app](https://climatechatbot.vercel.app/)**

---

## ✨ Why We Built This

Climate change can often feel overwhelmingly large, abstract, and paralyzing. Most people *want* to live more sustainably, but they are frequently bombarded with vague slogans ("be greener"), confusing technical jargon, corporate greenwashing, or climate guilt.

We built the **Global Climate & Sustainability Coach** to change that dynamic.

Instead of lecturing or throwing raw greenhouse formulas at you, this AI coach acts as an empathetic, data-driven thinking partner. Whether you are trying to minimize household food waste, decarbonize your daily commute, understand the lifecycle impact of fast fashion, or audit your home energy footprint, the coach provides **structured, quantitative, and step-by-step guidance** tailored to real life.

---

## 🌟 Key Features

### 💬 1. Intelligent, Human-Centered AI Coaching
- **Grounded Persona**: Built with strict operational guidelines focused on positive, practical, and science-backed advice.
- **Failover Dual-LLM Reliability**: Powered primarily by Google Gemini (`gemini-3.6-flash`) with an instant fallback to Groq (`qwen/qwen3.8-27b`). If one provider experiences rate limits or downtime, the user never experiences interruption.
- **Readable & Structured Answers**: Formatted with clear section headings, bulleted action items, comparative data tables (e.g., kg CO2e saved per year), and clean plain-text units without unrendered LaTeX symbols.
- **Multi-Session Memory**: Create new conversation threads, switch between past discussions, and pick up where you left off.

### 🧠 2. Interactive Knowledge Quiz
- **5 & 10 Question Challenges**: Curated question banks covering carbon footprinting, circular economies, water conservation, food systems, and climate science.
- **Immediate Feedback**: Instant visual green/red answer highlighting, detailed educational explanations for every option, and live progress tracking.
- **Comprehensive Scorecards**: Calculates accuracy percentages, completion time, and category breakdowns.

### 📊 3. Habit History & Insights
- Track your quiz scores over time, review question-by-question breakdowns, and monitor your personal sustainability literacy growth.

### ⚡ 4. Zero-Bloat, Lightning-Fast Architecture
- Built without bulky frameworks or complex build pipelines. Pure vanilla JavaScript, CSS variables, and native DOM APIs ensure the app loads in a blink on any desktop or mobile device.
- Fully mobile-responsive design with dark-green ambient theming, glassmorphic headers, and smooth micro-interactions.

---

## 🛠️ Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | Vanilla HTML5, CSS3, ES6 JavaScript | Zero build step, instant load time, maximum browser compatibility |
| **Backend** | Node.js + Express.js | Lightweight, flexible routing, minimal runtime overhead |
| **Primary AI** | Google Gemini (`gemini-3.6-flash`) | Deep reasoning, high context window, data-rich analytical advice |
| **Backup AI** | Groq SDK (`qwen/qwen3.8-27b`) | Sub-second failover engine for guaranteed 99.9% uptime |
| **Deployment** | Vercel Serverless Functions | Global edge distribution, auto-scaling, and zero server maintenance |

---

## 🚀 Quick Start (Local Setup)

Want to run the project on your local machine? Follow these simple steps:

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- Git

### 2. Clone the Repository
```bash
git clone https://github.com/aakash029-coder/climate_chatbot.git
cd climate_chatbot
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Set Up Your Environment Keys
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
QUIZ_API_KEY=any_custom_secret_key
PORT=3000
```

> 🔑 **Where to get free API keys:**
> - **Google Gemini Key:** [Google AI Studio](https://aistudio.google.com/apikey)
> - **Groq Key:** [Groq Cloud Console](https://console.groq.com/keys)

### 5. Launch the App
```bash
npm start
```
Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 🌐 Deploying to Vercel

The repository is pre-configured with `vercel.json` and serverless filesystem fallbacks.

1. Push your repository to GitHub.
2. Go to your [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import the repository.
4. Under **Project Settings → Environment Variables**, add:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `QUIZ_API_KEY`
5. Click **Deploy**. Your app will be live globally in seconds!

---

## 📁 Repository Structure

```text
├── server.js            # Express application, AI failover router, & quiz endpoints
├── vercel.json          # Vercel serverless builder configuration & route rewrites
├── package.json         # Node.js dependencies and script commands
├── .gitignore           # Git ignore rules (protects .env and local runtime data)
├── data/                # Local runtime JSON storage for chats and quiz logs
└── public/              # Zero-build client interface
    ├── index.html       # Landing gateway, conversational UI, & quiz views
    ├── styles.css       # Responsive styling, modern green typography & animations
    ├── script.js        # Client controller (state, view switching, markdown renderer)
    └── climate-bg.jpeg  # Ambient hero graphic asset
```

---

## 🤝 Contributing & Community

Every small positive action compounds into global change. If you have ideas for new quiz questions, better sustainability metrics, or UI improvements:

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/eco-improvement`).
3. Commit your changes (`git commit -m 'Add new food waste quiz module'`).
4. Push to the branch (`git push origin feature/eco-improvement`).
5. Open a Pull Request!

---

## 📜 Scientific Grounding & Disclaimer

- **Science First**: All environmental facts, lifecycle estimates, and carbon calculations are based on established open peer-reviewed climate science (including reports from the UN IPCC, FAO, and OECD).
- **Educational Scope**: This chatbot is designed for educational and habit-building purposes. It does not replace professional environmental auditing, engineering specifications, legal counsel, or financial advice.

---

<div align="center">
  <p>Made with 💚 for our shared planet and future generations.</p>
  <p><strong><a href="https://climatechatbot.vercel.app">Experience the Live Coach →</a></strong></p>
</div>
