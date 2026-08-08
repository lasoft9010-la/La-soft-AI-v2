/**
 * LA SOFT AI — storage.js
 * ------------------------------------------------------------
 * All persistence lives in the browser (localStorage). Nothing
 * in this file ever makes a network request. This is the ONLY
 * place the app reads/writes chats, memory, and settings, so a
 * future swap to IndexedDB/SQLite-wasm only touches this file.
 * ------------------------------------------------------------
 */

const KEYS = {
  CHATS: 'lasoft_ai_chats_v1',
  MEMORY: 'lasoft_ai_memory_v1',
  SETTINGS: 'lasoft_ai_settings_v1',
};

const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light'
  modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
};

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('LA SOFT AI storage: failed to read', key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('LA SOFT AI storage: failed to write', key, e);
    return false;
  }
}

export const Storage = {
  uid,

  // ---------------- Settings ----------------
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...readJSON(KEYS.SETTINGS, {}) };
  },
  saveSettings(patch) {
    const merged = { ...this.getSettings(), ...patch };
    writeJSON(KEYS.SETTINGS, merged);
    return merged;
  },

  // ---------------- Chats ----------------
  getChats() {
    return readJSON(KEYS.CHATS, []);
  },
  getChat(id) {
    return this.getChats().find((c) => c.id === id) || null;
  },
  createChat() {
    const chat = {
      id: uid(),
      title: 'New chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    const chats = this.getChats();
    chats.unshift(chat);
    writeJSON(KEYS.CHATS, chats);
    return chat;
  },
  saveChat(chat) {
    const chats = this.getChats();
    const idx = chats.findIndex((c) => c.id === chat.id);
    chat.updatedAt = Date.now();
    if (idx === -1) chats.unshift(chat);
    else chats[idx] = chat;
    writeJSON(KEYS.CHATS, chats);
    return chat;
  },
  deleteChat(id) {
    const chats = this.getChats().filter((c) => c.id !== id);
    writeJSON(KEYS.CHATS, chats);
  },
  clearAllChats() {
    writeJSON(KEYS.CHATS, []);
  },
  renameChat(id, title) {
    const chats = this.getChats();
    const c = chats.find((c) => c.id === id);
    if (c) {
      c.title = title;
      writeJSON(KEYS.CHATS, chats);
    }
  },

  // ---------------- Memory ----------------
  // Memory = small, durable facts the user has shared ("my name is Kavi",
  // "I run a bakery"). Stored as {id, key, value, source, createdAt}.
  getMemory() {
    return readJSON(KEYS.MEMORY, []);
  },
  addMemory(key, value, source = 'auto') {
    const memory = this.getMemory();
    // Avoid duplicate keys — update instead of piling up.
    const existing = memory.find((m) => m.key.toLowerCase() === key.toLowerCase());
    if (existing) {
      existing.value = value;
      existing.updatedAt = Date.now();
    } else {
      memory.push({ id: uid(), key, value, source, createdAt: Date.now(), updatedAt: Date.now() });
    }
    writeJSON(KEYS.MEMORY, memory);
    return memory;
  },
  deleteMemory(id) {
    const memory = this.getMemory().filter((m) => m.id !== id);
    writeJSON(KEYS.MEMORY, memory);
    return memory;
  },
  clearMemory() {
    writeJSON(KEYS.MEMORY, []);
  },

  // ---------------- Backup / Restore ----------------
  exportAll() {
    return {
      app: 'LA SOFT AI',
      exportedAt: new Date().toISOString(),
      version: 1,
      chats: this.getChats(),
      memory: this.getMemory(),
      settings: this.getSettings(),
    };
  },
  importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
    if (Array.isArray(data.chats)) writeJSON(KEYS.CHATS, data.chats);
    if (Array.isArray(data.memory)) writeJSON(KEYS.MEMORY, data.memory);
    if (data.settings) writeJSON(KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...data.settings });
    return true;
  },
};
