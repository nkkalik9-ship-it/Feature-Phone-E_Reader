// Local test server: mimics the Vercel rewrite. Usage: node build.js && node dev.js
const http = require("http");
const handler = require("./api/index.js");

const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    const extra = u.search ? "&" + u.search.slice(1) : "";
    req.url = "/api/index?__p=" + encodeURIComponent(u.pathname) + extra;
    handler(req, res);
  })
  .listen(port, () => console.log("Preview at http://localhost:" + port));
