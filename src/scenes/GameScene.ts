import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export class GameScene extends Phaser.Scene {
  private socket: Socket | null = null;

  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.scale;
    const title = this.add.text(width / 2, height / 2, 'Game Board UI', {
      fontSize: '32px',
      color: '#ffffff'
    });
    title.setOrigin(0.5);

    // Dynamic and secure socket connection using env variables
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3000';
    this.socket = io(socketUrl, {
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    // Clean up socket and other listeners on shutdown to prevent memory leaks
    this.events.on('shutdown', this.cleanup, this);
  }

  cleanup() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
