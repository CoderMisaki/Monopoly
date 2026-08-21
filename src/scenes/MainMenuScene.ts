import { Howler } from 'howler';

export class MainMenuScene {
  private container: HTMLDivElement;

  constructor(parent: HTMLDivElement) {
    this.container = parent;
  }

  create() {
    this.container.innerHTML = `
      <div id="main-menu" style="
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        font-family: 'Arial', sans-serif;
        text-align: center;
        z-index: 1000;
      ">
        <h1 style="font-size: 4em; margin-bottom: 50px;">City Empire</h1>
        <button id="local-play-button" style="
          font-size: 2em;
          padding: 15px 30px;
          margin: 10px;
          cursor: pointer;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          transition: background-color 0.3s ease;
        ">Local Play</button>
        <button id="online-play-button" style="
          font-size: 2em;
          padding: 15px 30px;
          margin: 10px;
          cursor: pointer;
          background-color: #008CBA;
          color: white;
          border: none;
          border-radius: 8px;
          transition: background-color 0.3s ease;
        ">Online Play</button>
      </div>
    `;

    document.getElementById('local-play-button')?.addEventListener('click', () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      // Assuming startGame is globally available via window
      (window as any).startGame('local');
    });

    document.getElementById('online-play-button')?.addEventListener('click', () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      (window as any).startGame('online');
    });
  }
}
