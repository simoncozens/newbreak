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

interface DomBreakOptions {
  spaceStretch?: number,
  spaceShrink?: number,
  textStretch?: number,
  textShrink?: number,
  textLetterSpacing?: number,
  textLetterSpacingPriority?: number,
  hyphenate?: boolean,
  colorize?: boolean
}

var defaultOptions: DomBreakOptions = {
  spaceStretch: 1.00,
  spaceShrink:  0.20,
  textStretch:  0.10,
  textShrink:   0.40,
  textLetterSpacing: 0,
  textLetterSpacingPriority: 0,
  hyphenate: false,
  colorize: true
}

declare var Hyphenator: any;

export class DomBreak {
  public options: DomBreakOptions;
  public nodelist: Node[];
  public origText: string;
  public domNode: JQuery<HTMLElement>;

  constructor (domnode: JQuery<HTMLElement>, options: DomBreakOptions) {
    this.options = {...options, ...defaultOptions};
    this.domNode = domnode;
    this.origText = domnode.text();
    this.origText = this.origText.replace(/^\s+/,"")
    this.rebuild();
  }

  public rebuild () {
    this.nodelist = this.textToNodes(this.domNode, this.origText);
    let doResize = (evt, ui) => { this.layout() }
    if (this.domNode.resizable( "instance" )) {
      this.domNode.resizable("destroy");
    }
    setTimeout(() => {
      this.domNode.resizable({resize: doResize });
      doResize(null,null);
    },0.1);
  }

  public makeGlue(domnode) : Node {
    var sp = $("<span/>")
    sp.addClass("glue")
    // Because it's hard to measure a space directly we have to do a bit of
    // messing about to work out the width.
    sp.width(textWidth("x x", domnode.css("font"))-textWidth("xx",domnode.css("font")))
    return {
      text: sp,
      penalty: 0,
      breakClass: 1,
      width: sp.width(),
      stretch: this.options.spaceStretch * sp.width(),
      shrink:  this.options.spaceShrink  * sp.width()
    } as Node;
  }

  // A hyphen is an empty node, but with discretionary width and text.
  // It can't stretch.
  public makeHyphen(domnode): Node {
    var width = textWidth("-", domnode.css("font"))

    var sp1 = $("<span/>")
    sp1.addClass("hyphen");
    return {
      text:sp1,
      breakHereText: "-",
      width:0,
      breakHereWidth: width,
      breakClass:1
    } as Node;
  }

  public makeText(t :string, domnode) {
    var sp = $("<span/>");
    sp.addClass("text")
    sp.text(t);
    var length = t.length;
    var width = textWidth(t, domnode.css("font"))
    var maximumLSavailable = (length-1) * this.options.textLetterSpacing
    var maximumVarfontStretchAvailable = this.options.textStretch * width
    var stretch = maximumLSavailable * this.options.textLetterSpacingPriority + maximumVarfontStretchAvailable * (1-this.options.textLetterSpacingPriority)
    sp.attr("width", width);
    return {
      text: sp,
      breakClass:0,
      penalty:0,
      width: width,
      stretch: stretch,
      shrink: this.options.textShrink * width
    } as Node;
  }

  private hyphenator: any;
  public hyphenate(t) {
    if (this.options.hyphenate) {
      if (!this.hyphenator) { this.hyphenator = new Hyphenator() }
      return this.hyphenator.hyphenate(t);
    }
    return [t];
  }

