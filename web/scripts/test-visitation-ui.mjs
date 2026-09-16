// Isolated browser fixtures render the real client components; no Supabase accounts or data are changed.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  `import React from 'react';export function createClient(){return {auth:{signOut:async()=>{window.signedOut=true;}}};}export const usePathname=()=>'/visitation';export const useRouter=()=>({push:(url)=>{window.destination=url;},replace:(url)=>{window.destination=url;},refresh:()=>window.dispatchEvent(new Event('refresh-fixture'))});export default function Link({children,...props}){return <a {...props}>{children}</a>;}export async function mutateGroup(op,form){window.actions.push({op,...Object.fromEntries(form)});return {};}export async function pendingVisitCount(){return window.pending;}export async function mutateVisit(op,form){window.actions.push({op,...Object.fromEntries(form),deacons:form.getAll('deacon')});if(window.failNext){window.failNext=false;return {error:'Unable to save. Your draft has been retained.'};}if(op==='respond'){window.pending=1;window.demo.visit_recipients[0].response=form.get('decision');window.demo.visit_recipients[0].decline_reason=form.get('decision')==='declined'?form.get('reason'):'';}if(op==='close'){window.pending=0;window.demo.status=form.get('decision');}return {id:'saved-fixture'};}`,
);
await writeFile(
  resolve(dir, "entry.tsx"),
  `import React,{useState,useEffect} from 'react';
import{createRoot}from'react-dom/client';
import VisitForm from ${JSON.stringify(resolve(root, "src/components/visit-form.tsx"))};
import VisitControls from ${JSON.stringify(resolve(root, "src/components/visit-controls.tsx"))};
import VisitDetails from ${JSON.stringify(resolve(root, "src/components/visit-details.tsx"))};
import VisitBack from ${JSON.stringify(resolve(root, "src/components/visit-back.tsx"))};
import GroupManagement from ${JSON.stringify(resolve(root, "src/components/group-management.tsx"))};
import BottomNavigation from ${JSON.stringify(resolve(root, "src/components/bottom-navigation.tsx"))};
const p=new URLSearchParams(location.search), unavailable=p.has('unavailable');
window.actions=[];window.pending=2;
window.demo={id:'visit',pastor_id:'pastor',pastor_person_id:unavailable?null:'pastor-person',pastor_name:'Fictional Pastor',person_id:'member',member_available:!unavailable,member_name:'A very long fictional member name for accessibility testing',member_address:'123 Example Street, Seattle, WA',location:'Church meeting room',scheduled_at:'2099-12-15T19:30:00Z',notes:'Discuss the upcoming visit',status:'open',revision:2,updated_fields:['location'],visit_recipients:[{deacon_id:'d1',deacon_person_id:unavailable?null:'deacon-person-1',deacon_name:'First Deacon',response:'accepted',decline_reason:'',last_viewed_revision:1},{deacon_id:'d2',deacon_person_id:unavailable?null:'deacon-person-2',deacon_name:'Second Deacon',response:'pending',decline_reason:'',last_viewed_revision:0}]};
function App(){
  const[version,setVersion]=useState(0);
  useEffect(()=>{const update=()=>setVersion(v=>v+1);window.addEventListener('refresh-fixture',update);return()=>window.removeEventListener('refresh-fixture',update);},[]);
  const mode=p.get('mode'),locale=p.get('locale')||'en',detail=mode==='deacon'||mode==='pastor',userId=mode==='deacon'?'d1':'pastor';
  return <><main className="mx-auto max-w-xl p-5 pb-28 bg-[var(--app-surface)] text-[var(--app-ink)]">
    <VisitBack locale={locale}/>
    {mode==='groups'?<GroupManagement
      locale={locale}
      groups={[{id:'group',name:'Fixture group',memberIds:['member','archived'],deacons:[{id:'d1',name:'First Deacon',status:'active',personId:'deacon-person-1',phone:null}]}]}
      people={[{id:'member',first_name:'Active',last_name:'Member',archived_at:null},{id:'archived',first_name:'Archived',last_name:'Member',archived_at:'2026-01-01'}]}
      eligible={[{id:'d1',display_name:'First Deacon',group_id:'group'},{id:'d2',display_name:'Unlinked Deacon',group_id:null}]}
      memberProfiles={{d1:{personId:'deacon-person-1'}}}
    />:detail?<><VisitDetails visit={window.demo} locale={locale} userId={userId}/><p data-testid="response" className="sr-only">{window.demo.visit_recipients[0].response}</p><VisitControls visit={{...window.demo}} userId={userId} locale={locale} /></>:<>
      <h1 className="mb-5 text-2xl font-semibold">{mode==='edit'?'Edit planned visit':'Plan visit'}</h1>
      <VisitForm
        member={mode==='new'?undefined:{id:'member',available:!unavailable,name:window.demo.member_name,address:window.demo.member_address,groupId:p.get('missing')?null:'group'}}
        members={mode==='new'?[{id:'member',name:'First member',photoPath:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=',address:'First home',groupId:'group'},{id:'other',name:'Other member',photoPath:'/missing-photo.png',address:'Other home',groupId:null}]:[]}
        deacons={[{id:'d1',person_id:'deacon-person-1',name:'First Deacon',group_id:'group'},{id:'d2',person_id:'deacon-person-2',name:'Second Deacon',group_id:'group'},{id:'d3',person_id:null,name:'Other Deacon',group_id:null}]}
        visit={mode==='edit'?window.demo:undefined} locale={locale} submission="fixture-submission"/>
    </>}
  </main><BottomNavigation role={p.get('role')||'member'} isDeacon={mode==='deacon'} isPastor={mode!=='deacon'} locale={locale} currentUser={{name:'Fixture User',email:'fixture@example.test',personId:'viewer'}} fixed/></>
};createRoot(document.getElementById('root')).render(<App/>);`,
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
        "@/app/admin/groups/actions": resolve(dir, "stubs.tsx"),
        "@/components/navigation-link": resolve(dir, "stubs.tsx"),
        "@/components/member-photo": resolve(
          root,
          "src/components/member-photo.tsx",
        ),
        "next/navigation": resolve(dir, "stubs.tsx"),
        "@/lib/supabase/browser": resolve(dir, "stubs.tsx"),
        "@/lib/directory-view": resolve(root, "src/lib/directory-view.ts"),
        "@/lib/i18n": resolve(root, "src/lib/i18n.ts"),
        "@/lib/group-copy": resolve(root, "src/lib/group-copy.ts"),
        "@/components/language-switcher": resolve(root, "src/components/language-switcher.tsx"),
        "@/components/sign-out-button": resolve(root, "src/components/sign-out-button.tsx"),
        "@/components/appearance-settings": resolve(root, "src/components/appearance-settings.tsx"),
        "@/components/visit-member-link": resolve(
          root,
          "src/components/visit-member-link.tsx",
        ),
        "@/components/back-button": resolve(
          root,
          "src/components/back-button.tsx",
        ),
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
const cssSource = resolve(root, "src/app/globals.css");
const postcss = createRequire(require.resolve("@tailwindcss/postcss"))("postcss");
const { css } = await postcss([
  require("@tailwindcss/postcss")({ base: root }),
]).process(await readFile(cssSource, "utf8"), { from: cssSource });
const server = createServer(async (req, res) => {
  if (req.url === "/brand-contours.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(await readFile(resolve(root, "public/brand-contours.svg")));
  } else if (req.url === "/bundle.js") {
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
  await expect(
    page.getByRole("link", { name: "Back", exact: true }),
  ).toHaveAttribute("href", "/visitation");
  await expect(
    page.getByRole("link", { name: "First Deacon", exact: true }),
  ).toHaveAttribute("href", "/members/deacon-person-1");
  await expect(
    page.getByRole("link", { name: "Other Deacon", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Profile unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("a a, button a, a button, label a")).toHaveCount(0);
  await page
    .getByRole("link", { name: "First Deacon", exact: true })
    .evaluate((link) =>
      link.addEventListener("click", (event) => event.preventDefault()),
    );
  await page.getByRole("link", { name: "First Deacon", exact: true }).click();
  expect(await page.evaluate(() => window.actions)).toEqual([]);
  await expect(page.getByLabel("First Deacon")).toBeChecked();
  await expect(page.getByLabel("Second Deacon")).toBeChecked();
  await expect(page.getByLabel("Other Deacon")).toBeDisabled();
  await page.getByLabel("Second Deacon").uncheck();
  await page.getByLabel("Other Deacon").check();
  await page.getByLabel("Visit location").fill("Alternate meeting place");
  await page.getByLabel("Date and time").fill("2099-09-15T12:30");
  await page.getByLabel("Visit notes").fill("Retain this draft");
  await page.evaluate(() => (window.failNext = true));
  await page.getByRole("button", { name: "Plan visit" }).click();
  await expect(page.getByRole("alert")).toContainText("retained");
  await expect(page.getByLabel("Visit notes")).toHaveValue("Retain this draft");
  await page.getByRole("button", { name: "Plan visit" }).click();
  await expect
    .poll(() => page.evaluate(() => window.destination))
    .toBe("/visitation/saved-fixture");
  const save = await page.evaluate(() => window.actions.at(-1));
  expect(save.deacons).toEqual(["d1", "d3"]);
  expect(save.location).toBe("Alternate meeting place");
  await page.goto(url + "/?mode=edit");
  await page.goto(url + "/?mode=new");
  await expect(page.getByLabel("Date and time")).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan visit" })).toBeDisabled();
  await page.getByLabel("Date and time").fill("2099-12-15T12:30");
  await page.getByLabel("Search people").fill("zzzz");
  await expect(page.getByText("No matches found.")).toBeVisible();
  await page.getByLabel("Search people").fill("First");
  await expect(
    page.getByRole("button", {
      name: "Choose a person: Other member",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("link", { name: "First member", exact: true })
      .locator("img"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose a person: First member", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "First member", exact: true }),
  ).toHaveAttribute("href", "/members/member");
  await expect(page.locator('input[name="personId"]')).toHaveValue("member");
  await expect(page.getByLabel("First Deacon", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Second Deacon", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Visit location")).toHaveValue("First home");
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByLabel("Search people").fill("Other");
  await expect(
    page
      .getByRole("link", { name: "Other member", exact: true })
      .locator("img"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Choose a person: Other member", exact: true })
    .click();
  await expect(
    page.getByLabel("First Deacon", { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel("Date and time")).toHaveValue(
    "2099-12-15T12:30",
  );
  await expect(page.getByLabel("Visit location")).toHaveValue("Other home");
  await page.goto(url + "/?mode=edit");
  await expect(
    page.getByRole("link", { name: "First Deacon", exact: true }),
  ).toHaveAttribute("href", "/members/deacon-person-1");
  await expect(page.getByLabel("Date and time")).toHaveValue(
    "2099-12-15T12:30",
  );
  await page.getByLabel("Visit location").fill("Updated location");
  await page.getByRole("button", { name: "Save changes" }).click();
  expect((await page.evaluate(() => window.actions.at(-1))).revision).toBe("2");
  await page.goto(url + "/?mode=deacon");
  await expect(
    page.getByRole("link", { name: "Fictional Pastor", exact: true }),
  ).toHaveAttribute("href", "/members/pastor-person");
  await expect(
    page.getByRole("link", { name: "Second Deacon", exact: true }),
  ).toHaveAttribute("href", "/members/deacon-person-2");
  await expect(
    page.getByRole("heading", { level: 1 }).getByRole("link"),
  ).toHaveAttribute("href", "/members/member");
  await expect(page.locator("a a, button a, a button, label a")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Visitation, 2 visits awaiting response" }),
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
    page.getByRole("button", { name: "Decline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).not.toHaveClass(/bg-\[var\(--app-brand\)\]/);
  await expect(
    page.getByRole("link", { name: "Visitation, 1 visits awaiting response" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByTestId("response")).toHaveText("accepted");
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Decline", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("link", { name: "Church meeting room", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=Church%20meeting%20room",
  );
  expect(
    await page.evaluate(() => window.demo.visit_recipients[0].decline_reason),
  ).toBe("");
  await page.goto(url + "/?mode=pastor");
  await expect(
    page.getByRole("link", { name: "Edit planned visit", exact: true }),
  ).toHaveAttribute("href", "/visitation/visit/edit");
  await expect(
    page.getByRole("button", { name: "Mark completed" }),
  ).toBeEnabled();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel planned visit" }).click();
  await expect(
    page.getByRole("link", { name: "Visitation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel planned visit" }),
  ).toHaveCount(0);
  await page.goto(url + "/?mode=pastor&complete=1");
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(
    page.getByRole("button", { name: "Mark completed" }),
  ).toHaveCount(0);
  for (const locale of ["en", "uk"]) {
    await page.goto(url + "/?mode=pastor&unavailable=1&locale=" + locale);
    await expect(page.locator('main a[href^="/members/"]')).toHaveCount(0);
    await expect(
      page.getByText(
        locale === "uk" ? "Профіль недоступний" : "Profile unavailable",
        { exact: true },
      ),
    ).toHaveCount(4);
  }
  await page.goto(url + "/?mode=groups");
  await expect(
    page.getByRole("link", { name: "Active Member", exact: true }),
  ).toHaveAttribute("href", "/members/member");
  await expect(
    page.getByRole("link", { name: "Archived Member", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "First Deacon", exact: true }),
  ).toHaveAttribute("href", "/members/deacon-person-1");
  await expect(page.locator("a a, button a, a button, label a")).toHaveCount(0);
  const createGroup = page
    .locator("form")
    .filter({
      has: page.getByRole("button", { name: "Create group", exact: true }),
    });
  await createGroup.getByLabel("Group name").fill("New fixture group");
  await createGroup.getByLabel("First deacon").selectOption("d2");
  await expect(
    createGroup.getByText("Profile unavailable", { exact: true }),
  ).toBeVisible();
  await expect(createGroup.getByRole("link")).toHaveCount(0);
  await createGroup
    .getByRole("button", { name: "Create group", exact: true })
    .click();
  expect((await page.evaluate(() => window.actions.at(-1))).firstDeacon).toBe(
    "d2",
  );
  await expect(createGroup.getByLabel("First deacon")).toHaveValue("");
  for (const width of [320, 375, 460])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(url + "/?missing=1&locale=uk");
      await page.locator('input[name="time"]').fill("2099-12-15T12:30");
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        document.documentElement.dataset.textSize = "large";
      }, theme);
      await expect(
        page.getByRole("button", { name: "Запланувати відвідування" }),
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
      await page.goto(url + "/?mode=new");
      await page.locator('input[name="time"]').fill("2099-12-15T12:30");
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        document.documentElement.dataset.textSize = "large";
      }, theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: resolve(dir, `picker-${width}-${theme}.png`),
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
  // Exercise the real menu without touching authenticated accounts.
  for (const locale of ["en", "uk"])
    for (const theme of ["light", "dark"])
      for (const [width, height] of [[320, 440], [320, 568], [390, 664], [390, 812], [393, 852], [430, 932], [460, 1000], [568, 320], [844, 390], [1280, 812]]) {
        await page.setViewportSize({ width, height });
        await page.goto(url + "/?mode=pastor&locale=" + locale);
        await page.evaluate((theme) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.dataset.themePreference = theme;
          document.documentElement.dataset.textSize = "large";
        }, theme);
        const trigger = page.getByRole("button", { name: locale === "uk" ? "Меню" : "Menu", exact: true });
        await trigger.click();
        const menu = page.getByRole("dialog");
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("link")).toHaveCount(1);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
        expect(await page.locator("#root").evaluate((root) => root.inert)).toBe(true);
        expect(await menu.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        const fit = await menu.evaluate((node) => ({height:node.clientHeight,scroll:node.scrollHeight,children:[...node.children].map(c=>({class:c.className,height:c.getBoundingClientRect().height}))}));
        if(fit.scroll>fit.height) console.log(JSON.stringify({width,height,locale,theme,fit}));
        expect(fit.scroll <= fit.height).toBe(true);
        const profile = menu.locator('a[href], button').first();
        await expect(profile).toBeFocused();
        expect(await profile.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("none");
        const closeBounds = await menu.getByRole("button", { name: locale === "uk" ? "Закрити меню" : "Close menu" }).boundingBox();
        expect(closeBounds.width).toBeGreaterThanOrEqual(56);
        expect(closeBounds.height).toBeGreaterThanOrEqual(56);
        await page.keyboard.press("Shift+Tab");
        await expect(menu.getByRole("button").last()).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(menu.locator('a[href], button').first()).toBeFocused();
        const language = menu.getByRole("combobox");
        await language.focus();
        expect(await language.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("none");
        expect(await language.locator("..").evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
        await page.screenshot({ path: resolve(dir, `menu-${locale}-${theme}-${width}-${height}.png`), animations: "disabled" });
        const bounds = await menu.boundingBox();
        expect(Math.round(bounds.x + bounds.width)).toBe(width);
        expect(bounds.y).toBe(0);
        for (const button of await menu.getByRole("button").all()) {
          expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
        }
        await expect(menu.getByRole("button", { name: /System|Системний/ })).toHaveCount(0);
        const light = menu.getByRole("button", { name: locale === "uk" ? "Світла тема" : "Light theme", exact: true });
        const dark = menu.getByRole("button", { name: locale === "uk" ? "Темна тема" : "Dark theme", exact: true });
        await light.click();
        await expect(light).toHaveAttribute("aria-pressed", "true");
        await dark.click();
        await expect(dark).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => localStorage.getItem("directory-theme"))).toBe("dark");
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(await page.locator("#root").evaluate((root) => root.inert)).toBe(false);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
        await trigger.click();
        await page.mouse.click(2, 2);
        await expect(menu).toHaveCount(0);
      }
  for (const role of ["member", "editor", "admin"]) {
    await page.goto(url + "/?mode=deacon&role=" + role);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link")).toHaveCount(role === "member" ? 3 : 4);
    await expect(menu).toHaveCount(0);
  }
  await page.goto(url + "/?mode=pastor");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Language", exact: true })).toHaveValue("en");
  await page.getByRole("dialog").getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.signedOut)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.destination)).toBe("/login");
  console.log(
    "Visitation/admin UI passed: canonical member links, unavailable identities, separate selection controls, shared BackButton, group selections, recipient defaults/overrides, save failure/recovery, editing, response changes, Ukrainian, light/dark, large text, 320/375/460px.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
