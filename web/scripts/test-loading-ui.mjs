import { readFile, readdir, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServer } from "node:http";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, expect } from "@playwright/test";
const require = createRequire(import.meta.url),
  root = resolve(import.meta.dirname, ".."),
  output = resolve(root, "../work/loading-ui");
let locale = "en";
async function load(path, overrides = {}) {
  const source = await readFile(resolve(root, path), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => overrides[name] ?? require(name),
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}
const spinner = await load("src/components/loading-spinner.tsx");
const loading = await load("src/components/app-loading.tsx", {
  "@/components/loading-spinner": spinner,
  "@/lib/locale": { getLocale: async () => locale },
});
const cssPath = resolve(root, ".next/static/css");
const css = (
  await Promise.all(
    (await readdir(cssPath))
      .filter((file) => file.endsWith(".css"))
      .map((file) => readFile(resolve(cssPath, file), "utf8")),
  )
).join("\n");
await mkdir(output, { recursive: true });
const pages = {};
const layouts = [
  "directory",
  "visits",
  "visit-detail",
  "visit-form",
  "visit-edit",
  "groups",
  "management",
];
for (const language of ["en", "uk"]) {
  locale = language;
  for (const layout of layouts)
    pages[`${language}-${layout}`] = renderToStaticMarkup(
      await loading.default({ layout }),
    );
}
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<!doctype html><html lang="${url.searchParams.get("locale") || "en"}" data-theme="${url.searchParams.get("theme") || "light"}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body>${pages[`${url.searchParams.get("locale") || "en"}-${url.searchParams.get("layout") || "directory"}`]}</body></html>`,
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  for (const language of ["en", "uk"])
    for (const theme of ["light", "dark"]) {
      for (const layout of layouts) {
        await page.goto(
          `http://127.0.0.1:${server.address().port}/?locale=${language}&theme=${theme}&layout=${layout}`,
        );
        await expect(page.getByRole("status")).toContainText(
          language === "uk" ? "Завантаження" : "Loading",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: resolve(output, `${language}-${theme}-${layout}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  console.log(
    "Shared loading UI passed: English/Ukrainian, light/dark, 375px.",
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
