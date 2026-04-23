# NederWord

A static Dutch vocabulary game inspired by Wordle.

## Features
- Daily word mode
- Unlimited play mode
- Variable word length
- Dutch definition shown before guessing
- English translation revealed after the round
- Easy-to-edit word bank in `data/words.json`
- GitHub Pages friendly

## Files
- `index.html`
- `styles.css`
- `scripts/app.js`
- `data/words.json`

## To customize
Add more entries to `data/words.json` in this format:

```json
{
  "word": "voorbeeld",
  "definition_nl": "Een uitleg of betekenis in het Nederlands.",
  "definition_en": "example",
  "example_nl": "Dit is een voorbeeldzin."
}
```

## Deployment
Upload the folder to GitHub Pages, Netlify, or any static host.


## Automated word list updates

This project now includes a GitHub Actions workflow that can refresh a broader Dutch candidate list
from OpenTaal and filter it down for this game.

### Files
- `.github/workflows/update-wordbank.yml`
- `scripts/build-wordbank.mjs`

### What the workflow does
- runs on a weekly schedule and on manual dispatch
- downloads the Dutch word list from OpenTaal
- filters out likely obscure or unsuitable entries:
  - too short / too long
  - capitals / names
  - hyphenated forms
  - apostrophes
  - digits
  - uncommon diacritics
  - many inflected/plural-like endings
- keeps only lowercase Dutch-looking words
- creates:
  - `data/candidate-words.json` (large filtered list)
  - `data/words.json` (smaller playable list with placeholder clues)

### Important note
The workflow is designed to expand the playable bank without flooding it with very obscure entries,
but it cannot perfectly measure word frequency on its own. For the best learning quality, you may
still want to manually review `data/words.json` from time to time.

### To improve it later
You can later add:
- CEFR tiers
- frequency lists from subtitles or corpora
- Wiktionary-based clue enrichment
- manual allow/block lists
