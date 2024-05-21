import { encrypt } from "../crypt";

/**
 * Generates an encryped 'guess' and a plain guess & session token
 * @param guess The guess object
 * @param sessionToken The session token
 * @returns The encryped guess
 */
export default function generateGuess(guess: object[], sessionToken: string) {
	return encrypt(JSON.stringify(guess), sessionToken);
}
