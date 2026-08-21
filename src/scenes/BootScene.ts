// This scene is no longer needed in a DOM-based menu / Three.js setup
// It will be removed or made empty as main.ts now directly manages menu/game states.
// For now, removing its content to signify its deprecation.
// The new entry point is main.ts directly calling showMainMenu.
export class BootScene {
  constructor() {
    console.log('BootScene (deprecated in Three.js setup)');
  }

  create() {
    // In a Three.js / DOM setup, main.ts will handle starting the MainMenu.
    // This file might be removed entirely or repurposed if a preloader is genuinely needed for 3D assets.
  }
}
