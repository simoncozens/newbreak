/**
 * This is dombreak, which applies the newbreak algorithm to text
 * nodes in a HTML DOM.
 */

import * as $ from "jquery";
import { Node, Linebreaker } from './newbreak';

// Crappy function to measure the width of a bit of text.
var fakeEl;
function textWidth (text:string, font) {
    if (!fakeEl) fakeEl = $('<span>').appendTo(document.body).hide();
    fakeEl.text(text).css('font', font || this.css('font'));
    return fakeEl.width();
};

// When we need to make a space character, turn it into a stretchy
// node. Break class is one, and we can stretch by 100% and shrink by 20%
// of the space's width.
function makeGlue(domnode) {
  var sp = $("<span/>")
  sp.addClass("glue")
  // Because it's hard to measure a space directly we have to do a bit of
  // messing about to work out the width.
  sp.width(textWidth("x x", domnode.css("font"))-textWidth("xx",domnode.css("font")))
  let n:Node = {
    text: sp,
    penalty: 0,
    breakClass: 1,
    width: sp.width(),
    stretch: 1 * sp.width(),
    shrink:0.2 * sp.width()
  } as Node;
  return n;
}

// A hyphen is an empty node, but with discretionary width and text.
// It can't stretch.
function makeHyphen(domnode) {
  var width = textWidth("-", domnode.css("font"))

  var sp1 = $("<span/>")
  sp1.addClass("hyphen");
  return {
    text:sp1,
    breakHereText: "-",
    width:0,
    breakHereWidth: width,
    breakClass:2
  } as Node;
}

// Text nodes can't break, but they can stretch by 10% and shrink by 40%.
// These hard-coded values are just for effect.
function makeText(t, domnode) {
  var sp = $("<span/>");
  sp.addClass("text")
  sp.text(t);
  var width = textWidth(t, domnode.css("font"))
  sp.attr("width", width);
  return {
    text: sp,
    breakClass:0,
    penalty:0,
    width: width,
    stretch:0.10*width,
    shrink:0.40*width
  } as Node;
}

declare var Hyphenator: any;
var h = new Hyphenator();
function hyphenate(t) {
  // Uncomment the following line if you want to use hyphenation.
  // return h.hyphenate(t);
  // But the effect of the justification is more visible if you don't,
  // so I am choosing not to. It's more fun.
  return [t];
}

// This makes a DOM node justified using the newbreak algorithm.
export function addBreaker(domnode: JQuery<HTMLElement>) {
  console.log("Addbreaker called");

  // The first job is to create nodes, both in the DOM and
  // newbreak `Node` objects, representing each word and space.
  var text = domnode.text();
  text = text.replace(/^\s+/,"");
  // We'll empty the container and tell it that we're handling wrapping.
  domnode.empty()
  domnode.addClass("nowrap")

  var nodelist: Node[] = [];
  for (let t of text.split(/(\s+)/)) {
    let n: Node;
    if (t.match(/\s+/)) {
      // This is just space. Turn it into a glue node.
      n = makeGlue(domnode);
      nodelist.push(n);
      domnode.append(n.text);
    }
    else {
      // This is text. Turn it into hyphenated fragments.
      // If hyphenation is off, we just get the text back.
      let fragments = hyphenate(t) as String[];
      for (let idx=0; idx < fragments.length; idx++) {
        var frag = fragments[idx];
        // Turn each fragment into a `Node`, pop it on the list
        // and put the word back into the DOM.
        n = makeText(frag, domnode);
        nodelist.push(n);
        domnode.append(n.text);
        if (idx != fragments.length-1) {
          // Add hyphens between each fragment.
          n = makeHyphen(domnode);
          nodelist.push(n);
          domnode.append(n.text);
        }
      }
    }
  }

  // At the end of the paragraph we need super-stretchy glue,
  // else we end up with full-justification.
  let stretchy = makeGlue(domnode);
  stretchy.stretch = 10000;
  nodelist.push(stretchy);

  // We're going to run the justification algorithm every time
  // the DOM node gets resized.
  let doResize = (evt, ui) => {
    var breaker = new Linebreaker(nodelist, [domnode.width()])
    var points = breaker.doBreak();
    var ratios = breaker.ratios(points)

    // Now we have our breakpoints, we have to actually lay the thing out,
    // which turns out to be the hard bit.

    // Remove any breaks we added on previous times.
    domnode.find("br").remove()

    // Stretch and shrink each node as appropriate. We'll add linebreaks later.
    for (var p = 0; p < nodelist.length-1; p++) {
      var el = (nodelist[p].text as JQuery<HTMLSpanElement>);

      if (p == ratios[0].end) {
        // Discretionaries at the end of the line have to be replaced
        // with their break text (the hyphen)
        if (el.hasClass("hyphen")) {
          el.text(nodelist[p].breakHereText);
        }
      } else if (el.hasClass("hyphen")) {
        // Discretionaries *not* at the end of the line have to be empty.
          el.text("");
        }
      if (p > ratios[0].end) {
        // Done with this line, move to the next.
        ratios.shift()
      }

      // First deal with nodes which need to be shrunk.
      if (ratios[0].ratio < 0 && nodelist[p].shrink > 0) {
        var shrunk = nodelist[p].width - nodelist[p].shrink * -ratios[0].ratio;
        if (el.hasClass("text")) {
          // Text gets shrunk with the variable font CSS rule.
          var shrunkpercent = shrunk / nodelist[p].width * 100
          el.css("font-stretch", shrunkpercent+"%")
          var redness = (255 - ((shrunkpercent - 75) / 25 * 255)).toFixed(0)
          el.css("color", "rgb("+redness+",0,0)")
        } else {
          // Glue gets shrunk by setting its width directly.
          el.css("width", shrunk+"px")
        }
      } else if (ratios[0].ratio > 0 && nodelist[p].stretch > 0) {
        // And similarly for things which need to be stretched.
        var stretched = nodelist[p].width + nodelist[p].stretch * ratios[0].ratio;
        if (el.hasClass("text")) {
          var stretchedpercent = stretched / nodelist[p].width * 100
          el.css("font-stretch", stretchedpercent+"%")
          var greenness = (((stretchedpercent - 100) / 25 * 255)).toFixed(0)
          el.css("color", "rgb(0,"+greenness+",0)")
        } else {
          el.css("width", stretched+"px")
        }
      } else {
        // On the rare occasion that a line is perfect, reset it to natural.
        el.css("font-stretch", "")
        el.css("color", "black")
      }
    }
    // Now we add the breaks.
    for (let p of points) {
      (nodelist[p].text as JQuery<HTMLSpanElement>).after($("<br>"))
    }
    console.log("Ratios:")
    console.log(ratios)
  }
  // Hook this up to be run every resize, and once to begin with.
  domnode.resizable({resize: doResize });
  doResize(null,null);

}