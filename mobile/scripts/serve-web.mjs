import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
};
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(
            new URL(req.url, "http://localhost").pathname,
        );
        const target = path.resolve(root, `.${pathname}`);
        const relative = path.relative(root, target);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            res.writeHead(403).end();
            return;
        }
        let file = target;
        if (!(await stat(file).catch(() => null))?.isFile()) {
            if (path.extname(pathname)) {
                res.writeHead(404).end();
                return;
            }
            file = path.join(root, "index.html");
        }
        res.writeHead(200, {
            "Content-Type":
                types[path.extname(file)] || "application/octet-stream",
            "Cache-Control": "no-store",
        });
        res.end(await readFile(file));
    } catch {
        if (res.headersSent || res.destroyed) res.destroy();
        else res.writeHead(500).end("Unable to serve this page.");
    }
}).listen(port, "127.0.0.1", () =>
    console.log(`Web preview: http://localhost:${port}`),
);
