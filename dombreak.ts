/**
 * This is dombreak, which applies the newbreak algorithm to text
 * nodes in a HTML DOM.
 */

import * as $ from "jquery";
import { Node, Linebreaker, Line } from './newbreak';

/** You can provide a hash of options to the DomBreak object to
 *  control various aspects of its behaviour:
*/
interface DomBreakOptions {
  /**
  * @property {number} spaceStretch
  *  A measure of how "stretchy" a space is, defined as the ratio
  *  between the extended width and the default width. i.e. if your
  *  default space is 5 points wide and `spaceStretch` is 1.0, then
  *  you can expand a space another 5 points up to a total of 10 points.
  **/
  spaceStretch?: number,

  /**
  * @property {number} spaceShrink
  *  Similarly for how much a space can shrink; a ratio of 0.5 with
  *  a 5-point space can reduce the space to 2.5 points where needed.
  */
  spaceShrink?: number,

  /**
  * @property {number} textStretch
  *  A ratio of how stretchy a piece of text is. Placing a constant
  *  ratio here assumes that all characters stretch to the same degree.
  *  If they don't, then you can use the magic string "computed" instead
  *  of a number. When you do this, DomBreak will try to stretch each bit
  *  of text as far as the font allows it to go and compute the appropriate
  *  value for each individual bit of text.
  */
  textStretch?: number | string,

  /**
  * @property {number} textShrink
  *  The same but for how much a piece of text can shrink.
  */
  textShrink?: number | string,

  /**
  * @property {number} textLetterSpacing
  *  The maximum amount of letterspacing (in pixels) you want to apply
  *  when stretching a font.
  */
  textLetterSpacing?: number,

  /**
  * @property {number} textLetterSpacingPriority
  *  Ratio of how much of the stretching of a piece of text is done by
  *  letterspacing and how much by applying variable font axes.
  *  If this is 0, everything is done with variable fonts; if it is 1,
  *  all stretching is done by letterspacing.
  */
  textLetterSpacingPriority?: number,

  /**
  * @property {boolean} hyphenate
  *  Should the text be hyphenated?
  */
  hyphenate?: boolean,

  /**
  * @property {boolean} colorize
  *  If this is true, then stretched text becomes more green as it
  *  stretches while shrunk text becomes more red.
  */
  colorize?: boolean,

  /**
  * @property {boolean} fullJustify
  *  If false, the last line and any text with hard breaks are set ragged;
  *  if true, they are set flush.
  */

  fullJustify?: boolean,

  /**
  * @property {string} method
  *  The CSS method used to stretch and shrink text. This can either be
  *  the string "font-stretch", in which case the CSS parameter "font-stretch"
  *  is used, or the name of a variable font axis such as "wdth" or "GEXT".
  */
  method?: string,

  /**
  * @property {function} customizeTextNode
  *  When a node is created from a piece of text, this callback is called to
  *  allow the user to customize the node. For example, you can check the text
  *  and decide that you don't want this particular bit of text to be stretched
  *  at all. Normally this function should mutate the node and return nothing.
  *  If it does return, it should return a list of nodes, which will be
  *  *substituted* for the node passed in.
  */
  customizeTextNode?: ((text: string, node: Node) => Node[]) | ((text: string, node: Node) => void),

  /**
  * @property {function} customNodeMaker
  *  When a HTML element, rather than a piece of text or space, is found in the
  *  box to be justified, it is passed to this function to be transformed into
  *  one or more Nodes. By default, the text is extracted as normal.
  */
  customNodeMaker?: (domnode: JQuery<HTMLElement>) => Node[]

}

var defaultOptions: DomBreakOptions = {
  spaceStretch: 1.00,
  spaceShrink:  0.20,
  textStretch:  0.10,
  textShrink:   0.40,
  textLetterSpacing: 0,
  textLetterSpacingPriority: 0,
  hyphenate: false,
  colorize: true,
  fullJustify: false,
  method: "font-stretch"
}

declare var Hyphenator: any;

// Crappy function to measure the width of a bit of text.
var fakeEl: JQuery<HTMLElement>;
function textWidth (text:string, elProto: JQuery<HTMLElement>) :number {
  if (!fakeEl) {
    fakeEl = $("<span>").appendTo(document.body).hide()
  }
  for (var c of ["font-style", "font-variant", "font-weight", "font-size", "font-family", "font-stretch", "font-variation-settings"]) {
    fakeEl.css(c,elProto.css(c));
  }
  fakeEl.text(text);
  return fakeEl.width();
};

