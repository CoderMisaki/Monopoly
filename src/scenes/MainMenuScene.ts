import { Howler } from 'howler';
import { startGame } from '../main.js'; // Import startGame from main.ts

export class MainMenuScene {
  private uiContainer: HTMLElement | null = null;
  private menuElements: HTMLElement[] = [];

  constructor() {
    console.log('MainMenuScene initialized');
  }

  create() {
    this.uiContainer = document.getElementById('ui-container');
    if (!this.uiContainer) {
      console.error('UI Container not found!');
      return;
    }

    // Main menu styling for DOM elements
    const menuStyle = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;
      font-family: sans-serif;
      pointer-events: auto; /* Allow interaction */
    `;

    const titleElement = document.createElement('h1');
    titleElement.style.cssText = `
      font-size: 48px;
      margin-bottom: 30px;
    `;
    titleElement.textContent = 'City Empire';
    this.menuElements.push(titleElement);

    const localPlayButton = document.createElement('button');
    localPlayButton.style.cssText = `
      font-size: 32px;
      padding: 15px 30px;
      margin: 10px;
      cursor: pointer;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      transition: background-color 0.2s;
    `;
    localPlayButton.textContent = 'Local Play';
    localPlayButton.onmouseover = () => localPlayButton.style.backgroundColor = '#0056b3';
    localPlayButton.onmouseout = () => localPlayButton.style.backgroundColor = '#007bff';
    localPlayButton.onclick = () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      startGame('local');
    };
    this.menuElements.push(localPlayButton);

    const onlinePlayButton = document.createElement('button');
    onlinePlayButton.style.cssText = `
      font-size: 32px;
      padding: 15px 30px;
      margin: 10px;
      cursor: pointer;
      background-color: #28a745;
      color: white;
      border: none;
      border-radius: 5px;
      transition: background-color 0.2s;
    `;
    onlinePlayButton.textContent = 'Online Play';
    onlinePlayButton.onmouseover = () => onlinePlayButton.style.backgroundColor = '#218838';
    onlinePlayButton.onmouseout = () => onlinePlayButton.style.backgroundColor = '#28a745';
    onlinePlayButton.onclick = () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      startGame('online');
    };
    this.menuElements.push(onlinePlayButton);

    const menuWrapper = document.createElement('div');
    menuWrapper.id = 'main-menu-wrapper';
    menuWrapper.style.cssText = menuStyle;
    this.menuElements.forEach(el => menuWrapper.appendChild(el));
    this.uiContainer.appendChild(menuWrapper);
  }

  show() {
    const menuWrapper = document.getElementById('main-menu-wrapper');
    if (menuWrapper) {
      menuWrapper.style.display = 'block';
    }
  }

  hide() {
    const menuWrapper = document.getElementById('main-menu-wrapper');
    if (menuWrapper) {
      menuWrapper.style.display = 'none';
    }
  }

  cleanup() {
    const menuWrapper = document.getElementById('main-menu-wrapper');
    if (menuWrapper && this.uiContainer) {
      this.uiContainer.removeChild(menuWrapper);
    }
    this.menuElements = [];
    this.uiContainer = null;
  }
}
