import * as $ from "jquery";
import { Node, Linebreaker } from './newbreak';

var fakeEl;
function textWidth (text:string, font) {
    if (!fakeEl) fakeEl = $('<span>').appendTo(document.body).hide();
    fakeEl.text(text).css('font', font || this.css('font'));
    return fakeEl.width();
};

function makeGlue(domnode) {
  var sp = $("<span/>")
  sp.addClass("glue")
  sp.data("stretch", 0)
  sp.data("maxStretch", 1)
  sp.width(textWidth("x x", domnode.css("font"))-textWidth("xx",domnode.css("font")))
  let n:Node = {text: sp, penalty: 0,breakClass: 1, width: sp.width(), stretch: 1 * sp.width(), shrink:0.2 * sp.width() } as Node;
  return n;
}


function makeHyphen(domnode) {
  var width = textWidth("-", domnode.css("font"))

  var sp1 = $("<span/>")
  sp1.addClass("hyphen");
  return {text:sp1, breakHereText: "-", width:0, breakHereWidth:1, breakClass:1} as Node;
}

function makeText(t, domnode) {
  var sp = $("<span/>");
  sp.addClass("text")
  sp.text(t);
  var width = textWidth(t, domnode.css("font"))
  sp.attr("width", width);
  // XXX Hard-coded values for Avenir Next here...
  // return { text: sp, breakClass:0, penalty:0, width: width, stretch:0, shrink:0.25*width } as Node;
  // Skia
  return { text: sp, breakClass:0, penalty:0, width: width, stretch:0.10*width, shrink:0.40*width } as Node;
}

declare var Hyphenator: any;

var h = new Hyphenator();

function hyphenate(t) {
  return [t];
  // return h.hyphenate(t);
}

export function addBreaker(domnode: JQuery<HTMLElement>) {
  console.log("Addbreaker called");
  var text = domnode.text()
  text = text.replace(/^\s+/,"");
  domnode.empty()
  domnode.addClass("nowrap")
  var nodelist: Node[] = [];
  console.log("Breaking: "+text)
  for (let t of text.split(/(\s+)/)) {
    let n: Node;
    if (t.match(/\s+/)) {
      n = makeGlue(domnode);
      nodelist.push(n);
      domnode.append(n.text);
    }
    else {
      let fragments = hyphenate(t) as String[];
      for (let idx=0; idx < fragments.length; idx++) {
        var frag = fragments[idx];
        console.log(frag)
        n = makeText(frag, domnode);
        nodelist.push(n);
        domnode.append(n.text);
        if (idx != fragments.length-1) {
          n = makeHyphen(domnode);
          nodelist.push(n);
          domnode.append(n.text);
        }
      }
    }
  }
  let stretchy = makeGlue(domnode);
  stretchy.stretch = 10000;
  nodelist.push(stretchy);
  domnode.data("nodelist", nodelist);
  // console.log("Nodes:")
  // console.log(nodelist)
  let doResize = (evt, ui) => {
    var breaker = new Linebreaker(nodelist, [domnode.width()])
    var points = breaker.doBreak();
    domnode.find("br").remove()
    var ratios = breaker.ratios(points)
    for (var p = 0; p < nodelist.length-1; p++) {
      var el = (nodelist[p].text as JQuery<HTMLSpanElement>);
      if (p == ratios[0].end) {
        el.css("width", "0");
        if (el.hasClass("hyphen")) {
          el.text(nodelist[p].breakHereText);
        }
      } else if (el.hasClass("hyphen")) {
          el.text("");
        }
      if (p > ratios[0].end) { ratios.shift() }
      if (ratios[0].ratio < 0 && nodelist[p].shrink > 0) {
        var shrunk = nodelist[p].width - nodelist[p].shrink * -ratios[0].ratio;
        if (el.hasClass("text")) {
          var shrunkpercent = shrunk / nodelist[p].width * 100
          el.css("font-stretch", shrunkpercent+"%")
          var redness = (255 - ((shrunkpercent - 75) / 25 * 255)).toFixed(0)
          el.css("color", "rgb("+redness+",0,0)")
        } else {
          el.css("width", shrunk+"px")
        }
      } else if (ratios[0].ratio > 0 && nodelist[p].stretch > 0) {
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
          el.css("font-stretch", "")
          el.css("color", "black")
      }
    }
    for (let p of points) {
      (nodelist[p].text as JQuery<HTMLSpanElement>).after($("<br>"))
    }
    console.log("Ratios:")
    console.log(ratios)
  }
  domnode.resizable({resize: doResize });
  doResize(null,null);

}