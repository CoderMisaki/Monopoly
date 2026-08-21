import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import { gsap } from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Optional: for development camera control
import { showMainMenu } from '../main.js'; // Import function to return to main menu

interface BoardSpace {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

interface Player {
  id: number;
  token: THREE.Mesh;
  position: number;
  color: THREE.Color;
}

export class GameScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rendererDomElement: HTMLElement;
  private controls: OrbitControls | null = null; // Optional controls

  private socket: Socket | null = null;
  private mode: string = 'local';
  private boardGroup!: THREE.Group; // Group to hold all board elements
  private boardSpaces: BoardSpace[] = [];
  private players: Player[] = [];
  private currentPlayerIndex: number = 0;

  // DOM UI elements
  private uiContainer!: HTMLElement;
  private gameTitleElement!: HTMLHeadingElement;
  private statusTextElement!: HTMLParagraphElement;
  private diceTextElement!: HTMLParagraphElement;
  private rollButtonElement!: HTMLButtonElement;
  private backToMenuButton!: HTMLButtonElement;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, rendererDomElement: HTMLElement) {
    this.scene = scene;
    this.camera = camera;
    this.rendererDomElement = rendererDomElement; // Used to manage its visibility
  }

  init(data: { mode?: string }) {
    if (data && data.mode) {
      this.mode = data.mode;
    }
    // Setup OrbitControls if desired for development
    // this.controls = new OrbitControls(this.camera, this.rendererDomElement);
    // this.controls.enableDamping = true; // An animation loop is required when damping is enabled
    // this.controls.dampingFactor = 0.05;
  }

  create() {
    this.setupLights();
    this.drawBoard3D();
    this.initPlayers3D();
    this.setupUI();

    if (this.mode === 'online') {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3000';
      this.socket = io(socketUrl, {
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server (Three.js game)');
      });
      // Add more socket event listeners here as needed for online play
    }
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  private drawBoard3D() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    // Basic board dimensions
    const boardWidth = 20;
    const boardHeight = 20; // Z-dimension in Three.js
    const boardThickness = 0.5;
    const spaceSize = boardWidth / 10; // 10 spaces per side including corners

    const boardBaseGeometry = new THREE.BoxGeometry(boardWidth, boardThickness, boardHeight);
    const boardBaseMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const boardBase = new THREE.Mesh(boardBaseGeometry, boardBaseMaterial);
    boardBase.position.y = -boardThickness / 2; // Sit on the ground plane
    boardBase.receiveShadow = true;
    this.boardGroup.add(boardBase);

    // Create 40 spaces
    // Calculate space coordinates (starting from bottom right corner - "GO")
    // In Three.js, Y is up, X is right, Z is forward/back.
    // Let's map Phaser's (x, y) to Three.js's (x, z).
    const spacesPerSide = 10;
    const actualSpaceSize = spaceSize;
    const halfBoard = boardWidth / 2;
    const spaceThickness = 0.1;

    // Helper to add a space
    const addSpace = (x: number, z: number, color: THREE.ColorRepresentation = 0x555555) => {
      const spaceGeometry = new THREE.BoxGeometry(actualSpaceSize, spaceThickness, actualSpaceSize);
      const spaceMaterial = new THREE.MeshPhongMaterial({ color: color, flatShading: true });
      const spaceMesh = new THREE.Mesh(spaceGeometry, spaceMaterial);
      spaceMesh.position.set(x, 0, z); // Y=0 means on top of the base
      spaceMesh.receiveShadow = true;
      this.boardGroup.add(spaceMesh);
      this.boardSpaces.push({ x: x, y: 0, z: z, width: actualSpaceSize, height: spaceThickness, depth: actualSpaceSize });
    };

    // Bottom row (0 to 9) - Moving left along X (decreasing X)
    for (let i = 0; i < spacesPerSide; i++) {
      const x = halfBoard - actualSpaceSize / 2 - i * actualSpaceSize;
      const z = -halfBoard + actualSpaceSize / 2;
      addSpace(x, z, i === 0 ? 0x00ff00 : 0x555555); // GO space is green
    }

    // Left column (10 to 19) - Moving up along Z (decreasing Z)
    for (let i = 1; i < spacesPerSide; i++) { // Skip corner 9 (already added as part of bottom row)
      const x = -halfBoard + actualSpaceSize / 2;
      const z = -halfBoard + actualSpaceSize / 2 + i * actualSpaceSize;
      addSpace(x, z);
    }

    // Top row (20 to 29) - Moving right along X (increasing X)
    for (let i = 1; i < spacesPerSide; i++) { // Skip corner 19
      const x = -halfBoard + actualSpaceSize / 2 + i * actualSpaceSize;
      const z = halfBoard - actualSpaceSize / 2;
      addSpace(x, z);
    }

    // Right column (30 to 39) - Moving down along Z (increasing Z)
    for (let i = 1; i < spacesPerSide - 1; i++) { // Skip corners 29 and 0 (already added)
      const x = halfBoard - actualSpaceSize / 2;
      const z = halfBoard - actualSpaceSize / 2 - i * actualSpaceSize;
      addSpace(x, z);
    }
  }

  private initPlayers3D() {
    const numPlayers = 2; // For local play
    const colors = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00]; // Red, Blue, Green, Yellow

    for (let i = 0; i < numPlayers; i++) {
      const startSpace = this.boardSpaces[0]; // "GO" space

      // Token geometry (e.g., small cylinder)
      const tokenRadius = 0.3;
      const tokenHeight = 1;
      const tokenGeometry = new THREE.CylinderGeometry(tokenRadius, tokenRadius, tokenHeight, 16);
      const tokenMaterial = new THREE.MeshPhongMaterial({ color: colors[i] });
      const token = new THREE.Mesh(tokenGeometry, tokenMaterial);

      // Offset tokens slightly so they don't overlap
      const offsetX = (i % 2 === 0 ? -0.5 : 0.5) * tokenRadius;
      const offsetZ = (i < 2 ? -0.5 : 0.5) * tokenRadius;

      token.position.set(
        startSpace.x + offsetX,
        startSpace.height / 2 + tokenHeight / 2, // Place token on top of the space
        startSpace.z + offsetZ
      );
      token.castShadow = true;
      this.boardGroup.add(token);

      this.players.push({
        id: i,
        token: token,
        position: 0,
        color: new THREE.Color(colors[i])
      });
    }
  }

  private setupUI() {
    this.uiContainer = document.getElementById('ui-container')!;
    this.uiContainer.style.pointerEvents = 'auto'; // Re-enable pointer events for UI

    // Game Title
    this.gameTitleElement = document.createElement('h2');
    this.gameTitleElement.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffffff;
      font-size: 28px;
      font-family: sans-serif;
      text-align: center;
    `;
    this.gameTitleElement.textContent = `City Empire - ${this.mode.toUpperCase()} Mode`;
    this.uiContainer.appendChild(this.gameTitleElement);

    // Status Text
    this.statusTextElement = document.createElement('p');
    this.statusTextElement.style.cssText = `
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      color: ${this.players[this.currentPlayerIndex].color.getHexString()};
      font-size: 24px;
      font-family: sans-serif;
      text-align: center;
    `;
    this.statusTextElement.textContent = `Player ${this.currentPlayerIndex + 1}'s Turn`;
    this.uiContainer.appendChild(this.statusTextElement);

    // Dice Text
    this.diceTextElement = document.createElement('p');
    this.diceTextElement.style.cssText = `
      position: absolute;
      top: 130px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffffff;
      font-size: 36px;
      font-family: sans-serif;
      text-align: center;
    `;
    this.diceTextElement.textContent = 'Dice: --';
    this.uiContainer.appendChild(this.diceTextElement);

    // Roll Button
    this.rollButtonElement = document.createElement('button');
    this.rollButtonElement.style.cssText = `
      position: absolute;
      top: 200px;
      left: 50%;
      transform: translateX(-50%);
      padding: 15px 30px;
      font-size: 28px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    this.rollButtonElement.textContent = 'Roll Dice';
    this.rollButtonElement.onmouseover = () => this.rollButtonElement.style.backgroundColor = '#0056b3';
    this.rollButtonElement.onmouseout = () => this.rollButtonElement.style.backgroundColor = '#007bff';
    this.rollButtonElement.onclick = () => this.rollDice();
    this.uiContainer.appendChild(this.rollButtonElement);

    // Back to Menu Button
    this.backToMenuButton = document.createElement('button');
    this.backToMenuButton.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      padding: 10px 20px;
      font-size: 18px;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    this.backToMenuButton.textContent = 'Back to Main Menu';
    this.backToMenuButton.onmouseover = () => this.backToMenuButton.style.backgroundColor = '#c82333';
    this.backToMenuButton.onmouseout = () => this.backToMenuButton.style.backgroundColor = '#dc3545';
    this.backToMenuButton.onclick = () => showMainMenu();
    this.uiContainer.appendChild(this.backToMenuButton);
  }

  private rollDice() {
    this.rollButtonElement.disabled = true;
    this.rollButtonElement.style.opacity = '0.5';
    this.rollButtonElement.style.cursor = 'not-allowed';

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;

    this.diceTextElement.textContent = `Dice: ${die1} + ${die2} = ${total}`;
    this.moveCurrentPlayer(total);
  }

  private moveCurrentPlayer(spaces: number) {
    const player = this.players[this.currentPlayerIndex];
    let currentPos = player.position;
    const targetPos = (currentPos + spaces) % 40;

    const moveStep = () => {
      currentPos = (currentPos + 1) % 40;
      const targetSpace = this.boardSpaces[currentPos];

      // Offset for tokens on the same space
      const tokenOffset = 0.5 * player.token.geometry.parameters.radiusTop; // Using radius as base for offset
      const offsetX = (player.id % 2 === 0 ? -1 : 1) * tokenOffset;
      const offsetZ = (player.id < 2 ? -1 : 1) * tokenOffset;

      gsap.to(player.token.position, {
        x: targetSpace.x + offsetX,
        y: targetSpace.height / 2 + player.token.geometry.parameters.height / 2,
        z: targetSpace.z + offsetZ,
        duration: 0.2, // Faster animation for each step
        ease: 'power1.out',
        onComplete: () => {
          if (currentPos !== targetPos) {
            moveStep();
          } else {
            player.position = targetPos;
            this.endTurn();
          }
        }
      });
    };
    moveStep();
  }

  private endTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    const nextPlayer = this.players[this.currentPlayerIndex];

    this.statusTextElement.textContent = `Player ${nextPlayer.id + 1}'s Turn`;
    this.statusTextElement.style.color = `#${nextPlayer.color.getHexString()}`;

    this.rollButtonElement.disabled = false;
    this.rollButtonElement.style.opacity = '1';
    this.rollButtonElement.style.cursor = 'pointer';
  }

  update() {
    // This is called in the main animation loop
    this.controls?.update(); // Only if OrbitControls is enabled
  }

  cleanup() {
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Dispose Three.js objects to free memory
    this.scene.remove(this.boardGroup);
    this.boardGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.players.forEach(player => {
      this.boardGroup.remove(player.token);
      player.token.geometry.dispose();
      (player.token.material as THREE.Material).dispose();
    });
    this.boardSpaces = [];
    this.players = [];

    // Clean up UI elements
    this.uiContainer.style.pointerEvents = 'none'; // Disable interaction with game UI
    while (this.uiContainer.firstChild) {
      this.uiContainer.removeChild(this.uiContainer.firstChild);
    }
  }
}
