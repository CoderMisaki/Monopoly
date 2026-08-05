import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load minimal assets needed for main menu / loading screen
    // this.load.image('logo', 'assets/logo.png');
  }

  create() {
    this.scene.start('MainMenuScene');
  }
}
