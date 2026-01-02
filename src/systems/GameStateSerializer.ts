import { GameState } from './GameState';

export class GameStateSerializer {
  static toJSON(state: GameState): string {
    return JSON.stringify(state, null, 2);
  }

  static toBase64(state: GameState): string {
    return btoa(JSON.stringify(state));
  }

  static fromJSON(json: string): GameState {
    return JSON.parse(json) as GameState;
  }

  static fromBase64(base64: string): GameState {
    return JSON.parse(atob(base64)) as GameState;
  }
}
