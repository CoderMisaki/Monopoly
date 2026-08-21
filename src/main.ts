import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js'; // GameScene needs to be imported here

let gameInstance: Phaser.Game | null = null;

// Define the global startGame function that MainMenuScene will call
(window as any).startGame = (mode: string) => {
  // Clear the existing #app content (the main menu)
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.innerHTML = '';
  }

  // Configuration for the Phaser game
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'app', // Attach Phaser canvas to the #app div
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
    // Only GameScene is active after the menu, BootScene is deprecated as per memory
    scene: [GameScene]
  };

  // Create the Phaser game instance
  gameInstance = new Phaser.Game(config);

  // Start the GameScene and pass the mode
  // The 'start' method requires a scene key and optional data.
  // Phaser's scene management will handle starting GameScene once the game is ready.
  // No explicit game.scene.start here, as GameScene is the only/initial scene in config.
  // However, if we want to pass data immediately to init, we must explicitly start it.
  gameInstance.scene.add('GameScene', GameScene, true, { mode: mode });
};

// Initialize the MainMenuScene when the main script runs
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    const mainMenu = new MainMenuScene(appContainer);
    mainMenu.create();
  } else {
    console.error("Element with ID 'app' not found.");
  }
});
