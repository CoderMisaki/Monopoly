import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { io, Socket } from 'socket.io-client';
import { Howler } from 'howler';

export class Monopoly3DScene {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private socket: Socket | null = null;
  private mode: string = 'local'; // Default to local
  private animationFrameId: number | null = null;

  private boardMeshes: THREE.Mesh[] = [];
  private playerTokens: THREE.Mesh[] = [];
  private currentPlayerIndex: number = 0;
  private diceValue: number = 0;

  private uiContainer!: HTMLDivElement;
  private statusElement!: HTMLDivElement;
  private diceElement!: HTMLDivElement;
  private rollButton!: HTMLButtonElement;
  private menuContainer!: HTMLDivElement;
  private localPlayButton!: HTMLButtonElement;
  private onlinePlayButton!: HTMLButtonElement;

  constructor() {
    this.handleResize = this.handleResize.bind(this);
    this.animate = this.animate.bind(this);
    this.rollDice = this.rollDice.bind(this);
    this.startLocalGame = this.startLocalGame.bind(this);
    this.startOnlineGame = this.startOnlineGame.bind(this);
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 15, 20); // Elevated view

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera from going below ground

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    // Initial setup for UI
    this.createUI();
    this.showMainMenu();

    // Event listeners
    window.addEventListener('resize', this.handleResize);
  }

  createUI() {
    this.uiContainer = document.createElement('div');
    this.uiContainer.style.position = 'absolute';
    this.uiContainer.style.top = '10px';
    this.uiContainer.style.left = '10px';
    this.uiContainer.style.color = 'white';
    this.uiContainer.style.fontFamily = 'Arial, sans-serif';
    this.uiContainer.style.fontSize = '20px';
    this.uiContainer.style.zIndex = '100';
    document.body.appendChild(this.uiContainer);

    this.statusElement = document.createElement('div');
    this.statusElement.textContent = "Welcome to City Empire 3D!";
    this.uiContainer.appendChild(this.statusElement);

    this.diceElement = document.createElement('div');
    this.diceElement.textContent = "Dice: --";
    this.uiContainer.appendChild(this.diceElement);

    this.rollButton = document.createElement('button');
    this.rollButton.textContent = "Roll Dice";
    this.rollButton.style.padding = '10px 20px';
    this.rollButton.style.marginTop = '10px';
    this.rollButton.style.fontSize = '24px';
    this.rollButton.style.backgroundColor = '#4CAF50';
    this.rollButton.style.color = 'white';
    this.rollButton.style.border = 'none';
    this.rollButton.style.borderRadius = '5px';
    this.rollButton.style.cursor = 'pointer';
    this.rollButton.addEventListener('click', this.rollDice);
    this.uiContainer.appendChild(this.rollButton);

    // Main Menu UI
    this.menuContainer = document.createElement('div');
    this.menuContainer.style.position = 'absolute';
    this.menuContainer.style.top = '50%';
    this.menuContainer.style.left = '50%';
    this.menuContainer.style.transform = 'translate(-50%, -50%)';
    this.menuContainer.style.color = 'white';
    this.menuContainer.style.fontFamily = 'Arial, sans-serif';
    this.menuContainer.style.fontSize = '32px';
    this.menuContainer.style.textAlign = 'center';
    this.menuContainer.style.zIndex = '101';
    this.menuContainer.style.display = 'none'; // Hidden by default
    document.body.appendChild(this.menuContainer);

    const title = document.createElement('h1');
    title.textContent = 'City Empire 3D';
    this.menuContainer.appendChild(title);

    this.localPlayButton = document.createElement('button');
    this.localPlayButton.textContent = 'Local Play';
    this.localPlayButton.style.padding = '15px 30px';
    this.localPlayButton.style.margin = '10px';
    this.localPlayButton.style.fontSize = '28px';
    this.localPlayButton.style.backgroundColor = '#007bff';
    this.localPlayButton.style.color = 'white';
    this.localPlayButton.style.border = 'none';
    this.localPlayButton.style.borderRadius = '8px';
    this.localPlayButton.style.cursor = 'pointer';
    this.localPlayButton.addEventListener('click', this.startLocalGame);
    this.menuContainer.appendChild(this.localPlayButton);

    this.onlinePlayButton = document.createElement('button');
    this.onlinePlayButton.textContent = 'Online Play';
    this.onlinePlayButton.style.padding = '15px 30px';
    this.onlinePlayButton.style.margin = '10px';
    this.onlinePlayButton.style.fontSize = '28px';
    this.onlinePlayButton.style.backgroundColor = '#dc3545';
    this.onlinePlayButton.style.color = 'white';
    this.onlinePlayButton.style.border = 'none';
    this.onlinePlayButton.style.borderRadius = '8px';
    this.onlinePlayButton.style.cursor = 'pointer';
    this.onlinePlayButton.addEventListener('click', this.startOnlineGame);
    this.menuContainer.appendChild(this.onlinePlayButton);
  }

  showMainMenu() {
    this.uiContainer.style.display = 'none';
    this.menuContainer.style.display = 'block';
  }

  hideMainMenu() {
    this.uiContainer.style.display = 'block';
    this.menuContainer.style.display = 'none';
  }

  startLocalGame() {
    if (Howler.ctx && Howler.ctx.state !== 'running') {
      Howler.ctx.resume();
    }
    this.mode = 'local';
    this.hideMainMenu();
    this.setupGame();
    this.statusElement.textContent = "Player 1's Turn (Local)";
  }

  startOnlineGame() {
    if (Howler.ctx && Howler.ctx.state !== 'running') {
      Howler.ctx.resume();
    }
    this.mode = 'online';
    this.hideMainMenu();
    this.setupGame();
    this.statusElement.textContent = "Connecting to server...";
    this.connectSocket();
  }

  connectSocket() {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3000';
    this.socket = io(socketUrl, {
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.statusElement.textContent = "Connected. Waiting for players...";
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.statusElement.textContent = "Disconnected.";
    });
  }

  setupGame() {
    // Clear previous game elements
    this.boardMeshes.forEach(mesh => this.scene.remove(mesh));
    this.playerTokens.forEach(token => this.scene.remove(token));
    this.boardMeshes = [];
    this.playerTokens = [];

    this.drawBoard();
    this.initPlayers();
  }

  drawBoard() {
    const boardSize = 20; // Size of the entire square board
    const spaceCount = 10; // Spaces per side (including corners)
    const spaceWidth = boardSize / spaceCount;
    const spaceHeight = 0.5; // Thickness of the board

    const boardMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Dark grey for board
    const propertyMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 }); // Lighter grey for properties

    // Create the main board plane
    const boardGeometry = new THREE.BoxGeometry(boardSize, spaceHeight, boardSize);
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.y = -spaceHeight / 2; // Sit on the ground plane
    this.scene.add(board);

    // Create individual property spaces
    const spaceGeometry = new THREE.BoxGeometry(spaceWidth, spaceHeight * 2, spaceWidth); // Slightly taller for emphasis
    const colors = [
      0x00ff00, 0x0000ff, 0xff0000, 0xffff00, 0x00ffff, 0xff00ff, 0x808080, 0x40e0d0
    ]; // Example colors for properties

    let currentX = boardSize / 2 - spaceWidth / 2;
    let currentZ = boardSize / 2 - spaceWidth / 2;
    let colorIndex = 0;

    // Helper to add a space
    const addSpace = (x: number, z: number, isCorner: boolean = false) => {
      const material = isCorner ? boardMaterial : new THREE.MeshPhongMaterial({ color: colors[colorIndex % colors.length] });
      const space = new THREE.Mesh(spaceGeometry, material);
      space.position.set(x, spaceHeight / 2, z);
      this.scene.add(space);
      this.boardMeshes.push(space);
      if (!isCorner) {
        colorIndex++;
      }
    };

    // Bottom row (GO to Jail) - moving left on X axis, Z is constant
    for (let i = 0; i < spaceCount; i++) {
      addSpace(currentX - i * spaceWidth, currentZ, i === 0 || i === spaceCount - 1);
    }
    currentX -= (spaceCount - 1) * spaceWidth; // Adjust X for corner

    // Left column (Jail to Free Parking) - moving forward on Z axis, X is constant
    for (let i = 1; i < spaceCount; i++) { // Skip first corner (Jail)
      addSpace(currentX, currentZ - i * spaceWidth, i === spaceCount - 1);
    }
    currentZ -= (spaceCount - 1) * spaceWidth; // Adjust Z for corner

    // Top row (Free Parking to Go to Jail) - moving right on X axis, Z is constant
    for (let i = 1; i < spaceCount; i++) { // Skip first corner (Free Parking)
      addSpace(currentX + i * spaceWidth, currentZ, i === spaceCount - 1);
    }
    currentX += (spaceCount - 1) * spaceWidth; // Adjust X for corner

    // Right column (Go to Jail to GO) - moving backward on Z axis, X is constant
    for (let i = 1; i < spaceCount - 1; i++) { // Skip first corner (Go to Jail) and last (GO)
      addSpace(currentX, currentZ + i * spaceWidth);
    }
  }

  initPlayers() {
    const numPlayers = 2; // For local demo
    const tokenColors = [0xff0000, 0x0000ff]; // Red, Blue
    const tokenRadius = 0.5;
    const tokenHeight = 1.5;
    const tokenGeometry = new THREE.CylinderGeometry(tokenRadius, tokenRadius, tokenHeight, 32);

    for (let i = 0; i < numPlayers; i++) {
      const material = new THREE.MeshPhongMaterial({ color: tokenColors[i] });
      const token = new THREE.Mesh(tokenGeometry, material);

      // Position tokens at "GO" (first space)
      const firstSpace = this.boardMeshes[0];
      token.position.set(
        firstSpace.position.x + (i * 0.5 - 0.25), // Offset for multiple tokens on one space
        tokenHeight / 2 + 0.5, // Lift above the board
        firstSpace.position.z + (i * 0.5 - 0.25)
      );
      this.scene.add(token);
      this.playerTokens.push(token);
    }
    this.statusElement.textContent = `Player ${this.currentPlayerIndex + 1}'s Turn`;
  }

  rollDice() {
    if (this.rollButton.disabled) return;

    // Simulate dice roll (1-6 for simplicity)
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    this.diceValue = die1 + die2;
    this.diceElement.textContent = `Dice: ${die1} + ${die2} = ${this.diceValue}`;

    this.rollButton.disabled = true;
    this.rollButton.style.backgroundColor = '#888888';

    this.moveCurrentPlayer(this.diceValue);
  }

  moveCurrentPlayer(steps: number) {
    const playerToken = this.playerTokens[this.currentPlayerIndex];
    let currentPositionIndex = this.boardMeshes.indexOf(this.boardMeshes.find(mesh => {
        // Simple check, in a real game, track player position separately
        return Math.abs(mesh.position.x - playerToken.position.x) < 1 &&
               Math.abs(mesh.position.z - playerToken.position.z) < 1;
    }) || this.boardMeshes[0]); // Default to 0 if not found

    let remainingSteps = steps;

    const animateMove = () => {
      if (remainingSteps <= 0) {
        this.endTurn();
        return;
      }

      currentPositionIndex = (currentPositionIndex + 1) % this.boardMeshes.length;
      const targetSpace = this.boardMeshes[currentPositionIndex];

      // Use GSAP for smooth animation (already in dependencies)
      gsap.to(playerToken.position, {
        x: targetSpace.position.x,
        y: targetSpace.position.y + 1.5, // Adjusted height
        z: targetSpace.position.z,
        duration: 0.3,
        ease: 'power1.inOut',
        onComplete: () => {
          remainingSteps--;
          animateMove();
        }
      });
    };

    animateMove();
  }

  endTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerTokens.length;
    this.statusElement.textContent = `Player ${this.currentPlayerIndex + 1}'s Turn`;
    this.rollButton.disabled = false;
    this.rollButton.style.backgroundColor = '#4CAF50';
  }


  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update(); // only required if controls.enableDamping is set to true
    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Cleanup method (equivalent to Phaser's shutdown)
  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.renderer.domElement.remove();
    this.renderer.dispose();
    this.uiContainer.remove();
    this.menuContainer.remove();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log('Monopoly3DScene disposed.');
  }
}