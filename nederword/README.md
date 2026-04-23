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
