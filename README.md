# tguess/guess

Generate "guess" and "tguess" components for Arkose Labs Funcaptcha

```
npm install tguess
```




```js
import { generateTGuess, generateGuess } from "tguess";

// Fetch the contents of the script from a Funcaptcha sessions' Arkose Labs "dapib" URL
const dapibScript = `(function(){const Z={'aXSrO':function(m,T){re...`;

const sessionToken = "83417d0fb7a5d8d09.6158889701";
const guess = [
  {
    index: 0,
  },
];

await generateTGuess(dapibScript, {
  guess,
  sessionToken,
}); // {"ct":"Fyd+au174XHfKTLG1T1GUfdmAR...

await generateGuess(guess, sessionToken); // {"ct":"Kz2qbnq55...
```

<br/>

# reverse engineering

The "tguess" component of a Funcaptcha answer seems to be a way of *verifying* a guess. It does so by providing a small JavaScript file when requesting session information, and having your guess be ran through it before submitting an answer. This is common "proof of work" approach taken by many different companies to try and combat simple botting attempts.

When requesting `/fc/gfct`, the endpoint which fetches nessasary information on your captcha session, there will be a `dapib_url` field:

```js
{
    "session_token": "65917d170fd50ba78.9179887501",
    "challengeID":"162664c4fafa4af82.9739379201",
    "challengeURL":"https:\/\/client-api.arkoselabs.com\/fc\/assets\/match-game-ui\/0.33.0\/standard\/index.html",

    ...
    
    "dapib_url": "https:\/\/client-api.arkoselabs.com\/dapib\/us-east-1\/51b199df-f3b4-47e3-a7c4-8ff7b099411f\/1187.js?mac=scv%2BI46zNyMhzRLeOLtC%2BtNNsX%2BJCjRBYtSnlCrIZ6s%3D&expiry=1716278968037"
}
```

This URL encoded script file is "unique to each Funcaptcha session" (~1200 files per day that rotate), and will expire after a certain time. 

After "deobfuscating" the script and combing through some of its code, the script is run in an iframe which communicates with the main FC JS through two properties in the `window.parent.ae` object:

| Name | Description |
| --- | --- |
| `dapibReceive` | Callback function called on "tguess" generation success/failure |
| `answer` | Plain guess + session token as a key/value pair in each guess entry |


> <details>
> 
> <summary>Example of <code>window.parent.ae.answer</code></summary>
> 
> ```js
> // session token is 83417d0fb7a5d8d09.6158889701
> [
>     {
>       index: 0,
>       "83417d0fb7a5d8d09": "6158889701",
>     },
>     {
>       index: 5,
>       "83417d0fb7a5d8d09": "6158889701",
>     },
> ]
> ```
> 
> </details>

<br />

The script does some work on your guess, transforming each guess into an object like:

```json
{
  "index": "0",
  "83417d0fb7a5d8d09": "6158889701",
  "_0": "index",
  "_6158889701": "83417d0fb7a5d8d09",
  "i8n3d4e1x7d0fb7a5d8d095d8d09": "061588897019701",
  "__061588897019701": "i8n3d4e1x7d0fb7a5d8d095d8d09",
  "indexs": "0",
  "83417d0fb7a5d8d09s": "5189808671",
  "_0s": "ndexi",
  "_6158889701s": "ddbf831a854700d97",
  "i8n3d4e1x7d0fb7a5d8d095d8d09s": "810977850689011",
  "__061588897019701s": "99i03axd5e0888d7f1d4dbn5dd07",
  "_i_80n631d548e818x977d001f9b770a15d8d095d8d09d8d09": "0i681n538d848e917x071d907f0b17a5d8d095d8d095d8d09",
  "i8n3d4e1x7sd0fb7a5d8d09sd8d09s": "051898086718671",
  "__06s158889701s701s": "ndddebxfi831a854700d97700d97",
  "_i_80n631d548e818x977d001f9b770a15sd8d095d8d09s8d09s": "89190i90737a8x5d056e809808181d7f1d4dbn5dd07n5dd07"
}
```

This list of "work proven" entries is then packaged up using Arkose Labs' general "ct" / "iv" / "s" format and sent along with your also packaged guess, bio, etc.

<br />

Arkose Labs have ***attempted*** to stop people from simply sandboxing these payloads by adding this check:

```js
var a = window.document;
var B = undefined;
if (
  Z.lYDPG(Object.prototype.toString.call(typeof process !== Z.oUjDv ? process : 0), Z.cIrbo) || 
  a.hidden && 
  Z.IOsCd(a.visibilityState, "prerender") && 
  typeof window.requestAnimationFrame === "undefined" 
  && Z.lYDPG(typeof window.cancelAnimationFrame, "undefined") || 
  !(a.activeElement instanceof Object)) {
    B = String.fromCharCode(Z.TjsEY(Math.random() * 26, 65));
}
const answer = window.parent.ae.answer;
n(answer, B);
```

This code basically checks if certain variables & window properties exist in the currently running enciornment to detect NodeJS, JSDom, and other sandboxing methods. The problem with this implementation is that all it does is add one random character to the end of every entry in your tguess.

<br />

To bypass their sandboxing detection you can either:

- Remove this check totally before sandboxing
- Make sure each variable & "window" property passes this check
- **Simply remove the random character from the object...**

<br />

## example - tguess http server

```js
const { generateTGuess } = require("tguess");
const express = require("express");

const app = express().use(express.json());

app.post("/tguess", async (req, res) => {
	const { guess, dapib_url: dapibUrl, session_token: sessionToken } = req.body;

	if (!guess || !dapibUrl || !sessionToken)
		return res.status(400).json({ success: false, message: "Missing data" });

	const scriptContent = await (await fetch(dapibUrl)).text();
	if (!scriptContent)
		return res
			.status(400)
			.send({ success: false, message: "Invalid dapib url" });

	const tguess = await generateTGuess(scriptContent, {
		sessionToken,
		guess,
	});

	res.json({ success: true, tguess });
});

app.listen(3000, () => console.log("Server started"));

```

**`POST`** `http://localhost:3000/tguess`

```json
{
    "guess": [
	{"index": 1}
    ],
    "dapib_url": "https://client-api.arkoselabs.com/dapib/ap-southeast-1/c63fbbd1-c550-4342-a308-e1c96be38bc2/902.js?mac=xjLTKLENwqPuxVim4XJnJ6WMt0JC8U2IIsfSSnZcAVI%3D&expiry=1718054969465",
    "session_token": "16817d7c04033d733.8703324805"
}
```
