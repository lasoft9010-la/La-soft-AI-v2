/**
 * LA SOFT AI — llm.js
 * ------------------------------------------------------------
 * This module is the ONLY place that talks to the local AI model.
 * It runs entirely in the browser using WebLLM (https://github.com/mlc-ai/web-llm),
 * which executes a real quantized LLM on-device via WebGPU. No prompt,
 * response, or conversation ever leaves the device — there is no
 * server endpoint in this app at all.
 *
 * First run: the browser downloads the model weights once (a few
 * hundred MB) and caches them (Cache API / IndexedDB, handled
 * internally by WebLLM). Every run after that loads from the local
 * cache — no internet required.
 *
 * MODULAR BY DESIGN: to upgrade or swap the local model later,
 * change MODEL_ID below (and optionally add it to MODEL_OPTIONS).
 * Nothing else in the app needs to change.
 *
 * Honest limitation: small on-device models (1-2B params) are fluent
 * in English but noticeably weaker in Tamil than a large cloud model
 * would be. Qwen2.5-1.5B-Instruct was chosen here as the best
 * available small multilingual option in the WebLLM prebuilt catalog.
 * ------------------------------------------------------------
 */

// Loaded lazily from CDN only when the user actually starts the model —
// keeps the initial page load fast and works fine offline once cached.
let webllmModulePromise = null;
function loadWebLLM() {
  if (!webllmModulePromise) {
    webllmModulePromise = import('https://esm.run/@mlc-ai/web-llm');
  }
  return webllmModulePromise;
}

export const MODEL_OPTIONS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B (recommended — balanced)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (fastest, lighter)' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi-3.5 mini (stronger reasoning, larger)' },
];

const SYSTEM_PROMPT = `You are LA SOFT AI, a friendly, natural-sounding assistant built by La Soft.
Talk like a helpful, sharp friend — never like a robotic FAQ bot.
Rules:
- Mirror the language/style the user writes in: plain English, Tamil script, or Tanglish (Tamil written in English letters mixed with English words). If they mix languages, mix naturally back.
- Keep replies conversational and concise by default. Expand only when the question needs depth.
- Use light, natural emoji occasionally — never in every line.
- When a request is broad or ambiguous (e.g. "I need a business idea"), ask one short clarifying question instead of dumping a generic list.
- Never claim to browse the internet or access anything outside this conversation — you run fully offline, on this device.
- If you don't know something current or specific, say so plainly instead of guessing with false confidence.`;

export class LocalAI {
  constructor() {
    this.engine = null;
    this.modelId = null;
    this.status = 'idle'; // idle | loading | ready | error
    this.generating = false;
  }

  static webgpuSupported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  async init(modelId, onProgress) {
    if (this.engine && this.modelId === modelId && this.status === 'ready') return;
    this.status = 'loading';
    this.modelId = modelId;
    try {
      const webllm = await loadWebLLM();
      this.engine = new webllm.MLCEngine();
      this.engine.setInitProgressCallback((report) => {
        if (onProgress) onProgress(report.progress || 0, report.text || '');
      });
      await this.engine.reload(modelId);
      this.status = 'ready';
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  /**
   * Stream a reply. `history` is an array of {role:'user'|'assistant', content}.
   * `memoryFacts` is an array of {key,value} injected as light context.
   * onToken(deltaText) is called for every streamed chunk.
   * Returns the full assistant text.
   */
  async streamChat(history, memoryFacts, onToken) {
    if (!this.engine || this.status !== 'ready') {
      throw new Error('Model not loaded yet');
    }
    this.generating = true;

    let systemContent = SYSTEM_PROMPT;
    if (memoryFacts && memoryFacts.length) {
      const factLines = memoryFacts.map((f) => `- ${f.key}: ${f.value}`).join('\n');
      systemContent += `\n\nThings you remember about this user (use naturally, don't recite them):\n${factLines}`;
    }

    const messages = [{ role: 'system', content: systemContent }, ...history];

    let full = '';
    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.8,
        top_p: 0.95,
      });
      for await (const chunk of stream) {
        if (!this.generating) break; // stopped by user
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          onToken(delta);
        }
      }
    } finally {
      this.generating = false;
    }
    return full;
  }

  stop() {
    this.generating = false;
    try {
      this.engine?.interruptGenerate?.();
    } catch (e) {
      /* no-op */
    }
  }
}

export const localAI = new LocalAI();
