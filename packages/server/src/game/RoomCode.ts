import { randomInt } from 'crypto';
import { gameStore } from './GameStore';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Omit I and O (confusing)
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 20;

/** Generate a 6-letter uppercase room code using crypto-secure randomness.
 *  Retries up to MAX_ATTEMPTS times to avoid collisions with existing rooms. */
export function generateRoomCode(): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARS[randomInt(CHARS.length)];
    }
    // Check for collision with existing rooms
    if (!gameStore.get(code)) {
      return code;
    }
  }
  // Extremely unlikely: all attempts collided. Return last generated code anyway.
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[randomInt(CHARS.length)];
  }
  return code;
}
