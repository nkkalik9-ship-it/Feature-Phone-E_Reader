// Feature-phone book reader: build step.
// Reads every .txt file in /books, splits it into small pages and writes
// JSON into /data. The function in /api/index.js turns those into tiny HTML
// pages on request (so it can apply your theme and bookmarks).
//
// Usage:  node build.js
// Add a book: drop a .txt file in /books, then redeploy.

const fs = require("fs");
const path = require("path");

const BOOKS_DIR = path.join(__dirname, "books");
const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");

// Characters per page. ~3000 is about 500 words.
const PAGE_SIZE = 3000;

// Replace fancy punctuation that old phone fonts show as "?" or boxes.
function simplify(s) {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[    ]/g, " ")
    .replace(/﻿/g, "");
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "book"
  );
}

function titleFrom(filename) {
  return filename
    .replace(/\.txt$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Split text into pages at paragraph boundaries, never mid-word.
function paginate(text) {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const pages = [];
  let cur = "";
  const flush = () => {
    if (cur) pages.push(cur);
    cur = "";
  };

  for (let p of paragraphs) {
    while (p.length > PAGE_SIZE) {
      let cut = p.lastIndexOf(". ", PAGE_SIZE);
      if (cut < PAGE_SIZE / 2) cut = p.lastIndexOf(" ", PAGE_SIZE);
      if (cut <= 0) cut = PAGE_SIZE;
      const head = p.slice(0, cut + 1).trim();
      p = p.slice(cut + 1).trim();
      if (cur && cur.length + head.length > PAGE_SIZE) flush();
      cur += (cur ? "\n\n" : "") + head;
      flush();
    }
    if (cur && cur.length + p.length + 2 > PAGE_SIZE) flush();
    cur += (cur ? "\n\n" : "") + p;
  }
  flush();
  return pages.length ? pages : ["(empty)"];
}

function main() {
  if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR);
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DATA_DIR, "books"), { recursive: true });

  // Vercel needs an output folder; the real pages come from the function.
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PUBLIC_DIR, "robots.txt"),
    "User-agent: *\nDisallow: /\n"
  );

  const files = fs
    .readdirSync(BOOKS_DIR)
    .filter((f) => /\.txt$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  const used = new Set();
  const library = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(BOOKS_DIR, file), "utf8");
    const title = titleFrom(file);
    let slug = slugify(title);
    while (used.has(slug)) slug += "-x";
    used.add(slug);

    const pages = paginate(simplify(raw));
    fs.writeFileSync(
      path.join(DATA_DIR, "books", slug + ".json"),
      JSON.stringify(pages)
    );
    library.push({ slug, title, pages: pages.length });
  }

  fs.writeFileSync(path.join(DATA_DIR, "library.json"), JSON.stringify(library));

  console.log("Built " + library.length + " book(s).");
  library.forEach((b) => console.log("  " + b.title + ": " + b.pages + " pages"));
}

main();
