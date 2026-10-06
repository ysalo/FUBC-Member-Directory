// Synthetic backend browser acceptance. Run against local export or a Preview:
// PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs FUBC_SITE_URL=http://localhost:4173 node tests/audit-browser.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const site=process.env.FUBC_SITE_URL??'http://localhost:4173', actor='40000000-0000-4000-8000-000000000001';
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:actor,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const subject='60000000-0000-4000-8000-000000000003';
const actions=Array.from({length:27},(_,i)=>({id:`70000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,actor_id:actor,actor_name:'Audit Admin',action:i===1?'directory.replace':i===2?'legacy.fixture':'save_person',restoration:i===1?'irreversible':i===2?'legacy':'supported',schema_version:i===2?0:1,created_at:`2026-10-06T12:${String(59-i).padStart(2,'0')}:00Z`,change_count:i===2?0:1,original_action_id:null,reason:null}));
let cases=0;
try {
 for(const appearance of ['light','dark']) for(const width of [390,1023,1024,1440]) for(const role of ['admin','editor']) {
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],calls=[];let conflict=false;
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await page.addInitScript(({actor,token})=>{localStorage.setItem('sb-lxrrjrezpdzyqkevgwyx-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:actor,aud:'authenticated',role:'authenticated',email:'fixture@example.com',app_metadata:{},user_metadata:{}}}));window.Notification.requestPermission=()=>{window.__notificationCalls=(window.__notificationCalls??0)+1;return Promise.resolve('denied');};},{actor,token});
  await page.route('https://lxrrjrezpdzyqkevgwyx.supabase.co/**',async route=>{
   const url=new URL(route.request().url()),name=url.pathname.split('/').at(-1),args=route.request().postDataJSON()??{};let body=[],status=200;
   if(name==='mobile_contract_version')body='expo-directory-v3';
   else if(name==='current_account')body=[{id:actor,person_id:null,display_name:'Audit Admin',status:'active',role,leadership_ministry:null,revision:1}];
   else if(url.pathname==='/auth/v1/user')body={id:actor,email:'fixture@example.com'};
   else if(name==='preferences')body=[{appearance,locale:'en'}];
   else if(name==='people')body=[{id:subject,name:'Example Member',first_name:'Example',last_name:'Member',gender:'male',revision:1,photo_path:null,membership_group_id:null,archived_at:null,phone:null,email:null}];
   else if(name==='remove-member'||name==='delete-member'){calls.push({name,args});body={status:'completed',deletedPersonId:subject,deletedAccountId:null,deletedVisitCount:0};}
   else if(name==='audit_history') {calls.push({name,args});body={items:args.p_filters?.action?actions.filter(x=>x.action===args.p_filters.action):actions.slice(args.p_offset,args.p_offset+args.p_limit),total:args.p_filters?.action?1:27};}
   else if(name==='audit_action_details') {calls.push({name,args});body={items:[{id:1,entity:'people',record_key:{id:subject},before_data:{id:subject,name:'Example Member',phone:'2535551000'},after_data:{id:subject,name:'Example Member',phone:'2535552000'},subject_ids:[subject]}],total:1};}
   else if(name==='preview_audit_rollback') {calls.push({name,args});body={available:!conflict,reasonCode:conflict?'conflict':null,reason:conflict?'Conflicting later changes block the whole rollback.':null,photoLimitations:true,conflicts:conflict?[{entity:'people',key:{id:subject},field:'phone',code:'field_changed',reason:'This field changed after the selected action.'}]:[],changes:[{entity:'people',key:{id:subject},fields:['phone'],current:{phone:'2535552000'},proposed:{phone:'2535551000'}}],total:1};}
   else if(name==='execute_audit_rollback'){calls.push({name,args});conflict=true;status=409;body={code:'40001',message:'Conflicting later changes block the whole rollback.',details:'phone'};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`${site}/manage`);
  if(role==='admin'&&width>=1024) {
   await page.getByRole('button',{name:/Audit history/}).click();await page.getByText('Member and group changes, newest first',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('26–27 / 27',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Previous',exact:true}).click();await page.getByText('1–25 / 27',{exact:true}).waitFor();
   await page.getByLabel('Action type',{exact:true}).fill('directory.replace');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.getByRole('button',{name:/directory.replace/}).waitFor();assert.ok(calls.some(c=>c.name==='audit_history'&&c.args.p_filters.action==='directory.replace'));
   await page.getByRole('button',{name:/directory.replace/}).click();assert.equal(await page.getByRole('button',{name:'Preview rollback',exact:true}).count(),0);
   await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('button',{name:/legacy.fixture/}).click();assert.equal(await page.getByRole('button',{name:'Preview rollback',exact:true}).count(),0);
   await page.getByRole('button',{name:/save_person/}).first().click();await page.getByText('Before',{exact:true}).waitFor();await page.getByText('After',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Preview rollback',exact:true}).click();await page.getByText(/Previous photos are lost/).waitFor();
   if(width===1440&&appearance==='light')await page.screenshot({path:'/tmp/fubc-audit-preview-light.png',fullPage:true});
   assert.equal(await page.getByRole('button',{name:'Confirm rollback',exact:true}).isDisabled(),true);
   await page.getByLabel('Reason for rollback',{exact:true}).fill('Correct mistaken phone');await page.getByRole('button',{name:'Confirm rollback',exact:true}).click();await page.getByText(/This field changed after the selected action/).waitFor();
   assert.equal(calls.find(c=>c.name==='execute_audit_rollback').args.p_reason,'Correct mistaken phone');
   await page.goto(`${site}/manage/member/${subject}/delete`);await page.getByText('Remove this member?',{exact:true}).waitFor();
   await page.getByLabel('Member name',{exact:true}).fill('Example Member');await page.getByRole('button',{name:'Remove member',exact:true}).click();await page.waitForURL(`${site}/manage`);
   assert.equal(calls.filter(c=>c.name==='remove-member').length,1);assert.equal(calls.filter(c=>c.name==='delete-member').length,0);
   await page.goto(`${site}/manage/member/${subject}/delete`);await page.getByRole('radio',{name:/Permanent deletion/}).click();await page.getByText('Delete member permanently?',{exact:true}).waitFor();
   await page.getByLabel('Member name',{exact:true}).fill('Example Member');await page.getByRole('button',{name:'Delete member permanently',exact:true}).click();await page.waitForURL(`${site}/manage`);
   assert.equal(calls.find(c=>c.name==='delete-member').args.permanent,true);
  } else {
   await page.getByText('Keep the directory accurate and access up to date.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Audit history/}).count(),0);
   await page.goto(`${site}/manage/audit`);await page.waitForURL(`${site}/manage`).catch(async error=>{console.log('ROUTE DEBUG',width,role,page.url(),errors,await page.locator('body').innerText());throw error;});assert.equal(calls.filter(c=>c.name.startsWith('audit_')||c.name.includes('rollback')).length,0);
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.__notificationCalls??0),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
  await context.close();cases++;console.log(`PASS ${appearance} ${width}px ${role}`);
 }
} finally {await browser.close();}
console.log(`${cases} audit browser cases passed (synthetic backend; no physical native/live OAuth claim).`);
