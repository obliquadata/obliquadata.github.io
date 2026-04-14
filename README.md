# \# 🌍 World Leaderle

# 

# A daily geography game where you guess the country of world leaders.

# 

# Play here: https://obliquadata.github.io/

# 

# \---

# 

# \## 🎯 How it works

# 

# Each day, a mystery world leader is selected.

# 

# Your goal:

# \- Guess the \*\*country\*\* they lead

# \- You have \*\*6 attempts\*\*

# 

# After each guess, you receive hints:

# \- 🌍 \*\*Continent\*\* – whether you're on the right continent

# \- 📉 \*\*Corruption\*\* – whether your guess is more or less corrupt

# \- 📏 \*\*Distance\*\* – how geographically close you are

# \- 🏛️ \*\*Role\*\* – head of state, head of government, or both

# 

# \---

# 

# \## 🎮 Features

# 

# \- Daily puzzle

# \- Random mode with non-repeating queue

# \- Progress tracking per leader pool

# \- Light / Dark / System themes

# \- Shareable results

# \- Smart country alias system

# \- Responsive design

# 

# \---

# 

# \## 🔒 Privacy

# 

# \- No login required  

# \- No personal data collected  

# \- Game progress stored locally in your browser  

# \- Optional anonymous analytics (with user consent)  

# 

# See `privacy.html` for details.

# 

# \---

# 

# \## ⚙️ Tech Stack

# 

# \- Static site (HTML, CSS, JavaScript)

# \- Hosted on GitHub Pages

# \- Data sourced from:

# &#x20; - Wikidata

# &#x20; - Wikipedia

# &#x20; - World Bank (corruption index)

# 

# \---

# 

# \## 🔄 Data Pipeline

# 

# Leaders and daily puzzles are generated using Node.js scripts:

# 

# \- `update-leaders.mjs` → fetches and builds leader dataset :contentReference\[oaicite:0]{index=0}  

# \- `generate-daily-schedule.mjs` → creates daily puzzle schedule :contentReference\[oaicite:1]{index=1}  

# 

# Automated via GitHub Actions:

# \- `update\_leaders.yml` :contentReference\[oaicite:2]{index=2}  

# \- `generate\_daily\_schedule.yml` :contentReference\[oaicite:3]{index=3}  

# 

# \---

# 

# \## 🚀 Running locally

# 

# Clone the repo and open `index.html` in your browser:

# 

# ```bash

# git clone https://github.com/obliquadata/obliquadata.github.io.git

# cd obliquadata.github.io

