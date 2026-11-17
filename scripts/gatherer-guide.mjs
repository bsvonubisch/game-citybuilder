import fs from 'node:fs';
const {createCanvas}=await import(new URL('../../visual-qa/node_modules/@napi-rs/canvas/index.js',import.meta.url).href);
const canvas=createCanvas(1254,1254),ctx=canvas.getContext('2d');
for(let r=0;r<4;r++){
 ctx.save();ctx.translate(r%2*627,Math.floor(r/2)*627);
 const turn=(x,y)=>{for(let i=0;i<r;i++)[x,y]=[y,-x];return[x,y];};
 const p=([x,y,z=0])=>{[x,y]=turn(x,y);return[313+(x-y)*32*9,440+(x+y)*16*9-z*9];};
 const poly=(points,color)=>{ctx.beginPath();points.map(p).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#473d2b';ctx.lineWidth=1.5;ctx.stroke();};
 const box=(x0,y0,x1,y1,z0,z1,color)=>{
 const faces=[[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],[[x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1]],[[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]];
 for(let i=0;i<4;i++){const n=turn(...[[1,0],[0,1],[-1,0],[0,-1]][i]);if(n[0]+n[1]>0)poly(faces[i],color);}
 poly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],color);};
 box(-.35,-.35,.35,.35,0,27,'#a37140');
 for(const y of [-.35,.35]){const n=turn(0,Math.sign(y));if(n[0]+n[1]>0)poly([[-.35,y,27],[.35,y,27],[0,y,40]],'#a37140');}
 if(r<2){poly([[-.12,.351,1],[.12,.351,1],[.12,.351,25],[-.12,.351,25]],'#60462f');box(-.16,.35,.16,.46,0,1.2,'#bba887');}
 for(const x of [-.351,.351]){const n=turn(Math.sign(x),0);if(n[0]+n[1]>0)poly([[x,-.09,11],[x,.09,11],[x,.09,22],[x,-.09,22]],'#f0b557');}
 if(r>=2)poly([[-.10,-.351,11],[.10,-.351,11],[.10,-.351,22],[-.10,-.351,22]],'#f0b557');
 const roofs=[[[.40,-.40,27],[.40,.40,27],[0,.40,41],[0,-.40,41]],[[-.40,-.40,27],[-.40,.40,27],[0,.40,41],[0,-.40,41]]];
 roofs.sort((a,b)=>a.reduce((n,v)=>n+p([v[0],v[1]])[1],0)-b.reduce((n,v)=>n+p([v[0],v[1]])[1],0));for(const roof of roofs)poly(roof,'#38594a');
 if(r<2){box(.19,.35,.33,.47,0,4,'#946638');poly([[.19,.35,4],[.33,.35,4],[.33,.47,4],[.19,.47,4]],'#a83950');}
 ctx.restore();
}
fs.writeFileSync(new URL('../docs/art-guides/gatherer-guide.png',import.meta.url),canvas.toBuffer('image/png'));
