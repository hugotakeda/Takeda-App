const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const HISTORY_FILE = path.join(app.getPath('userData'), 'history.json');
const MAX_HISTORY = 50;
let operationQueue = Promise.resolve();

function finiteNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function safeString(value, fallback = 'N/D', maxLength = 512) {
  return typeof value === 'string' && value.length <= maxLength ? value : fallback;
}

function normalizeEntry(value, createId = false) {
  const timestamp = finiteNumber(value?.timestamp, Date.now(), 0, 8640000000000000);
  return {
    id: createId ? crypto.randomUUID() : safeString(value?.id, crypto.randomUUID(), 128),
    timestamp,
    score: finiteNumber(value?.score?.value ?? value?.score, 0, 0, 100),
    cpu: finiteNumber(value?.cpu, 0, 0, 100),
    ramPct: finiteNumber(value?.ramPct, 0, 0, 100),
    gpuDays: finiteNumber(value?.gpuDays, -1, -1, 100000),
    ping: finiteNumber(value?.ping, -1, -1, 100000),
    heavy: finiteNumber(value?.heavy, 0, 0, 100000),
    defender: safeString(value?.defender),
    plan: safeString(value?.plan),
    ok: finiteNumber(value?.score?.ok ?? value?.ok, 0, 0, 8),
    warnings: finiteNumber(value?.score?.warnings ?? value?.warnings, 0, 0, 8),
    criticals: finiteNumber(value?.score?.criticals ?? value?.criticals, 0, 0, 8),
  };
}

function enqueue(operation) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => {});
  return result;
}

async function readHistory() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY).map((entry) => normalizeEntry(entry)) : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Error reading history:', err);
    return [];
  }
}

async function atomicWrite(history) {
  const temporaryFile = [HISTORY_FILE, process.pid, crypto.randomUUID(), 'tmp'].join('.');
  try {
    await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
    await fs.writeFile(temporaryFile, JSON.stringify(history, null, 2), { encoding: 'utf-8', flag: 'wx' });
    await fs.rename(temporaryFile, HISTORY_FILE);
  } catch (error) {
    await fs.unlink(temporaryFile).catch(() => {});
    throw error;
  }
}

function get() {
  return enqueue(readHistory);
}

function save(analysisData) {
  return enqueue(async () => {
    if (!analysisData || typeof analysisData !== 'object' || Array.isArray(analysisData)) {
      throw new TypeError('Dados de análise inválidos');
    }
    let history = await readHistory();
    
    // Add new entry at the beginning
    history.unshift(normalizeEntry(analysisData, true));
    
    // Keep only the last MAX_HISTORY entries
    history = history.slice(0, MAX_HISTORY);
    
    await atomicWrite(history);
    return history;
  });
}

function clear() {
  return enqueue(async () => {
    await atomicWrite([]);
    return [];
  });
}

module.exports = { get, save, clear };
