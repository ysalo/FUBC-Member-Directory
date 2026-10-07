import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

// Exercise actual native components and their event handlers. The platform
// boundary cannot present a Modal; the native page must still open.
const require = createRequire(import.meta.url);
const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const imports = new Map([
  ['react/jsx-runtime', pathToFileURL(require.resolve('react/jsx-runtime')).href],
  ['react-native', dataModule(`export const Pressable='Pressable',View='View',ScrollView='ScrollView'; export const StyleSheet={create:x=>x,hairlineWidth:1}; export function Modal(){throw new Error('Native modal host unavailable');}`)],
  ['expo-router', dataModule(`export const Stack='Stack'; export const useRouter=()=>globalThis.__nativeAboutFixture.router;`)],
  ['react-native-safe-area-context', dataModule(`export const SafeAreaView='SafeAreaView';`)],
  ['expo-constants', dataModule(`export default {expoConfig:{version:${JSON.stringify(version)}}};`)],
  ['@/features/accessibility/app-text', dataModule(`export const Text='Text';`)],
  ['@/features/appearance/AppearanceProvider', dataModule(`export const useAppearance=()=>({palette:{background:'#111315',text:'#F4F1EA',secondaryText:'#B2B4B7',line:'#34383D',accent:'#FF8052',surface:'#1A1D20'}});`)],
  ['@/features/localization/LocalizationProvider', dataModule(`export const useLocalization=()=>({locale:globalThis.__nativeAboutFixture.locale});`)],
]);
async function load(relative) {
  const source = await readFile(new URL(`../src/${relative}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const resolved = compiled.replace(/from (["'])(.*?)\1/g, (_, quote, specifier) => {
    assert.ok(imports.has(specifier), `Explicit native test dependency: ${specifier}`);
    return `from ${JSON.stringify(imports.get(specifier))}`;
  });
  const url = dataModule(resolved);
  return { url, exports: await import(url) };
}
const copy = await load('features/menu/menu-copy.ts');
imports.set('./menu-copy', copy.url);
const content = await load('features/menu/AboutContent.tsx');
imports.set('@/features/menu/AboutContent', content.url);
const { AboutLink } = (await load('features/menu/AboutLink.tsx')).exports;
const AboutRoute = (await load('app/menu/about.tsx')).exports.default;
const MenuLayout = (await load('app/menu/_layout.tsx')).exports.default;
function children(element) {
  if (element == null || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(children)];
}
function text(element) {
  if (element == null || typeof element === 'boolean') return '';
  if (typeof element !== 'object') return String(element);
  return [element.props?.children].flat(Infinity).map(text).join('');
}
for (const locale of ['en', 'uk']) {
  test(`native About opens content, returns and reopens without a modal (${locale})`, () => {
    const calls = [];
    globalThis.__nativeAboutFixture = {locale,router:{push:path=>calls.push(['push',path]),canGoBack:()=>true,back:()=>calls.push(['back']),replace:path=>calls.push(['replace',path])}};
    assert.equal(MenuLayout().props.screenOptions.headerShown, false);
    const link = AboutLink({label:copy.exports.menuCopy[locale].about,onOpen:()=>assert.fail('Native must navigate, not open browser dialog')});
    for (let attempt=0; attempt<2; attempt++) {
      link.props.onPress();
      const screen = AboutRoute();
      const page = screen.type(screen.props);
      assert.equal(page.type, 'SafeAreaView');
      assert.deepEqual(page.props.edges, ['top', 'bottom']);
      assert.ok(text(page).includes(`${copy.exports.menuCopy[locale].version} ${version}`));
      assert.ok(text(page).includes(copy.exports.menuCopy[locale].licenses));
      const done = children(page).find(e=>e.type==='Pressable'&&text(e)===copy.exports.menuCopy[locale].done);
      assert.ok(done, 'Native About has a reachable Done action');
      done.props.onPress();
    }
    assert.deepEqual(calls, [['push','/menu/about'],['back'],['push','/menu/about'],['back']]);
  });
  test(`direct native About returns to Menu without history (${locale})`, () => {
    const calls = [];
    globalThis.__nativeAboutFixture = {locale,router:{canGoBack:()=>false,replace:path=>calls.push(path),back:()=>assert.fail('No previous route')}};
    const screen=AboutRoute();
    screen.props.onClose();
    assert.deepEqual(calls, ['/menu']);
  });
}
