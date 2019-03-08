# Newbreak: Another line breaking algorithm, for variable fonts

The main algorithm lives in `newbreak.ts` and is implemented in TypeScript.
It should be clearly documented.

You may want to override the default options in `dombreak.ts` to change
the allowable stretchiness and shrinkiness of the font.

## To see the demo

Here it is: https://simoncozens.github.io/newbreak/

## To run the demo yourself

* Use `npm install` to get the Javascript modules you need.
* Run `npm run-script build` to compile TypeScript to Javascript.

This should produce `src/bundle.js`, which is needed by the `index.html`.

## To use it on your own site

Either compile it yourself (using the instructions above) or grab the precompiled versions of [newbreak.js](https://github.com/simoncozens/newbreak/blob/gh-pages/src/newbreak.js) and [dombreak.js](https://github.com/simoncozens/newbreak/blob/gh-pages/src/dombreak.js), and add them to your site. (Get the hyphenator and dictionary as well if you want these.)

Then, when your fonts are loaded, call:

    var dombreak = require("./dombreak")
    new dombreak.DomBreak($("#elemToJustify"), {
        // ... your DomBreak options here ...
    })

(You can use the [fontspy](https://github.com/patrickmarabeas/jQuery-FontSpy.js) library to run a callback when all CSS fonts are loaded.)

See the comments in [dombreak.ts](https://github.com/simoncozens/newbreak/blob/master/dombreak.ts) for the available options or just accept the defaults.