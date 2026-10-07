// Synthetic authenticated acceptance; every backend request is intercepted.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = process.env.FUBC_BROWSER_ENGINE==='webkit' ? await webkit.launch({headless:true}) : await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const site=process.env.FUBC_SITE_URL??'http://localhost:4173';
const out=process.env.FUBC_BROWSER_OUT??'/tmp/deacon-care-browser';await mkdir(out,{recursive:true});
const actor='40000000-0000-4000-8000-000000000001',deacon='60000000-0000-4000-8000-000000000001',member='60000000-0000-4000-8000-000000000002',relative='60000000-0000-4000-8000-000000000003',group='50000000-0000-4000-8000-000000000001';
const people=[{id:deacon,name:'Daniel Deacon',first_name:'Daniel',last_name:'Deacon',gender:'male',membership_group_id:null},{id:member,name:'Anna Member',first_name:'Anna',last_name:'Member',gender:'female',membership_group_id:group},{id:relative,name:'Peter Relative',first_name:'Peter',last_name:'Relative',gender:'male',membership_group_id:null}].map(p=>({...p,revision:1,photo_path:null,archived_at:null}));
const storageKey=`sb-${process.env.FUBC_SUPABASE_REF??'example'}-auth-token`;
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:actor,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
let cases=0;
try {for(const width of [390,1440])for(const leadership of ['deacon','pastor']) {
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1024}),page=await context.newPage(),errors=[],unexpected=[];
 let note={body:'Prayer for recovery',revision:1},family={memberId:member,revision:0,parents:[],spouse:null,children:[],siblings:[]};
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.addInitScript(({actor,token,storageKey})=>{localStorage.setItem(storageKey,JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:actor,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}}));window.__notificationCalls=0;if(window.Notification)window.Notification.requestPermission=()=>{window.__notificationCalls++;return Promise.resolve('denied')};},{actor,token,storageKey});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(!url.hostname.endsWith('supabase.co'))return route.continue();
  const path=url.pathname.split('/').at(-1),method=req.method(),payload=method==='POST'?req.postDataJSON():null;let body=[],status=200;
  const headers={'Access-Control-Allow-Origin':new URL(site).origin,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'};
  if(method==='OPTIONS')return route.fulfill({status:204,headers});
  if(path==='mobile_contract_version')body='expo-directory-v3';
  else if(path==='current_account')body=[{id:actor,person_id:deacon,display_name:'Daniel Deacon',status:'active',role:'member',leadership_ministry:leadership,revision:1}];
  else if(path==='user')body={id:actor,email:'fixture@example.invalid'};
  else if(path==='preferences')body=[];
  else if(path==='record_account_use')body=null;
  else if(path==='people') {const filter=url.searchParams.get('id');body=filter?.startsWith('eq.')?people.find(p=>p.id===filter.slice(3)):filter?.startsWith('in.')?people.filter(p=>filter.includes(p.id)):people;if(url.searchParams.has('membership_group_id'))body=people.filter(p=>p.membership_group_id===group);}
  else if(path==='deacon_groups')body=url.searchParams.has('id')?{id:group,name:'Group one',kind:'membership'}:[{id:group,name:'Group one',kind:'membership'}];
  else if(path==='deacon_group_deacons')body=[{group_id:group,person_id:deacon,slot:1}];
  else if(path==='ministry_accounts')body=[{id:actor,person_id:deacon,leadership_ministry:leadership}];
  else if(path==='person_leadership_ministries')body=url.searchParams.has('person_id')?[{person_id:deacon,leadership_ministry:leadership}]:[];
  else if(path==='member_profile_details')body=[{person_id:member,address:'Seattle',birth_date:'1990-05-06'}];
  else if(path==='directory_active_members')body=people.map(p=>({...p,ministry:'',ministry_uk:'',phone:null,leadership_ministry:p.id===deacon?leadership:null,is_orphan:false,is_widow:false}));
  else if(path==='can_edit_group_member')body=leadership==='deacon'&&payload.p_person_id===member;
  else if(path==='member_note_access'||path==='can_write_member_note')body=false;
  else if(path==='deacon_member_note_access')body=leadership==='deacon';
  else if(path==='member_notes')body=url.searchParams.get('select')==='person_id'?[]:null;
  else if(path==='deacon_member_notes')body=leadership==='deacon'?(url.searchParams.get('select')==='person_id'?(note?[{person_id:member}]:[]):note):[];
  else if(path==='save_deacon_member_note'){note={body:payload.p_body,revision:(note?.revision??0)+1};body=null;}
  else if(path==='remove_deacon_member_note'){note=null;body=null;}
  else if(path==='member_family')body={...family,memberId:payload.p_person_id};
  else if(path==='save_member_family'){family={...family,revision:1,spouse:payload.p_spouse_id?{id:relative,name:'Peter Relative',archived:false,photoPath:null}:null};body=family;}
  else if(path==='group_birthdays'||path==='group_birthday_notification_preferences')body=[];
  else if(path==='group_summary_counts')body=[{total:1,orphans:0,widows:0}];
  else if(method!=='GET'&&method!=='HEAD'){unexpected.push(path);status=500;body={message:'Unexpected write blocked'};}
  await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto(`${site}/members/${member}`);await page.getByText('Anna Member',{exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Save to Contacts',exact:true}).count(),0);

 if(leadership==='deacon') {
  const toggle=page.getByTestId('deacon-notes-toggle');await toggle.waitFor();
  assert.ok(await toggle.evaluate((el)=>{const headings=[...document.querySelectorAll('[role=heading]')];return headings.every(h=>!(el.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING));}),'deacon notes are below profile sections');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await toggle.click();const section=page.getByTestId('deacon-notes-section');assert.equal(await section.getByText('Only for this group’s deacons. Prayer needs and care reminders.',{exact:true}).count(),0);await section.getByText('Prayer for recovery',{exact:true}).waitFor();
  const expandedToggle=page.getByTestId('deacon-notes-toggle');assert.equal(await expandedToggle.getAttribute('aria-expanded'),'true');assert.equal(await section.getByText('Collapse',{exact:true}).count(),0);
  await expandedToggle.click();assert.equal(await page.getByTestId('deacon-notes-section').count(),0);assert.equal(await page.getByTestId('deacon-notes-toggle').getAttribute('aria-expanded'),'false');
  await page.getByTestId('deacon-notes-toggle').click();await section.getByText('Prayer for recovery',{exact:true}).waitFor();
  await page.screenshot({path:`${out}/member-${width}.png`,fullPage:true});
  await section.getByRole('button',{name:'Edit note',exact:true}).click();await page.getByRole('textbox',{name:'Deacon note',exact:true}).fill('Prayer and follow up');assert.equal(await page.getByTestId('deacon-notes-toggle').isDisabled(),true);
  await section.getByRole('button',{name:'Save note',exact:true}).click();await section.getByText('Prayer and follow up',{exact:true}).waitFor();
  await section.getByRole('button',{name:'Remove note',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.ok(note);
  await section.getByRole('button',{name:'Remove note',exact:true}).click();await page.getByRole('button',{name:'Remove note',exact:true}).last().click();await section.getByRole('button',{name:'Add note',exact:true}).waitFor();
  await section.getByRole('button',{name:'Add note',exact:true}).click();await page.getByRole('textbox',{name:'Deacon note',exact:true}).fill('Prayer for family');await section.getByRole('button',{name:'Save note',exact:true}).click();await section.getByText('Prayer for family',{exact:true}).waitFor();
  await page.goto(`${site}/manage/member/${member}/family`);await page.getByRole('button',{name:'Add: Spouse',exact:true}).click();await page.getByRole('radio',{name:'Peter Relative',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Save family',exact:true}).last().click();await page.waitForURL(`**/members/${member}`);assert.equal(family.spouse.id,relative);
 } else {await page.waitForLoadState('networkidle');assert.equal(await page.getByTestId('deacon-notes-toggle').count(),0);}
 await page.goto(`${site}/groups/${group}`);await page.getByText('Anna Member',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
 assert.equal(await page.getByTestId('deacon-note-indicator').count(),leadership==='deacon'?1:0);
 if(leadership==='deacon') {await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByRole('checkbox',{name:'Has deacon notes',exact:true}).click();await page.getByText('Anna Member',{exact:true}).waitFor();}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 await page.screenshot({path:`${out}/group-${width}-${leadership}.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>window.__notificationCalls),0);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 await context.close();cases++;
}console.log(`Passed ${cases} deacon/pastor mobile/desktop cases`);}finally{await browser.close();}
