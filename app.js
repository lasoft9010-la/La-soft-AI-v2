import { Storage } from './storage.js';
import { localAI, MODEL_OPTIONS } from './llm.js';
import { extractMemoryFacts } from './memory-extract.js';
import { shareResponse } from './share.js';

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
const state = {
  chat: null,          // current chat object {id, title, messages}
  settings: Storage.getSettings(),
  streaming: false,
  editingId: null,
};

// ---------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const el = {
  app: $('#app'),
  sidebar: $('#sidebar'),
  sidebarToggle: $('#sidebarToggle'),
  chatList: $('#chatList'),
  newChatBtn: $('#newChatBtn'),
  settingsBtn: $('#settingsBtn'),
  themeToggle: $('#themeToggle'),

  welcome: $('#welcome'),
  thread: $('#thread'),
  composer: $('#composer'),
  input: $('#messageInput'),
  sendBtn: $('#sendBtn'),
  stopBtn: $('#stopBtn'),

  statusPill: $('#statusPill'),
  loadModelBtn: $('#loadModelBtn'),
  progressWrap: $('#progressWrap'),
  progressBar: $('#progressBar'),
  progressText: $('#progressText'),

  settingsModal: $('#settingsModal'),
  closeSettings: $('#closeSettings'),
  memoryList: $('#memoryList'),
  clearMemoryBtn: $('#clearMemoryBtn'),
  exportBtn: $('#exportBtn'),
  importInput: $('#importInput'),
  modelSelect: $('#modelSelect'),
  clearChatBtn: $('#clearChatBtn'),

  welcomeStart: $('#welcomeStart'),
};

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
function init() {
  applyTheme(state.settings.theme);
  populateModelSelect();
  renderChatList();
  showWelcome();
  bindEvents();
  updateStatusPill();

  if (!localAI.constructor.webgpuSupported()) {
    setStatus('unsupported', 'WebGPU not available in this browser');
  }
}

// ---------------------------------------------------------------
// Theme
// ---------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  el.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const next = state.settings.theme === 'dark' ? 'light' : 'dark';
  state.settings = Storage.saveSettings({ theme: next });
  applyTheme(next);
}

// ---------------------------------------------------------------
// Sidebar / chat history
// ---------------------------------------------------------------
function renderChatList() {
  const chats = Storage.getChats();
  el.chatList.innerHTML = '';
  if (!chats.length) {
    el.chatList.innerHTML = '<div class="chat-list-empty">No conversations yet</div>';
    return;
  }
  for (const c of chats) {
    const item = document.createElement('div');
    item.className = 'chat-item' + (state.chat?.id === c.id ? ' active' : '');
    item.innerHTML = `
      <span class="chat-item-title">${escapeHTML(c.title || 'New chat')}</span>
      <button class="chat-item-delete" title="Delete" aria-label="Delete chat">🗑</button>
    `;
    item.querySelector('.chat-item-title').addEventListener('click', () => loadChat(c.id));
    item.querySelector('.chat-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this conversation?')) {
        Storage.deleteChat(c.id);
        if (state.chat?.id === c.id) showWelcome();
        renderChatList();
      }
    });
    el.chatList.appendChild(item);
  }
}

function loadChat(id) {
  const chat = Storage.getChat(id);
  if (!chat) return;
  state.chat = chat;
  el.welcome.classList.add('hidden');
  el.thread.classList.remove('hidden');
  el.thread.innerHTML = '';
  for (const m of chat.messages) renderMessage(m);
  renderChatList();
  scrollToBottom();
}

function showWelcome() {
  state.chat = null;
  el.thread.classList.add('hidden');
  el.thread.innerHTML = '';
  el.welcome.classList.remove('hidden');
  renderChatList();
  el.input.value = '';
  el.input.focus();
}

