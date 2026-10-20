/**
 * A tiny local stand-in for Cloudflare R2's S3 API, so Origin Notes uploads,
 * PDF viewing and the storage checks can be exercised on a dev machine with
 * no real bucket (V1/NOTES_PLAN.md §8). DEV ONLY — binds to 127.0.0.1.
 *
 * It really checks AWS SigV4 signatures (query-presigned and header-signed)
 * with the fake secret, so a wrong signature, an expired link or a PUT with a
 * different Content-Type than the one signed is refused just like R2 would.
 * Supports PUT (incl. x-amz-copy-source copies and x-amz-copy-source-if-match),
 * If-Match on GET/HEAD, GET (incl. Range and the
 * response-* overrides), HEAD, DELETE and CORS preflight.
 *
 *   npx tsx scripts/dev-fake-r2.ts            # port 9466, files in $TMPDIR/origin-fake-r2
 *
 * Point the app at it:
 *   R2_ENDPOINT=http://127.0.0.1:9466 R2_ACCESS_KEY_ID=dev R2_SECRET_ACCESS_KEY=dev-secret R2_NOTES_BUCKET=notes-dev
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { presignUrl, signRequest } from "../src/server/notes/r2-sigv4";

const PORT = Number(process.env.FAKE_R2_PORT ?? 9466);
const ACCESS_KEY = process.env.FAKE_R2_ACCESS_KEY ?? "dev";
const SECRET = process.env.FAKE_R2_SECRET ?? "dev-secret";
const DIR = process.env.FAKE_R2_DIR ?? join(tmpdir(), "origin-fake-r2");
mkdirSync(DIR, { recursive: true });

type Meta = { contentType: string; etag: string; size: number };

function fileFor(objectPath: string): { data: string; meta: string } {
  const id = createHash("sha256").update(objectPath).digest("hex");
  return { data: join(DIR, `${id}.bin`), meta: join(DIR, `${id}.json`) };
}

function readMeta(objectPath: string): Meta | null {
  const files = fileFor(objectPath);
  if (!existsSync(files.meta) || !existsSync(files.data)) return null;
  return JSON.parse(readFileSync(files.meta, "utf8")) as Meta;
}

function cors(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, HEAD, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "content-type, range, x-amz-content-sha256, x-amz-date, authorization");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, ETag");
  res.setHeader("Access-Control-Max-Age", "600");
}

function fail(res: ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { "Content-Type": "application/xml" });
  res.end(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`);
}

function amzToDate(value: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u.exec(value);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns null when the request is correctly signed, or the reason it isn't. */
function verify(req: IncomingMessage, url: URL, rawPath: string, body: Buffer): string | null {
  const method = (req.method ?? "GET") as "GET" | "PUT" | "HEAD" | "DELETE";
  const origin = `http://${req.headers.host}`;
  const q = url.searchParams;
  if (q.get("X-Amz-Signature")) {
    const [accessKeyId, , region, service] = (q.get("X-Amz-Credential") ?? "").split("/");
    if (accessKeyId !== ACCESS_KEY) return "unknown access key";
    const now = amzToDate(q.get("X-Amz-Date") ?? "");
    const expires = Number(q.get("X-Amz-Expires"));
    if (Number.isNaN(now.getTime()) || Date.now() > now.getTime() + expires * 1000) return "link expired";
    const signedHeaders: Record<string, string> = {};
    for (const name of (q.get("X-Amz-SignedHeaders") ?? "").split(";")) {
      if (name && name !== "host") signedHeaders[name] = String(req.headers[name] ?? "");
    }
    const extra: Record<string, string> = {};
    for (const [k, v] of q.entries()) if (!k.startsWith("X-Amz-")) extra[k] = v;
    const expected = presignUrl({
      method,
      origin,
      canonicalUri: rawPath,
      credentials: { accessKeyId, secretAccessKey: SECRET, region, service },
      expiresSeconds: expires,
      query: extra,
      signedHeaders,
      now,
    }).split("X-Amz-Signature=")[1];
    return same(expected, q.get("X-Amz-Signature") ?? "") ? null : "signature does not match (check signed headers such as Content-Type)";
  }
  const auth = String(req.headers.authorization ?? "");
  const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/\d{8}\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]+)$/u.exec(auth);
  if (!m) return "missing or malformed Authorization";
  if (m[1] !== ACCESS_KEY) return "unknown access key";
  const payloadHash = String(req.headers["x-amz-content-sha256"] ?? "");
  if (payloadHash !== "UNSIGNED-PAYLOAD" && payloadHash !== createHash("sha256").update(body).digest("hex")) return "body hash mismatch";
  const headers: Record<string, string> = {};
  for (const name of m[4].split(";")) {
    if (!["host", "x-amz-content-sha256", "x-amz-date"].includes(name)) headers[name] = String(req.headers[name] ?? "");
  }
  const query: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) query[k] = v;
  const expected = signRequest({
    method,
    origin,
    canonicalUri: rawPath,
    credentials: { accessKeyId: m[1], secretAccessKey: SECRET, region: m[2], service: m[3] },
    headers,
    query: Object.keys(query).length ? query : undefined,
    payloadHash,
    now: amzToDate(String(req.headers["x-amz-date"] ?? "")),
  }).headers.Authorization.split("Signature=")[1];
  return same(expected, m[5]) ? null : "signature does not match";
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const rawPath = (req.url ?? "/").split("?")[0];
  const objectPath = decodeURIComponent(rawPath);
  const body = req.method === "PUT" ? await readBody(req) : Buffer.alloc(0);
  const problem = verify(req, url, rawPath, body);
  if (problem) {
    fail(res, 403, "SignatureDoesNotMatch", problem);
    return;
  }
  const files = fileFor(objectPath);

  if (req.method === "PUT") {
    const copySource = req.headers["x-amz-copy-source"];
    let data = body;
    let contentType = String(req.headers["content-type"] ?? "application/octet-stream");
    if (copySource) {
      const source = decodeURIComponent(String(copySource));
      const meta = readMeta(source);
      if (!meta) {
        fail(res, 404, "NoSuchKey", "copy source not found");
        return;
      }
      const wanted = req.headers["x-amz-copy-source-if-match"];
      if (wanted && String(wanted) !== meta.etag) {
        fail(res, 412, "PreconditionFailed", "copy source ETag does not match");
        return;
      }
      data = readFileSync(fileFor(source).data);
      contentType = meta.contentType;
    }
    const etag = `"${createHash("md5").update(data).digest("hex")}"`;
    writeFileSync(files.data, data);
    writeFileSync(files.meta, JSON.stringify({ contentType, etag, size: data.length } satisfies Meta));
    res.writeHead(200, { ETag: etag, "Content-Type": copySource ? "application/xml" : "text/plain" });
    res.end(copySource ? `<CopyObjectResult><ETag>${etag}</ETag></CopyObjectResult>` : "");
    return;
  }

  if (req.method === "DELETE") {
    rmSync(files.data, { force: true });
    rmSync(files.meta, { force: true });
    res.writeHead(204);
    res.end();
    return;
  }

  const meta = readMeta(objectPath);
  if (!meta) {
    if (req.method === "HEAD") {
      res.writeHead(404);
      res.end();
    } else fail(res, 404, "NoSuchKey", "The specified key does not exist.");
    return;
  }
  const ifMatch = req.headers["if-match"];
  if (ifMatch && String(ifMatch) !== meta.etag) {
    fail(res, 412, "PreconditionFailed", "ETag does not match");
    return;
  }
  const size = statSync(files.data).size;
  const headers: Record<string, string> = {
    "Content-Type": url.searchParams.get("response-content-type") ?? meta.contentType,
    ETag: meta.etag,
    "Accept-Ranges": "bytes",
  };
  const disposition = url.searchParams.get("response-content-disposition");
  if (disposition) headers["Content-Disposition"] = disposition;
  const cacheControl = url.searchParams.get("response-cache-control");
  if (cacheControl) headers["Cache-Control"] = cacheControl;

  const range = /^bytes=(\d*)-(\d*)$/u.exec(String(req.headers.range ?? ""));
  if (range && req.method === "GET") {
    const start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
    const end = range[1] === "" || range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` });
    createReadStream(files.data, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": String(size) });
  if (req.method === "HEAD") res.end();
  else createReadStream(files.data).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-r2] listening on http://127.0.0.1:${PORT} (files in ${DIR})`);
});
