// scripts/fetch_oscars.js
// Fetch Oscars nominations from Wikipedia and save to /data/year.json

import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const START_YEAR = 2000;
const END_YEAR = 2025;

// Utility → ordinal numbers
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Ceremony number formula
function ceremonyNumberFromYear(year) {
  return year - 1928; // works 2000 → 72nd, etc.
}

// Extract nominees from HTML
function extractNominations(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Try to find the "Winners and nominees" section
  const h2List = Array.from(doc.querySelectorAll("h2, h3, h4"));

  let target = h2List.find(h =>
    /Winners|Nominees|Nominations/i.test(h.textContent)
  );

  if (!target) return { error: "Nominees section not found" };

  // The content will be the next sibling elements until next H2/H3
  let cur = target.nextElementSibling;
  const blocks = [];
  while (cur && !/H2|H3/.test(cur.tagName)) {
    blocks.push(cur.outerHTML);
    cur = cur.nextElementSibling;
  }

  return { html: blocks.join("\n") };
}

// Download page from Wikipedia API
async function fetchYear(year) {
  const num = ceremonyNumberFromYear(year);
  const page = `${ordinal(num)}_Academy_Awards`;
  const url =
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
      page
    )}&prop=text&format=json`;

  console.log("Fetching:", year, url);

  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error");
  const json = await res.json();

  if (json.error) throw new Error("Wiki API error: " + json.error.info);

  const html = json.parse.text["*"];
  const extracted = extractNominations(html);

  return {
    year,
    page,
    fetchedAt: new Date().toISOString(),
    ...extracted,
  };
}

// Save JSON to /data folder
function saveJSON(year, data) {
  if (!fs.existsSync("data")) fs.mkdirSync("data");
  fs.writeFileSync(`data/${year}.json`, JSON.stringify(data, null, 2));
  console.log("Saved:", `data/${year}.json`);
}

// Runner
async function run() {
  for (let y = END_YEAR; y >= START_YEAR; y--) {
    try {
      const data = await fetchYear(y);
      saveJSON(y, data);
      await new Promise(r => setTimeout(r, 1000)); // delay for Wikipedia
    } catch (err) {
      console.log("FAILED", y, err.message);
      saveJSON(y, { year: y, error: err.message });
    }
  }
}

run();