// ---------------------------------------------------------------
// Messages / rendering
// ---------------------------------------------------------------
function escapeHTML(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

// Minimal, safe markdown: bold, italics, inline code, line breaks.
function formatContent(text) {
  let s = escapeHTML(text);
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

function renderMessage(msg) {
  const row = document.createElement('div');
  row.className = `msg-row ${msg.role}`;
  row.dataset.id = msg.id;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  if (msg.role === 'assistant') {
    avatar.innerHTML = `<img src="assets/la-logo.png" alt="LA">`;
  } else {
    avatar.textContent = '🧑';
  }

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = formatContent(msg.content);

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copyBtn = actionBtn('📋', 'Copy', () => {
    navigator.clipboard?.writeText(msg.content);
    flashBtn(copyBtn, '✅');
  });
  actions.appendChild(copyBtn);

  if (msg.role === 'assistant') {
    const regenBtn = actionBtn('🔁', 'Regenerate', () => regenerate(msg.id));
    const shareBtn = actionBtn('📤', 'Share', async () => {
      shareBtn.disabled = true;
      await shareResponse(msg.content, 'assets/la-logo.png');
      shareBtn.disabled = false;
    });
    actions.appendChild(regenBtn);
    actions.appendChild(shareBtn);
  } else {
    const editBtn = actionBtn('✏️', 'Edit', () => startEdit(msg.id));
    actions.appendChild(editBtn);
  }

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(actions);
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  el.thread.appendChild(row);
  return row;
}

function actionBtn(icon, label, onClick) {
  const b = document.createElement('button');
  b.className = 'msg-action-btn';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.textContent = icon;
  b.addEventListener('click', onClick);
  return b;
}

function flashBtn(btn, icon) {
  const original = btn.textContent;
  btn.textContent = icon;
  setTimeout(() => (btn.textContent = original), 1200);
}

function scrollToBottom() {
  el.thread.scrollTop = el.thread.scrollHeight;
}

// ---------------------------------------------------------------
// Sending / streaming
// ---------------------------------------------------------------
async function ensureChat() {
  if (!state.chat) {
    state.chat = Storage.createChat();
    el.welcome.classList.add('hidden');
    el.thread.classList.remove('hidden');
    el.thread.innerHTML = '';
    renderChatList();
  }
  return state.chat;
}

async function ensureModelLoaded() {
  if (localAI.status === 'ready') return true;
  if (!localAI.constructor.webgpuSupported()) {
    alert('Your browser does not support WebGPU, so the local AI model cannot run. Please use a recent desktop version of Chrome or Edge.');
    return false;
  }
  await loadModel();
  return localAI.status === 'ready';
}

async function loadModel() {
  setStatus('loading', 'Loading local model…');
  el.progressWrap.classList.remove('hidden');
  try {
    await localAI.init(state.settings.modelId, (progress, text) => {
      const pct = Math.round(progress * 100);
      el.progressBar.style.width = pct + '%';
      el.progressText.textContent = text || `Loading… ${pct}%`;
    });
    el.progressWrap.classList.add('hidden');
    setStatus('ready', 'Offline ready');
  } catch (err) {
    console.error(err);
    el.progressWrap.classList.add('hidden');
    setStatus('error', 'Model failed to load');
    alert('Could not load the local AI model. Check your internet connection for the first-time download, or try a different model in Settings.');
  }
}

function setStatus(kind, text) {
  el.statusPill.className = 'status-pill ' + kind;
  el.statusPill.textContent =
    kind === 'ready' ? '🟢 ' + text :
    kind === 'loading' ? '🔵 ' + text :
    kind === 'unsupported' ? '⚪ ' + text :
    kind === 'error' ? '🔴 ' + text :
    '⚪ ' + text;
}

function updateStatusPill() {
  if (!localAI.constructor.webgpuSupported()) {
    setStatus('unsupported', 'WebGPU not supported');
  } else if (localAI.status === 'ready') {
    setStatus('ready', 'Offline ready');
  } else {
    setStatus('idle', 'Model not loaded — tap to start');
  }
}

async function sendMessage(overrideText, editIdToReplace) {
  const text = (overrideText ?? el.input.value).trim();
  if (!text || state.streaming) return;

  const ok = await ensureModelLoaded();
  if (!ok) return;

  await ensureChat();

  if (editIdToReplace) {
    // Truncate everything from the edited message onward, then resend.
    const idx = state.chat.messages.findIndex((m) => m.id === editIdToReplace);
    if (idx !== -1) state.chat.messages = state.chat.messages.slice(0, idx);
    el.thread.innerHTML = '';
    for (const m of state.chat.messages) renderMessage(m);
  }

  // Store memory facts heuristically, offline.
  for (const fact of extractMemoryFacts(text)) {
    Storage.addMemory(fact.key, fact.value, 'auto');
  }

  const userMsg = { id: Storage.uid(), role: 'user', content: text, ts: Date.now() };
  state.chat.messages.push(userMsg);
  renderMessage(userMsg);
  el.input.value = '';
  autoGrow();
  scrollToBottom();

  if (state.chat.messages.length === 1) {
    state.chat.title = text.slice(0, 48);
  }
  Storage.saveChat(state.chat);
  renderChatList();

  await streamAssistantReply();
}

async function streamAssistantReply() {
  state.streaming = true;
  toggleSendStop(true);

  const assistantMsg = { id: Storage.uid(), role: 'assistant', content: '', ts: Date.now() };
  state.chat.messages.push(assistantMsg);
  const row = renderMessage(assistantMsg);
  const bubble = row.querySelector('.bubble');
  bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  scrollToBottom();

  const history = state.chat.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(0, -1) // exclude the empty assistant placeholder we just added
    .slice(-16)   // recent context window
    .map((m) => ({ role: m.role, content: m.content }));

  const memoryFacts = Storage.getMemory().slice(-12);

  let firstToken = true;
  try {
    const full = await localAI.streamChat(history, memoryFacts, (delta) => {
      if (firstToken) {
        bubble.innerHTML = '';
        firstToken = false;
      }
      assistantMsg.content += delta;
      bubble.innerHTML = formatContent(assistantMsg.content);
      scrollToBottom();
    });
    assistantMsg.content = full || assistantMsg.content || '…';
    bubble.innerHTML = formatContent(assistantMsg.content);
    // Rebuild action buttons now that content is final (regen/share/copy need final text).
    row.remove();
    state.chat.messages[state.chat.messages.length - 1] = assistantMsg;
    renderMessage(assistantMsg);
  } catch (err) {
    console.error(err);
    assistantMsg.content = assistantMsg.content || 'Something went wrong while generating a reply. Please try again.';
    bubble.innerHTML = formatContent(assistantMsg.content);
  } finally {
    state.streaming = false;
    toggleSendStop(false);
    Storage.saveChat(state.chat);
    scrollToBottom();
  }
}

function toggleSendStop(isStreaming) {
  el.sendBtn.classList.toggle('hidden', isStreaming);
  el.stopBtn.classList.toggle('hidden', !isStreaming);
}

function stopGenerating() {
  localAI.stop();
}

function regenerate(assistantMsgId) {
  if (state.streaming || !state.chat) return;
  const idx = state.chat.messages.findIndex((m) => m.id === assistantMsgId);
  if (idx === -1) return;
  // find the preceding user message
  let userIdx = idx - 1;
  while (userIdx >= 0 && state.chat.messages[userIdx].role !== 'user') userIdx--;
  if (userIdx < 0) return;
  const userText = state.chat.messages[userIdx].content;
  // remove everything from that user message onward, then resend
  state.chat.messages = state.chat.messages.slice(0, userIdx);
  el.thread.innerHTML = '';
  for (const m of state.chat.messages) renderMessage(m);
  sendMessage(userText);
}

function startEdit(msgId) {
  const msg = state.chat.messages.find((m) => m.id === msgId);
  if (!msg) return;
  el.input.value = msg.content;
  state.editingId = msgId;
  el.input.focus();
  el.composer.classList.add('editing');
  autoGrow();
}

function cancelEdit() {
  state.editingId = null;
  el.composer.classList.remove('editing');
  el.input.value = '';
}

function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 160) + 'px';
}

