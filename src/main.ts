import * as THREE from 'three';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js'; // This will be our Three.js game scene

// Global variables for Three.js setup
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let gameSceneInstance: GameScene | null = null;
let mainMenuSceneInstance: MainMenuScene | null = null;
let animationFrameId: number;

function initThreeJS() {
  const appElement = document.getElementById('app');
  if (!appElement) {
    console.error('App element not found!');
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333); // Dark background

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 20); // Initial camera position, adjust as needed
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  appElement.appendChild(renderer.domElement);

  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (gameSceneInstance && gameSceneInstance.update) {
    gameSceneInstance.update(); // Call update method for game logic
  }
  renderer.render(scene, camera);
}

// Function to start the game scene
export function startGame(mode: string) {
  // Clear any existing game scene before starting a new one
  if (gameSceneInstance) {
    gameSceneInstance.cleanup();
    cancelAnimationFrame(animationFrameId);
  }
  if (mainMenuSceneInstance) {
    mainMenuSceneInstance.hide();
  }

  // Ensure Three.js is initialized if not already
  if (!renderer) {
    initThreeJS();
  }

  // Clear existing objects from the scene before creating a new game
  while(scene.children.length > 0){
    scene.remove(scene.children[0]);
  }
  // Reset camera position for the game
  camera.position.set(0, 15, 20); // Adjust as appropriate for the game
  camera.lookAt(0, 0, 0);

  gameSceneInstance = new GameScene(scene, camera, renderer.domElement);
  gameSceneInstance.init({ mode: mode });
  gameSceneInstance.create();
  animate();
}

// Function to show the main menu
export function showMainMenu() {
  if (gameSceneInstance) {
    gameSceneInstance.cleanup();
    cancelAnimationFrame(animationFrameId);
    gameSceneInstance = null;
  }
  if (mainMenuSceneInstance) {
    mainMenuSceneInstance.show();
  } else {
    mainMenuSceneInstance = new MainMenuScene();
    mainMenuSceneInstance.create(); // Renders the main menu DOM elements
  }
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  showMainMenu(); // Start with the main menu
});

// Expose functions globally for debugging or specific interactions if needed
(window as any).startGame = startGame;
(window as any).showMainMenu = showMainMenu;