export class DomBreak {
  public options: DomBreakOptions;
  public nodelist: Node[];
  public origContents: JQuery<HTMLElement|Text|Comment>;
  public domNode: JQuery<HTMLElement>;
  public cacheComputedShrink = {}
  public cacheComputedStretch = {}
  public cacheSpaceWidth = -1;

  constructor (domnode: JQuery<HTMLElement>, options: DomBreakOptions) {
    this.options = {...defaultOptions,...options};
    this.domNode = domnode;
    if (domnode[0].hasAttribute("data-text-stretch")) {
      this.options.textStretch = domnode.data("text-stretch")
    }
    if (domnode[0].hasAttribute("data-text-shrink")) {
      this.options.textShrink = domnode.data("text-shrink")
    }
    if (domnode.data("method")) {
      this.options.method = domnode.data("method")
    }
    this.origContents = domnode.contents();
    if (!this.options.customNodeMaker) {
      this.options.customNodeMaker = (el) => {
        return this.textToNodes(domnode, el.text())
      }
    }
    this.rebuild();
  }

  public rebuild () {
    this.cacheComputedStretch = {};
    this.cacheComputedShrink = {};
    this.nodelist = this.DOMToNodes(this.domNode, this.origContents);
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
    if (this.cacheSpaceWidth == -1) {
      this.cacheSpaceWidth = textWidth("x x", domnode)-textWidth("xx",domnode)
    }
    sp.width(this.cacheSpaceWidth)
    return {
      text: sp,
      debugText: " ",
      penalty: 0,
      stretchContribution: [1,0],
      shrinkContribution: [1,0],
      breakable: true,
      width: sp.width(),
      stretch: this.options.spaceStretch * sp.width(),
      shrink:  this.options.spaceShrink  * sp.width()
    } as Node;
  }

  public makeForcedBreak(domnode) : Node[] {
    var rv: Node[] = []
    if (!this.options.fullJustify) {
      var sp = $("<span/>")
      sp.addClass("glue")
      rv.push(
      {
        debugText: " ",
        text: sp,
        breakable: false,
        penalty: 0,
        width: sp.width(),
        stretch: 100000,
        shrink: 0
      } as Node)
    }
    var b = $("<span class='break'/>")
    rv.push(
    {
      debugText: "<BR!>\n",
      text: b,
      breakable: true,
      penalty: -10000,
      width: 0,
    } as Node)
    return rv;
  }

  public makeText(t :string, domnode) : Node[] {
    var sp = $("<span/>");
    sp.addClass("text")
    sp.text(t);
    var length = t.length;
    var width = textWidth(t, domnode)
    var maximumLSavailable = (length-1) * this.options.textLetterSpacing
    var maximumVarfontStretchAvailable : number
    var shrink;
    if (this.options.textStretch == "computed") {
      maximumVarfontStretchAvailable = this.computeMaxWidth(sp) - width;
      // console.log(t+" can stretch by "+maximumVarfontStretchAvailable+"px")
    } else {
      var maximumVarfontStretchAvailable = (this.options.textStretch as number) * width
    }
    if (this.options.textShrink == "computed") {
      shrink = width - this.computeMinWidth(sp);
    } else {
      shrink = (this.options.textShrink as number) * width
    }
    this.setToWidth(sp, width)
    var stretch = maximumLSavailable * this.options.textLetterSpacingPriority + maximumVarfontStretchAvailable * (1-this.options.textLetterSpacingPriority)
    var node = {
      debugText: t,
      text: sp,
      breakable: false,
      penalty:0,
      stretchContribution: [0,1],
      shrinkContribution: [0,1],
      width: width,
      stretch: stretch,
      shrink: shrink
    } as Node;

    if (this.options.customizeTextNode) {
      var res = this.options.customizeTextNode(t, node)
      if (res) { return res }
    }
    sp.attr("width", node.width);
    sp.attr("stretch", node.stretch);
    sp.attr("shrink", node.shrink);
    return [node];
  }

  public computeMaxWidth(sp: JQuery<HTMLElement>) : number {
    if (this.cacheComputedStretch[sp.text()]) { return this.cacheComputedStretch[sp.text()] }
    var measureEl = sp.clone().appendTo(this.domNode).hide();
    this.setToWidth(measureEl, 1000)
    var w = measureEl.width()
    measureEl.remove()
    this.cacheComputedStretch[sp.text()] = w
    return w
  }

