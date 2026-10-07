import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import type { BoardSpace, PlayerState } from '../game/economy.js';
import {
  START_CASH,
  START_BONUS,
  MAX_HOUSES,
  basePriceForTile,
  cityNameForTile,
  houseCost,
  landmarkCost,
  tollFor,
  takeoverPrice,
  describeTier,
  formatIDR
} from '../game/economy.js';

/* ————————————————— Luxury palette ————————————————— */
const C = {
  bg: 0x0b0e15,
  bgGlow: 0x14202e,
  panel: 0x111722,
  tile: 0x161d2b,
  tileEdge: 0x3a4660,
  gold: 0xd4af37,
  goldLight: 0xf5d67b,
  goldDark: 0x8a6d1f,
  text: 0xf2ead8,
  dim: 0x9aa3b5,
  green: 0x2fbf71,
  red: 0xe5484d,
  houseWall: 0xefe3cb,
  houseRoof: 0xa34a3a,
  towerGlass: 0x274b73
};

const TILE_TYPES: Record<number, 'Start' | 'Fortune' | 'Tax'> = {
  0: 'Start',
  8: 'Fortune',
  16: 'Tax',
  24: 'Fortune'
};

interface ModalButton {
  label: string;
  sub?: string;
  style?: 'gold' | 'ghost' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}

interface Player extends PlayerState {
  token?: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  private socket: Socket | null = null;
  private mode: string = 'local';

  private boardSpaces: BoardSpace[] = [];
  private players: Player[] = [];
  private currentPlayerIndex = 0;

  private tileLayer!: Phaser.GameObjects.Graphics;
  private buildLayer!: Phaser.GameObjects.Graphics;
  private playerPanels: Phaser.GameObjects.Container[] = [];

  private diceG: Phaser.GameObjects.Graphics[] = [];
  private dicePips: Phaser.GameObjects.Graphics[] = [];
  private diceText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private rollButton!: Phaser.GameObjects.Container;
  private rollLabel!: Phaser.GameObjects.Text;
  private modal: Phaser.GameObjects.Container | null = null;
  private busy = false;

  constructor() {
    super('GameScene');
  }

  init(data: { mode?: string }) {
    if (data && data.mode) this.mode = data.mode;
  }

  preload() {
    // Blueprint drawings generated with text-to-cad (parametric CAD models)
    this.load.svg('bp_house', 'cad/rumah_kecil.svg', { width: 420, height: 280 });
    this.load.svg('bp_landmark', 'cad/landmark.svg', { width: 420, height: 280 });
  }

  create() {
    const { width, height } = this.scale;

    this.drawBackdrop(width, height);
    this.buildBoardSpaces(width, height);
    this.drawTiles();
    this.buildLayer = this.add.graphics().setDepth(5);
    this.initPlayers();
    this.createPlayerPanels(width, height);
    this.createCenterUI(width, height);
    this.refreshBuildings();

    if (this.mode === 'online') {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3000';
      this.socket = io(socketUrl, { transports: ['websocket'] });
      this.socket.on('connect', () => console.log('Connected to server'));
    }
    this.events.on('shutdown', this.cleanup, this);

    this.log('Permainan dimulai. Pemain 1, kocok dadu!');
    this.updatePanels();
  }

  /* ════════════════ Backdrop ════════════════ */

  private drawBackdrop(width: number, height: number) {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(C.bg, 1);
    g.fillRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    for (let i = 6; i >= 1; i--) {
      g.fillStyle(C.bgGlow, 0.05 * i);
      g.fillCircle(cx, cy, 90 * i);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle(C.gold, 0.05 + Math.random() * 0.08);
      g.fillCircle(Math.random() * width, Math.random() * height, 1 + Math.random() * 1.5);
    }
  }

  /* ════════════════ Board ════════════════ */

  private buildBoardSpaces(width: number, height: number) {
    this.boardSpaces = [];
    const boardSize = Math.min(width, height) - 60;
    const startX = (width - boardSize) / 2;
    const startY = (height - boardSize) / 2;
    const n = 8;
    const sw = boardSize / n;

    const push = (x: number, y: number, index: number) => {
      const special = TILE_TYPES[index];
      this.boardSpaces.push({
        x,
        y,
        width: sw,
        height: sw,
        type: special ?? 'City',
        name:
          special === 'Start'
            ? 'START'
            : special === 'Fortune'
              ? 'Nasib'
              : special === 'Tax'
                ? 'Pajak'
                : cityNameForTile(index),
        ownerId: null,
        houses: 0,
        landmark: false,
        basePrice: basePriceForTile(index)
      });
    };

    for (let i = 0; i < n; i++) push(startX + boardSize - sw * (i + 1), startY + boardSize - sw, i);
    for (let i = 0; i < n; i++) push(startX, startY + boardSize - sw * (i + 1), 8 + i);
    for (let i = 0; i < n; i++) push(startX + sw * i, startY, 16 + i);
    for (let i = 0; i < n; i++) push(startX + boardSize - sw, startY + sw * i, 24 + i);
  }

