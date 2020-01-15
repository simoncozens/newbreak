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

## Using the interesting features

### Variable font extension

If you have a variable font, then you can use the axes in your variable font to stretch or shrink some or all of your glyphs. Add the `data-method="wdth"` (or whatever axis name) attribute to your wrapper div to tell the system *how* to vary your fonts.

To make all tokens stretchable/shrinkable, the easiest way is to add the `data-text-stretch="computed" data-text-shrink="computed"` attributes to the wrapper div. This will allow each token to be stretched/shrunk to the limits of the variable font axis.

If you don't want to stretch/shrink them the whole way, you can instead specify a width ratio: `data-text-stretch="0.5"` will allow text to be stretched to a total of 50% more than their natural width.

If you want to make only *some* tokens stretchable/shrinkable (such as Arabic kashidas) or to make some tokens more stretchy than others, then you need to alter the way that justification nodes are created. The way to do this is to write a function which takes a piece of text and a node, and spits out an *array* of nodes. This function is passed as an option to your `dombreak` instance. The following function will allow only the word "stretchy" to be stretched up to a total of three times its natural width.

    var nodeCustomizer = function (text, node) {
        if (text == "stretchy") {
            node.stretch = 2 * node.width
        } else {
            node.stretch = 0;
        }
        return [node];
    }
    var d = new DomBreak.DomBreak(box, {customizeTextNode: nodeCustomizer});

> `node.stretch` and `node.shrink` specifies the amount of space (in points) that can be added to or taken away from the natural width. So if `node.stretch` is `2 * node.width`, then the node can be stretched up to a *total* of `node.width + node.stretch == 3 * node.width`.

### Contextual alternates

In situations like Arabic justification, you may get a better line fit by choosing alternative forms of glyphs or activating ligatures. newbreak supports this, but making it happen takes a bit of work. Each justification node can have an array called `node.alternates`, which consists of more Node objects. Here's a node customizer which adds any alternate glyphs produced by the swash feature:

    function makeItSwashy(text, node) {
      d.cacheComputedStretch = {};

      var nlalt = d.makeText(text, $("#testbox2")[0])
      nlalt.text.addClass("swash")
      nlalt.text.css("font-feature-settings", "swsh")
      nlalt.substitutionPenalty = 10;
      if (nlalt.width != node.width) {
        node.alternates = [nlalt];
      }
      return [node];
    }

To make this work you need to add another text box (`#testbox2` in this example) which has the same CSS properties as your main box *but with the swash feature activated*. This is so that when text nodes are created in this context, their width will be measured correctly.

We have added a `substitutionPenalty` to this alternate node, so that the engine is somewhat penalised for choosing the swash form over the default one.

### Choosing the strategy

Each justification node has a `stretchContribution` or `shrinkContribution`. This is an array of numbers which should sum to one, specifying different "levels" at which the stretching and shrinking takes places. The default value is `[1]`. By carefully setting the `stretchContribution` (and *mutatis mutantis* for shrink, so I'm not going to mention it again), you can customize the way that justification takes place for your language.

Let's suppose we have a line whose natural width is 80pt and we want to stretch it to be 130pt long. We have four spaces, which can stretch up to 10pt each, and two kashidas, which can stretch by 40pt.

If we set the `stretchContribution` of each space node to `[1,0]` and the `stretchContribution` of the kashidas to `[0,1]`, this is what happens: the first level of stretching is delegated completely to the spaces, which are stretched to their full 10pt each, and the kashidas are untouched. Now the line is 120pt long, so we need another 10pt. We move to the next level, in which the spaces will use 0% of their available stretch and the kashidas will use all of it. We don't need them to each go the whole 40pt, though: the shortfall is spread between them and they each stretch 5pt. Setting `space.stretchContribution = [1,0]; kashida.stretchContribution = [0,1]` means "stretch the spaces first, then fill up with kashidas next".

If instead we set `space.stretchContribution = [1]; kashida.stretchContribution = [0.5, 0.5]` then the kashidas will be prepared to use up 50% of their stretchability on the first pass. Kashidas contribute 20pt each and spaces contribute 10pt, so we have a total usable stretch of 80pt. To make up the 50 point shortfall, each node is allocated 50/80 of their stretch: kashidas are stretched by 12.5pt and spaces are stretched by 6.25pt. What our setting means is "fill up the line with spaces and kashidas at the same time, but kashidas go towards their maximum width at half the speed that spaces to."

Conversely, if we set `space.stretchContribution = [0,1]; kashida.stretchContribution = [1,0]`, we would stretch the line as far as we could with kashidas before adjusting the spaces.

Combining this with the alternation penalties should give you full control over the order of justification techniques.