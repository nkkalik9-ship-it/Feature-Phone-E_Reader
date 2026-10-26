// Page renderer for the feature-phone reader (Vercel Node function).
// Every URL is rewritten here (see vercel.json) with the original path in
// the __p query parameter.
//
// Cookies used (all optional, nothing breaks if the phone refuses them):
//   th  = theme name        fs = text size
//   bm  = bookmarks "slug.page_slug.page_..." (newest first)
//   last = last page read "slug.page"

const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const SITE_NAME = "My Library";
const MAX_BOOKMARKS = 60;
const YEAR = 31536000;

const THEMES = {
  light: { name: "Light", bg: "#ffffff", fg: "#000000", link: "#0000cc", bar: "#eeeeee" },
  dark: { name: "Dark", bg: "#000000", fg: "#cccccc", link: "#66aaff", bar: "#222222" },
  sepia: { name: "Sepia", bg: "#f4ecd8", fg: "#3b2f1e", link: "#7a4a12", bar: "#e6dcc3" },
  night: { name: "Green night", bg: "#000000", fg: "#33ff33", link: "#99ff99", bar: "#002200" },
  contrast: { name: "Yellow on black", bg: "#000000", fg: "#ffff00", link: "#ffffff", bar: "#333333" },
};
const SIZES = { small: "x-small", medium: "small", large: "medium" };
const SIZE_NAMES = { small: "Small", medium: "Medium", large: "Large" };

let lib = null;
const books = {};

function getLib() {
  if (!lib) lib = JSON.parse(fs.readFileSync(path.join(DATA, "library.json"), "utf8"));
  return lib;
}
function getMeta(slug) {
  return getLib().find((b) => b.slug === slug) || null;
}
function getPages(slug) {
  if (!getMeta(slug)) return null;
  if (!books[slug]) {
    books[slug] = JSON.parse(
      fs.readFileSync(path.join(DATA, "books", slug + ".json"), "utf8")
    );
  }
  return books[slug];
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(/;\s*/).forEach((c) => {
    const i = c.indexOf("=");
    if (i > 0) out[c.slice(0, i)] = c.slice(i + 1);
  });
  return out;
}

function setCookie(name, value) {
  return name + "=" + value + "; Max-Age=" + YEAR + "; Path=/";
}

// "slug.3_other.12" -> [{slug, n}, ...] (only valid, existing entries)
function parseMarks(str) {
  if (!str) return [];
  const out = [];
  for (const part of str.split("_")) {
    const m = /^([a-z0-9-]+)\.(\d+)$/.exec(part);
    if (!m) continue;
    const meta = getMeta(m[1]);
    const n = parseInt(m[2], 10);
    if (meta && n >= 1 && n <= meta.pages) out.push({ slug: m[1], n });
  }
  return out;
}
function marksToString(list) {
  return list.map((m) => m.slug + "." + m.n).join("_");
}

function pageUrl(slug, n) {
  return "/b/" + slug + "/" + n;
}

function safeReturn(r) {
  return typeof r === "string" && r.charAt(0) === "/" && r.charAt(1) !== "/" ? r : "/";
}

function layout(ctx, title, body) {
  const t = THEMES[ctx.theme];
  const fsz = SIZES[ctx.size];
  return (
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Mobile 1.0//EN" ' +
    '"http://www.wapforum.org/DTD/xhtml-mobile10.dtd">\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml"><head>\n' +
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    "<title>" + esc(title) + "</title>\n" +
    "<style>body{margin:2px;padding:0;font-family:sans-serif;font-size:" + fsz +
    ";line-height:1.35;background:" + t.bg + ";color:" + t.fg + "}" +
    "h1,h2{font-size:medium;margin:3px 0}" +
    "p{margin:0 0 7px 0}" +
    "a{color:" + t.link + "}" +
    ".nav{margin:5px 0;padding:3px;background:" + t.bar + "}" +
    "</style>\n" +
    "</head><body>\n" + body + "\n</body></html>\n"
  );
}

function send(res, status, html, cookies) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  if (cookies && cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(html);
}

