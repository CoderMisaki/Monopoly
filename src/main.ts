import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js'; // Keep import for DOM Menu

let gameInstance: Phaser.Game | null = null;

// Define the global startGame function that MainMenuScene will call
(window as any).startGame = (mode: string) => {
  // Hide the main menu DOM element
  const mainMenuElement = document.getElementById('main-menu');
  if (mainMenuElement) {
    mainMenuElement.style.display = 'none';
  }

  if (gameInstance === null) {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      parent: 'app',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'arcade',
        arcade: {
          debug: false
        }
      },
      scene: [GameScene] // Only GameScene as a Phaser scene
    };
    gameInstance = new Phaser.Game(config);
  }

  // Restart GameScene with the selected mode
  if (gameInstance.scene.isActive('GameScene')) {
    gameInstance.scene.stop('GameScene');
  }
  gameInstance.scene.start('GameScene', { mode });
};

// Initialize the Main Menu as a DOM overlay when the script loads
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = (document.getElementById('app') || document.body) as HTMLDivElement;
  const mainMenu = new MainMenuScene(appContainer);
  mainMenu.create();
});
