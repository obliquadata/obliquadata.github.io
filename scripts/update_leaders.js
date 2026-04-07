#!/usr/bin/env node

/**
 * Leaderle database generator
 *
 * Usage:
 *   node scripts/update-leaders.mjs
 *
 * Output:
 *   data/leaders.json
 *
 * Notes:
 * - Designed for Node 20+ (global fetch available)
 * - Queries current national heads of state and heads of government from Wikidata
 * - Enriches entries with Wikipedia summaries/thumbnails
 * - Adds World Bank Control of Corruption scores where available
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "data");
const outputPath = path.join(outputDir, "leaders.json");

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const WORLD_BANK_CORRUPTION_URL = "https://api.worldbank.org/v2/country/all/indicator/CC.EST?format=json&per_page=400&mrv=1";
const WIKIPEDIA_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/";

const USER_AGENT = "LeaderleDatabaseGenerator/1.0 (https://github.com/your-user/your-repo)";
const SUMMARY_CONCURRENCY = 6;
const SUMMARY_DELAY_MS = 60;

function buildLeaderQuery() {
  return `
    SELECT DISTINCT ?country ?countryLabel ?leader ?leaderLabel ?article ?officeLabel ?continentLabel ?iso2 ?image ?coord ?start WHERE {
      {
        ?country p:P35 ?stmt .
        ?stmt ps:P35 ?leader .
        FILTER NOT EXISTS { ?stmt wikibase:rank wikibase:DeprecatedRank }
        OPTIONAL { ?stmt pq:P580 ?start . }
        BIND("Head of state" AS ?officeLabel)
      }
      UNION
      {
        ?country p:P6 ?stmt .
        ?stmt ps:P6 ?leader .
        FILTER NOT EXISTS { ?stmt wikibase:rank wikibase:DeprecatedRank }
        OPTIONAL { ?stmt pq:P580 ?start . }
        BIND("Head of government" AS ?officeLabel)
      }
      ?country wdt:P31/wdt:P279* wd:Q3624078 .
      OPTIONAL { ?country wdt:P30 ?continent . }
      OPTIONAL { ?country wdt:P297 ?iso2 . }
      OPTIONAL { ?country wdt:P625 ?coord . }
      OPTIONAL { ?leader wdt:P18 ?image . }
      ?article schema:about ?leader ;
               schema:isPartOf <https://en.wikipedia.org/> .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `.trim();
}

function inferContinent(continentLabel) {
  if (!continentLabel) return null;
  const c = String(continentLabel).toLowerCase();
  if (c.includes("africa")) return "Africa";
  if (c.includes("europe")) return "Europe";
  if (c.includes("asia")) return "Asia";
  if (c.includes("north america")) return "North America";
  if (c.includes("south america")) return "South America";
  if (c.includes("oceania") || c.includes("australia")) return "Oceania";
  if (c.includes("antarctica")) return "Antarctica";
  return continentLabel;
}

function parsePointWkt(wkt) {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(wkt || "");
  if (!match) return null;
  return { lon: Number(match[1]), lat: Number(match[2]) };
}

function commonsImageToUrl(imageValue) {
  if (!imageValue) return "";
  const fileName = decodeURIComponent(String(imageValue).split("/").pop() || "");
  return fileName
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=900`
    : String(imageValue);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

async function fetchLeaderPool() {
  const query = buildLeaderQuery();
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const json = await fetchJson(url, {
    headers: {
      accept: "application/sparql-results+json"
    }
  });

  const rows = json?.results?.bindings || [];
  const dedupe = new Set();
  const leaders = [];

  for (const row of rows) {
    const articleUrl = row.article?.value || "";
    const articleTitle = decodeURIComponent(articleUrl.split("/wiki/")[1] || "");
    const entry = {
      id: `${row.leader?.value || ""}|${row.country?.value || ""}|${row.officeLabel?.value || ""}`,
      leader: row.leaderLabel?.value || "Unknown leader",
      startDate: row.start?.value ? row.start.value.slice(0, 10) : null,
      country: row.countryLabel?.value || "Unknown country",
      continent: inferContinent(row.continentLabel?.value || ""),
      iso2: (row.iso2?.value || "").toUpperCase(),
      role: row.officeLabel?.value || "Leader",
      articleTitle,
      image: commonsImageToUrl(row.image?.value || ""),
      corruptionScore: null,
      coords: parsePointWkt(row.coord?.value || ""),
      summary: ""
    };

    if (!entry.country || !entry.articleTitle || !entry.continent) continue;
    if (dedupe.has(entry.id)) continue;
    dedupe.add(entry.id);
    leaders.push(entry);
  }

  leaders.sort((a, b) => `${a.country}-${a.leader}-${a.role}`.localeCompare(`${b.country}-${b.leader}-${b.role}`));
  return leaders;
}

async function fetchCorruptionMap() {
  const json = await fetchJson(WORLD_BANK_CORRUPTION_URL);
  const rows = Array.isArray(json) ? json[1] : [];
  const map = new Map();
  for (const row of rows || []) {
    if (!row?.country?.id || row.value == null) continue;
    map.set(String(row.country.id).toUpperCase(), Number(row.value));
  }
  return map;
}

async function fetchSummaryForLeader(leader) {
  await sleep(SUMMARY_DELAY_MS);
  try {
    const data = await fetchJson(`${WIKIPEDIA_SUMMARY_BASE}${encodeURIComponent(leader.articleTitle)}`);
    return {
      ...leader,
      image: data?.thumbnail?.source || data?.originalimage?.source || leader.image || "",
      summary: data?.extract || ""
    };
  } catch (error) {
    console.warn(`Summary fetch failed for ${leader.articleTitle}: ${error.message}`);
    return leader;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function addCorruptionScores(leaders, corruptionMap) {
  return leaders.map((leader) => ({
    ...leader,
    corruptionScore: leader.iso2 ? (corruptionMap.get(leader.iso2) ?? null) : null
  }));
}

function validateLeaders(leaders) {
  if (!Array.isArray(leaders) || leaders.length === 0) {
    throw new Error("No leaders were generated.");
  }

  for (const leader of leaders) {
    if (!leader.id || !leader.country || !leader.leader || !leader.role) {
      throw new Error(`Invalid leader entry: ${JSON.stringify(leader)}`);
    }
  }
}

async function writeOutput(leaders) {
  const payload = {
    generatedAt: new Date().toISOString(),
    count: leaders.length,
    leaders
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  console.log("Fetching live leaders from Wikidata...");
  const leaders = await fetchLeaderPool();
  console.log(`Fetched ${leaders.length} leader entries.`);

  console.log("Fetching corruption scores from World Bank...");
  const corruptionMap = await fetchCorruptionMap();
  const leadersWithCorruption = addCorruptionScores(leaders, corruptionMap);

  console.log("Fetching Wikipedia summaries and thumbnails...");
  const enrichedLeaders = await mapWithConcurrency(
    leadersWithCorruption,
    SUMMARY_CONCURRENCY,
    fetchSummaryForLeader
  );

  validateLeaders(enrichedLeaders);
  await writeOutput(enrichedLeaders);
  console.log(`Wrote ${enrichedLeaders.length} leaders to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
