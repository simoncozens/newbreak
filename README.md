# Newbreak: Another line breaking algorithm, for variable fonts

The main algorithm lives in `newbreak.ts` and is implemented in TypeScript.
It should be clearly documented.

You may want to play with the hard-coded values in `dombreak.ts` to change
the allowable stretchiness and shrinkiness of the font.

## To run the demo

* Use `npm install` to get the Javascript modules you need.
* Run `npm run-script build` to compile TypeScript to Javascript.

This should produce `src/bundle.js`, which is needed by the `index.html`.
