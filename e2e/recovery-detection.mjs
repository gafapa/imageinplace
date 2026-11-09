import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.TEST_URL || 'http://127.0.0.1:4180';
const browser = await chromium.launch();
async function setup() {
 const context=await browser.newContext({locale:'es-ES',viewport:{width:1440,height:900}});
 await context.addInitScript(()=>{localStorage.setItem('imageinplace-welcome-dismissed','true');localStorage.setItem('imageinplace-locale','es')});
 const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());await page.goto(origin);
 const fixture={name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.fillStyle='#ffffee';x.fillRect(0,0,160,100);return c.toDataURL().split(',')[1]}),'base64')};
 return {context,page,fixture};
}
const readSession=page=>page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('imageinplace',1);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('session');const get=tx.objectStore('session').get('current');get.onsuccess=()=>resolve(get.result?{savedAt:get.result.savedAt,count:get.result.count}:null);get.onerror=reject;tx.oncomplete=()=>db.close()};request.onerror=reject}));
const importImage=async(page,fixture)=>{await page.locator('input[type=file]').first().setInputFiles(fixture);await page.locator('.image-card-edit').first().waitFor()};
try {
 // An older encoder must not store after opt-out, or overtake a newer edit.
 const {context,page,fixture}=await setup();
 await importImage(page,fixture);
 await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{window.testDigestStarted=true;await new Promise(resolve=>setTimeout(resolve,600));return original(...args)}});
 await page.locator('.project-menu summary').click();
 await page.getByRole('checkbox',{name:/Recordar mis imágenes/}).check();
 await page.waitForFunction(()=>window.testDigestStarted);
 await page.getByRole('checkbox',{name:/Recordar mis imágenes/}).uncheck();
 await page.waitForTimeout(2400);
 assert.equal(await readSession(page),null,'No write is allowed after opt-out during encoding');
 await page.getByRole('checkbox',{name:/Recordar mis imágenes/}).check();
 await page.waitForTimeout(3200);
 const saved=await readSession(page);assert.ok(saved);
 const second=await context.newPage();second.on('dialog',dialog=>dialog.accept());await second.goto(origin);await importImage(second,{...fixture,name:'second-tab.png'});
 await second.locator('.project-menu summary').click();
 await second.getByRole('status').filter({hasText:'Esta pestaña no está guardando la sesión.'}).waitFor();
 await second.waitForTimeout(3000);assert.deepEqual(await readSession(second),saved,'A second tab must not replace the writer snapshot');
 await second.getByRole('checkbox',{name:/Recordar mis imágenes/}).uncheck();
 await page.getByRole('checkbox',{name:/Recordar mis imágenes/}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.recovery-toggle input').checked);
 await page.waitForTimeout(2400);assert.equal(await readSession(page),null,'Cross-tab opt-out removes stored images');
 await second.close();
 await page.getByRole('combobox').selectOption('en');await page.waitForFunction(()=>document.documentElement.lang==='en');
 assert.equal(await page.locator('.offline-status').innerText(),'Ready to use offline.');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const targets=await page.locator('.gallery-header-actions > button, .gallery-header-actions .project-menu summary, .language-select select, .preview-zoom button').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
 assert.ok(targets.every(({width,height})=>width>=44&&height>=44),'Header and zoom touch targets must be at least 44 px');
 await context.close();
 // Return a deterministic worker result after a transform has changed the coordinate system.
 const sample=await setup();
 await sample.page.evaluate(()=>{
  const NativeWorker=window.Worker;
  window.Worker=class {
   constructor(url,options){if(!String(url).includes('aiWorker'))return new NativeWorker(url,options)}
   postMessage({id}){window.testInferenceStarted=true;setTimeout(()=>this.onmessage?.({data:{id,result:{faces:[{x:.2,y:.2,width:.2,height:.2}]}}}),800)}
   terminate(){}
  };
 });
 await importImage(sample.page,sample.fixture);await sample.page.locator('.image-card-edit').first().click();
 await sample.page.getByRole('button',{name:'Ocultar',exact:true}).click();
 await sample.page.getByRole('button',{name:'Detectar caras',exact:true}).click();
 await sample.page.waitForFunction(()=>window.testInferenceStarted);
 await sample.page.getByRole('button',{name:'Girar',exact:true}).click();
 await sample.page.getByRole('button',{name:'Derecha',exact:true}).first().click();
 await sample.page.waitForTimeout(1100);
 await sample.page.getByRole('button',{name:'Ocultar',exact:true}).click();
 assert.equal(await sample.page.locator('.privacy-area-tabs button').count(),0);

 await sample.context.close();
 console.log('Audit regressions passed: opt-out during encoding, exclusive tab ownership, cross-tab deletion, translated offline status, stale detection.');
} finally {await browser.close()}
