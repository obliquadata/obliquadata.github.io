#!/usr/bin/env node

/**
 * Leaderle database generator (v2)
 *
 * More reliable than v1 because it:
 * - splits the Wikidata fetch into two smaller queries
 * - uses retries with backoff for flaky upstreams
 * - degrades gracefully instead of failing the whole run immediately
 * - always writes a valid leaders.json if at least one source succeeds
 *
 * Usage:
 *   node scripts/update-leaders.mjs
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

const USER_AGENT = "LeaderleDatabaseGenerator/2.0 (https://github.com/obliquadata/obliquadata.github.io)";
const SUMMARY_CONCURRENCY = 4;
const SUMMARY_DELAY_MS = 120;
const MAX_RETRIES = 4;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const FALLBACK_LEADERS = [
  {
    id: "france-macron-head-of-state",
    leader: "Emmanuel Macron",
    startDate: "2017-05-14",
    country: "France",
    continent: "Europe",
    iso2: "FR",
    role: "Head of state",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Emmanuel_Macron_in_2023.jpg/640px-Emmanuel_Macron_in_2023.jpg",
    corruptionScore: 1.3,
    coords: { lat: 46.2276, lon: 2.2137 },
    summary: "Emmanuel Macron is a French politician who has served as President of France since 2017."
  },
  {
    id: "australia-albanese-head-of-government",
    leader: "Anthony Albanese",
    startDate: "2022-05-23",
    country: "Australia",
    continent: "Oceania",
    iso2: "AU",
    role: "Head of government",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Anthony_Albanese_2022_%28cropped%29.jpg/640px-Anthony_Albanese_2022_%28cropped%29.jpg",
    corruptionScore: 1.8,
    coords: { lat: -25.2744, lon: 133.7751 },
    summary: "Anthony Albanese is an Australian politician serving as Prime Minister of Australia since 2022."
  },
  {
    id: "india-modi-head-of-government",
    leader: "Narendra Modi",
    startDate: "2014-05-26",
    country: "India",
    continent: "Asia",
    iso2: "IN",
    role: "Head of government",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Official_Photograph_of_Prime_Minister_Narendra_Modi_Portrait.png/640px-Official_Photograph_of_Prime_Minister_Narendra_Modi_Portrait.png",
    corruptionScore: -0.2,
    coords: { lat: 20.5937, lon: 78.9629 },
    summary: "Narendra Modi is an Indian politician serving as Prime Minister of India since 2014."
  }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const error = new Error(`Request failed (${res.status}) for ${url}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function fetchJsonWithRetry(url, options = {}, label = "request") {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fetchJson(url, options);
    } catch (error) {
      lastError = error;
      const retryable = RETRYABLE_STATUS.has(error.status);
      if (!retryable || attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`${label} failed on attempt ${attempt}/${MAX_RETRIES}: ${error.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function buildOfficeQuery(property, officeLabel) {
  return `
    SELECT DISTINCT ?country ?countryLabel ?leader ?leaderLabel ?article ?continentLabel ?iso2 ?image ?coord ?start WHERE {
      ?country p:${property} ?stmt .
      ?stmt ps:${property} ?leader .
      FILTER NOT EXISTS { ?stmt wikibase:rank wikibase:DeprecatedRank }
      OPTIONAL { ?stmt pq:P580 ?start . }
      ?country wdt:P31/wdt:P279* wd:Q3624078 .
      OPTIONAL { ?country wdt:P30 ?continent . }
      OPTIONAL { ?country wdt:P297 ?iso2 . }
      OPTIONAL { ?country wdt:P625 ?coord . }
      OPTIONAL { ?leader wdt:P18 ?image . }
      ?article schema:about ?leader ; schema:isPartOf <https://en.wikipedia.org/> .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `.trim().replaceAll("\n", "\n") + `\n# ${officeLabel}`;
}

async function fetchWikidataOffice(property, officeLabel) {
  const query = buildOfficeQuery(property, officeLabel);
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const json = await fetchJsonWithRetry(
    url,
    { headers: { accept: "application/sparql-results+json" } },
    `Wikidata ${officeLabel}`
  );

  const rows = json?.results?.bindings || [];
  return rows.map((row) => {
    const articleUrl = row.article?.value || "";
    const articleTitle = decodeURIComponent(articleUrl.split("/wiki/")[1] || "");
    return {
      id: `${row.leader?.value || ""}|${row.country?.value || ""}|${officeLabel}`,
      leader: row.leaderLabel?.value || "Unknown leader",
      startDate: row.start?.value ? row.start.value.slice(0, 10) : null,
      country: row.countryLabel?.value || "Unknown country",
      continent: inferContinent(row.continentLabel?.value || ""),
      iso2: (row.iso2?.value || "").toUpperCase(),
      role: officeLabel,
      articleTitle,
      image: commonsImageToUrl(row.image?.value || ""),
      corruptionScore: null,
      coords: parsePointWkt(row.coord?.value || ""),
      summary: ""
    };
  }).filter((entry) => entry.country && entry.articleTitle && entry.continent);
}

async function fetchLeaderPool() {
  const results = await Promise.allSettled([
    fetchWikidataOffice("P35", "Head of state"),
    fetchWikidataOffice("P6", "Head of government")
  ]);

  const successful = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (successful.length === 0) {
    throw new Error("All Wikidata leader queries failed.");
  }

  const dedupe = new Set();
  const leaders = successful.filter((entry) => {
    if (dedupe.has(entry.id)) return false;
    dedupe.add(entry.id);
    return true;
  });

  leaders.sort((a, b) => `${a.country}-${a.leader}-${a.role}`.localeCompare(`${b.country}-${b.leader}-${b.role}`));
  return leaders;
}

async function fetchCorruptionMap() {
  try {
    const json = await fetchJsonWithRetry(WORLD_BANK_CORRUPTION_URL, {}, "World Bank corruption data");
    const rows = Array.isArray(json) ? json[1] : [];
    const map = new Map();
    for (const row of rows || []) {
      if (!row?.country?.id || row.value == null) continue;
      map.set(String(row.country.id).toUpperCase(), Number(row.value));
    }
    return map;
  } catch (error) {
    console.warn(`Could not fetch corruption scores: ${error.message}`);
    return new Map();
  }
}

async function fetchSummaryForLeader(leader) {
  await sleep(SUMMARY_DELAY_MS);
  try {
    const data = await fetchJsonWithRetry(
      `${WIKIPEDIA_SUMMARY_BASE}${encodeURIComponent(leader.articleTitle)}`,
      {},
      `Wikipedia summary for ${leader.articleTitle}`
    );
    return {
      ...leader,
      image: data?.thumbnail?.source || data?.originalimage?.source || leader.image || "",
      summary: data?.extract || leader.summary || ""
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

async function writeOutput(leaders, source) {
  const payload = {
    generatedAt: new Date().toISOString(),
    count: leaders.length,
    source,
    leaders
  };
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  let leaders;
  let source = "wikidata";

  try {
    console.log("Fetching heads of state and heads of government from Wikidata...");
    leaders = await fetchLeaderPool();
    console.log(`Fetched ${leaders.length} leader entries from Wikidata.`);
  } catch (error) {
    console.warn(`Live leader fetch failed: ${error.message}`);
    console.warn("Falling back to starter leaders so deployment remains usable.");
    leaders = [...FALLBACK_LEADERS];
    source = "fallback";
  }

  console.log("Fetching corruption scores...");
  const corruptionMap = await fetchCorruptionMap();
  const leadersWithCorruption = addCorruptionScores(leaders, corruptionMap);

  console.log("Fetching Wikipedia summaries and thumbnails...");
  const enrichedLeaders = await mapWithConcurrency(
    leadersWithCorruption,
    SUMMARY_CONCURRENCY,
    fetchSummaryForLeader
  );

  validateLeaders(enrichedLeaders);
  await writeOutput(enrichedLeaders, source);
  console.log(`Wrote ${enrichedLeaders.length} leaders to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
