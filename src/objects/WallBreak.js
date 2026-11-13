import {
  GAME_WIDTH, GAME_HEIGHT, WALL_BREAK_MS, WALL_DEPTH, WALL_LATE_MS, WALL_DEBRIS_LIFE_MS, WALL_DUST_LIFE_MS, WALL_DUST_COLOR,
  WALL_LINE_WIDTH, WALL_LINE_TOP, WALL_LINE_COLOR, WALL_RIM_COLOR, WALL_CAP_COLOR, WALL_CAP_OVERHANG, WALL_CAP_HEIGHT,
  WALL_GLOW_WIDTH, WALL_GLOW_ALPHA, WALL_DEBRIS_EDGE_COLOR,
} from '../config/gameConfig.js';
import { wallX, wallGap, gapStubs, debrisPieces, debrisState, dustPuffs, dustState, DUST_MAX_DELAY_MS } from '../wallBreak.js';

const OFFSCREEN_PAD = 40;   // keep drawing this far past each screen edge (camera shake / zoom punch)
const LINE_BOTTOM = GAME_HEIGHT + OFFSCREEN_PAD;
const GLOW_STEPS = 8;       // the right-side shadow fades out in this many strips
const DUST_KEY = 'wall-dust';
const DUST_SIZE = 64;

// The wall the runner breaks through at WALL_BREAK_MS, seen edge-on: a thin black line over the full height
// (see src/wallBreak.js for the maths). Before the impact its x comes from song time, so it meets the runner on
// the beat even after a `?t=` seek; on the impact frame it is redrawn with a gap broken out at the runner's row
// (fixed from then on) and follows the road's actual scroll (worldDx) until off-screen left, with a pooled
// burst of shards and dust puffs. One Graphics drawn in local coordinates, so a frame only moves it.
export class WallBreak {
  constructor(scene) {
    if (!scene.textures.exists(DUST_KEY)) makeDustTexture(scene);
    this.line = scene.add.graphics().setDepth(WALL_DEPTH).setVisible(false);
    this.draw(null);
    this.broken = false;
    this.x = 0;
    this.done = false;
    this.bursting = false;
    // Pooled up front so the impact frame doesn't allocate; burst() re-aims them at the runner's row
    // (a shard's size and colour don't depend on the row).
    this.shards = debrisPieces(1).map(piece => ({
      piece,
      rect: scene.add.rectangle(0, 0, piece.w, piece.h, piece.color)
        .setStrokeStyle(1, WALL_DEBRIS_EDGE_COLOR).setDepth(WALL_DEPTH + 0.1).setVisible(false),
    }));
    this.puffs = dustPuffs(1).map(puff => ({
      puff,
      image: scene.add.image(0, 0, DUST_KEY).setTint(WALL_DUST_COLOR).setDepth(WALL_DEPTH + 0.2).setVisible(false),
    }));
  }

  // The line with its glow, rim light and cap; with a gap ({ top, bottom }, plus the row for its stubs) the
  // stretch between is left out and both ends get jagged stubs.
  draw(gap, row) {
    const g = this.line.clear();
    const spans = gap ? [[WALL_LINE_TOP, gap.top], [gap.bottom, LINE_BOTTOM]] : [[WALL_LINE_TOP, LINE_BOTTOM]];
    const stripW = WALL_GLOW_WIDTH / GLOW_STEPS;
    for (const [y0, y1] of spans) {
      if (y1 <= y0) continue;
      for (let i = 0; i < GLOW_STEPS; i++) {
        g.fillStyle(0x000000, WALL_GLOW_ALPHA * (1 - i / GLOW_STEPS)).fillRect(WALL_LINE_WIDTH + i * stripW, y0, stripW, y1 - y0);
      }
      g.fillStyle(WALL_LINE_COLOR).fillRect(0, y0, WALL_LINE_WIDTH, y1 - y0);
      g.fillStyle(WALL_RIM_COLOR).fillRect(0, y0, 1, y1 - y0);
    }
    if (gap) {
      g.fillStyle(WALL_LINE_COLOR);
      for (const [x0, y0, x1, y1, x2, y2] of gapStubs(row)) g.fillTriangle(x0, y0, x1, y1, x2, y2);
    }
    g.fillStyle(WALL_CAP_COLOR)
      .fillRect(-WALL_CAP_OVERHANG, WALL_LINE_TOP - WALL_CAP_HEIGHT, WALL_LINE_WIDTH + 2 * WALL_CAP_OVERHANG, WALL_CAP_HEIGHT);
  }

  onScreen(x) {
    return x + WALL_LINE_WIDTH + WALL_GLOW_WIDTH > -OFFSCREEN_PAD && x - WALL_CAP_OVERHANG < GAME_WIDTH + OFFSCREEN_PAD;
  }

  // Returns true on the frame the wall breaks with the impact seen live (GameScene flashes on it).
  update(songMs, worldDx, row) {
    if (this.done) return false;
    if (songMs < WALL_BREAK_MS) {
      const x = wallX(songMs);
      this.line.setX(x).setVisible(this.onScreen(x));
      return false;
    }

    let impact = false;
    if (!this.broken) {
      this.broken = true;
      this.x = wallX(songMs);
      this.draw(wallGap(row), row);
      impact = songMs - WALL_BREAK_MS <= WALL_LATE_MS;
      if (impact) this.burst(row);
    } else {
      this.x -= worldDx;
    }

    const t = songMs - WALL_BREAK_MS;
    this.line.setX(this.x).setVisible(this.onScreen(this.x));
    if (this.bursting) {
      for (const { piece, rect } of this.shards) {
        const s = debrisState(piece, t);
        if (!s) { rect.setVisible(false); continue; }
        rect.setPosition(this.x + s.x, s.y).setRotation(s.angle).setAlpha(s.alpha).setVisible(true);
      }
      for (const { puff, image } of this.puffs) {
        const s = dustState(puff, t);
        if (!s) { image.setVisible(false); continue; }
        image.setPosition(this.x + s.x, s.y).setScale(s.scale).setAlpha(s.alpha).setVisible(true);
      }
    }

    const effectsOver = !this.bursting || t >= Math.max(WALL_DEBRIS_LIFE_MS, WALL_DUST_LIFE_MS + DUST_MAX_DELAY_MS);
    if (!this.onScreen(this.x) && this.x < 0 && effectsOver) {
      this.done = true;
      this.line.setVisible(false);
      for (const { rect } of this.shards) rect.setVisible(false);
      for (const { image } of this.puffs) image.setVisible(false);
    }
    return impact;
  }

  burst(row) {
    this.bursting = true;
    debrisPieces(row).forEach((piece, i) => { this.shards[i].piece = piece; });
    dustPuffs(row).forEach((puff, i) => { this.puffs[i].puff = puff; });
  }
}

// Soft white puff (tinted at runtime): a few overlapping radial gradients, ~35% opaque at the core.
// The texture outlives the scene (restart), so it is only made once.
function makeDustTexture(scene) {
  const tex = scene.textures.createCanvas(DUST_KEY, DUST_SIZE, DUST_SIZE);
  const ctx = tex.getContext();
  const c = DUST_SIZE / 2;
  for (const [dx, dy, r] of [[0, 0, 0.5], [-0.12, 0.06, 0.38], [0.12, -0.06, 0.38], [0.04, 0.12, 0.34]]) {
    const x = c + dx * DUST_SIZE;
    const y = c + dy * DUST_SIZE;
    const rad = r * DUST_SIZE;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.14)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, DUST_SIZE, DUST_SIZE);
  }
  tex.refresh();
}
