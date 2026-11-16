import fs from 'node:fs';
// The visual QA workspace provides the optional native canvas dependency.
const {createCanvas}=await import(new URL('../../visual-qa/node_modules/@napi-rs/canvas/index.js',import.meta.url).href);
const canvas=createCanvas(1254,1254),ctx=canvas.getContext('2d');
for(let r=0;r<4;r++){
 ctx.save();ctx.translate(r%2*627,Math.floor(r/2)*627);
 const turn=(x,y)=>{for(let i=0;i<r;i++)[x,y]=[y,-x];return[x,y]};
 const p=([x,y,z=0])=>{[x,y]=turn(x,y);return[313+(x-y)*32*8,448+(r>=2?45:0)+(x+y)*16*8-z*8]};
 const poly=(points,color)=>{ctx.beginPath();points.map(p).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#514c3d';ctx.lineWidth=1.5;ctx.stroke()};
 const box=(x0,y0,x1,y1,z0,z1,color)=>{
  const faces=[[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],[[x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1]],[[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]];
  for(let i=0;i<4;i++){const n=turn(...[[1,0],[0,1],[-1,0],[0,-1]][i]);if(n[0]+n[1]>0)poly(faces[i],color)}
  poly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],color);
 };
 box(-.39,-.39,.39,.39,0,27,'#c9b68d');
 for(const y of [-.39,.39]){const n=turn(0,Math.sign(y));if(n[0]+n[1]>0)poly([[-.39,y,27],[.39,y,27],[0,y,38]],'#c9b68d')}
 if(r<2){poly([[-.14,.391,1],[.14,.391,1],[.14,.391,25],[-.14,.391,25]],'#725438');box(-.19,.39,.19,.48,0,1.5,'#aa9b7f');}
 // Two small windows per side, one rear window. These repeat on the same walls.
 for(const x of [-.391,.391]){const n=turn(Math.sign(x),0);if(n[0]+n[1]>0)for(const y of [-.27,.11])poly([[x,y,10],[x,y+.16,10],[x,y+.16,22],[x,y,22]],'#cf9947');}
 if(r>=2)poly([[-.11,-.391,10],[.11,-.391,10],[.11,-.391,22],[-.11,-.391,22]],'#cf9947');
 const roofs=[[[.43,-.43,27],[.43,.43,27],[0,.43,39],[0,-.43,39]],[[-.43,-.43,27],[-.43,.43,27],[0,.43,39],[0,-.43,39]]];
 roofs.sort((a,b)=>a.reduce((n,v)=>n+p([v[0],v[1]])[1],0)-b.reduce((n,v)=>n+p([v[0],v[1]])[1],0));for(const roof of roofs)poly(roof,'#365649');
 // A small front bellcote, not a full tower. Separate legs expose the bell.
 box(-.105,.15,-.065,.32,38,47,'#b9ac90');box(.065,.15,.105,.32,38,47,'#b9ac90');
 box(-.11,.15,.11,.32,46,48,'#b9ac90');
 const ring=[[-.14,.12,48],[.14,.12,48],[.14,.35,48],[-.14,.35,48]];
 for(let i=0;i<4;i++)poly([ring[i],ring[(i+1)%4],[0,.235,51]],'#365649');
 box(-.012,.223,.012,.247,50,55,'#846244');box(-.07,.223,.07,.247,53,53.6,'#846244');
 ctx.restore();
}
fs.writeFileSync(new URL('../docs/art-guides/chapel-guide.png',import.meta.url),canvas.toBuffer('image/png'));