  public computeMinWidth(sp: JQuery<HTMLElement>) : number {
    if (this.cacheComputedShrink[sp.text()]) { return this.cacheComputedShrink[sp.text()] }
    var measureEl = sp.clone().appendTo(this.domNode).hide();
    this.setToWidth(measureEl, 0)
    var w = measureEl.width()
    measureEl.remove()
    this.cacheComputedShrink[sp.text()] = w
    return w
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
  public DOMToNodes(domnode: JQuery<HTMLElement>, contents: JQuery<HTMLElement|Text|Comment>) : Node[] {
    domnode.empty()
    domnode.addClass("nowrap")
    var nodelist: Node[] = []
    contents.each( (i,el) => {
      if (el.nodeType == 3) {
        nodelist = nodelist.concat(this.textToNodes(domnode, el.textContent))
      } else if (el.nodeType == 1) {
        el = el as HTMLElement
        var nodes
        if (el.tagName == "BR") {
          nodes = this.makeForcedBreak(domnode);
        } else {
          nodes = this.options.customNodeMaker($(el))
        }
        for (var n of nodes) {
          nodelist.push(n)
          domnode.append(n.text)
        }
      }
    })
    return nodelist
  }

  public textToNodes(domnode: JQuery<HTMLElement>, text: string) : Node[] {
    // We'll empty the container and tell it that we're handling wrapping.

    var nodelist: Node[] = [];
    for (let t of text.split(/(\s+)/m)) {
      var n: Node;
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
          var nl = this.makeText(frag, domnode);
          for (n of nl) {
            nodelist.push(n);
            domnode.append(n.text);
          }
          // if (idx != fragments.length-1) {
          //   // Add hyphens between each fragment.
          //   n = this.makeHyphen(domnode);
          //   nodelist.push(n);
          //   domnode.append(n.text);
          // }
        }
      }
    }

    if (!this.options.fullJustify) {
      // At the end of the paragraph we need super-stretchy glue.
      let stretchy = this.makeGlue(domnode);
      stretchy.stretch = 10000;
      nodelist.push(stretchy);
    }
    return nodelist;
  }

  public setToWidth(el:JQuery<HTMLSpanElement>, width: number) {
    var tries = 20
    if (this.options.method == "font-stretch") {
      var guess = width / el.width() * 100
      var min = 0 // XXX
      var max = 200 // XXX
    } else {
      var guess = width / el.width() * 1000
      var min = 0 // XXX
      var max = 1000 // XXX
    }
    while (tries--) {
      if (this.options.method == "font-stretch") {
        el.css("font-stretch", guess+"%")
      } else {
        el.css("font-variation-settings", `'${this.options.method}' ${guess}`)
      }
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
    var lines:Line[] = breaker.doBreak({fullJustify: this.options.fullJustify});

    domnode.find("br").remove()
    domnode.children("span").remove()


    // Stretch and shrink each node as appropriate. We'll add linebreaks later.
    for (var l of lines) {
      for (var ix = 0; ix < l.nodes.length ; ix++) {
        var n = l.nodes[ix];
        var el = (n.text as JQuery<HTMLSpanElement>);
        domnode.append(el)

        if (el.hasClass("text") && (n.stretch > 0 || n.shrink > 0)) {
          // Text gets shrunk with the variable font CSS rule.
          this.setToWidth(el, l.targetWidths[ix]);
          el.css("letter-spacing", "normal");
          if (this.options.colorize) {
            var stretchShrink = (n.width-l.targetWidths[ix]) / n.width
            var color;
            if (stretchShrink > 0) {
              var redness = (stretchShrink * 4 * 255).toFixed(0);
              color = "rgb("+redness+",0,0)"
            } else {
              var greenness = -(stretchShrink * 4 * 255).toFixed(0);
              color = "rgb(0,"+greenness+",0)"
            }
            el.css("color", color)
          }
        } else {
          // Glue gets shrunk by setting its width directly.
          el.css("width", l.targetWidths[ix]+"px")
        }
        if (ix == l.nodes.length-1) {
          // el.next().after($("<br>"));
          domnode.append($("<br>"));
        }
      }
    }
  }
}
