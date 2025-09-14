require('dotenv').config();
const express = require('express');
const fs = require('fs');
const app = express();

// Redirect to latest Nitro code
app.get('/nitro', (req, res) => {
  try {
    const url = fs.readFileSync('current_nitro_url.txt', 'utf8').trim();
    res.redirect(url);
  } catch (e) {
    res.status(404).send('No Nitro URL found');
  }
});

// Redirect to latest Deco code
app.get('/deco', (req, res) => {
  try {
    const url = fs.readFileSync('current_deco_url.txt', 'utf8').trim();
    res.redirect(url);
  } catch (e) {
    res.status(404).send('No Deco URL found');
  }
});

app.listen(3000, () => {
  console.log('Redirect server running on http://localhost:3000');
});
