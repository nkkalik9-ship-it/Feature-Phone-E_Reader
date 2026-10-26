# Feature Phone Reader

A tiny book reader for Opera Mini 4.x on feature phones.
No JavaScript, no images, no external files. Pages are about 4 KB each.

Features: themes (5), text size (3), bookmarks (up to 60), "Continue" link to
the last page you read, jump-to-page, and Prev/Next on every page.

## Add a book
1. Save it as plain text (`.txt`, UTF-8) in the `books/` folder.
   The file name becomes the title: `the-time-machine.txt` -> "the time machine".
2. Commit and push (or run `npx vercel --prod`). Vercel rebuilds automatically.

## Deploy to Vercel
**Option A: GitHub**
1. Create a GitHub repo and push this folder.
2. On vercel.com choose "Add New > Project" and import the repo.
3. Leave settings as they are. `vercel.json` already sets everything up.

**Option B: CLI**
```
npx vercel --prod
```

## Test locally
```
npm run dev
```
then open http://localhost:3000

## How it works
- `build.js` splits each book into small pages and writes JSON to `data/`.
- `api/index.js` is one Vercel function that renders every page. It reads your
  theme, text size, bookmarks and last-read page from cookies on your phone.
- Nothing is stored on the server. Clearing the browser's cookies resets them.

## If themes or bookmarks don't stick
They rely on cookies. In Opera Mini, check Settings and make sure cookies are
allowed. If your phone refuses cookies, reading still works; only the saved
theme, bookmarks and "Continue" link are lost.

## Tweaks
- `PAGE_SIZE` in build.js: characters per page (default 3000).
- `SITE_NAME` in api/index.js: title on the home page.
- `THEMES` in api/index.js: edit or add colour themes.
- `MAX_BOOKMARKS` in api/index.js: bookmark limit (default 60).

## Notes
- Curly quotes and long dashes are converted to plain ones so old phone fonts
  don't show "?" boxes.
- Project Gutenberg (gutenberg.org) has thousands of free .txt books.