  // The first job is to create nodes, both in the DOM and
  // newbreak `Node` objects, representing each word and space.
  public textToNodes(domnode: JQuery<HTMLElement>, text: string) : Node[] {
    // We'll empty the container and tell it that we're handling wrapping.
    domnode.empty()
    domnode.addClass("nowrap")

    var nodelist: Node[] = [];
    for (let t of text.split(/(\s+)/)) {
      let n: Node;
      if (t.match(/\s+/)) {
        // This is just space. Turn it into a glue node.
        n = this.makeGlue(domnode);
        nodelist.push(n);
        domnode.append(n.text);
      }
      else {
        // This is text. Turn it into hyphenated fragments.
        // If hyphenation is off, we just get the text back.
        let fragments = this.hyphenate(t) as string[];
        for (let idx=0; idx < fragments.length; idx++) {
          var frag = fragments[idx];
          // Turn each fragment into a `Node`, pop it on the list
          // and put the word back into the DOM.
          n = this.makeText(frag, domnode);
          nodelist.push(n);
          domnode.append(n.text);
          if (idx != fragments.length-1) {
            // Add hyphens between each fragment.
            n = this.makeHyphen(domnode);
            nodelist.push(n);
            domnode.append(n.text);
          }
        }
      }
    }

    if (!domnode.hasClass("fulljustify")) {
      // At the end of the paragraph we need super-stretchy glue.
      let stretchy = this.makeGlue(domnode);
      stretchy.stretch = 10000;
      nodelist.push(stretchy);
    }
    return nodelist;
  }

  public setToWidth(el:JQuery<HTMLSpanElement>, width: number) {
    var tries = 20
    var guess = width / el.width() * 100
    var min = 0 // XXX
    var max = 200 // XXX
    while (tries--) {
      el.css("font-stretch", guess+"%")
      var newWidth = el.width()
      if (Math.abs(newWidth - width) < 1) {
        return;
      } else if (newWidth > width) {
        max = guess
      } else if (newWidth < width) {
        min = guess
      }
      guess = (min + max) / 2
    }
  }

  public layout() {
    var nodelist = this.nodelist;
    var domnode = this.domNode;
    var breaker = new Linebreaker(nodelist, [domnode.width()])
    var points = breaker.doBreak({fullJustify: domnode.hasClass("fulljustify")});
    var ratios = breaker.ratios(points)

    // Now we have our breakpoints, we have to actually lay the thing out,
    // which turns out to be the hard bit.

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
        var shrinkRequired = nodelist[p].shrink * -ratios[0].ratio
        var shrunk = nodelist[p].width - shrinkRequired;
        if (el.hasClass("text")) {
          // Text gets shrunk with the variable font CSS rule.
          var shrunkpercent = shrunk / nodelist[p].width * 100
          this.setToWidth(el, shrunk)
          el.css("letter-spacing", "normal");
          if (this.options.colorize) {
            var redness = ((shrinkRequired/nodelist[p].width) * 4 * 255).toFixed(0)
            el.css("color", "rgb("+redness+",0,0)")
          }
        } else {
          // Glue gets shrunk by setting its width directly.
          el.css("width", shrunk+"px")
        }
      } else if (ratios[0].ratio > 0 && nodelist[p].stretch > 0) {
        // And similarly for things which need to be stretched.
        var stretchRequired = nodelist[p].stretch * ratios[0].ratio
        var stretched = nodelist[p].width + stretchRequired
        if (el.hasClass("text")) {
          // There are two ways of stretching, so we divide the job
          // between the two.
          var vfContribution = (1 - this.options.textLetterSpacingPriority) * stretchRequired
          var lsContribution = (this.options.textLetterSpacingPriority) * stretchRequired
          var lsStretched = lsContribution / (el.text().length-1)
          // el.css("font-stretch", (vfStretched)+"%")
          this.setToWidth(el, nodelist[p].width + vfContribution)
          el.css("letter-spacing", lsStretched+"px")
          if (this.options.colorize) {
            var greenness = ((stretchRequired/nodelist[p].width) * 4 * 255).toFixed(0)
            el.css("color", "rgb(0,"+greenness+",0)")
          }
        } else {
          el.css("width", stretched+"px")
        }
      } else {
        // On the rare occasion that a line is perfect, reset it to natural.
        el.css("font-stretch", "");
        el.css("color", "black");
        el.css("letter-spacing", "normal");
      }
    }
    // Remove any breaks we added on previous times.
    domnode.find("br").remove()
    // Now we add the breaks.
    for (let p of points) {
      (nodelist[p].text as JQuery<HTMLSpanElement>).after($("<br>"))
    }
  }
}