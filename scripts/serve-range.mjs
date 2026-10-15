// Tiny static server with CORS + HTTP Range + ETag, to mimic R2 locally.
//   node scripts/serve-range.mjs dev-data [port]
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, normalize } from "node:path";

const root = process.argv[2] ?? "dev-data";
const port = Number(process.argv[3] ?? 8787);

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "range, if-match, if-none-match, content-type");
  res.setHeader("Access-Control-Expose-Headers", "etag, content-length, content-range, accept-ranges, last-modified");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const path = join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  let st;
  try { st = statSync(path); if (!st.isFile()) throw 0; } catch { return res.writeHead(404).end("not found"); }
  const etag = `"${st.size}-${st.mtimeMs}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Accept-Ranges", "bytes");
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : st.size - Number(m[2]);
    const end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1, "Content-Type": "application/octet-stream" });
    if (req.method === "HEAD") return res.end();
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Length": st.size, "Content-Type": "application/octet-stream" });
  if (req.method === "HEAD") return res.end();
  createReadStream(path).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
