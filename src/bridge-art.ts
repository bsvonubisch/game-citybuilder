import {roadTypeAt} from "./roads.js";
import {roadSurface} from "./road-art.js";
import type Phaser from "phaser";
import {
  BRIDGE_PARAPET_HEIGHT,
  bridgeRails,
  bridgeLandings,
  deckHeight,
  isBridge,
} from "./bridges.js";
import { iso } from "./rendering.js";
import { type Point, type Simulation } from "./simulation.js";

type Vec = { x: number; y: number };
const RESOLUTION = 4,
  WIDTH = 96,
  HEIGHT = 80;
const CORNERS = [
  [
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
  ],
  [
    { x: 0.5, y: 0.5 },
    { x: -0.5, y: 0.5 },
  ],
  [
    { x: -0.5, y: 0.5 },
    { x: -0.5, y: -0.5 },
  ],
  [
    { x: -0.5, y: -0.5 },
    { x: 0.5, y: -0.5 },
  ],
];

/** Textured geometry is cached by connections. Ramps and rail openings follow
 * the actual road graph, while front and rear rails sort separately from traffic. */
export class BridgeArt {
  private variants = new Map<
    string,
    { deck: string; supports: string; rails: (string | null)[] }
  >();
  private images: Phaser.GameObjects.Image[] = [];
  private wood: HTMLImageElement;
  constructor(private scene: Phaser.Scene) {
    this.wood = scene.textures
      .get("bridge-wood")
      .getSourceImage() as HTMLImageElement;
  }
  private canvas(name: string, paint: (ctx: CanvasRenderingContext2D) => void) {
    const texture = this.scene.textures.createCanvas(
      name,
      WIDTH * RESOLUTION,
      HEIGHT * RESOLUTION,
    )!;
    const ctx = texture.context;
    ctx.scale(RESOLUTION, RESOLUTION);
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.imageSmoothingEnabled = true;
    paint(ctx);
    texture.refresh();
    return name;
  }
  private quad(
    ctx: CanvasRenderingContext2D,
    points: Vec[],
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    material:CanvasImageSource=this.wood,
  ) {
    const [a, b, c, d] = points;
    // Flat deck patches and wall panels need one affine draw. Clipping them
    // into two triangles leaves an antialiased crack through the material.
    if (Math.abs(a.x + c.x - b.x - d.x) < .001 &&
        Math.abs(a.y + c.y - b.y - d.y) < .001) {
      ctx.save();
      ctx.transform(b.x - a.x, b.y - a.y, d.x - a.x, d.y - a.y, a.x, a.y);
      ctx.drawImage(material, sx, sy, sw, sh, 0, 0, 1, 1);
      ctx.restore();
      return;
    }
    for (const [end, side, triangle] of [
      [b, { x: c.x - b.x, y: c.y - b.y }, [a, b, c]],
      [
        { x: a.x + c.x - d.x, y: a.y + c.y - d.y },
        { x: d.x - a.x, y: d.y - a.y },
        [a, c, d],
      ],
    ] as [Vec, Vec, Vec[]][]) {
      ctx.save();
      ctx.beginPath();
      triangle.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.clip();
      ctx.transform(end.x - a.x, end.y - a.y, side.x, side.y, a.x, a.y);
      ctx.drawImage(material, sx, sy, sw, sh, 0, 0, 1, 1);
      ctx.restore();
    }
  }
  private variant(sim: Simulation, tile: Point) {
    const open = bridgeRails(
      sim.roads,
      tile,
      sim.state.buildings,
      sim.state.terrain,
    );
    const land = bridgeLandings(
      sim.roads,
      tile,
      sim.state.buildings,
      sim.state.terrain,
    );
    const kind=roadTypeAt(sim.state.roadTypes,tile);
    const id = kind+open.map(Number).join("") + land.map(Number).join("");
    const existing = this.variants.get(id);
    if (existing) return existing;
    const point = (u: number, v: number): Vec => {
      const p = iso(u, v);
      return {
        x: p.x,
        y:
          p.y -
          deckHeight(
            sim.roads,
            tile,
            u,
            v,
            sim.state.buildings,
            sim.state.terrain,
          ),
      };
    };
    if(kind==="stone"||kind==="brick")return this.masonry(id,open,point,kind);
    const line = (
      ctx: CanvasRenderingContext2D,
      a: Vec,
      b: Vec,
      color: string,
      width: number,
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const beam = (
      ctx: CanvasRenderingContext2D,
      a: Vec,
      b: Vec,
      thickness: number,
    ) => {
      line(
        ctx,
        { x: a.x, y: a.y + 1 },
        { x: b.x, y: b.y + 1 },
        "#684b2e",
        thickness + 1,
      );
      this.quad(
        ctx,
        [
          { x: a.x, y: a.y - thickness / 2 },
          { x: b.x, y: b.y - thickness / 2 },
          { x: b.x, y: b.y + thickness / 2 },
          { x: a.x, y: a.y + thickness / 2 },
        ],
        this.wood.width / 2,
        0,
        this.wood.width / 2,
        this.wood.height * 0.16,
      );
      line(
        ctx,
        { x: a.x, y: a.y - thickness / 2 },
        { x: b.x, y: b.y - thickness / 2 },
        "#e2bd7e",
        0.45,
      );
    };
    const deck = this.canvas(`bridge-deck-${id}`, (ctx) => {
      ctx.fillStyle = "#173c3a44";
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(34, 8);
      ctx.lineTo(0, 25);
      ctx.lineTo(-34, 8);
      ctx.closePath();
      ctx.fill();
      const acrossX =
        Number(!open[0]) + Number(!open[2]) >=
        Number(!open[1]) + Number(!open[3]);
      // Subdivide at the midpoint so both land ramps meet a level raised centre.
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 4; i++) {
          const u = i / 4 - 0.5,
            v = j / 4 - 0.5;
          const corners = acrossX
            ? [
                point(u, v),
                point(u, v + 0.25),
                point(u + 0.25, v + 0.25),
                point(u + 0.25, v),
              ]
            : [
                point(u, v),
                point(u + 0.25, v),
                point(u + 0.25, v + 0.25),
                point(u, v + 0.25),
              ];
          ctx.beginPath();
          corners.forEach((p, i) =>
            i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
          );
          ctx.closePath();
          ctx.fillStyle = "#af783c";
          ctx.fill();
          this.quad(
            ctx,
            corners,
            ((acrossX ? j : i) * this.wood.width) / 8,
            ((acrossX ? i : j) * this.wood.height) / 4,
            this.wood.width / 8,
            this.wood.height / 4,
          );
        }
      // Deck thickness belongs only on exposed sides, never across a joined
      // road span: a fascia there looks like a step across the carriageway.
      for (let edge = 0; edge < 2; edge++) {
        if (!open[edge]) continue;
        const [a, b] = CORNERS[edge];
        for (let i = 0; i < 2; i++) {
          const start = point(
            a.x + ((b.x - a.x) * i) / 2,
            a.y + ((b.y - a.y) * i) / 2,
          );
          const end = point(
            a.x + ((b.x - a.x) * (i + 1)) / 2,
            a.y + ((b.y - a.y) * (i + 1)) / 2,
          );
          beam(
            ctx,
            { x: start.x, y: start.y + 1.3 },
            { x: end.x, y: end.y + 1.3 },
            2,
          );
        }
      }
    });
    const supports = this.canvas(`bridge-supports-${id}`, (ctx) => {
      for (let edge = 0; edge < 4; edge++)
        if (open[edge]) {
          const [a, b] = CORNERS[edge];
          for (const t of [0, 0.5, 1]) {
            const u = a.x + (b.x - a.x) * t,
              v = a.y + (b.y - a.y) * t,
              p = point(u, v),
              ground = iso(u, v);
            this.quad(
              ctx,
              [
                { x: p.x - 1.8, y: p.y },
                { x: p.x + 1, y: p.y + 0.7 },
                { x: p.x + 1, y: ground.y + 8 },
                { x: p.x - 1.8, y: ground.y + 7.3 },
              ],
              this.wood.width * 0.55,
              0,
              this.wood.width * 0.05,
              this.wood.height,
            );
            ctx.fillStyle = "#70482c";
            ctx.fillRect(p.x + 1, p.y + 0.7, 1.3, ground.y + 7.3 - p.y);
          }
        }
    });
    const rails = open.map((closed, edge) =>
      !closed
        ? null
        : this.canvas(`bridge-rail-${id}-${edge}`, (ctx) => {
            const [a, b] = CORNERS[edge];
            const positions = [0, 0.5, 1].map((t) =>
              point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
            );
            // Rail posts stop at deck level; submerged pilings are behind the deck.
            for (let i = 0; i < positions.length; i++) {
              const p = positions[i];
              this.quad(
                ctx,
                [
                  { x: p.x - 1.8, y: p.y - 12 },
                  { x: p.x + 1, y: p.y - 11.3 },
                  { x: p.x + 1, y: p.y + 0.7 },
                  { x: p.x - 1.8, y: p.y },
                ],
                this.wood.width * 0.55,
                0,
                this.wood.width * 0.05,
                this.wood.height,
              );
              ctx.fillStyle = "#70482c";
              ctx.fillRect(p.x + 1, p.y - 11.3, 1.3, 12);
              ctx.fillStyle = "#e9c48a";
              ctx.beginPath();
              ctx.moveTo(p.x - 2.2, p.y - 12);
              ctx.lineTo(p.x, p.y - 13.2);
              ctx.lineTo(p.x + 2.6, p.y - 12);
              ctx.lineTo(p.x, p.y - 10.8);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = "#695c47";
              ctx.fillRect(p.x - 1.8, p.y - 10, 4, 1.4);
              ctx.fillStyle = "#cab58b";
              ctx.fillRect(p.x - 0.5, p.y - 9.8, 0.7, 0.7);
            }
            for (let i = 0; i < 2; i++) {
              const a = positions[i],
                b = positions[i + 1];
              beam(ctx, { x: a.x, y: a.y - 9 }, { x: b.x, y: b.y - 9 }, 2.3);
              beam(
                ctx,
                { x: a.x, y: a.y - 3.5 },
                { x: b.x, y: b.y - 3.5 },
                1.5,
              );
              beam(ctx, { x: a.x, y: a.y - 8 }, { x: b.x, y: b.y - 3.5 }, 0.9);
            }
          }),
    );
    const result = { deck, supports, rails };
    this.variants.set(id, result);
    return result;
  }
  private masonry(id:string,open:boolean[],point:(u:number,v:number)=>Vec,kind:'stone'|'brick') {
    const surface=roadSurface(this.scene,kind,0,0),wall=kind==='brick'?surface:this.scene.textures.get('foundation-stone').getSourceImage() as HTMLImageElement;
    const tint=kind==='brick'?{cap:'#e5af86',edge:'#734d3e'}:{cap:'#dfd7bf',edge:'#656864'};
    const deck=this.canvas('bridge-deck-'+id,ctx=>{
      // Opaque underpaint seals shared raster edges between ramp patches.
      ctx.fillStyle=kind==='brick'?'#aa7759':'#8d8d82';ctx.beginPath();
      for(const [edge,[a,b]] of CORNERS.entries())for(let i=0;i<2;i++){
        const p=point(a.x+(b.x-a.x)*i/2,a.y+(b.y-a.y)*i/2);
        if(edge===0&&i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      }
      ctx.closePath();ctx.fill();
      for(let y=0;y<4;y++)for(let x=0;x<4;x++){
        const u=x/4-.5,v=y/4-.5;
        this.quad(ctx,[point(u,v),point(u+.25,v),point(u+.25,v+.25),point(u,v+.25)],x*surface.width/4,y*surface.height/4,surface.width/4,surface.height/4,surface);
      }
      for(let e=0;e<2;e++)if(open[e]){
        const[a,b]=CORNERS[e];
        for(let i=0;i<2;i++){
          const p=point(a.x+(b.x-a.x)*i/2,a.y+(b.y-a.y)*i/2),q=point(a.x+(b.x-a.x)*(i+1)/2,a.y+(b.y-a.y)*(i+1)/2);
          this.quad(ctx,[p,q,{x:q.x,y:q.y+3},{x:p.x,y:p.y+3}],i*wall.width/2,0,wall.width/2,wall.height*.18,wall);
        }
      }
    });
    const supports=this.canvas('bridge-supports-'+id,ctx=>{
      for(let e=0;e<4;e++)if(open[e]){
        const[a,b]=CORNERS[e],p=iso(a.x,a.y),q=iso(b.x,b.y);
        const upper=(t:number)=>{
          const u=a.x+(b.x-a.x)*t,v=a.y+(b.y-a.y)*t;
          return point(u,v).y-iso(u,v).y;
        };
        ctx.save();ctx.transform(q.x-p.x,q.y-p.y,0,1,p.x,p.y);
        // Follow both halves of the ramp right up to the deck. A straight
        // chord between its endpoints exposed a triangular strip of water.
        ctx.beginPath();ctx.moveTo(0,upper(0));ctx.lineTo(.5,upper(.5));ctx.lineTo(1,upper(1));ctx.lineTo(1,9);ctx.lineTo(0,9);ctx.closePath();
        ctx.moveTo(.13,9);ctx.lineTo(.13,6);ctx.quadraticCurveTo(.5,-9,.87,6);ctx.lineTo(.87,9);ctx.closePath();ctx.clip('evenodd');
        ctx.drawImage(wall,0,0,wall.width,wall.height,0,-6,1,15);ctx.fillStyle='#20242224';ctx.fillRect(0,-6,1,15);ctx.restore();
        // Raised arch voussoirs follow the opening, rather than wooden pilings.
        ctx.strokeStyle=tint.cap;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x+(q.x-p.x)*.13,p.y+(q.y-p.y)*.13+6);ctx.quadraticCurveTo((p.x+q.x)/2,(p.y+q.y)/2-9,p.x+(q.x-p.x)*.87,p.y+(q.y-p.y)*.87+6);ctx.stroke();
      }
    });
    const rails=open.map((closed,e)=>!closed?null:this.canvas('bridge-rail-'+id+'-'+e,ctx=>{
      const[a,b]=CORNERS[e];
      for(let i=0;i<2;i++){
        const p=point(a.x+(b.x-a.x)*i/2,a.y+(b.y-a.y)*i/2),q=point(a.x+(b.x-a.x)*(i+1)/2,a.y+(b.y-a.y)*(i+1)/2);
        this.quad(ctx,[{x:p.x,y:p.y-8},{x:q.x,y:q.y-8},q,p],i*wall.width/2,0,wall.width/2,wall.height*.3,wall);
        ctx.strokeStyle=tint.edge;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-7);ctx.lineTo(q.x,q.y-7);ctx.stroke();
        ctx.strokeStyle=tint.cap;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(p.x,p.y-BRIDGE_PARAPET_HEIGHT);ctx.lineTo(q.x,q.y-BRIDGE_PARAPET_HEIGHT);ctx.stroke();
      }
    }));
    const result={deck,supports,rails};this.variants.set(id,result);return result;
  }
  redraw(sim: Simulation) {
    this.images.forEach((image) => image.destroy());
    this.images = [];
    for (const road of sim.roads) {
      const [x, y] = road.split(",").map(Number);
      if (!isBridge(sim.roads, x, y, sim.state.terrain)) continue;
      const p = iso(x, y),
        art = this.variant(sim, { x, y });
      const add = (texture: string, depth: number) =>
        this.images.push(
          this.scene.add
            .image(p.x - WIDTH / 2, p.y - HEIGHT / 2, texture)
            .setOrigin(0)
            .setScale(1 / RESOLUTION)
            .setDepth(depth),
        );
      add(art.supports, -997);
      add(art.deck, -996);
      art.rails.forEach((texture, edge) => {
        if (texture) add(texture, (x + y) * 32 + (edge < 2 ? 32 : 0));
      });
    }
  }
}