// ---------------------------------------------------------------
// Settings modal: memory, backup/restore, model choice, clear chat
// ---------------------------------------------------------------
function openSettings() {
  renderMemoryList();
  el.modelSelect.value = state.settings.modelId;
  el.settingsModal.classList.remove('hidden');
}
function closeSettingsModal() {
  el.settingsModal.classList.add('hidden');
}

function renderMemoryList() {
  const memory = Storage.getMemory();
  el.memoryList.innerHTML = '';
  if (!memory.length) {
    el.memoryList.innerHTML = '<div class="chat-list-empty">Nothing remembered yet</div>';
    return;
  }
  for (const m of memory) {
    const row = document.createElement('div');
    row.className = 'memory-row';
    row.innerHTML = `
      <div><span class="memory-key">${escapeHTML(m.key)}</span>: <span class="memory-value">${escapeHTML(m.value)}</span></div>
      <button class="memory-delete" aria-label="Delete memory">✕</button>
    `;
    row.querySelector('.memory-delete').addEventListener('click', () => {
      Storage.deleteMemory(m.id);
      renderMemoryList();
    });
    el.memoryList.appendChild(row);
  }
}

function populateModelSelect() {
  el.modelSelect.innerHTML = '';
  for (const opt of MODEL_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    el.modelSelect.appendChild(o);
  }
  el.modelSelect.value = state.settings.modelId;
}

