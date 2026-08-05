import Phaser from 'phaser';
import { Howler } from 'howler';

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

    const localPlayText = this.add.text(width / 2, height / 2, 'Local Play', {
      fontSize: '32px',
      color: '#ffffff'
    });
    localPlayText.setOrigin(0.5);
    localPlayText.setInteractive({ useHandCursor: true });

    localPlayText.on('pointerdown', () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      this.scene.start('GameScene', { mode: 'local' });
    });

    const onlinePlayText = this.add.text(width / 2, height / 2 + 50, 'Online Play', {
      fontSize: '32px',
      color: '#ffffff'
    });
    onlinePlayText.setOrigin(0.5);
    onlinePlayText.setInteractive({ useHandCursor: true });

    onlinePlayText.on('pointerdown', () => {
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      this.scene.start('GameScene', { mode: 'online' });
    });
  }
}
