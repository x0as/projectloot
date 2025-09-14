require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const app = express();

// === CONFIG ===
const DEV_KEY = process.env.DEV_KEY;
const USER_KEY = process.env.USER_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
// === END CONFIG ===

// Generate a random 16-character alphanumeric code
function generateCode() {
  return Array.from({length: 16}, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();
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

// Create a new Pastebin paste with the new code, deleting the previous one if present
async function createPaste(newCode, label, prevUrlFile) {
  // Delete previous paste if exists
  try {
    if (fs.existsSync(prevUrlFile)) {
      const prevUrl = fs.readFileSync(prevUrlFile, 'utf8').trim();
      const prevKey = extractPasteKey(prevUrl);
      await deletePaste(prevKey);
    }
  } catch (e) {
    console.error("Error deleting previous paste:", e.message);
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
async function postDiscord(label, code) {
  try {
    await axios.post(WEBHOOK_URL, {
      content: `**[${label}]** New code: \`${code}\``
    });
  } catch (err) {
    console.error("Discord error:", err.message);
  }
}

// Main rotate function
async function rotate() {
  // Nitro
  const nitroCode = generateCode();
  const nitroPasteUrl = await createPaste(nitroCode, "High Rewards (Nitro)", "current_nitro_url.txt");
  if (nitroPasteUrl) {
    fs.writeFileSync("current_nitro_url.txt", nitroPasteUrl);
    await postDiscord("High Rewards (Nitro)", nitroCode + "\n" + nitroPasteUrl);
  }

  // Deco
  const decoCode = generateCode();
  const decoPasteUrl = await createPaste(decoCode, "Deco & Nameplates", "current_deco_url.txt");
  if (decoPasteUrl) {
    fs.writeFileSync("current_deco_url.txt", decoPasteUrl);
    await postDiscord("Deco & Nameplates", decoCode + "\n" + decoPasteUrl);
  }

  console.log("Updated codes at", new Date().toLocaleTimeString());
}

// Run immediately, then every 60s
rotate();
setInterval(rotate, 60 * 1000);

// Express redirect endpoints
app.get('/nitro', (req, res) => {
  try {
    const url = fs.readFileSync('current_nitro_url.txt', 'utf8').trim();
    res.redirect(url);
  } catch (e) {
    res.status(404).send('No Nitro URL found');
  }
});

app.get('/deco', (req, res) => {
  try {
    const url = fs.readFileSync('current_deco_url.txt', 'utf8').trim();
    res.redirect(url);
  } catch (e) {
    res.status(404).send('No Deco URL found');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running and listening on port ${PORT}`);
});
