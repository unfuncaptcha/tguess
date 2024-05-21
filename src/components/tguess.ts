import { encrypt } from "../crypt";
import vm from "vm";

type TGuess = { [key: string]: string };

/**
 * Generates an Arkose Labs "tguess" by means of sandboxing.
 * @param dapibScriptPayload The dapib script payload from Arkose Labs
 * @param data The data to pass to the dapib script
 * @returns A promise that resolves with the generated TGuess
 */
export default function generateTGuess(
	dapibScriptPayload: string,
	data: {
		sessionToken: string;
		guess: object[];
	},
) {
	const { sessionToken, guess } = data;

	const [tokenKey, tokenValue] = sessionToken.split("."),
		preparedGuess = guess.map((entry) => ({
			...entry,
			[tokenKey]: tokenValue,
		}));

	return new Promise((resolve, reject) => {
		const dapibReceive = (data: { tanswer: TGuess[] | undefined }) => {
			if (!data.tanswer) {
				return reject(
					`No tanswer present, there was an error during generation: ${data}`,
				);
			}

			const tguess = data.tanswer.map((item) =>
				Object.entries(item).reduce((newTGuess, [key, value]) => {
					// Arkose Labs' sandbox detection literally just adds a random character to the end of every entry...
					// We can totally bypass sandbox detection in this case
					newTGuess[key] = value.slice(0, -1);
					return newTGuess;
				}, {} as TGuess),
			);

			return resolve(encrypt(JSON.stringify(tguess), sessionToken));
		};

		// The dapib script seems to be run in an iframe, where it passes/gets passed data through window.parent.ae
		// - The script is passed your initial guess + your session token data through window.parent.ae.answer
		// - When the script finishes generating a TGuess OR fails at generating a TGuess it calls window.parent.ae.dapibReceive
		const virtualIframeContext = vm.createContext({
			window: {
				document: {
					hidden: false,
				},
				parent: {
					ae: {
						dapibReceive,
						answer: preparedGuess,
					},
				},
			},
		});
		vm.runInContext(dapibScriptPayload, virtualIframeContext);
	});
}
