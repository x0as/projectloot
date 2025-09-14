require('dotenv').config();
const axios = require('axios');
const express = require('express');
const app = express();

// In-memory store for codes and their types
const codeStore = {};

// === CONFIG ===
const DEV_KEY = process.env.DEV_KEY;
const USER_KEY = process.env.USER_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
// === END CONFIG ===

// Generate a random 16-character alphanumeric code
function generateCode() {
  return Array.from({length: 16}, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();
}

// Generate a random 6-character alphanumeric path
function generatePath() {
  return Array.from({length: 6}, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();
}

// Helper to extract paste key from a Pastebin URL
function extractPasteKey(url) {
  if (!url) return null;
  const match = url.match(/pastebin\.com\/(\w+)/);
  return match ? match[1] : null;
}

// Delete a Pastebin paste by key
async function deletePaste(pasteKey) {
  if (!pasteKey) return;
  try {
    const body = new URLSearchParams({
      api_dev_key: DEV_KEY,
      api_user_key: USER_KEY,
      api_option: "delete",
      api_paste_key: pasteKey
    });
    const r = await axios.post("https://pastebin.com/api/api_post.php", body);
    if (r.data !== 'Paste Removed') {
      console.error("Failed to delete paste:", r.data);
    }
  } catch (err) {
    console.error("Delete paste error:", err.response?.data || err.message);
  }
}

// List all pastes for the user
async function listPastes() {
  try {
    const body = new URLSearchParams({
      api_dev_key: DEV_KEY,
      api_user_key: USER_KEY,
      api_option: "list",
      api_results_limit: "1000"
    });
    const r = await axios.post("https://pastebin.com/api/api_post.php", body);
    if (typeof r.data === 'string' && r.data.startsWith('<')) {
      return r.data;
    }
    return null;
  } catch (err) {
    console.error("Failed to list pastes:", err.response?.data || err.message);
    return null;
  }
}

// Delete all pastes with a given label (title)
async function deleteAllPastesWithLabel(label) {
  const xml = await listPastes();
  if (!xml) return;
  const regex = /<paste>([\s\S]*?)<\/paste>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const pasteBlock = match[1];
    const keyMatch = pasteBlock.match(/<paste_key>(.*?)<\/paste_key>/);
    const titleMatch = pasteBlock.match(/<paste_title>(.*?)<\/paste_title>/);
    if (keyMatch && titleMatch && titleMatch[1] === label) {
      await deletePaste(keyMatch[1]);
    }
  }
}

// Create a new Pastebin paste with the new code, deleting all previous ones with the same label
async function createPaste(newCode, label, prevUrlFile) {
  // Delete all previous pastes with this label
  try {
    await deleteAllPastesWithLabel(label);
  } catch (e) {
    console.error("Error deleting previous pastes:", e.message);
  }
  // Create new paste
  try {
    const body = new URLSearchParams({
      api_dev_key: DEV_KEY,
      api_user_key: USER_KEY,
      api_option: "paste",
      api_paste_code: newCode,
      api_paste_name: label,
      api_paste_private: "1" // unlisted
    });
    const r = await axios.post("https://pastebin.com/api/api_post.php", body);
    if (r.data.startsWith("Bad API request")) {
      console.error("Pastebin error:", r.data);
      return null;
    }
    return r.data; // Should be the new paste URL
  } catch (err) {
    console.error("Failed to create paste:", err.response?.data || err.message);
    return null;
  }
}

// Send message to Discord webhook
async function postDiscord(label, code, url) {
  try {
    await axios.post(WEBHOOK_URL, {
      content: `**[${label}]** New code: \`${code}\`\n${url}`
    });
  } catch (err) {
    console.error("Discord error:", err.message);
  }
}


// Route handler to generate and redirect to a new code URL
async function handleCodeRequest(type, label, req, res) {
  const code = generateCode();
  const path = generatePath();
  codeStore[path] = { code, type, created: Date.now() };
  const fullUrl = `${req.protocol}://${req.get('host')}/${path}`;
  await postDiscord(label, code, fullUrl);
  res.redirect(`/${path}`);
}

app.get('/nitro', (req, res) => {
  handleCodeRequest('nitro', 'High Rewards (Nitro)', req, res);
});

app.get('/deco', (req, res) => {
  handleCodeRequest('deco', 'Deco & Nameplates', req, res);
});

// Show the code at the unique URL
app.get('/:codePath', (req, res) => {
  const entry = codeStore[req.params.codePath.toUpperCase()];
  if (!entry) {
    return res.status(404).send('Code not found or expired.');
  }
  res.send(`<h1>${entry.type === 'nitro' ? 'High Rewards (Nitro)' : 'Deco & Nameplates'}</h1><pre style="font-size:2em;">${entry.code}</pre>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running and listening on port ${PORT}`);
});
