// Rebuild the promotional reel with the local site running on port 5173.
// Requires Chromium and ffmpeg; no external images, stock music or API calls.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const temp='/tmp/papeled-reel', out='public/apresentacao';
await mkdir(temp,{recursive:true}); await mkdir(out,{recursive:true});
execFileSync('python3',['scripts/render-maker-reel-music.py'],{stdio:'inherit'});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
await page.route('**/platform-config.json',r=>r.fulfill({contentType:'application/json',body:'{"supabaseUrl":"","supabaseAnonKey":""}'}));
await page.route('https://*.supabase.co/**',r=>r.abort());
await page.goto('http://127.0.0.1:5173/');
const art=await page.evaluate(async()=>{
 const {defaults}=await import('/src/models.js'); const {previewSVG}=await import('/src/preview.js');
 const {FINISHES}=await import('/src/finishes.js');
 const render=(id,changes={},view={})=>previewSVG({...defaults(id),...changes},{dimensions:false,angle:32,...view});
 // Promotional colors are scoped to this isolated rendering page only.
 // Restore the shared swatch immediately; the live catalog remains black/white.
 const promoRender=(id,color,changes={})=>{
  const original=FINISHES.black.color;
  try { FINISHES.black.color=color; return render(id,{...changes,finish:'black'}); }
  finally { FINISHES.black.color=original; }
 };
 return {hero:render('referencehinge',{lidOpening:70,engraveName:'SUA IDEIA',hingeLidGap:1}),box:render('grid'),drawers:render('drawers'),slide:render('sliding'),puzzle:render('picturepuzzle',{toyTheme:'butterfly',toyPieceStyle:'jigsaw'}),gears:promoRender('gears','#35b76c'),tag:promoRender('keychain','#ef554d',{makerText:'Luna'}),stamp:promoRender('stamp','#ef554d',{makerText:'FEITO POR MIM'}),letters:promoRender('lettering','#35b76c',{signText:'Crie',signBase:true})};
});
const logo='data:image/png;base64,'+(await readFile('public/papeled-logo.png')).toString('base64');
const font='data:font/woff2;base64,'+(await readFile('node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2')).toString('base64');
const regular='data:font/woff2;base64,'+(await readFile('node_modules/@fontsource/montserrat/files/montserrat-latin-500-normal.woff2')).toString('base64');
const product=(svg,cls='')=>`<div class="product ${cls}">${svg}</div>`;
const scenes=[
 {dark:true,kicker:'ESPAÇO MAKER ONLINE',title:'SUA IDEIA<br>GANHA<br><em>FORMA.</em>',body:product(art.hero,'hero'),foot:'Imagine. Personalize. Crie.',tag:'COMECE AQUI'},
 {kicker:'VOCÊ NO CONTROLE',title:'DO SEU<br>TAMANHO.<br><em>DO SEU JEITO.</em>',body:product(art.box,'hero')+'<div class="specs"><span>LARGURA <b>240 mm</b></span><span>ALTURA <b>65 mm</b></span><span>DIVISÓRIAS <b>3 × 2</b></span></div>',foot:'Ajuste as medidas. Veja em 3D.',tag:'PERSONALIZE'},
 {dark:true,kicker:'CORTE LASER',title:'ABRA NOVAS<br><em>POSSIBILIDADES.</em>',body:product(art.hero,'medium')+'<div class="mini-grid">'+product(art.slide)+product(art.drawers)+'</div>',foot:'Caixas. Tampas. Gavetas. Encaixes.',tag:'EXPLORE'},
 {kicker:'BRINQUEDOS PEDAGÓGICOS',title:'CRIAR.<br>BRINCAR.<br><em>DESCOBRIR.</em>',body:product(art.puzzle,'hero')+'<div class="pill">FIGURAS + TAMANHOS + PEÇAS</div>',foot:'Quebra-cabeças feitos para novas ideias.',tag:'IMAGINE'},
 {dark:true,kicker:'IMPRESSÃO 3D',title:'IDEIAS EM<br><em>OUTRA<br>DIMENSÃO.</em>',body:product(art.gears,'medium light-stage')+'<div class="mini-grid">'+product(art.tag)+product(art.letters)+'</div>',foot:'Engrenagens, chaveiros e letreiros.',tag:'DÊ RELEVO'},
 {kicker:'PERSONALIZAÇÃO DE VERDADE',title:'NÃO É SÓ<br>ESCOLHER.<br><em>É CRIAR.</em>',body:product(art.stamp,'hero')+'<div class="pill">TEXTO · FIGURA · BORDA · RELEVO</div>',foot:'Um detalhe muda tudo.',tag:'FAÇA SEU'},
 {dark:true,kicker:'DA TELA AO PRÓXIMO PASSO',title:'MONTE.<br>VISUALIZE.<br><em>VAMOS FAZER?</em>',body:'<div class="steps"><div><i>01</i><b>Escolha seu modelo</b></div><div><i>02</i><b>Personalize em 3D</b></div><div><i>03</i><b>Baixe ou peça orçamento</b></div></div>',foot:'Sua próxima criação começa no site.',tag:'TIRE DO PAPEL'},
 {kicker:'PAPELED MAKER',title:'BORA CRIAR<br>ALGO<br><em>SEU?</em>',body:`<div class="closing-logo"><img src="${logo}"></div><div class="cta">ACESSE E EXPLORE</div><div class="url">maker.papeled.com.br</div><div class="handle">@papeledmaker</div>`,foot:'ESPAÇO MAKER ONLINE',tag:'SUA IDEIA GANHA FORMA'},
];
for(let i=0;i<scenes.length;i++){
 const s=scenes[i];
 await page.setContent(`<!doctype html><html lang="pt-BR"><head><style>
 @font-face{font-family:M;src:url('${font}');font-weight:800}@font-face{font-family:M;src:url('${regular}');font-weight:500}
 *{box-sizing:border-box}body{margin:0;width:1080px;height:1920px;overflow:hidden;background:${s.dark?'#392924':'#faf5ee'};color:${s.dark?'#faf5ee':'#392924'};font-family:M,sans-serif;position:relative;padding:160px 78px 230px}body:before{content:'';position:absolute;width:850px;height:850px;border:1px solid ${s.dark?'#70534a':'#ddc5b0'};border-radius:50%;right:-380px;top:340px;box-shadow:0 0 0 90px ${s.dark?'#422e28':'#f3e7d9'},0 0 0 180px ${s.dark?'#3d2b26':'#f7efe5'};z-index:0}.inner{position:relative;z-index:1}.brand{display:flex;align-items:center;gap:17px;letter-spacing:3px;font-size:25px;font-weight:800}.brand img{width:64px;height:64px;border-radius:50%}.kicker{font-size:22px;letter-spacing:4px;font-weight:800;margin-top:73px;color:${s.dark?'#d4b093':'#805749'}}h1{font-size:100px;letter-spacing:-5px;line-height:1.04;margin:28px 0 0;font-weight:800}em{font-style:normal;color:${s.dark?'#e5bd91':'#a5673f'}}.product{width:100%;height:420px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0px 28px 19px #00000024)}.product svg{width:100%;height:100%;overflow:visible}.hero{height:650px;margin-top:22px}.light-stage{background:#f8efe5;border-radius:36px;padding:25px}.medium{height:465px;margin-top:44px}.mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px}.mini-grid .product{height:300px;background:${s.dark?'#f8efe5':'#efe0d1'};border-radius:36px;padding:15px}.specs{display:flex;gap:16px;margin-top:10px}.specs span{flex:1;font-size:17px;letter-spacing:1px;background:#eadbcb;border-radius:20px;padding:24px 18px}.specs b{display:block;font-size:29px;margin-top:10px}.pill{font-size:23px;font-weight:800;background:#eadbcb;padding:24px;border-radius:40px;text-align:center;margin-top:26px;letter-spacing:1px}.footer{position:absolute;left:78px;right:78px;bottom:235px;font-size:27px;line-height:1.5;font-weight:500;z-index:2;border-top:1px solid ${s.dark?'#70534a':'#ddc5b0'};padding-top:27px}.bottom{position:absolute;bottom:155px;left:78px;right:78px;display:flex;justify-content:space-between;font-size:17px;letter-spacing:3px;font-weight:800;z-index:2}.progress{position:absolute;bottom:115px;left:78px;width:${(i+1)/8*924}px;height:5px;background:#b1815b;z-index:2}.steps{margin-top:95px}.steps>div{display:flex;align-items:center;gap:24px;border-bottom:1px solid #70534a;padding:42px 0}.steps i{font-size:48px;font-style:normal;color:#e5bd91}.steps b{font-size:31px}.closing-logo{display:flex;justify-content:center;margin:65px 0 35px}.closing-logo img{width:325px;height:325px;border-radius:50%;box-shadow:0 22px 45px #39292420}.cta{background:#684a40;color:white;border-radius:21px;text-align:center;font-size:29px;font-weight:800;padding:27px;margin-top:38px}.url{text-align:center;font-size:34px;letter-spacing:-1px;font-weight:800;margin-top:31px}.handle{text-align:center;font-size:26px;margin-top:22px;color:#805749}
 </style></head><body><div class="inner"><div class="brand"><img src="${logo}"> PAPELED MAKER</div><div class="kicker">${s.kicker}</div><h1>${s.title}</h1>${s.body}</div><div class="footer">${s.foot}</div><div class="bottom"><span>${s.tag}</span><span>0${i+1} / 08</span></div><div class="progress"></div></body></html>`);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${temp}/scene-${i}.png`});
 console.log(`Scene ${i+1}/8 captured`);
}
await browser.close();
// Each shot has gentle camera movement, with a short fade-in on the beat.
for(let i=0;i<8;i++){
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${temp}/scene-${i}.png`,'-vf',`scale=2160:3840,zoompan=z='1.0+0.00025*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=120:s=1080x1920:fps=30,fade=t=in:st=0:d=0.15,format=yuv420p`,'-t','4','-an','-c:v','libx264','-preset','fast','-crf','21','-threads','2',`${temp}/shot-${i}.mp4`],{stdio:'inherit'});
 console.log(`Shot ${i+1}/8 encoded`);
}
await writeFile(`${temp}/concat.txt`,scenes.map((_,i)=>`file '${temp}/shot-${i}.mp4'`).join('\n'));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',`${temp}/concat.txt`,'-i',`${temp}/music.wav`,'-c:v','copy','-c:a','aac','-b:a','192k','-af','afade=t=in:d=0.3,afade=t=out:st=30:d=2,loudnorm=I=-16:TP=-1.5:LRA=9','-t','32','-movflags','+faststart',`${out}/papeled-maker-reels.mp4`],{stdio:'inherit'});
await writeFile(`${out}/capa-papeled-maker.jpg`,execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',`${temp}/scene-0.png`,'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','-q:v','2','pipe:1'],{maxBuffer:8e6}));
console.log('Reel ready');