function redirect(res, loc, cookies) {
  res.statusCode = 302;
  res.setHeader("Location", loc);
  res.setHeader("Cache-Control", "private, no-store");
  if (cookies && cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end();
}

function notFound(ctx, res) {
  send(res, 404, layout(ctx, "Not found",
    '<p>Page not found.</p><div class="nav"><a href="/">Home</a></div>'));
}

// ---------- pages ----------

function home(ctx, res) {
  const books = getLib();
  let body = "<h1>" + esc(SITE_NAME) + "</h1>";

  const last = parseMarks(ctx.cookies.last)[0];
  if (last) {
    const m = getMeta(last.slug);
    body += '<div class="nav">Continue: <a href="' + pageUrl(last.slug, last.n) + '">' +
      esc(m.title) + " p." + last.n + "</a></div>";
  }

  if (books.length) {
    body += "<ol>" + books.map((b) =>
      '<li><a href="' + pageUrl(b.slug, 1) + '">' + esc(b.title) + "</a> (" + b.pages + "p)</li>"
    ).join("\n") + "</ol>";
  } else {
    body += "<p>No books yet. Add .txt files to the books folder.</p>";
  }

  const n = ctx.marks.length;
  body += '<div class="nav"><a href="/marks">Bookmarks (' + n + ')</a> | ' +
    '<a href="/settings?r=%2F">Settings</a></div>';
  send(res, 200, layout(ctx, SITE_NAME, body));
}

function bookPage(ctx, res, slug, nStr) {
  const pages = getPages(slug);
  if (!pages) return notFound(ctx, res);
  const meta = getMeta(slug);
  const total = pages.length;
  const n = nStr === undefined ? 1 : parseInt(nStr, 10);
  if (!(n >= 1 && n <= total)) return notFound(ctx, res);

  const here = pageUrl(slug, n);
  const enc = encodeURIComponent(here);
  const isMarked = ctx.marks.some((m) => m.slug === slug && m.n === n);

  const prev = n > 1 ? '<a href="' + pageUrl(slug, n - 1) + '">&lt; Prev</a>' : "";
  const next = n < total ? '<a href="' + pageUrl(slug, n + 1) + '">Next &gt;</a>' : "End";
  const nav1 = '<div class="nav">' + prev + (prev ? " | " : "") + next + " | " + n + "/" + total + "</div>";
  const mark = isMarked
    ? '<a href="/bm/del/' + slug + "/" + n + "?r=" + encodeURIComponent(here) + '">Unmark</a>'
    : '<a href="/bm/add/' + slug + "/" + n + '">Bookmark</a>';
  const nav2 = '<div class="nav">' + mark + ' | <a href="/marks">Marks</a> | <a href="/">Home</a> | ' +
    '<a href="/settings?r=' + enc + '">Theme</a></div>';

  let head = "";
  if (n === 1) {
    head = "<h2>" + esc(meta.title) + "</h2>";
    if (total > 10) {
      const jumps = [];
      for (let i = 10; i <= total; i += 10) jumps.push('<a href="' + pageUrl(slug, i) + '">' + i + "</a>");
      head += "<p>Jump: " + jumps.slice(0, 40).join(" ") + "</p>";
    }
  }
  if (total > 1) {
    head += '<form action="/go" method="get"><p>Go to page: ' +
      '<input type="hidden" name="s" value="' + slug + '" />' +
      '<input type="text" name="p" size="4" /> <input type="submit" value="Go" /></p></form>';
  }

  const paras = pages[n - 1].split("\n\n").map((p) => "<p>" + esc(p) + "</p>").join("\n");
  const body = nav1 + (n === 1 ? head : "") + paras + nav1 + nav2 +
    (n !== 1 ? head : "");

  const cookies = [];
  if (ctx.cookies.last !== slug + "." + n) cookies.push(setCookie("last", slug + "." + n));
  send(res, 200, layout(ctx, meta.title + " " + n + "/" + total, body), cookies);
}

function marksPage(ctx, res) {
  let body = "<h2>Bookmarks</h2>";
  if (!ctx.marks.length) {
    body += "<p>No bookmarks yet. Use Bookmark at the bottom of any page.</p>";
  } else {
    body += "<ol>" + ctx.marks.map((m) => {
      const meta = getMeta(m.slug);
      return '<li><a href="' + pageUrl(m.slug, m.n) + '">' + esc(meta.title) + " p." + m.n +
        '</a> [<a href="/bm/del/' + m.slug + "/" + m.n + '?r=%2Fmarks">x</a>]</li>';
    }).join("\n") + "</ol>";
  }
  body += '<div class="nav"><a href="/">Home</a></div>';
  send(res, 200, layout(ctx, "Bookmarks", body));
}

function settingsPage(ctx, res, r) {
  const enc = encodeURIComponent(r);
  let body = "<h2>Settings</h2><p>Theme:</p><ul>";
  body += Object.keys(THEMES).map((k) =>
    "<li>" + (k === ctx.theme ? "&gt; " : "") +
    '<a href="/set/theme/' + k + "?r=" + enc + '">' + esc(THEMES[k].name) + "</a></li>"
  ).join("");
  body += "</ul><p>Text size:</p><ul>";
  body += Object.keys(SIZES).map((k) =>
    "<li>" + (k === ctx.size ? "&gt; " : "") +
    '<a href="/set/size/' + k + "?r=" + enc + '">' + SIZE_NAMES[k] + "</a></li>"
  ).join("");
  body += '</ul><div class="nav"><a href="' + esc(r) + '">Back</a> | <a href="/">Home</a></div>';
  send(res, 200, layout(ctx, "Settings", body));
}

// ---------- router ----------

module.exports = (req, res) => {
  let u;
  try {
    u = new URL(req.url, "http://x");
  } catch (e) {
    res.statusCode = 400;
    return res.end("Bad request");
  }
  const q = u.searchParams;
  const parts = (q.get("__p") || "/").split("/").filter(Boolean);

  let ctx;
  try {
    getLib();
    const cookies = parseCookies(req);
    ctx = {
      cookies,
      theme: THEMES[cookies.th] ? cookies.th : "light",
      size: SIZES[cookies.fs] ? cookies.fs : "medium",
      marks: parseMarks(cookies.bm),
    };
  } catch (e) {
    res.statusCode = 500;
    return res.end("Library data missing. Run: node build.js");
  }

  const r = safeReturn(q.get("r"));

  try {
    switch (parts[0]) {
      case undefined:
        return home(ctx, res);

      case "b":
        return bookPage(ctx, res, parts[1], parts[2]);

      case "marks":
        return marksPage(ctx, res);

      case "settings":
        return settingsPage(ctx, res, r);

      case "set": {
        const kind = parts[1];
        const val = parts[2];
        if (kind === "theme" && THEMES[val]) return redirect(res, r, [setCookie("th", val)]);
        if (kind === "size" && SIZES[val]) return redirect(res, r, [setCookie("fs", val)]);
        return notFound(ctx, res);
      }

      case "bm": {
        const action = parts[1];
        const slug = parts[2];
        const n = parseInt(parts[3], 10);
        const meta = getMeta(slug);
        if (!meta || !(n >= 1 && n <= meta.pages)) return notFound(ctx, res);
        let list = ctx.marks.filter((m) => !(m.slug === slug && m.n === n));
        if (action === "add") {
          list.unshift({ slug, n });
          list = list.slice(0, MAX_BOOKMARKS);
          while (list.length > 1 && marksToString(list).length > 3500) list.pop();
          return redirect(res, r !== "/" ? r : pageUrl(slug, n), [setCookie("bm", marksToString(list) || "-")]);
        }
        if (action === "del") {
          return redirect(res, r !== "/" ? r : "/marks", [setCookie("bm", marksToString(list) || "-")]);
        }
        return notFound(ctx, res);
      }

      case "go": {
        const slug = q.get("s") || "";
        const meta = getMeta(slug);
        if (!meta) return redirect(res, "/");
        let n = parseInt(q.get("p"), 10);
        if (!(n >= 1)) n = 1;
        if (n > meta.pages) n = meta.pages;
        return redirect(res, pageUrl(slug, n));
      }

      default:
        return notFound(ctx, res);
    }
  } catch (e) {
    res.statusCode = 500;
    res.end("Error");
  }
};