function exportData() {
  const data = Storage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `la-soft-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Storage.importAll(data);
      state.settings = Storage.getSettings();
      applyTheme(state.settings.theme);
      renderChatList();
      renderMemoryList();
      alert('Backup restored successfully.');
    } catch (e) {
      alert('That file could not be read as a LA SOFT AI backup.');
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------
function bindEvents() {
  el.newChatBtn.addEventListener('click', showWelcome);

  $$('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      el.input.value = chip.dataset.fill || chip.textContent;
      el.input.focus();
      autoGrow();
    });
  });

  el.sidebarToggle.addEventListener('click', () => el.sidebar.classList.toggle('open'));

  el.themeToggle.addEventListener('click', toggleTheme);

  el.settingsBtn.addEventListener('click', openSettings);
  el.closeSettings.addEventListener('click', closeSettingsModal);
  el.settingsModal.addEventListener('click', (e) => {
    if (e.target === el.settingsModal) closeSettingsModal();
  });

  el.clearMemoryBtn.addEventListener('click', () => {
    if (confirm('Clear all remembered facts? This cannot be undone.')) {
      Storage.clearMemory();
      renderMemoryList();
    }
  });

  el.clearChatBtn.addEventListener('click', () => {
    if (!state.chat) return alert('Open a conversation first.');
    if (confirm('Clear all messages in this conversation?')) {
      state.chat.messages = [];
      Storage.saveChat(state.chat);
      el.thread.innerHTML = '';
      closeSettingsModal();
    }
  });

  el.exportBtn.addEventListener('click', exportData);
  el.importInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = '';
  });

  el.modelSelect.addEventListener('change', async () => {
    const modelId = el.modelSelect.value;
    state.settings = Storage.saveSettings({ modelId });
    localAI.status = 'idle';
    closeSettingsModal();
    setStatus('idle', 'Model changed — tap to load');
  });

  el.statusPill.addEventListener('click', () => {
    if (localAI.status !== 'ready' && localAI.status !== 'loading') loadModel();
  });
  el.loadModelBtn?.addEventListener('click', loadModel);

  el.input.addEventListener('input', autoGrow);
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
    if (e.key === 'Escape' && state.editingId) cancelEdit();
  });
  el.sendBtn.addEventListener('click', submitComposer);
  el.stopBtn.addEventListener('click', stopGenerating);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettingsModal();
  });
}

function submitComposer() {
  if (state.editingId) {
    const id = state.editingId;
    const text = el.input.value.trim();
    cancelEdit();
    if (text) sendMessage(text, id);
  } else {
    sendMessage();
  }
}

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
init();

// Register a lightweight service worker so the app shell itself
// (HTML/CSS/JS/logo) works offline, independent of model caching.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline-first is best-effort; app still works without it */
    });
  });
}
