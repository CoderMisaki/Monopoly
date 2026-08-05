import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const { width, height } = this.scale;
    const title = this.add.text(width / 2, height / 2 - 100, 'City Empire', {
      fontSize: '48px',
      color: '#ffffff'
    });
    title.setOrigin(0.5);

    const startText = this.add.text(width / 2, height / 2, 'Click to Start', {
      fontSize: '32px',
      color: '#ffffff'
    });
    startText.setOrigin(0.5);
    startText.setInteractive({ useHandCursor: true });

    startText.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
