import { Howler } from 'howler';

/**
 * MainMenuScene — luxury DOM overlay.
 * Dark obsidian + gold leaf aesthetic, blueprint line motif.
 */
export class MainMenuScene {
  private container: HTMLDivElement;

  constructor(parent: HTMLDivElement) {
    this.container = parent;
  }

  create() {
    this.container.innerHTML = `
      <div id="main-menu" style="
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        background:
          radial-gradient(ellipse 70% 55% at 50% 42%, rgba(20,32,46,0.95) 0%, rgba(11,14,21,0.98) 70%),
          #0b0e15;
        color: #f2ead8;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        text-align: center; z-index: 1000; overflow: hidden;
      ">
        <div style="
          position: absolute; inset: 24px;
          border: 1px solid rgba(212,175,55,0.35);
          pointer-events: none;
        "></div>
        <div style="
          position: absolute; inset: 30px;
          border: 1px solid rgba(212,175,55,0.15);
          pointer-events: none;
        "></div>

        <div style="
          font-size: 13px; letter-spacing: 0.55em; text-indent: 0.55em;
          color: #9aa3b5; margin-bottom: 18px; text-transform: uppercase;
        ">Permainan Strategi Properti</div>

        <h1 style="
          font-family: 'Cinzel', Georgia, serif;
          font-size: clamp(3rem, 8vw, 5.5rem);
          font-weight: 700; margin: 0 0 8px 0; line-height: 1.05;
          color: #f5d67b;
          text-shadow: 0 2px 24px rgba(212,175,55,0.25);
        ">CITY EMPIRE</h1>

        <div style="
          width: 220px; height: 1px; margin: 18px 0 14px 0;
          background: linear-gradient(90deg, transparent, #d4af37, transparent);
        "></div>

        <p style="
          max-width: 520px; color: #9aa3b5; font-size: 15px; line-height: 1.7;
          margin: 0 24px 42px 24px;
        ">
          Bangun hingga <b style="color:#f2ead8">3 rumah kecil</b> di setiap kavling,
          upgrade menjadi <b style="color:#f5d67b">Landmark</b> yang kebal ambil alih,
          dan rebut properti lawan sebelum mereka merebut milikmu.
        </p>

        <button id="local-play-button" style="${MainMenuScene.btnStyle(false)}">Main Lokal</button>
        <button id="online-play-button" style="${MainMenuScene.btnStyle(true)}">Main Online</button>

        <div style="margin-top: 34px; font-size: 12px; color: #5b6373; letter-spacing: 0.2em;">
          2 PEMAIN &nbsp;·&nbsp; 32 KAVLING &nbsp;·&nbsp; TANPA AMPUN
        </div>
      </div>
    `;

    const resume = () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') void Howler.ctx.resume();
    };
    document.getElementById('local-play-button')?.addEventListener('click', () => {
      resume();
      (window as unknown as { startGame: (m: string) => void }).startGame('local');
    });
    document.getElementById('online-play-button')?.addEventListener('click', () => {
      resume();
      (window as unknown as { startGame: (m: string) => void }).startGame('online');
    });
  }

  private static btnStyle(ghost: boolean): string {
    const base = `
      display: block; width: 300px; max-width: 78vw;
      font-family: 'Cinzel', Georgia, serif;
      font-size: 17px; font-weight: 700; letter-spacing: 0.18em; text-indent: 0.18em;
      padding: 16px 0; margin: 9px; cursor: pointer;
      border-radius: 10px; text-transform: uppercase;
      transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
    `;
    if (ghost) {
      return (
        base +
        `background: rgba(212,175,55,0.06); color: #f5d67b;
         border: 1px solid rgba(212,175,55,0.55);`
      );
    }
    return (
      base +
      `background: linear-gradient(180deg, #f5d67b 0%, #d4af37 55%, #a8842a 100%);
       color: #0b0e15; border: 1px solid #f5d67b;
       box-shadow: 0 6px 28px rgba(212,175,55,0.28);`
    );
  }
}