  private drawTiles() {
    if (this.tileLayer) this.tileLayer.destroy();
    const g = this.add.graphics().setDepth(1);
    this.tileLayer = g;

    for (const s of this.boardSpaces) {
      const r = 8;
      g.fillStyle(C.tile, 1);
      g.fillRoundedRect(s.x + 1, s.y + 1, s.width - 2, s.height - 2, r);
      g.lineStyle(1.5, C.tileEdge, 1);
      g.strokeRoundedRect(s.x + 1, s.y + 1, s.width - 2, s.height - 2, r);

      if (s.ownerId !== null) {
        const owner = this.players[s.ownerId];
        const col = owner ? owner.color : 0x888888;
        g.fillStyle(col, 1);
        g.fillRoundedRect(s.x + 4, s.y + 4, s.width - 8, 7, 3);
        if (s.landmark) {
          g.lineStyle(2, C.gold, 1);
          g.strokeRoundedRect(s.x + 1, s.y + 1, s.width - 2, s.height - 2, r);
        }
      }

      const cx = s.x + s.width / 2;
      const labelColor = s.type === 'City' ? '#f2ead8' : '#f5d67b';
      this.add
        .text(cx, s.y + 15, s.name, {
          fontSize: '10px',
          color: labelColor,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: s.width - 8 }
        })
        .setOrigin(0.5, 0)
        .setDepth(2);

      if (s.type === 'City') {
        this.add
          .text(cx, s.y + s.height - 15, formatIDR(s.basePrice), {
            fontSize: '9px',
            color: '#9aa3b5'
          })
          .setOrigin(0.5, 1)
          .setDepth(2);
      } else {
        const icon = s.type === 'Start' ? 'GO' : s.type === 'Fortune' ? '?' : 'Rp';
        this.add
          .text(cx, s.y + s.height / 2 + 8, icon, {
            fontSize: '22px',
            color: '#d4af37',
            fontStyle: 'bold'
          })
          .setOrigin(0.5)
          .setDepth(2);
      }
    }
  }

  /* ════════════════ Pseudo-3D buildings ════════════════ */

  private refreshBuildings() {
    this.buildLayer.clear();
    for (const s of this.boardSpaces) {
      if (s.type !== 'City' || s.ownerId === null) continue;
      if (s.landmark) {
        this.drawLandmark(s.x + s.width / 2, s.y + s.height - 12, 30);
      } else {
        for (let h = 0; h < s.houses; h++) {
          const slotW = s.width / 3;
          const hx = s.x + slotW * (h + 0.5);
          this.drawHouse(hx, s.y + s.height - 14, 24, this.players[s.ownerId].color);
        }
      }
    }
  }

  /** Small 3D-ish house: shadow + shaded box + prism roof. (x, baseY) = bottom center. */
  private drawHouse(x: number, baseY: number, w: number, ownerColor: number) {
    const g = this.buildLayer;
    const h = w * 0.85;
    const dx = 5;
    const dy = 6;
    const roofH = w * 0.45;
    const lx = x - w / 2;
    const ty = baseY - h;

    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(x, baseY + 2, w + 8, 7);
    // side face
    g.fillStyle(0x9c8f74, 1);
    g.fillPoints(
      [
        { x: lx + w, y: ty },
        { x: lx + w + dx, y: ty - dy },
        { x: lx + w + dx, y: baseY - dy },
        { x: lx + w, y: baseY }
      ],
      true
    );
    // top face
    g.fillStyle(0xf7efdd, 1);
    g.fillPoints(
      [
        { x: lx, y: ty },
        { x: lx + w, y: ty },
        { x: lx + w + dx, y: ty - dy },
        { x: lx + dx, y: ty - dy }
      ],
      true
    );
    // front face
    g.fillStyle(C.houseWall, 1);
    g.fillRect(lx, ty, w, h);
    // owner door
    g.fillStyle(ownerColor, 1);
    g.fillRect(x - 3, baseY - h * 0.42, 6, h * 0.42);
    // roof front + side
    g.fillStyle(C.houseRoof, 1);
    g.fillTriangle(lx - 2, ty, lx + w + 2, ty, x, ty - roofH);
    g.fillStyle(0x7e382c, 1);
    g.fillPoints(
      [
        { x: lx + w + 2, y: ty },
        { x: x, y: ty - roofH },
        { x: x + dx, y: ty - roofH - dy },
        { x: lx + w + 2 + dx, y: ty - dy }
      ],
      true
    );
  }

  /** Grand landmark tower: gold halo + stepped glass tiers + spire. */
  private drawLandmark(x: number, baseY: number, w: number) {
    const g = this.buildLayer;
    g.fillStyle(C.gold, 0.16);
    g.fillCircle(x, baseY - 26, w * 1.5);
    g.fillStyle(C.gold, 0.08);
    g.fillCircle(x, baseY - 26, w * 2.1);

    const tiers: Array<[number, number]> = [
      [w, 20],
      [w * 0.72, 16],
      [w * 0.46, 13]
    ];
    let y = baseY;
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(x, baseY + 2, w * 2 + 10, 9);

    tiers.forEach(([tw, th], i) => {
      const lx = x - tw / 2;
      const ty = y - th;
      g.fillStyle(C.towerGlass, 1);
      g.fillRect(lx, ty, tw, th);
      g.fillStyle(i === 0 ? C.goldDark : C.gold, 1);
      g.fillRect(lx - 1, ty - 2, tw + 2, 3);
      g.fillStyle(0x16293f, 1);
      g.fillRect(lx + tw - 4, ty, 4, th);
      g.fillStyle(C.goldLight, 0.85);
      const wins = Math.max(2, Math.floor(tw / 9));
      for (let k = 0; k < wins; k++) {
        g.fillRect(lx + 4 + k * ((tw - 8) / wins), ty + 4, 3, th - 8);
      }
      y = ty;
    });

    g.fillStyle(C.gold, 1);
    g.fillTriangle(x - 3, y, x + 3, y, x, y - 14);
    const orb = this.add.circle(x, y - 17, 3.5, C.goldLight).setDepth(6);
    this.tweens.add({
      targets: orb,
      alpha: 0.35,
      scale: 1.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inout'
    });
  }

  /* ════════════════ Players & panels ════════════════ */

  private initPlayers() {
    const numPlayers = 2;
    const colors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d];
    const names = ['Pemain 1', 'Pemain 2', 'Pemain 3', 'Pemain 4'];

    for (let i = 0; i < numPlayers; i++) {
      const token = this.makeToken(colors[i]);
      const p: Player = {
        id: i,
        name: names[i],
        position: 0,
        color: colors[i],
        cash: START_CASH,
        bankrupt: false,
        token
      };
      this.players.push(p);
      this.placeToken(p, 0);
    }
  }

  private makeToken(color: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(10);
    const shadow = this.add.ellipse(0, 3, 26, 10, 0x000000, 0.4);
    const body = this.add.circle(0, 0, 11, color);
    const rim = this.add.circle(0, 0, 11).setStrokeStyle(2.5, 0xf2ead8, 1);
    const shine = this.add.circle(-3.5, -3.5, 3.5, 0xffffff, 0.55);
    c.add([shadow, body, rim, shine]);
    return c;
  }

  private placeToken(p: Player, tileIndex: number) {
    if (!p.token) return;
    const s = this.boardSpaces[tileIndex];
    const offX = p.id % 2 === 0 ? -11 : 11;
    const offY = p.id < 2 ? -11 : 11;
    p.token.setPosition(s.x + s.width / 2 + offX, s.y + s.height / 2 + offY);
  }

  private createPlayerPanels(width: number, height: number) {
    const defs = [
      { x: 16, y: 16 },
      { x: width - 236, y: 16 },
      { x: 16, y: height - 116 },
      { x: width - 236, y: height - 116 }
    ];
    for (let i = 0; i < 4; i++) {
      const d = defs[i];
      const c = this.add.container(d.x, d.y).setDepth(20);
      const g = this.add.graphics();
      g.fillStyle(C.panel, 0.92);
      g.fillRoundedRect(0, 0, 220, 100, 10);
      g.lineStyle(1.5, C.gold, 0.9);
      g.strokeRoundedRect(0, 0, 220, 100, 10);
      const name = this.add.text(14, 8, `Pemain ${i + 1}`, {
        fontSize: '15px',
        color: '#f5d67b',
        fontStyle: 'bold'
      });
      const info = this.add.text(14, 30, '', { fontSize: '13px', color: '#f2ead8', lineSpacing: 4 });
      info.setName('info');
      const turn = this.add.text(206, 8, '', { fontSize: '11px', color: '#0b0e15', fontStyle: 'bold', backgroundColor: '#d4af37', padding: { x: 6, y: 2 } });
      turn.setName('turn');
      turn.setOrigin(1, 0);
      c.add([g, name, info, turn]);
      if (i >= this.players.length) c.setVisible(false);
      this.playerPanels.push(c);
    }
  }

  private totalAssets(p: Player): number {
    let v = p.cash;
    for (const s of this.boardSpaces) {
      if (s.ownerId === p.id && s.type === 'City') {
        v += s.basePrice + s.houses * houseCost(s) + (s.landmark ? landmarkCost(s) : 0);
      }
    }
    return v;
  }

  private propertyCount(p: Player): { tiles: number; houses: number; landmarks: number } {
    let tiles = 0;
    let houses = 0;
    let landmarks = 0;
    for (const s of this.boardSpaces) {
      if (s.ownerId === p.id && s.type === 'City') {
        tiles++;
        houses += s.houses;
        if (s.landmark) landmarks++;
      }
    }
    return { tiles, houses, landmarks };
  }

  private updatePanels() {
    this.players.forEach((p, i) => {
      const panel = this.playerPanels[i];
      if (!panel) return;
      const info = panel.getByName('info') as Phaser.GameObjects.Text;
      const turn = panel.getByName('turn') as Phaser.GameObjects.Text;
      const pc = this.propertyCount(p);
      if (p.bankrupt) {
        info.setText(`BANGKRUT\nAset: ${formatIDR(0)}`);
        info.setColor('#e5484d');
      } else {
        info.setColor('#f2ead8');
        info.setText(
          `Kas: ${formatIDR(p.cash)}\nAset: ${formatIDR(this.totalAssets(p))}\n${pc.tiles} kav · ${pc.houses} rumah · ${pc.landmarks} landmark`
        );
      }
      const isTurn = i === this.currentPlayerIndex && !p.bankrupt;
      turn.setText(isTurn ? 'GILIRAN' : '');
    });
    const cur = this.players[this.currentPlayerIndex];
    if (cur && this.turnText) {
      this.turnText.setText(cur.bankrupt ? `${cur.name} bangkrut!` : `Giliran: ${cur.name}`);
    }
  }

  /* ════════════════ Center UI: dice + roll + log ════════════════ */

  private createCenterUI(width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2;

    this.turnText = this.add
      .text(cx, cy - 128, '', { fontSize: '20px', color: '#f5d67b', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(20);

    // dice pair
    for (let d = 0; d < 2; d++) {
      const g = this.add.graphics().setDepth(20);
      const pips = this.add.graphics().setDepth(21);
      this.diceG.push(g);
      this.dicePips.push(pips);
      const dx = cx - 42 + d * 84;
      (g as unknown as { homeX: number; homeY: number }).homeX = dx;
      (g as unknown as { homeY: number }).homeY = cy - 52;
      this.drawDie(d, 1);
    }

    this.diceText = this.add
      .text(cx, cy + 8, '—', { fontSize: '15px', color: '#9aa3b5' })
      .setOrigin(0.5)
      .setDepth(20);

    // roll button
    this.rollButton = this.add.container(cx, cy + 62).setDepth(20);
    const bg = this.add.graphics();
    bg.fillStyle(C.gold, 1);
    bg.fillRoundedRect(-95, -24, 190, 48, 12);
    bg.lineStyle(2, C.goldLight, 1);
    bg.strokeRoundedRect(-95, -24, 190, 48, 12);
    this.rollLabel = this.add
      .text(0, 0, 'KOCOK DADU', { fontSize: '18px', color: '#0b0e15', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.rollButton.add([bg, this.rollLabel]);
    this.rollButton.setSize(190, 48);
    this.rollButton.setInteractive({ useHandCursor: true });
    this.rollButton.on('pointerover', () => this.rollButton.setScale(1.05));
    this.rollButton.on('pointerout', () => this.rollButton.setScale(1));
    this.rollButton.on('pointerdown', () => this.rollDice());

    this.logText = this.add
      .text(cx, cy + 118, '', {
        fontSize: '13px',
        color: '#9aa3b5',
        align: 'center',
        wordWrap: { width: 420 }
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
  }

  private drawDie(d: number, value: number) {
    const g = this.diceG[d];
    const pips = this.dicePips[d];
    const home = g as unknown as { homeX: number; homeY: number };
    const s = 56;
    const x = home.homeX - s / 2;
    const y = home.homeY - s / 2;
    g.clear();
    pips.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x + 3, y + 5, s, s, 10);
    g.fillStyle(0xf2ead8, 1);
    g.fillRoundedRect(x, y, s, s, 10);
    g.lineStyle(2, C.goldDark, 1);
    g.strokeRoundedRect(x, y, s, s, 10);

    const cx = home.homeX;
    const cy = home.homeY;
    const o = 14;
    const pip = (px: number, py: number) => {
      pips.fillStyle(0x1a1a1a, 1);
      pips.fillCircle(px, py, 4.5);
    };
    const L = cx - o;
    const R = cx + o;
    const T = cy - o;
    const B = cy + o;
    if (value % 2 === 1) pip(cx, cy);
    if (value >= 2) {
      pip(L, T);
      pip(R, B);
    }
    if (value >= 4) {
      pip(R, T);
      pip(L, B);
    }
    if (value === 6) {
      pip(L, cy);
      pip(R, cy);
    }
  }

  private setRollEnabled(on: boolean) {
    this.busy = !on;
    if (on) {
      this.rollButton.setInteractive({ useHandCursor: true });
      this.rollButton.setAlpha(1);
    } else {
      this.rollButton.disableInteractive();
      this.rollButton.setAlpha(0.45);
    }
  }

  private log(msg: string) {
    this.logText.setText(msg);
  }

  /* ════════════════ Turn flow ════════════════ */

  private rollDice() {
    if (this.busy) return;
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.bankrupt) return;
    this.setRollEnabled(false);

    // dice shuffle animation
    let ticks = 0;
    const shuffle = this.time.addEvent({
      delay: 90,
      repeat: 7,
      callback: () => {
        ticks++;
        this.drawDie(0, 1 + Math.floor(Math.random() * 6));
        this.drawDie(1, 1 + Math.floor(Math.random() * 6));
        if (ticks >= 7) {
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          this.drawDie(0, d1);
          this.drawDie(1, d2);
          this.diceText.setText(`${d1} + ${d2} = ${d1 + d2}`);
          // pop
          this.diceG.forEach((g) => {
            g.setScale(1.25);
            this.tweens.add({ targets: g, scale: 1, duration: 220, ease: 'back.out' });
          });
          this.time.delayedCall(350, () => this.moveCurrentPlayer(d1 + d2));
        }
      }
    });
    void shuffle;
  }

  private moveCurrentPlayer(spaces: number) {
    const player = this.players[this.currentPlayerIndex];
    const total = this.boardSpaces.length;
    let step = 0;
    let pos = player.position;

    const hop = () => {
      pos = (pos + 1) % total;
      step++;
      // passing START
      if (pos === 0) {
        player.cash += START_BONUS;
        this.log(`${player.name} lewat START +${formatIDR(START_BONUS)}`);
      }
      const s = this.boardSpaces[pos];
      const offX = player.id % 2 === 0 ? -11 : 11;
      const offY = player.id < 2 ? -11 : 11;
      if (player.token) {
        this.tweens.add({
          targets: player.token,
          x: s.x + s.width / 2 + offX,
          y: s.y + s.height / 2 + offY,
          duration: 170,
          ease: 'quad.out',
          onComplete: () => {
            if (step < spaces) {
              hop();
            } else {
              player.position = pos;
              this.updatePanels();
              this.onLanded(player, this.boardSpaces[pos]);
            }
          }
        });
      }
    };
    hop();
  }

  private onLanded(player: Player, space: BoardSpace) {
    this.log(`${player.name} mendarat di ${space.name}.`);
    if (space.type === 'City') {
      this.handleCity(player, space);
    } else if (space.type === 'Fortune') {
      this.handleFortune(player);
    } else if (space.type === 'Tax') {
      this.handleTax(player);
    } else {
      // Start
      this.endTurn();
    }
  }

  /* ——— City: buy / build / upgrade / toll / takeover ——— */

  private handleCity(player: Player, space: BoardSpace) {
    if (space.ownerId === null) {
      // unowned → offer to buy
      const cost = space.basePrice;
      this.showModal({
        title: space.name,
        blueprint: 'bp_house',
        lines: [
          `Kavling ${describeTier(space)} — belum dimiliki.`,
          `Harga tanah: ${formatIDR(cost)}`,
          `Kas kamu: ${formatIDR(player.cash)}`
        ],
        buttons: [
          {
            label: 'Beli Tanah',
            sub: formatIDR(cost),
            style: 'gold',
            disabled: player.cash < cost,
            onClick: () => {
              player.cash -= cost;
              space.ownerId = player.id;
              this.drawTiles();
              this.refreshBuildings();
              this.updatePanels();
              this.log(`${player.name} membeli ${space.name}.`);
              // chain straight into building on the same visit
              this.offerBuild(player, space);
            }
          },
          { label: 'Lewati', style: 'ghost', onClick: () => this.endTurn() }
        ]
      });
      return;
    }

    if (space.ownerId === player.id) {
      // own tile
      if (space.landmark) {
        this.showModal({
          title: space.name,
          blueprint: 'bp_landmark',
          lines: ['Landmark megah berdiri di sini.', 'Tidak ada yang bisa mengambil alihnya.'],
          buttons: [{ label: 'Tutup', style: 'gold', onClick: () => this.endTurn() }]
        });
      } else if (space.houses >= MAX_HOUSES) {
        this.offerLandmark(player, space);
      } else {
        this.offerBuild(player, space);
      }
      return;
    }

    // opponent's tile
    const owner = this.players[space.ownerId];
    if (space.landmark) {
      const toll = tollFor(space);
      this.showModal({
        title: `${space.name} — Landmark`,
        blueprint: 'bp_landmark',
        lines: [
          `Milik ${owner.name}. Landmark TIDAK bisa diambil alih.`,
          `Tol: ${formatIDR(toll)}`
        ],
        buttons: [
          {
            label: 'Bayar Tol',
            sub: formatIDR(toll),
            style: 'danger',
            onClick: () => {
              this.transfer(player, owner, toll, `membayar tol ${formatIDR(toll)} ke ${owner.name}`);
              this.afterPayment(player);
            }
          }
        ]
      });
      return;
    }

    const toll = tollFor(space);
    const price = takeoverPrice(space);
    this.showModal({
      title: `${space.name} — ${describeTier(space)}`,
      blueprint: 'bp_house',
      lines: [
        `Milik ${owner.name}. Rumah kecil BISA diambil alih.`,
        `Tol: ${formatIDR(toll)}`,
        `Ambil alih: ${price !== null ? formatIDR(price) : '-'} (milikmu selamanya)`
      ],
      buttons: [
        {
          label: 'Bayar Tol',
          sub: formatIDR(toll),
          style: 'ghost',
          onClick: () => {
            this.transfer(player, owner, toll, `membayar tol ${formatIDR(toll)} ke ${owner.name}`);
            this.afterPayment(player);
          }
        },
        {
          label: 'Ambil Alih',
          sub: price !== null ? formatIDR(price) : '',
          style: 'gold',
          disabled: price === null || player.cash < price,
          onClick: () => {
            if (price === null) return;
            player.cash -= price;
            if (owner) owner.cash += price;
            const prevOwner = owner ? owner.name : '?';
            space.ownerId = player.id;
            this.drawTiles();
            this.refreshBuildings();
            this.updatePanels();
            this.log(`${player.name} mengambil alih ${space.name} dari ${prevOwner}!`);
            this.checkBankrupt(player, () => this.endTurn());
          }
        }
      ]
    });
  }

  /** Build houses on own tile (up to MAX_HOUSES), chained in one visit. */
  private offerBuild(player: Player, space: BoardSpace) {
    const cost = houseCost(space);
    const canBuild = space.houses < MAX_HOUSES && player.cash >= cost;
    this.showModal({
      title: `${space.name} — ${describeTier(space)}`,
      blueprint: 'bp_house',
      lines: [
        `Rumah kecil: ${space.houses}/${MAX_HOUSES}`,
        `Biaya 1 rumah: ${formatIDR(cost)}`,
        space.houses >= MAX_HOUSES
          ? 'Sudah maksimal. Kunjungi lagi untuk upgrade ke Landmark.'
          : 'Bangun sekarang, atau kembali lagi nanti.'
      ],
      buttons: [
        {
          label: `Bangun Rumah (${space.houses + 1}/${MAX_HOUSES})`,
          sub: formatIDR(cost),
          style: 'gold',
          disabled: !canBuild,
          onClick: () => {
            player.cash -= cost;
            space.houses += 1;
            this.refreshBuildings();
            this.updatePanels();
            this.log(`${player.name} membangun rumah ke-${space.houses} di ${space.name}.`);
            if (space.houses >= MAX_HOUSES) {
              this.offerLandmark(player, space);
            } else {
              this.offerBuild(player, space);
            }
          }
        },
        { label: 'Selesai', style: 'ghost', onClick: () => this.endTurn() }
      ]
    });
  }

  /** Upgrade 3 houses → landmark. */
  private offerLandmark(player: Player, space: BoardSpace) {
    const cost = landmarkCost(space);
    this.showModal({
      title: `${space.name} — Siap Upgrade!`,
      blueprint: 'bp_landmark',
      lines: [
        '3 rumah kecil berdiri di sini.',
        `Upgrade ke LANDMARK: ${formatIDR(cost)}`,
        'Landmark kebal dari ambil alih lawan. Tol naik drastis.'
      ],
      buttons: [
        {
          label: 'Upgrade ke Landmark',
          sub: formatIDR(cost),
          style: 'gold',
          disabled: player.cash < cost,
          onClick: () => {
            player.cash -= cost;
            space.houses = 0;
            space.landmark = true;
            this.drawTiles();
            this.refreshBuildings();
            this.updatePanels();
            this.log(`${player.name} membangun LANDMARK di ${space.name}!`);
            this.endTurn();
          }
        },
        { label: 'Nanti Saja', style: 'ghost', onClick: () => this.endTurn() }
      ]
    });
  }

  private handleFortune(player: Player) {
    const roll = Math.random();
    if (roll < 0.35) {
      const gain = 150_000;
      player.cash += gain;
      this.showModal({
        title: 'Kartu Nasib',
        lines: [`Rezeki nomplok! +${formatIDR(gain)}`],
        buttons: [{ label: 'Mantap', style: 'gold', onClick: () => this.endTurn() }]
      });
    } else if (roll < 0.7) {
      const loss = 120_000;
      this.showModal({
        title: 'Kartu Nasib',
        lines: [`Apes! -${formatIDR(loss)}`],
        buttons: [
          {
            label: 'Terima',
            style: 'danger',
            onClick: () => {
              player.cash -= loss;
              this.afterPayment(player);
            }
          }
        ]
      });
    } else {
      this.showModal({
        title: 'Kartu Nasib',
        lines: ['Perintah direksi: maju ke START!'],
        buttons: [
          {
            label: 'Jalankan',
            style: 'gold',
            onClick: () => {
              player.position = 0;
              if (player.token) {
                const s = this.boardSpaces[0];
                player.token.setPosition(s.x + s.width / 2, s.y + s.height / 2);
              }
              player.cash += START_BONUS;
              this.updatePanels();
              this.log(`${player.name} kembali ke START +${formatIDR(START_BONUS)}`);
              this.endTurn();
            }
          }
        ]
      });
    }
  }

  private handleTax(player: Player) {
    const tax = 150_000;
    this.showModal({
      title: 'Kantor Pajak',
      lines: [`Bayar pajak: ${formatIDR(tax)}`, `Kas kamu: ${formatIDR(player.cash)}`],
      buttons: [
        {
          label: 'Bayar',
          sub: formatIDR(tax),
          style: 'danger',
          onClick: () => {
            player.cash -= tax;
            this.afterPayment(player);
          }
        }
      ]
    });
  }

  /* ——— Money & elimination ——— */

  private transfer(from: Player, to: Player | undefined, amount: number, msg: string) {
    from.cash -= amount;
    if (to) to.cash += amount;
    this.log(`${from.name} ${msg}.`);
    this.updatePanels();
  }

  private afterPayment(player: Player) {
    this.checkBankrupt(player, () => this.endTurn());
  }

  private checkBankrupt(player: Player, done: () => void) {
    if (player.cash >= 0) {
      this.updatePanels();
      done();
      return;
    }
    player.bankrupt = true;
    // release properties
    for (const s of this.boardSpaces) {
      if (s.ownerId === player.id) {
        s.ownerId = null;
        s.houses = 0;
        s.landmark = false;
      }
    }
    if (player.token) player.token.setAlpha(0.25);
    this.drawTiles();
    this.refreshBuildings();
    this.updatePanels();
    this.log(`${player.name} BANGKRUT! Propertinya dilelang kembali.`);
    const alive = this.players.filter((p) => !p.bankrupt);
    if (alive.length <= 1) {
      this.showVictory(alive[0]);
      return;
    }
    this.showModal({
      title: 'Bangkrut!',
      lines: [`${player.name} kehabisan kas.`, 'Semua propertinya kembali ke pasar.'],
      buttons: [{ label: 'Lanjut', style: 'gold', onClick: () => done() }]
    });
  }

  private showVictory(winner: Player | undefined) {
    const name = winner ? winner.name : '—';
    const assets = winner ? formatIDR(this.totalAssets(winner)) : '-';
    this.showModal({
      title: 'PEMENANG',
      blueprint: 'bp_landmark',
      lines: [`${name} menguasai kota!`, `Total aset: ${assets}`],
      buttons: [
        {
          label: 'Main Lagi',
          style: 'gold',
          onClick: () => this.scene.restart({ mode: this.mode })
        }
      ]
    });
  }

  private endTurn() {
    this.closeModal();
    const alive = this.players.filter((p) => !p.bankrupt);
    if (alive.length <= 1) {
      this.showVictory(alive[0]);
      return;
    }
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.players[this.currentPlayerIndex].bankrupt);
    this.updatePanels();
    this.setRollEnabled(true);
  }

  /* ════════════════ Modal system ════════════════ */

  private showModal(opts: { title: string; lines: string[]; buttons: ModalButton[]; blueprint?: string }) {
    this.closeModal();
    const { width, height } = this.scale;
    const m = this.add.container(0, 0).setDepth(100);
    this.modal = m;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65);
    overlay.setInteractive();

    const pw = 560;
    const ph = 200 + opts.lines.length * 26 + (opts.blueprint ? 150 : 0);
    const px = width / 2 - pw / 2;
    const py = height / 2 - ph / 2;

    const panel = this.add.graphics();
    panel.fillStyle(C.panel, 0.98);
    panel.fillRoundedRect(px, py, pw, ph, 16);
    panel.lineStyle(2, C.gold, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 16);
    panel.lineStyle(1, C.gold, 0.35);
    panel.strokeRoundedRect(px + 6, py + 6, pw - 12, ph - 12, 12);

    const title = this.add
      .text(width / 2, py + 28, opts.title, {
        fontSize: '22px',
        color: '#f5d67b',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: pw - 60 }
      })
      .setOrigin(0.5, 0);

    m.add([overlay, panel, title]);
    let y = py + 66;

    if (opts.blueprint && this.textures.exists(opts.blueprint)) {
      const img = this.add.image(width / 2, y + 70, opts.blueprint).setOrigin(0.5, 0);
      img.setDisplaySize(300, 200);
      // dark blueprint plate behind
      const plate = this.add.graphics();
      plate.fillStyle(0x1e1e28, 1);
      plate.fillRoundedRect(width / 2 - 158, y - 6, 316, 152, 8);
      plate.lineStyle(1, 0x7dd3fc, 0.5);
      plate.strokeRoundedRect(width / 2 - 158, y - 6, 316, 152, 8);
      m.add(plate);
      m.add(img);
      m.sendToBack(plate);
      y += 156;
    }

    for (const line of opts.lines) {
      const t = this.add
        .text(width / 2, y, line, {
          fontSize: '14px',
          color: '#f2ead8',
          align: 'center',
          wordWrap: { width: pw - 60 }
        })
        .setOrigin(0.5, 0);
      m.add(t);
      y += 26;
    }

    // buttons row
    const btnW = Math.min(220, (pw - 60) / opts.buttons.length - 12);
    const totalW = opts.buttons.length * (btnW + 12) - 12;
    let bx = width / 2 - totalW / 2;
    const by = py + ph - 64;

    opts.buttons.forEach((b) => {
      const btn = this.add.container(bx + btnW / 2, by + 22);
      const bg = this.add.graphics();
      const fill = b.style === 'gold' ? C.gold : b.style === 'danger' ? 0x7a2e2e : 0x232c3f;
      const edge = b.style === 'gold' ? C.goldLight : b.style === 'danger' ? C.red : C.tileEdge;
      const alpha = b.disabled ? 0.35 : 1;
      bg.fillStyle(fill, alpha);
      bg.fillRoundedRect(-btnW / 2, -22, btnW, 44, 10);
      bg.lineStyle(1.5, edge, alpha);
      bg.strokeRoundedRect(-btnW / 2, -22, btnW, 44, 10);
      const label = this.add
        .text(0, b.sub ? -8 : 0, b.label, {
          fontSize: '14px',
          color: b.style === 'gold' ? '#0b0e15' : '#f2ead8',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: btnW - 16 }
        })
        .setOrigin(0.5);
      btn.add([bg, label]);
      if (b.sub) {
        const sub = this.add
          .text(0, 9, b.sub, {
            fontSize: '11px',
            color: b.style === 'gold' ? '#0b0e15' : '#9aa3b5'
          })
          .setOrigin(0.5);
        btn.add(sub);
      }
      if (!b.disabled) {
        btn.setSize(btnW, 44);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setScale(1.04));
        btn.on('pointerout', () => btn.setScale(1));
        btn.on('pointerdown', () => b.onClick());
      }
      m.add(btn);
      bx += btnW + 12;
    });

    // entrance animation
    m.setAlpha(0);
    m.setScale(0.96);
    this.tweens.add({ targets: m, alpha: 1, scale: 1, duration: 220, ease: 'quad.out' });
  }

  private closeModal() {
    if (this.modal) {
      this.modal.destroy(true);
      this.modal = null;
    }
  }

  private cleanup() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.closeModal();
  }
}
