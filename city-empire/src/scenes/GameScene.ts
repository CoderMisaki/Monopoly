import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
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
  }
}
