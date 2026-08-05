import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export class GameScene extends Phaser.Scene {
  private socket: Socket | null = null;
  private mode: string = 'local';
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private boardSpaces: { x: number; y: number; width: number; height: number }[] = [];

  private players: {
    id: number;
    token: Phaser.GameObjects.Arc;
    position: number;
    color: number;
  }[] = [];
  private currentPlayerIndex: number = 0;
  private diceText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private rollButton!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  init(data: { mode?: string }) {
    if (data && data.mode) {
      this.mode = data.mode;
    }
  }

  create() {
    const { width, height } = this.scale;

    // Draw the Monopoly Board
    this.drawBoard();

    // Initialize Players
    this.initPlayers();

    const title = this.add.text(
      width / 2,
      height / 2 - 100,
      `City Empire - ${this.mode.toUpperCase()} Mode`,
      {
        fontSize: '24px',
        color: '#ffffff'
      }
    );
    title.setOrigin(0.5);

    this.statusText = this.add.text(width / 2, height / 2 - 50, `Player 1's Turn`, {
      fontSize: '20px',
      color: '#ff0000'
    });
    this.statusText.setOrigin(0.5);

    this.diceText = this.add.text(width / 2, height / 2, 'Dice: --', {
      fontSize: '32px',
      color: '#ffffff'
    });
    this.diceText.setOrigin(0.5);

    this.rollButton = this.add.text(width / 2, height / 2 + 50, 'Roll Dice', {
      fontSize: '28px',
      color: '#00ff00',
      backgroundColor: '#333333',
      padding: { x: 10, y: 5 }
    });
    this.rollButton.setOrigin(0.5);
    this.rollButton.setInteractive({ useHandCursor: true });
    this.rollButton.on('pointerdown', this.rollDice, this);

    if (this.mode === 'online') {
      // Dynamic and secure socket connection using env variables
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3000';
      this.socket = io(socketUrl, {
        transports: ['websocket']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
      });
    }

    // Clean up socket and other listeners on shutdown to prevent memory leaks
    this.events.on('shutdown', this.cleanup, this);
  }

  private drawBoard() {
    const { width, height } = this.scale;
    const boardSize = Math.min(width, height) - 40; // Leave some margin
    const startX = (width - boardSize) / 2;
    const startY = (height - boardSize) / 2;

    this.boardGraphics = this.add.graphics();
    this.boardGraphics.lineStyle(2, 0xffffff, 1);
    this.boardGraphics.fillStyle(0x333333, 1);

    // Draw main board outline
    this.boardGraphics.fillRect(startX, startY, boardSize, boardSize);
    this.boardGraphics.strokeRect(startX, startY, boardSize, boardSize);

    // A Monopoly board has 40 spaces: 4 corners + 9 spaces on each side
    const spacesPerSide = 10;
    const spaceWidth = boardSize / spacesPerSide;
    const spaceHeight = spaceWidth; // Assuming square spaces for simplicity

    this.boardGraphics.lineStyle(1, 0xaaaaaa, 1);

    // Calculate space coordinates (starting from bottom right - "GO")
    // Bottom row (0 to 9) - Moving left
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX + boardSize - spaceWidth * (i + 1);
      const y = startY + boardSize - spaceHeight;
      this.boardSpaces.push({ x, y, width: spaceWidth, height: spaceHeight });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }

    // Left column (10 to 19) - Moving up
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX;
      const y = startY + boardSize - spaceHeight * (i + 1);
      this.boardSpaces.push({ x, y, width: spaceWidth, height: spaceHeight });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }

    // Top row (20 to 29) - Moving right
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX + spaceWidth * i;
      const y = startY;
      this.boardSpaces.push({ x, y, width: spaceWidth, height: spaceHeight });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }

    // Right column (30 to 39) - Moving down
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX + boardSize - spaceWidth;
      const y = startY + spaceHeight * i;
      this.boardSpaces.push({ x, y, width: spaceWidth, height: spaceHeight });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }
  }

  private initPlayers() {
    // Determine number of players (e.g., 2 for local play)
    const numPlayers = 2;
    const colors = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00]; // Red, Blue, Green, Yellow

    for (let i = 0; i < numPlayers; i++) {
      const goSpace = this.boardSpaces[0]; // Start at "GO"

      // Calculate offset so tokens don't overlap exactly
      const offsetX = (i % 2 === 0 ? -10 : 10) + goSpace.width / 2;
      const offsetY = (i < 2 ? -10 : 10) + goSpace.height / 2;

      const token = this.add.circle(goSpace.x + offsetX, goSpace.y + offsetY, 10, colors[i]);

      this.players.push({
        id: i,
        token: token,
        position: 0,
        color: colors[i]
      });
    }
  }

  private rollDice() {
    // Basic 2d6 roll
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;

    this.diceText.setText(`Dice: ${die1} + ${die2} = ${total}`);

    // Disable button during move
    this.rollButton.disableInteractive();
    this.rollButton.setAlpha(0.5);

    this.moveCurrentPlayer(total);
  }

  private moveCurrentPlayer(spaces: number) {
    const player = this.players[this.currentPlayerIndex];
    let currentPos = player.position;
    const targetPos = (currentPos + spaces) % 40; // 40 spaces on board

    // Simple animation: move one space at a time
    const moveStep = () => {
      currentPos = (currentPos + 1) % 40;
      const targetSpace = this.boardSpaces[currentPos];

      const offsetX = (player.id % 2 === 0 ? -10 : 10) + targetSpace.width / 2;
      const offsetY = (player.id < 2 ? -10 : 10) + targetSpace.height / 2;

      this.tweens.add({
        targets: player.token,
        x: targetSpace.x + offsetX,
        y: targetSpace.y + offsetY,
        duration: 200,
        onComplete: () => {
          if (currentPos !== targetPos) {
            moveStep(); // Move again
          } else {
            // Movement finished
            player.position = targetPos;
            this.endTurn();
          }
        }
      });
    };

    moveStep();
  }

  private endTurn() {
    // Next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    // Update UI
    const nextPlayer = this.players[this.currentPlayerIndex];
    this.statusText.setText(`Player ${nextPlayer.id + 1}'s Turn`);
    this.statusText.setColor(nextPlayer.color === 0xff0000 ? '#ff0000' : '#0000ff');

    // Re-enable roll button
    this.rollButton.setInteractive({ useHandCursor: true });
    this.rollButton.setAlpha(1);
  }

  cleanup() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
