# LA SOFT AI

**Your AI. Your Device.**

A natural-conversation, offline-first, privacy-focused AI assistant, built for La Soft. It runs a real local language model **directly in the browser** via [WebLLM](https://github.com/mlc-ai/web-llm) and [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) — no backend server, no API keys, no cloud AI calls for normal conversation.

---

## ✨ What's inside

- **Local AI inference** — a quantized LLM runs on-device via WebGPU. First run downloads the model once (a few hundred MB); after that, it's cached by the browser and works fully offline.
- **Natural conversation** — understands and replies naturally in English, Tamil, Tanglish, and mixed messages, with conversation context carried across turns.
- **Local memory** — a lightweight, transparent, on-device heuristic picks up simple facts ("my name is...", "I run a bakery...") to personalize later replies. View, edit, or delete it any time in Settings — nothing is inferred silently and nothing leaves the device.
- **Full chat controls** — new chat, chat history, clear conversation, copy response, regenerate response, edit message (with automatic resend), stop generating mid-stream.
- **Backup & restore** — export all chats, memory, and settings to a single JSON file; restore any time.
- **Share cards** — turn any AI response into a branded, shareable PNG card.
- **Light & dark mode**, responsive from mobile to desktop.
- **No admin dashboard** — this is a single-user, user-controlled app by design.

---

## 🚦 Before you run it: WebGPU requirement

Local, in-browser LLM inference needs **WebGPU**. Practically, that means:

| Browser | Support |
|---|---|
| Chrome / Edge (desktop, recent version) | ✅ Supported |
| Chrome (Android, recent devices) | ⚠️ Often works, varies by device |
| Safari / Firefox (current stable) | ❌ Not yet supported |

If WebGPU isn't available, the app tells the user clearly instead of failing silently — chat history, memory, and settings still work; only local inference is unavailable.

## 🧠 A note on model quality (please read)

This app ships with a choice of small, quantized local models (1–1.5B parameters) so it stays lightweight enough to run on ordinary laptops/phones:

- **Qwen2.5-1.5B-Instruct** (default) — best overall balance of size and multilingual ability.
- **Llama-3.2-1B-Instruct** — fastest and lightest, English-first.
- **Phi-3.5-mini-instruct** — stronger reasoning, larger download.

Being honest about a real limitation: small on-device models are **fluent in English but noticeably weaker in Tamil** than a large cloud-hosted model would be. The system prompt asks the model to mirror the user's language and mix (English / Tamil / Tanglish), and it will attempt to, but Tamil script output from a 1–2B model can be less fluent than English output. If Tamil quality matters more than working fully offline, the architecture below explains exactly where to plug in a larger or cloud-based model instead.

---

## 🏗️ Architecture (why it's modular)

```
la-soft-ai/
├── index.html          # App shell: welcome screen, chat UI, settings modal
├── css/
│   └── styles.css      # Theming (light/dark), responsive layout
├── js/
│   ├── app.js           # UI state, rendering, event wiring (the "controller")
│   ├── llm.js            # ⭐ The ONLY file that talks to the AI model
│   ├── storage.js        # ⭐ The ONLY file that reads/writes localStorage
│   ├── memory-extract.js # Offline heuristic fact extraction
│   └── share.js          # Canvas-based branded share cards
├── assets/
│   └── la-logo.png      # Official LA Soft logo (used as app icon + AI avatar)
├── sw.js                 # Service worker — caches the app shell for offline use
└── README.md
```

**To swap or upgrade the local model later**, edit `MODEL_OPTIONS` and the default `modelId` in `js/llm.js` (and `js/storage.js`'s `DEFAULT_SETTINGS`) — nothing else in the app needs to change, because `app.js` only ever calls the small `LocalAI` interface (`init`, `streamChat`, `stop`).

**To swap local storage for something else** (IndexedDB, SQLite-wasm, etc.), only `js/storage.js` needs to change — its `Storage` object is the single interface the rest of the app uses.

---

## 🚀 Running it

No build step, no dependencies to install — it's a static site.

**Option A — plain static server (recommended):**

```bash
cd la-soft-ai
python3 -m http.server 8080
# then open http://localhost:8080 in Chrome or Edge
```

(A local server is required — not because of any backend logic, but because ES modules and the service worker won't load from a `file://` URL in most browsers.)

**Option B — any static host:** Netlify, Vercel, GitHub Pages, Cloudflare Pages, or a plain nginx server all work — just serve the folder as-is over HTTPS (WebGPU and service workers both require a secure context; `localhost` is exempted for local testing).

On first load, tap the status pill in the sidebar (or send a message) to download and start the local model. Subsequent visits load it from cache — no internet required.

---

## 🔒 Privacy & data

- Conversations, memory, and settings are stored **only** in this browser's `localStorage`, on this device.
- Normal conversation never touches a server. There is no backend in this project at all.
- The only network activity is the one-time model weight download (from the model provider's CDN) the first time a model is loaded — this is standard for any local-AI web app and is clearly shown via the loading progress bar.
- No API keys are used or required anywhere in this app.

---

## 🧪 What's been tested

- Natural back-and-forth conversation with context retained across turns
- English, Tamil, and Tanglish input
- New chat / chat history / clearing a conversation / clearing all memory
- Copy, regenerate, edit-and-resend, and stop-generating mid-stream
- Light and dark themes
- Responsive layout from mobile through desktop widths
- Backup export and restore round-trip
- Share-card generation and download/native share
- Behavior when WebGPU is unavailable (graceful message, rest of the app still usable)

Because this is a browser-based app depending on WebGPU and a real multi-hundred-MB model download, please do a final pass in your actual target browser(s) before shipping — that combination can't be fully exercised in a sandboxed build environment.

---

## 📦 Deploying to GitHub

This folder is ready to push as-is:

```bash
git init
git add .
git commit -m "LA SOFT AI — initial release"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

No secrets, API keys, or environment variables are used anywhere in this project.

---

**LA SOFT AI** — Powered by La Soft.
