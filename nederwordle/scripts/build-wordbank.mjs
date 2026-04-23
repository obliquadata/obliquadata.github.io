#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const OPEN_TAAL_URL =
  "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/elements/basiswoorden-gekeurd.txt";
const OPEN_TAAL_FALLBACK_URL =
  "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/elements/wordlist-ascii.txt";

const root = process.cwd();
const dataDir = path.join(root, "data");
const candidateOut = path.join(dataDir, "candidate-words.json");
const gameOut = path.join(dataDir, "words.json");

const MIN_LEN = 4;
const MAX_LEN = 10;
const PLAYABLE_TARGET = 1200;

// These are not perfect frequency rules.
// They aim to keep the list cleaner for a beginner-friendly vocabulary game.
const BLOCKLIST = new Set([
  "aangaande", "aartsbisschop", "aanminnig", "abdicatie", "achterwege",
  "achterwaarts", "achterwerk", "adellijk", "afbetalingsregeling",
  "agglomeratie", "alomtegenwoordig", "ambivalent", "amper", "anachronisme",
  "arbeidsongeschiktheid", "baroness", "bedrijfswagen", "behoorlijkerwijs",
  "bezwaarschrift", "buitenissig", "civielrechtelijk", "conjunctuur",
  "deugdelijkheid", "dientengevolge", "doorzichtigheid", "eerdaags",
  "evidenterwijs", "functionaris", "geneeskundig", "geprivilegieerd",
  "handelsverkeer", "hernieuwbaarheidsdoelstelling", "hoedanigheid",
  "indertijd", "ingevolge", "kostwinner", "luchtvaartmaatschappij",
  "niettegenstaande", "onverminderd", "opsporingsambtenaar", "overeenkomstig",
  "plaatsvervangend", "provinciaal", "rechtsbijstand", "respectievelijk",
  "samenstellingsvorm", "stelselmatig", "tewerkstelling", "uitdrukkelijk",
  "verkeersveiligheid", "volksvertegenwoordiger", "wederrechtelijk", "zienswijze"
]);

const PREFERRED_SUFFIXES = [
  "en", "er", "je", "jes", "ing", "ig", "lijk", "baar", "heid"
];

const manualSeed = [
  "huis", "water", "boek", "fiets", "school", "vriend", "familie", "werken",
  "eten", "drinken", "lopen", "straat", "winkel", "markt", "brood", "kaas",
  "appel", "kamer", "tafel", "stoel", "raam", "deur", "licht", "donker",
  "groot", "klein", "nieuw", "oud", "mooi", "snel", "langzaam", "vroeg",
  "avond", "morgen", "vandaag", "tijd", "uur", "week", "jaar", "zomer",
  "winter", "regen", "zon", "wind", "vraag", "antwoord", "taal", "woord",
  "zin", "denken", "leren", "praten", "schrijven", "lezen", "kijken",
  "horen", "maken", "geven", "nemen", "komen", "gaan", "blijven", "begin",
  "einde", "mensen", "kind", "vrouw", "man", "stad", "dorp", "land",
  "zee", "lucht", "tuin", "bloem", "boom", "gezellig", "moeilijk",
  "makkelijk", "belangrijk", "begrijpen", "proberen", "luisteren",
  "gesprek", "oefenen"
];

function normalizeWord(word) {
  return word.trim().toLowerCase().normalize("NFC");
}

function looksPlayable(word) {
  if (!word) return false;
  if (word.length < MIN_LEN || word.length > MAX_LEN) return false;
  if (!/^[a-zà-ÿ]+$/u.test(word)) return false;
  if (/[0-9'’\-]/.test(word)) return false;
  if (word !== word.toLowerCase()) return false;
  if (BLOCKLIST.has(word)) return false;

  // Avoid many likely proper names or forms with unusual characters for beginners.
  if (/[áàâãäåæçèéêëìíîïñòóôõöùúûüýÿ]/u.test(word)) return false;

  // Avoid lots of obvious inflected verb plurals and past forms that clutter beginner sets.
  if (word.endsWith("den") || word.endsWith("ten")) return false;
  if (word.endsWith("heiden")) return false;
  if (word.endsWith("lijks")) return false;
  if (word.endsWith("matig") && word.length > 7) return false;

  // Avoid very long compounds with 3+ chunks heuristically.
  const vowelGroups = (word.match(/[aeiouy]+/g) || []).length;
  if (word.length >= 9 && vowelGroups >= 4 && !PREFERRED_SUFFIXES.some(s => word.endsWith(s))) {
    return false;
  }

  return true;
}

function scoreWord(word) {
  let score = 0;

  // Favor everyday lengths.
  if (word.length >= 4 && word.length <= 7) score += 5;
  if (word.length === 8) score += 3;
  if (word.length >= 9) score += 1;

  // Favor simple orthography for learners.
  if (!/[qx]/.test(word)) score += 2;
  if (!/[aeiou]{3,}/.test(word)) score += 1;
  if (!/(schr|ngst|rnst|pst|tst|chts|ngen)$/i.test(word)) score += 1;

  // Favor words that resemble common standalone base words.
  if (PREFERRED_SUFFIXES.some(s => word.endsWith(s)) && word.length <= 8) score += 1;

  // Penalize likely obscure compounds a bit.
  if (word.length >= 9) score -= 1;
  if ((word.match(/[aeiouy]+/g) || []).length >= 4) score -= 1;

  return score;
}

function clueFor(word) {
  return {
    word,
    definition_nl: "Nederlandse omschrijving volgt later. Raad het woord op basis van de letters.",
    definition_en: "translation to be added",
    example_nl: "Voorbeeldzin volgt later met BLANK als vervanging."
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchOpenTaalList() {
  let text;
  try {
    text = await fetchText(OPEN_TAAL_URL);
  } catch (primaryError) {
    console.warn(`Primary source failed, trying fallback: ${primaryError.message}`);
    text = await fetchText(OPEN_TAAL_FALLBACK_URL);
  }

  return text
    .split(/\r?\n/)
    .map(normalizeWord)
    .filter(Boolean);
}

async function main() {
  await fs.mkdir(dataDir, { recursive: true });

  const rawWords = await fetchOpenTaalList();

  const deduped = [...new Set(rawWords)];
  const filtered = deduped.filter(looksPlayable);

  filtered.sort((a, b) => {
    const diff = scoreWord(b) - scoreWord(a);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "nl");
  });

  const seedSet = new Set(manualSeed.filter(looksPlayable));
  const mergedPlayable = [
    ...manualSeed.filter(w => seedSet.has(w)),
    ...filtered.filter(w => !seedSet.has(w))
  ];

  const playable = mergedPlayable.slice(0, PLAYABLE_TARGET).map(clueFor);

  await fs.writeFile(candidateOut, JSON.stringify(filtered, null, 2), "utf8");
  await fs.writeFile(gameOut, JSON.stringify(playable, null, 2), "utf8");

  console.log(`Fetched raw words: ${rawWords.length}`);
  console.log(`Filtered candidate words: ${filtered.length}`);
  console.log(`Playable words written: ${playable.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
