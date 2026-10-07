// Synthetic Menu acceptance; no real account mutations. See docs/web-app-release.md.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const site=process.env.FUBC_SITE_URL??'http://localhost:4173',out=process.env.FUBC_BROWSER_OUT;
if(out)await mkdir(out,{recursive:true});
const actor='40000000-0000-4000-8000-000000000001',person='60000000-0000-4000-8000-000000000001';
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:actor,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
let cases=0;
try {
for(const width of [320,390,1023,1024,1440]) for(const appearance of ['light','dark']) {
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],unexpected=[];let savedAppearance=appearance,failSignout=appearance==='light';
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.addInitScript(({actor,token})=>{if(!localStorage.getItem('sb-lxrrjrezpdzyqkevgwyx-auth-token'))localStorage.setItem('sb-lxrrjrezpdzyqkevgwyx-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:actor,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}}));window.__notificationCalls=0;if(window.Notification)window.Notification.requestPermission=()=>{window.__notificationCalls++;return Promise.resolve('denied')};},{actor,token});
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(!url.hostname.endsWith('supabase.co'))return route.continue();
  const path=url.pathname.split('/').at(-1),method=request.method();let body=[],status=200;
  if(path==='mobile_contract_version')body='expo-directory-v3';
  else if(path==='current_account')body=[{id:actor,person_id:person,display_name:'Synthetic Administrator',status:'active',role:'admin',revision:1}];
  else if(path==='user')body={id:actor,email:'fixture@example.invalid'};
  else if(path==='preferences'){if(method==='GET')body=request.headers().accept?.includes('object')?{appearance:savedAppearance}:[{appearance:savedAppearance}];else {savedAppearance=(Array.isArray(request.postDataJSON())?request.postDataJSON()[0]:request.postDataJSON()).appearance;body=null;}}
  else if(path==='record_account_use')body=null;
  else if(path==='member_profile_details'||path==='directory_active_members')body=[];
  else if(path==='member_family')body={memberId:request.postDataJSON().p_person_id,revision:0,parents:[],spouse:null,children:[],siblings:[]};
  else if(path==='people') {const p={id:person,name:'Anna Example',first_name:'Anna',last_name:'Example',gender:'female',revision:1,photo_path:null,membership_group_id:null,archived_at:null};body=request.headers().accept?.includes('object')?p:[p];}
  else if(path==='management_summary')body={members:1,groups:0,pendingAccounts:0};
  else if(path==='management_page')body={items:[],total:0,offset:0,limit:50};
  else if(path==='logout'){if(failSignout){status=400;body={message:'Synthetic sign-out failure'};}else body={};}
  else if(method!=='GET'&&method!=='HEAD'&&method!=='OPTIONS'){unexpected.push(path);status=500;body={message:'Blocked unexpected write'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto(`${site}/menu`);
 await page.getByRole('radio',{name:'English',exact:true}).waitFor();await page.getByRole('button',{name:/Anna Example/}).waitFor();if(out&&width===1440)await page.screenshot({path:`${out}/menu-${width}-${appearance}-en.png`,fullPage:true});
 await page.getByRole('radio',{name:'Dark',exact:true}).check();
 await page.getByRole('radio',{name:'Light',exact:true}).focus();await page.keyboard.press('ArrowRight');
 assert.equal(await page.getByRole('radio',{name:'Dark',exact:true}).isChecked(),true,'arrow key changes appearance');
 await page.getByRole('radio',{name:'Large',exact:true}).check();
 await page.getByRole('radio',{name:'Українська',exact:true}).check();
 await page.reload();await page.getByRole('radio',{name:'Великий',exact:true}).waitFor();
 assert.equal(await page.getByRole('radio',{name:'Великий',exact:true}).isChecked(),true);
 assert.equal(await page.getByRole('radio',{name:'Українська',exact:true}).isChecked(),true);
 await page.waitForFunction(()=>document.documentElement.style.colorScheme==='dark');
 await page.getByRole('radio',{name:appearance==='light'?'Світлий':'Темний',exact:true}).check();
 for(const radio of await page.getByRole('radio').all()){const b=await radio.locator('..').boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=width+1&&b.height>=44,'choice bounds and target');}
 if(out)await page.screenshot({path:`${out}/menu-${width}-${appearance}-uk-large.png`,fullPage:true});
 const about=page.getByRole('button',{name:'Про застосунок',exact:true});await about.click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true,'initial dialog focus');assert.ok(await dialog.getByText(`Версія ${version}`,{exact:true}).isVisible());
 for(let i=0;i<4;i++)await page.keyboard.press(i%2?'Shift+Tab':'Tab');
 assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true,'dialog traps focus');
 const b=await dialog.boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=900,'dialog bounds');
 if(out)await page.screenshot({path:`${out}/about-${width}-${appearance}.png`});if(width===320){await page.setViewportSize({width,height:480});const small=await dialog.boundingBox();assert.ok(small.y>=0&&small.y+small.height<=480,'short viewport dialog');await dialog.getByText('© 2015–дотепер Ionic · © 2015 Joel Arvidsson',{exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Готово',exact:true}).waitFor();if(out)await page.screenshot({path:`${out}/about-short-${appearance}.png`});await page.setViewportSize({width,height:900});}
 await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await about.evaluate(e=>e===document.activeElement),true,'dialog restores focus');
 await about.click();await page.mouse.click(2,2);assert.equal(await dialog.isVisible(),false,'backdrop dismissal');await about.click();await page.getByRole('button',{name:'Готово',exact:true}).click();
 await page.getByRole('radio',{name:'English',exact:true}).check();
 await page.getByRole('button',{name:/Advanced/}).click();await page.getByRole('button',{name:'Delete account',exact:true}).click();await page.waitForURL('**/account/delete');assert.equal(await page.getByRole('button',{name:'Delete account permanently',exact:true}).isEnabled(),false);await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:/Advanced/}).waitFor();
 await page.getByRole('button',{name:/Advanced/}).click();assert.equal(await page.getByRole('button',{name:'Delete account',exact:true}).count(),0);
 await page.getByRole('button',{name:'Show install steps',exact:true}).click();assert.ok(await page.getByText(/Open the browser menu and choose Install app/).isVisible());

 await page.getByRole('button',{name:/Anna Example/}).click();await page.waitForURL(`**/members/${person}`);
 await page.goto(`${site}/manage`);await page.getByRole('link',{name:/Deacon schedule/}).waitFor();
 if(out)await page.screenshot({path:`${out}/manage-${width}-${appearance}.png`,fullPage:true});
 await page.getByRole('link',{name:/Deacon schedule/}).click();await page.waitForURL('**/manage/schedule');await page.goto(`${site}/manage`);await page.getByRole('link',{name:/Ministries/}).click();await page.waitForURL('**/manage/ministries');
 await page.goto(`${site}/menu`);await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByText('Continue with Google',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.equal(await page.evaluate(()=>window.__notificationCalls),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 cases++;await context.close();
}
console.log(`Menu browser acceptance: ${cases} responsive/theme cases passed`);
} finally {await browser.close();}
