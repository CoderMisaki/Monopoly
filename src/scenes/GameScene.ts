import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export interface Character {
  name: string;
  diceControl: number;
  tollDiscount: number;
  constructionDiscount: number;
}

export interface BoardSpace {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'Start' | 'City' | 'Fortune' | 'Island' | 'Travel' | 'Tax';
  ownerId: number | null;
  level: number; // 0=Land, 1=Villa, 2=Building, 3=Hotel, 4=Landmark
  basePrice: number;
  name: string;
}

export class GameScene extends Phaser.Scene {
  private socket: Socket | null = null;
  private mode: string = 'local';
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private boardSpaces: BoardSpace[] = [];

  private players: {
    id: number;
    token: Phaser.GameObjects.Arc;
    position: number;
    color: number;
    cash: number;
    totalAssets: number;
    character: Character;
  }[] = [];

  private playerPanels: Phaser.GameObjects.Container[] = [];
  private currentPlayerIndex: number = 0;
  private diceText!: Phaser.GameObjects.Text;

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
    this.boardSpaces[0].type = 'Start';
    this.boardSpaces[8].type = 'Fortune';
    this.boardSpaces[16].type = 'Fortune';
    this.boardSpaces[24].type = 'Fortune';
    this.boardSpaces[0].name = 'Start';
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

    // Removed central status text. Player panels handle status.
    this.createPlayerPanels(width, height);

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

  private createPlayerPanels(width: number, height: number) {
    const positions = [
      { x: 50, y: 50 }, // Player 1: Top-Left
      { x: width - 250, y: 50 }, // Player 2: Top-Right
      { x: 50, y: height - 100 }, // Player 3: Bottom-Left
      { x: width - 250, y: height - 100 } // Player 4: Bottom-Right
    ];

    for (let i = 0; i < 4; i++) {
      const pos = positions[i];
      const container = this.add.container(pos.x, pos.y);

      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.7);
      bg.fillRect(0, 0, 200, 80);

      const text = this.add.text(10, 10, `Player ${i + 1}\nCash: -\nAssets: -`, {
        fontSize: '16px',
        color: '#ffffff'
      });
      text.setName('infoText');

      container.add([bg, text]);
      this.playerPanels.push(container);

      // Hide if player doesn't exist yet
      if (i >= this.players.length && i >= 2) {
        container.setVisible(false);
      }
    }
  }

  private updateUIPanels() {
    this.players.forEach((player, index) => {
      const container = this.playerPanels[index];
      if (container) {
        const text = container.getByName('infoText') as Phaser.GameObjects.Text;
        if (text) {
          let str = `Player ${player.id + 1} (${player.character.name})\nCash: ${player.cash}\nAssets: ${player.totalAssets}`;
          if (this.currentPlayerIndex === index) {
            str = '👉 ' + str;
          }
          text.setText(str);
        }
      }
    });
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
    const spacesPerSide = 8;
    const spaceWidth = boardSize / spacesPerSide;
    const spaceHeight = spaceWidth; // Assuming square spaces for simplicity

    this.boardGraphics.lineStyle(1, 0xaaaaaa, 1);

    // Calculate space coordinates (starting from bottom right - "GO")
    // Bottom row (0 to 9) - Moving left
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX + boardSize - spaceWidth * (i + 1);
      const y = startY + boardSize - spaceHeight;
      this.boardSpaces.push({
        x,
        y,
        width: spaceWidth,
        height: spaceHeight,
        type: 'City',
        ownerId: null,
        level: 0,
        basePrice: 100000,
        name: 'City'
      });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }

    // Left column (10 to 19) - Moving up
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX;
      const y = startY + boardSize - spaceHeight * (i + 1);
      this.boardSpaces.push({
        x,
        y,
        width: spaceWidth,
        height: spaceHeight,
        type: 'City',
        ownerId: null,
        level: 0,
        basePrice: 100000,
        name: 'City'
      });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }

    // Top row (20 to 29) - Moving right
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX + spaceWidth * i;
      const y = startY;
      this.boardSpaces.push({
        x,
        y,
        width: spaceWidth,
        height: spaceHeight,
        type: 'City',
        ownerId: null,
        level: 0,
        basePrice: 100000,
        name: 'City'
      });
      this.boardGraphics.strokeRect(x, y, spaceWidth, spaceHeight);
    }

    // Right column (30 to 39) - Moving down
    for (let i = 0; i < spacesPerSide; i++) {
      const x = startX + boardSize - spaceWidth;
      const y = startY + spaceHeight * i;
      this.boardSpaces.push({
        x,
        y,
        width: spaceWidth,
        height: spaceHeight,
        type: 'City',
        ownerId: null,
        level: 0,
        basePrice: 100000,
        name: 'City'
      });
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
        color: colors[i],
        cash: 2000000,
        totalAssets: 2000000,
        character: {
          name: 'Default',
          diceControl: 0,
          tollDiscount: 0,
          constructionDiscount: 0
        }
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
    const targetPos = (currentPos + spaces) % 32; // 40 spaces on board

    // Simple animation: move one space at a time
    const moveStep = () => {
      currentPos = (currentPos + 1) % 32;
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

            // Gameplay Logic Hook
            const landedSpace = this.boardSpaces[targetPos];

            if (landedSpace.type === 'City') {
              if (landedSpace.ownerId === null) {
                // Prompt to buy
                const cost = landedSpace.basePrice;
                if (player.cash >= cost) {
                  const wantsToBuy = window.confirm(
                    `Do you want to buy ${landedSpace.name} for ${cost}?`
                  );
                  if (wantsToBuy) {
                    player.cash -= cost;
                    landedSpace.ownerId = player.id;
                    // If it's land, level 0. We can auto upgrade to level 1 (Villa) for prototype
                    landedSpace.level = 1;
                    this.boardGraphics.fillStyle(player.color, 0.5);
                    this.boardGraphics.fillRect(
                      landedSpace.x + 2,
                      landedSpace.y + 2,
                      landedSpace.width - 4,
                      landedSpace.height - 4
                    );
                  }
                }
              } else if (landedSpace.ownerId !== player.id) {
                // Pay toll
                const owner = this.players.find((p) => p.id === landedSpace.ownerId);
                if (owner) {
                  const baseToll = landedSpace.basePrice * 0.5 * (landedSpace.level || 1);
                  // Apply character discount
                  const discount = baseToll * (player.character.tollDiscount / 100);
                  const finalToll = Math.floor(baseToll - discount);

                  window.alert(`You paid a toll of ${finalToll} to Player ${owner.id + 1}`);
                  player.cash -= finalToll;
                  owner.cash += finalToll;
                }
              }
            } else if (landedSpace.type === 'Fortune') {
              this.drawFortuneCard(player);
            }

            // Recalculate total assets
            this.players.forEach((p) => {
              p.totalAssets = p.cash;
              this.boardSpaces.forEach((s) => {
                if (s.ownerId === p.id) {
                  p.totalAssets += s.basePrice * (s.level || 1);
                }
              });
            });

            this.updateUIPanels();
            this.endTurn();
          }
        }
      });
    };

    moveStep();
  }

  private drawFortuneCard(player: { cash: number }) {
    const effect = Math.random();
    if (effect > 0.5) {
      window.alert('Fortune: You found 50,000 cash!');
      player.cash += 50000;
    } else {
      window.alert('Fortune: You lost 30,000 cash!');
      player.cash -= 30000;
    }
  }

  private endTurn() {
    // Next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    // Update UI
    // const nextPlayer = this.players[this.currentPlayerIndex];
    this.updateUIPanels();
    this.updateUIPanels();

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
