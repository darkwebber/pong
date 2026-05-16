import './style.css';
import { Game } from './game/engine';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiLayer = document.getElementById('ui-layer') as HTMLDivElement;

if (!canvas || !uiLayer) {
  throw new Error('Required DOM elements not found');
}

const game = new Game(canvas, uiLayer);
game.init();
