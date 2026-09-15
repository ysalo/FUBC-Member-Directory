// Isolated browser fixtures render the real client components; no Supabase accounts or data are changed.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = resolve(import.meta.dirname, ".."),
  dir = resolve(root, "../work/visitation-ui");
await mkdir(dir, { recursive: true });
await writeFile(
  resolve(dir, "loader.cjs"),
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`,
);
await writeFile(
  resolve(dir, "stubs.tsx"),
  `import React from 'react';export const usePathname=()=>'/visitation';export const useRouter=()=>({push:(url)=>{window.destination=url;},refresh:()=>window.dispatchEvent(new Event('refresh-fixture'))});export default function Link({children,...props}){return <a {...props}>{children}</a>;}export async function pendingVisitCount(){return window.pending;}export async function mutateVisit(op,form){window.actions.push({op,...Object.fromEntries(form),deacons:form.getAll('deacon')});if(window.failNext){window.failNext=false;return {error:'Unable to save. Your draft has been retained.'};}if(op==='respond'){window.pending=1;window.demo.visit_recipients[0].response=form.get('decision');window.demo.visit_recipients[0].decline_reason=form.get('decision')==='declined'?form.get('reason'):'';}if(op==='close'){window.pending=0;window.demo.status=form.get('decision');}return {id:'saved-fixture'};}`,
);
await writeFile(
  resolve(dir, "entry.tsx"),
  `import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';import VisitForm from ${JSON.stringify(resolve(root, "src/components/visit-form.tsx"))};import VisitControls from ${JSON.stringify(resolve(root, "src/components/visit-controls.tsx"))};import VisitDetails from ${JSON.stringify(resolve(root, "src/components/visit-details.tsx"))};import BottomNavigation from ${JSON.stringify(resolve(root, "src/components/bottom-navigation.tsx"))};
window.actions=[];window.pending=2;window.demo={id:'visit',pastor_id:'pastor',pastor_name:'Fictional Pastor',person_id:'member',member_name:'A very long fictional member name for accessibility testing',member_address:'123 Example Street, Seattle, WA',location:'Church meeting room',scheduled_at:'2099-12-15T19:30:00Z',notes:'Discuss the upcoming visit',status:'open',revision:2,updated_fields:['location'],visit_recipients:[{deacon_id:'d1',deacon_name:'First Deacon',response:'accepted',decline_reason:'',last_viewed_revision:1},{deacon_id:'d2',deacon_name:'Second Deacon',response:'pending',decline_reason:'',last_viewed_revision:0}]};
function App(){const[version,setVersion]=useState(0);useEffect(()=>{const update=()=>setVersion(v=>v+1);window.addEventListener('refresh-fixture',update);return()=>window.removeEventListener('refresh-fixture',update);},[]);const p=new URLSearchParams(location.search),mode=p.get('mode'),locale=p.get('locale')||'en',detail=mode==='deacon'||mode==='pastor',userId=mode==='deacon'?'d1':'pastor';return <><main className="mx-auto max-w-xl p-5 pb-28 bg-[var(--app-surface)] text-[var(--app-ink)]">{detail?<><VisitDetails visit={window.demo} locale={locale} userId={userId}/><p data-testid="response" className="sr-only">{window.demo.visit_recipients[0].response}</p><VisitControls visit={{...window.demo}} userId={userId} locale={locale} canComplete={p.has('complete')}/></>:<><h1 className="mb-5 text-2xl font-semibold">{mode==='edit'?'Edit request':'Request visit'}</h1><VisitForm member={{id:'member',name:window.demo.member_name,address:window.demo.member_address,groupId:p.get('missing')?null:'group'}} deacons={[{id:'d1',name:'First Deacon',group_id:'group'},{id:'d2',name:'Second Deacon',group_id:'group'},{id:'d3',name:'Other Deacon',group_id:null}]} visit={mode==='edit'?window.demo:undefined} locale={locale} submission="fixture-submission"/></>}</main><BottomNavigation role="member" isDeacon={mode==='deacon'} isPastor={mode!=='deacon'} locale={locale} fixed/></>};createRoot(document.getElementById('root')).render(<App/>);`,
);
await new Promise((res, rej) => {
  const compiler = webpack({
    mode: "development",
    devtool: false,
    entry: resolve(dir, "entry.tsx"),
    output: { path: dir, filename: "bundle.js" },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      modules: [resolve(root, "node_modules"), "node_modules"],
      alias: {
        "@/lib/visitation": resolve(root, "src/lib/visitation.ts"),
        "@/app/visitation/actions": resolve(dir, "stubs.tsx"),
        "@/components/navigation-link": resolve(dir, "stubs.tsx"),
        "next/navigation": resolve(dir, "stubs.tsx"),
        "@/lib/i18n": resolve(root, "src/lib/i18n.ts"),
        "@/lib/group-copy": resolve(root, "src/lib/group-copy.ts"),
        "@/components/language-switcher": resolve(dir, "stubs.tsx"),
        "@/components/sign-out-button": resolve(dir, "stubs.tsx"),
        "@/components/appearance-settings": resolve(dir, "stubs.tsx"),
      },
    },
    module: { rules: [{ test: /\.tsx?$/, use: resolve(dir, "loader.cjs") }] },
  });
  compiler.run((err, stats) => {
    compiler.close(() => {});
    if (err || stats.hasErrors())
      rej(err || new Error(stats.toString({ all: false, errors: true })));
    else res();
  });
});
const cssDir = resolve(root, ".next/static/css");
const css = (
  await Promise.all(
    (await readdir(cssDir))
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFile(resolve(cssDir, f), "utf8")),
  )
).join("\n");
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end(await readFile(resolve(dir, "bundle.js")));
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(url);
  await expect(page.getByLabel("First Deacon")).toBeChecked();
  await expect(page.getByLabel("Second Deacon")).toBeChecked();
  await expect(page.getByLabel("Other Deacon")).toBeDisabled();
  await page.getByLabel("Second Deacon").uncheck();
  await page.getByLabel("Other Deacon").check();
  await page.getByLabel("Visit location").fill("Alternate meeting place");
  await page.getByLabel("Date and time").fill("2099-09-15T12:30");
  await page.getByLabel("Visit notes").fill("Retain this draft");
  await page.evaluate(() => (window.failNext = true));
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("alert")).toContainText("retained");
  await expect(page.getByLabel("Visit notes")).toHaveValue("Retain this draft");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect
    .poll(() => page.evaluate(() => window.destination))
    .toBe("/visitation/saved-fixture");
  const save = await page.evaluate(() => window.actions.at(-1));
  expect(save.deacons).toEqual(["d1", "d3"]);
  expect(save.location).toBe("Alternate meeting place");
  await page.goto(url + "/?mode=edit");
  await expect(page.getByLabel("Date and time")).toHaveValue(
    "2099-12-15T12:30",
  );
  await page.getByLabel("Visit location").fill("Updated location");
  await page.getByRole("button", { name: "Save changes" }).click();
  expect((await page.evaluate(() => window.actions.at(-1))).revision).toBe("2");
  await page.goto(url + "/?mode=deacon");
  await expect(
    page.getByRole("link", { name: "Visitation, 2 pending requests" }),
  ).toBeVisible();
  await expect(
    page.getByText("123 Example Street, Seattle, WA", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Church meeting room", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/12:30 PM/)).toBeVisible();
  await expect(
    page.getByText("America/Los_Angeles", { exact: true }),
  ).toHaveCount(0);
  await page.locator("summary").click();
  await page.getByLabel("Decline reason").fill("Cannot attend");
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page.getByTestId("response")).toHaveText("declined");
  await expect(
    page.getByRole("link", { name: "Visitation, 1 pending requests" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByTestId("response")).toHaveText("accepted");
  expect(
    await page.evaluate(() => window.demo.visit_recipients[0].decline_reason),
  ).toBe("");
  await page.goto(url + "/?mode=pastor");
  await expect(
    page.getByRole("link", { name: "Edit request", exact: true }),
  ).toHaveAttribute("href", "/visitation/visit/edit");
  await expect(
    page.getByRole("button", { name: "Mark completed" }),
  ).toBeDisabled();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(
    page.getByRole("link", { name: "Visitation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel request" }),
  ).toHaveCount(0);
  await page.goto(url + "/?mode=pastor&complete=1");
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(
    page.getByRole("button", { name: "Mark completed" }),
  ).toHaveCount(0);
  for (const width of [320, 375, 460])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(url + "/?missing=1&locale=uk");
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        document.documentElement.dataset.textSize = "large";
      }, theme);
      await expect(
        page.getByRole("button", { name: "Надіслати запит" }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: resolve(dir, `pastor-${width}-${theme}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  for (const mode of ["pastor", "deacon"])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(url + "/?mode=" + mode);
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.screenshot({
        path: resolve(dir, `details-${mode}-${theme}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  console.log(
    "Visitation UI passed: recipient defaults/overrides, save failure/recovery, editing, response changes, Ukrainian, light/dark, large text, 320/375/460px.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
