const fs = require('fs/promises');
const path = require('path');
const { app } = require('electron');

const HISTORY_FILE = path.join(app.getPath('userData'), 'history.json');
const MAX_HISTORY = 50;

async function get() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading history:', err);
    return [];
  }
}

async function save(analysisData) {
  try {
    let history = await get();
    
    // Add new entry at the beginning
    history.unshift({
      id: Date.now().toString(),
      timestamp: analysisData.timestamp || Date.now(),
      score: analysisData.score?.value || 0,
      cpu: analysisData.cpu,
      ramPct: analysisData.ramPct,
      gpuDays: analysisData.gpuDays,
      ping: analysisData.ping,
      heavy: analysisData.heavy,
      defender: analysisData.defender,
      plan: analysisData.plan,
      ok: analysisData.score?.ok || 0,
      warnings: analysisData.score?.warnings || 0,
      criticals: analysisData.score?.criticals || 0
    });
    
    // Keep only the last MAX_HISTORY entries
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    return history;
  } catch (err) {
    console.error('Error saving history:', err);
    return [];
  }
}

module.exports = { get, save };
