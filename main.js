const $ = (s) => document.querySelector(s);
const palette = {wood:['#bd9265','#e1b98a','#9c704a'],dark:['#50544e','#72776c','#353b33'],sage:['#95a080','#b8c1a3','#727e5e'],orange:['#c47652','#df9d79','#9d563a']};
const names={wood:'Madeira natural',dark:'Grafite',sage:'Verde sálvia',orange:'Terracota'};
const models={box:'Caixa organizadora',stand:'Suporte de mesa',vase:'Vaso paramétrico'};
let state={model:'box',process:'laser',color:'wood',width:160,height:100};
function drawing(model='box',color='wood',w=160,h=100){
 const [front,top,side]=palette[color];
 const defs=`<defs><filter id="shadow"><feGaussianBlur stdDeviation="9"/></filter><pattern id="grain" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M0 3 Q7 1 14 3M0 8 Q7 6 14 8" stroke="#694320" stroke-opacity=".13" fill="none" stroke-width=".5"/></pattern></defs><ellipse cx="260" cy="319" rx="137" ry="19" fill="#677052" opacity=".17" filter="url(#shadow)"/>`;
 let shape='';
 if(model==='box'){
 const bottom=290,up=bottom-h*.95, left=110-(w-160)*.25,right=330+(w-160)*.5;
 shape=`<path d="M${left} ${up} L${left+105} ${up-65} L${right+90} ${up-12} L${right} ${up+57}Z" fill="${top}" stroke="${side}"/><path d="M${left+12} ${up+3} L${left+105} ${up-53} L${right+74} ${up-10} L${right-2} ${up+42}Z" fill="${side}"/><path d="M${left+12} ${up+3} L${left+105} ${up-53} L${left+105} ${bottom-64} L${left+13} ${bottom-7}Z" fill="${front}"/><path d="M${left+105} ${up-53} L${right+74} ${up-10} L${right+74} ${bottom-20} L${left+105} ${bottom-64}Z" fill="${side}"/><path d="M${left} ${up} L${right} ${up+57} L${right} ${bottom+38} L${left} ${bottom-17}Z" fill="${front}" stroke="${side}" stroke-width="1.2"/><path d="M${right} ${up+57} L${right+90} ${up-12} L${right+90} ${bottom-31} L${right} ${bottom+38}Z" fill="${top}" stroke="${side}" stroke-width="1.2"/><path d="M${left} ${up} L${right} ${up+57} L${right} ${bottom+38} L${left} ${bottom-17}Z" fill="url(#grain)"/><path d="M${right+29} ${up+64} l32 -24 q5 -4 5 2 v8 q0 4 -5 8 l-32 24 q-4 3 -4 -2 v-8 q0 -4 4 -8Z" fill="${side}"/>`;
 for(let i=0;i<6;i++){const y=up+60+i*(h*.85/6);shape+=`<path d="M${right-7} ${y} l7 2 6 -5 v8 l-6 5 -7 -2Z" fill="${side}" opacity=".75"/>`;}
 }else if(model==='vase'){
 shape=`<path d="M219 117 Q187 155 173 224 Q163 283 202 302 Q251 325 302 299 Q337 279 321 223 Q305 157 278 117Z" fill="${front}"/><ellipse cx="249" cy="117" rx="30" ry="12" fill="${top}"/><ellipse cx="249" cy="117" rx="22" ry="7" fill="${side}"/>`;
 for(let i=0;i<22;i++){const x=194+i*5;shape+=`<path d="M${231+i*1.65} 128 Q${x-20} 218 ${x} 302" fill="none" stroke="${i%2?top:side}" opacity=".55" stroke-width="2.5"/>`;}
 }else if(model==='stand'){
 shape=`<path d="M130 259 L239 200 L383 235 L274 302Z" fill="${top}" stroke="${side}"/><path d="M130 259 v11 l144 43 v-11Z" fill="${front}"/><path d="M274 302 l109 -67 v11 l-109 67Z" fill="${side}"/><path d="M209 240 L235 126 L316 149 L289 263Z" fill="${front}" stroke="${side}"/><path d="M235 126 l13 -9 81 23 -13 9Z" fill="${top}"/><path d="M316 149 l13 -9 -26 113 -14 10Z" fill="${side}"/><path d="M197 244 l17 -12 83 24 -17 12Z" fill="${top}"/><path d="M197 244 v12 l83 24 v-12Z" fill="${front}"/>`;
 }else if(model==='lamp'){
 shape=`<ellipse cx="260" cy="291" rx="64" ry="17" fill="${side}"/><path d="M211 139 L189 279 Q257 318 328 279 L307 139Z" fill="${top}"/>`;
 for(let i=0;i<15;i++){let x=214+i*6.5;shape+=`<path d="M${x} 139 L${189+i*9.8} 280" stroke="${side}" stroke-width="4"/>`;}
 shape+=`<ellipse cx="259" cy="139" rx="48" ry="14" fill="${front}"/>`;
 }else if(model==='tray'){
 shape=`<path d="M126 235 L247 166 L392 205 L270 282Z" fill="${top}" stroke="${side}" stroke-width="8"/><path d="M126 235 v20 l144 43 v-16Z" fill="${front}"/><path d="M270 282 l122 -77 v20 l-122 73Z" fill="${side}"/><path d="M216 184 l1 69 M302 183 l-120 69" stroke="${side}" stroke-width="5"/>`;
 }else{
 shape=`<path d="M181 176 L262 132 L331 154 L331 270 L250 317 L181 294Z" fill="${front}"/><path d="M181 176 L262 132 L331 154 L250 199Z" fill="${top}"/><path d="M250 199 L331 154 v116 l-81 47Z" fill="${side}"/>`;
 for(let i=0;i<6;i++)for(let j=0;j<4;j++)shape+=`<ellipse cx="${195+i*8}" cy="${194+j*25+i*2.7}" rx="2" ry="5" fill="${side}" opacity=".6"/>`;
 }
 if(model!=='box') shape=`<g transform="translate(260 300) scale(${.8+w/800} ${.7+h/333.33}) translate(-260 -300)">${shape}</g>`;
 return `<svg viewBox="0 0 520 380" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}${shape}</svg>`;
}
function update(){
 $('#object').innerHTML=drawing(state.model,state.color,state.width,state.height);
 $('#object').setAttribute('aria-label',`Prévia ilustrada: ${models[state.model]}, ${names[state.color]}, ${state.width} por ${state.height} mm`);
 $('#objectTitle').textContent=models[state.model];$('#finishName').textContent=names[state.color];
 $('#widthValue').textContent=state.width+' mm';$('#heightValue').textContent=state.height+' mm';
 $('#processBadge').textContent=state.process==='laser'?'CORTE A LASER':'IMPRESSÃO 3D';
 $('#material').textContent=state.process==='laser'?`${names[state.color]} · montagem por encaixe`:`PLA · fabricação em camadas`;
 document.querySelectorAll('[data-process]').forEach(b=>{b.classList.toggle('active',b.dataset.process===state.process);b.setAttribute('aria-pressed',b.dataset.process===state.process)});
 document.querySelectorAll('.swatch').forEach(b=>{b.classList.toggle('selected',b.dataset.color===state.color);b.setAttribute('aria-pressed',b.dataset.color===state.color)});
}
$('#model').onchange=e=>{state.model=e.target.value;state.process=state.model==='vase'?'3d':'laser';update()};
for(const key of ['width','height']) $('#'+key).oninput=e=>{state[key]=Number(e.target.value);update()};
document.querySelectorAll('[data-process]').forEach(b=>b.onclick=()=>{state.process=b.dataset.process;if(state.process==='3d'&&state.color==='wood')state.color='sage';update()});
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;update()});
$('#rotate').onclick=()=>$('#object').classList.toggle('rotated');
const products=[['Caixa organizadora','Encaixes precisos, infinitas utilidades.','box','wood','laser'],['Vaso paramétrico','Texturas que nascem do digital.','vase','sage','3d'],['Suporte de mesa','Um lugar para suas ideias.','stand','wood','laser'],['Luminária de lâminas','Luz, sombra e um pouco de geometria.','lamp','wood','laser'],['Porta-lápis modular','Mais espaço para criar.','pencil','orange','3d'],['Bandeja organizadora','Cada coisa no seu lugar.','tray','wood','laser']];
function render(filter='all'){
 const list=products.filter(p=>filter==='all'||p[4]===filter);$('#count').textContent=`${list.length} objetos para explorar`;
 $('#products').innerHTML=list.map(p=>`<button class="card" data-product="${products.indexOf(p)}"><div class="card-image" style="background-color:${p[3]==='sage'?'#e9eddf':p[3]==='orange'?'#f0e8df':'#eeece5'}"><span class="tag">${p[4]==='laser'?'✳ CORTE A LASER':'▧ IMPRESSÃO 3D'}</span>${drawing(p[2],p[3])}</div><div class="card-info"><div><h3>${p[0]}</h3><p>${p[1]}</p></div><span><svg class="arrow" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></span></div></button>`).join('');
 document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>{const p=products[Number(b.dataset.product)];openDialog(`Tenho interesse em: ${p[0]}.\nProcesso: ${p[4]==='laser'?'Corte a laser':'Impressão 3D'}.\n\nMinha ideia: `)});
}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});render(b.dataset.filter)});
function updateContactLinks(){const text=$('#idea').value;$('#whatsapp').href='https://wa.me/5561992430051?text='+encodeURIComponent(text);$('#emailProject').href='mailto:papeledmaker@gmail.com?subject='+encodeURIComponent('Projeto para a Papeled Maker')+'&body='+encodeURIComponent(text)}
$('#idea').addEventListener('input',updateContactLinks);
function openDialog(text){$('#idea').value=text;updateContactLinks();$('#copyStatus').textContent='';$('#dialog').showModal()}
$('#project').onclick=()=>openDialog(`Tenho interesse em: ${models[state.model]}.\nDimensões conceituais: ${state.width} × ${state.height} mm.\nProcesso: ${state.process==='laser'?'Corte a laser':'Impressão 3D'}.\nAcabamento: ${names[state.color]}.\n\nMinha ideia: `);
$('#contactButton').onclick=()=>openDialog('Quero criar um projeto personalizado.\n\nMinha ideia: ');
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#idea').value);$('#copyStatus').textContent='Resumo copiado! Você pode enviar para a Papeled Maker.'}catch{$('#idea').focus();$('#idea').select();$('#copyStatus').textContent='Selecione e copie o texto com Ctrl+C ou pelo menu do dispositivo.'}};
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
update();render();
