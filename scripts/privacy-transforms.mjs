import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const origin = process.env.TEST_URL || 'http://127.0.0.1:4180';
for (const browserType of [chromium, webkit]) {
 const browser = await browserType.launch();
 try {
  const page = await browser.newPage({ locale: 'es-ES' });
  page.on('dialog', dialog => dialog.accept());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('imageinplace-welcome-dismissed','true');localStorage.setItem('imageinplace-locale','es')});
  await page.goto(origin);
  const bytes=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;
   const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,400,240);context.fillStyle='#f00';context.fillRect(80,48,80,48);
   return canvas.toDataURL().split(',')[1];
  });
  await page.locator('input[type=file]').first().setInputFiles({name:'sensitive-marker.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
  await page.locator('.image-card-edit').first().click();
  const editor=page.locator('.individual-editor');
  const tool=name=>editor.getByRole('button',{name,exact:true}).click();
  await tool('Ocultar');await tool('Nueva zona centrada');await tool('Tapar');
  for(const [label,value] of [['Horizontal',20],['Vertical',20],['Ancho',20],['Alto',20]]){
   const slider=editor.getByRole('slider',{name:new RegExp('^'+label)});
   await slider.press('Home');
   for(let step=Number(await slider.getAttribute('min'));step<value;step++)await slider.press('ArrowRight');
  }
  const redPixels=()=>editor.locator('.canvas-wrap canvas').evaluate(canvas=>{
   const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let red=0;for(let i=0;i<data.length;i+=4)if(data[i]>200&&data[i+1]<50&&data[i+2]<50)red++;
   return red;
  });
  assert.equal(await redPixels(),0,'The marker must be covered initially');
  await tool('Girar');await tool('Derecha');assert.equal(await redPixels(),0,'Clockwise rotation must not reveal masked content');
  await tool('Reflejar');assert.equal(await redPixels(),0,'Reflection must not reveal masked content');
  await tool('Izquierda');assert.equal(await redPixels(),0,'Counter-clockwise rotation must preserve the zone');
  await tool('Recortar');await tool('Cuadrado');assert.equal(await redPixels(),0,'Cropping must preserve the hidden subject');
  await tool('Libre');assert.equal(await redPixels(),0,'Removing the crop must restore the source-space zone');
  await tool('Deshacer');assert.equal(await redPixels(),0,'Undo must retain privacy');
  await tool('Rehacer');assert.equal(await redPixels(),0,'Redo must retain privacy');
  // A zone created after a transform must also stay attached when the transform changes again.
  await tool('Ocultar');await tool('Borrar zona');
  assert.ok(await redPixels()>0);
  await tool('Nueva zona centrada');await tool('Tapar');
  for(const [label,value] of [['Horizontal',60],['Vertical',20],['Ancho',20],['Alto',20]]){
   const slider=editor.getByRole('slider',{name:new RegExp('^'+label)});
   await slider.press('Home');
   for(let step=Number(await slider.getAttribute('min'));step<value;step++)await slider.press('ArrowRight');
  }
  assert.equal(await redPixels(),0,'A new zone in a reflected view must cover the marker');
  await tool('Girar');await tool('Reflejar');assert.equal(await redPixels(),0,'New zones must map back to source coordinates');
  await tool('Tamaño');
  await editor.getByRole('spinbutton',{name:/^Ancho/}).fill('200');
  await editor.getByRole('spinbutton',{name:/^Ancho/}).blur();
  assert.equal(await redPixels(),0,'Resizing must preserve the privacy zone');
  await tool('Exportar');
  await editor.getByRole('radio',{name:/PNG/}).check();
  const download=page.waitForEvent('download');await tool('Descargar');
  const output=await readFile(await(await download).path());
  const leaked=await page.evaluate(async bytes=>{
   const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   canvas.getContext('2d').drawImage(image,0,0);image.close();
   const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   return data.some((value,index)=>index%4===0&&value>200&&data[index+1]<50&&data[index+2]<50);
  },[...output]);
  assert.equal(leaked,false,'The exported image must not contain the sensitive marker');
  await tool('Guardar cambios');await editor.waitFor({state:'detached'});
  const savedLeak=await page.locator('.image-thumb img').first().evaluate(async image=>{
   const bitmap=await createImageBitmap(await(await fetch(image.dataset.sourceUrl)).blob());
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
   const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   return data.some((value,index)=>index%4===0&&value>200&&data[index+1]<50&&data[index+2]<50);
  });
  assert.equal(savedLeak,false,'Saving the draft must keep the sensitive marker covered');
  assert.deepEqual(errors,[]);
  console.log(browserType.name()+': privacy survives rotations, reflection, crop, undo/redo, drawing after transforms, export and save.');
 } finally {await browser.close()}
}
