import Phaser from "phaser";

const PREFERENCE = "little-works.smooth-artwork";
let smooth = true;
try {
  smooth = localStorage.getItem(PREFERENCE) !== "false";
} catch {
  /* Rendering still works when device storage is unavailable. */
}

export const smoothArtwork = () => smooth;
const filter = () =>
  smooth
    ? Phaser.Textures.FilterMode.LINEAR
    : Phaser.Textures.FilterMode.NEAREST;
const filterTexture = (_key: string, texture: Phaser.Textures.Texture) =>
  texture.setFilter(filter());

function apply(game: Phaser.Game) {
  document.documentElement.dataset.artwork = smooth ? "smooth" : "crisp";
  game.canvas.style.imageRendering = smooth ? "auto" : "pixelated";
  // Also controls newly created and refreshed terrain/foundation canvases.
  (game.renderer.config as { antialias: boolean }).antialias = smooth;
  if (game.renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer)
    game.renderer.antialias = smooth;
  for (const key of game.textures.getTextureKeys())
    game.textures.get(key).setFilter(filter());
}

export function setupArtworkScaling(game: Phaser.Game) {
  apply(game);
  game.textures.on(Phaser.Textures.Events.ADD, filterTexture);
  game.events.once(Phaser.Core.Events.DESTROY, () =>
    game.textures.off(Phaser.Textures.Events.ADD, filterTexture),
  );
}

export function setArtworkSmoothing(game: Phaser.Game, enabled: boolean) {
  smooth = enabled;
  apply(game);
  try {
    localStorage.setItem(PREFERENCE, String(smooth));
  } catch {
    /* Keep this session's choice. */
  }
}
