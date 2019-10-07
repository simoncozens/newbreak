"use strict";
/**
 * This is dombreak, which applies the newbreak algorithm to text
 * nodes in a HTML DOM.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var $ = require("jquery");
var newbreak_1 = require("./newbreak");
var defaultOptions = {
    spaceStretch: 1.00,
    spaceShrink: 0.20,
    textStretch: 0.10,
    textShrink: 0.40,
    textLetterSpacing: 0,
    textLetterSpacingPriority: 0,
    hyphenate: false,
    colorize: true,
    fullJustify: false,
    method: "font-stretch"
};
// Crappy function to measure the width of a bit of text.
var fakeEl;
function textWidth(text, elProto) {
    if (!fakeEl) {
        fakeEl = $("<span>").appendTo(document.body).hide();
    }
    for (var _i = 0, _a = ["font-style", "font-variant", "font-weight", "font-size", "font-family", "font-stretch", "font-variation-settings"]; _i < _a.length; _i++) {
        var c = _a[_i];
        fakeEl.css(c, elProto.css(c));
    }
    fakeEl.text(text);
    return fakeEl.width();
}
;
var DomBreak = /** @class */ (function () {
    function DomBreak(domnode, options) {
        var _this = this;
        this.cacheComputedShrink = {};
        this.cacheComputedStretch = {};
        this.cacheSpaceWidth = -1;
        this.options = __assign({}, defaultOptions, options);
        this.domNode = domnode;
        if (domnode[0].hasAttribute("data-text-stretch")) {
            this.options.textStretch = domnode.data("text-stretch");
        }
        if (domnode[0].hasAttribute("data-text-shrink")) {
            this.options.textShrink = domnode.data("text-shrink");
        }
        if (domnode.data("method")) {
            this.options.method = domnode.data("method");
        }
        this.origContents = domnode.contents();
        if (!this.options.customNodeMaker) {
            this.options.customNodeMaker = function (el) {
                return _this.textToNodes(domnode, el.text());
            };
        }
        this.rebuild();
    }
    DomBreak.prototype.rebuild = function () {
        var _this = this;
        this.nodelist = this.DOMToNodes(this.domNode, this.origContents);
        var doResize = function (evt, ui) { _this.layout(); };
        if (this.domNode.resizable("instance")) {
            this.domNode.resizable("destroy");
        }
        setTimeout(function () {
            _this.domNode.resizable({ resize: doResize });
            doResize(null, null);
        }, 0.1);
    };
    DomBreak.prototype.makeGlue = function (domnode) {
        var sp = $("<span/>");
        sp.addClass("glue");
        // Because it's hard to measure a space directly we have to do a bit of
        // messing about to work out the width.
        if (this.cacheSpaceWidth == -1) {
            this.cacheSpaceWidth = textWidth("x x", domnode) - textWidth("xx", domnode);
        }
        sp.width(this.cacheSpaceWidth);
        return {
            text: sp,
            debugText: " ",
            penalty: 0,
            breakClass: 1,
            width: sp.width(),
            stretch: this.options.spaceStretch * sp.width(),
            shrink: this.options.spaceShrink * sp.width()
        };
    };
    // A hyphen is an empty node, but with discretionary width and text.
    // It can't stretch.
    DomBreak.prototype.makeHyphen = function (domnode) {
        var width = textWidth("-", domnode);
        var sp1 = $("<span/>");
        sp1.addClass("hyphen");
        return {
            debugText: "",
            text: sp1,
            breakHereText: "-",
            width: 0,
            breakHereWidth: width,
            breakClass: 1
        };
    };
    DomBreak.prototype.makeForcedBreak = function (domnode) {
        var rv = [];
        if (!this.options.fullJustify) {
            var sp = $("<span/>");
            sp.addClass("glue");
            rv.push({
                debugText: " ",
                text: sp,
                breakClass: 0,
                penalty: 0,
                width: sp.width(),
                stretch: 100000,
                shrink: 0
            });
        }
        var b = $("<span class='break'/>");
        rv.push({
            debugText: "<BR!>\n",
            text: b,
            breakClass: 1,
            penalty: -10000,
            width: 0,
        });
        return rv;
    };
    DomBreak.prototype.makeText = function (t, domnode) {
        var sp = $("<span/>");
        sp.addClass("text");
        sp.text(t);
        var length = t.length;
        var width = textWidth("X" + t + "X", domnode) - textWidth("XX", domnode);
        var maximumLSavailable = (length - 1) * this.options.textLetterSpacing;
        var maximumVarfontStretchAvailable;
        var shrink;
        if (this.options.textStretch == "computed") {
            maximumVarfontStretchAvailable = this.computeMaxWidth(sp) - width;
        }
        else {
            var maximumVarfontStretchAvailable = this.options.textStretch * width;
        }
        if (this.options.textShrink == "computed") {
            shrink = width - this.computeMinWidth(sp);
        }
        else {
            shrink = this.options.textShrink * width;
        }
        this.setToWidth(sp, width);
        var stretch = maximumLSavailable * this.options.textLetterSpacingPriority + maximumVarfontStretchAvailable * (1 - this.options.textLetterSpacingPriority);
        var node = {
            debugText: t,
            text: sp,
            breakClass: 0,
            penalty: 0,
            width: width,
            stretch: stretch,
            shrink: shrink
        };
        if (this.options.customizeTextNode) {
            var res = this.options.customizeTextNode(t, node);
            if (res) {
                return res;
            }
        }
        sp.attr("width", node.width);
        sp.attr("stretch", node.stretch);
        sp.attr("shrink", node.shrink);
        return [node];
    };
    DomBreak.prototype.computeMaxWidth = function (sp) {
        if (this.cacheComputedStretch[sp.text()]) {
            return this.cacheComputedStretch[sp.text()];
        }
        var measureEl = sp.clone().appendTo(this.domNode).hide();
        this.setToWidth(measureEl, 1000);
        var w = measureEl.width();
        measureEl.remove();
        this.cacheComputedStretch[sp.text()] = w;
        return w;
    };
    DomBreak.prototype.computeMinWidth = function (sp) {
        if (this.cacheComputedShrink[sp.text()]) {
            return this.cacheComputedShrink[sp.text()];
        }
        var measureEl = sp.clone().appendTo(this.domNode).hide();
        this.setToWidth(measureEl, 0);
        var w = measureEl.width();
        measureEl.remove();
        this.cacheComputedShrink[sp.text()] = w;
        return w;
    };
    DomBreak.prototype.hyphenate = function (t) {
        if (this.options.hyphenate) {
            if (!this.hyphenator) {
                this.hyphenator = new Hyphenator();
            }
            return this.hyphenator.hyphenate(t);
        }
        return [t];
    };
    // The first job is to create nodes, both in the DOM and
    // newbreak `Node` objects, representing each word and space.
    DomBreak.prototype.DOMToNodes = function (domnode, contents) {
        var _this = this;
        domnode.empty();
        domnode.addClass("nowrap");
        var nodelist = [];
        contents.each(function (i, el) {
            if (el.nodeType == 3) {
                nodelist = nodelist.concat(_this.textToNodes(domnode, el.textContent));
            }
            else if (el.nodeType == 1) {
                el = el;
                var nodes;
                if (el.tagName == "BR") {
                    nodes = _this.makeForcedBreak(domnode);
                }
                else {
                    nodes = _this.options.customNodeMaker($(el));
                }
                for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                    var n = nodes_1[_i];
                    nodelist.push(n);
                    domnode.append(n.text);
                }
            }
        });
        return nodelist;
    };
    DomBreak.prototype.textToNodes = function (domnode, text) {
        // We'll empty the container and tell it that we're handling wrapping.
        var nodelist = [];
        for (var _i = 0, _a = text.split(/(\s+)/m); _i < _a.length; _i++) {
            var t = _a[_i];
            var n;
            if (t.match(/\s+/)) {
                // This is just space. Turn it into a glue node.
                n = this.makeGlue(domnode);
                nodelist.push(n);
                domnode.append(n.text);
            }
            else {
                // This is text. Turn it into hyphenated fragments.
                // If hyphenation is off, we just get the text back.
                var fragments = this.hyphenate(t);
                for (var idx = 0; idx < fragments.length; idx++) {
                    var frag = fragments[idx];
                    // Turn each fragment into a `Node`, pop it on the list
                    // and put the word back into the DOM.
                    var nl = this.makeText(frag, domnode);
                    for (var _b = 0, nl_1 = nl; _b < nl_1.length; _b++) {
                        n = nl_1[_b];
                        nodelist.push(n);
                        domnode.append(n.text);
                    }
                    if (idx != fragments.length - 1) {
                        // Add hyphens between each fragment.
                        n = this.makeHyphen(domnode);
                        nodelist.push(n);
                        domnode.append(n.text);
                    }
                }
            }
        }
        if (!this.options.fullJustify) {
            // At the end of the paragraph we need super-stretchy glue.
            var stretchy = this.makeGlue(domnode);
            stretchy.stretch = 10000;
            nodelist.push(stretchy);
        }
        return nodelist;
    };
    DomBreak.prototype.setToWidth = function (el, width) {
        var tries = 20;
        if (this.options.method == "font-stretch") {
            var guess = width / el.width() * 100;
            var min = 0; // XXX
            var max = 200; // XXX
        }
        else {
            var guess = width / el.width() * 1000;
            var min = 0; // XXX
            var max = 1000; // XXX
        }
        while (tries--) {
            if (this.options.method == "font-stretch") {
                el.css("font-stretch", guess + "%");
            }
            else {
                el.css("font-variation-settings", "'" + this.options.method + "' " + guess);
            }
            var newWidth = el.width();
            if (Math.abs(newWidth - width) < 1) {
                return;
            }
            else if (newWidth > width) {
                max = guess;
            }
            else if (newWidth < width) {
                min = guess;
            }
            guess = (min + max) / 2;
        }
    };
    DomBreak.prototype.layout = function () {
        var nodelist = this.nodelist;
        var domnode = this.domNode;
        var breaker = new newbreak_1.Linebreaker(nodelist, [domnode.width()]);
        breaker.debugging = false;
        var points = breaker.doBreak({ fullJustify: this.options.fullJustify });
        var ratios = breaker.ratios(points);
        // Now we have our breakpoints, we have to actually lay the thing out,
        // which turns out to be the hard bit.
        // Stretch and shrink each node as appropriate. We'll add linebreaks later.
        for (var p = 0; p < nodelist.length - 1; p++) {
            var el = nodelist[p].text;
            if (p == ratios[0].end) {
                // Discretionaries at the end of the line have to be replaced
                // with their break text (the hyphen)
                if (el.hasClass("hyphen")) {
                    el.text(nodelist[p].breakHereText);
                }
            }
            else if (el.hasClass("hyphen")) {
                // Discretionaries *not* at the end of the line have to be empty.
                el.text("");
            }
            if (p > ratios[0].end) {
                // Done with this line, move to the next.
                ratios.shift();
            }
            // First deal with nodes which need to be shrunk.
            if (ratios[0].ratio < 0 && nodelist[p].shrink > 0) {
                var shrinkRequired = nodelist[p].shrink * -ratios[0].ratio;
                var shrunk = nodelist[p].width - shrinkRequired;
                if (el.hasClass("text")) {
                    // Text gets shrunk with the variable font CSS rule.
                    var shrunkpercent = shrunk / nodelist[p].width * 100;
                    this.setToWidth(el, shrunk);
                    el.css("letter-spacing", "normal");
                    if (this.options.colorize) {
                        var redness = ((shrinkRequired / nodelist[p].width) * 4 * 255).toFixed(0);
                        el.css("color", "rgb(" + redness + ",0,0)");
                    }
                }
                else {
                    // Glue gets shrunk by setting its width directly.
                    el.css("width", shrunk + "px");
                }
            }
            else if (ratios[0].ratio > 0 && nodelist[p].stretch > 0) {
                // And similarly for things which need to be stretched.
                var stretchRequired = nodelist[p].stretch * ratios[0].ratio;
                var stretched = nodelist[p].width + stretchRequired;
                if (el.hasClass("text")) {
                    // There are two ways of stretching, so we divide the job
                    // between the two.
                    var vfContribution = (1 - this.options.textLetterSpacingPriority) * stretchRequired;
                    var lsContribution = (this.options.textLetterSpacingPriority) * stretchRequired;
                    var lsStretched = lsContribution / (el.text().length - 1);
                    // el.css("font-stretch", (vfStretched)+"%")
                    this.setToWidth(el, nodelist[p].width + vfContribution);
                    el.css("letter-spacing", lsStretched + "px");
                    if (this.options.colorize) {
                        var greenness = ((stretchRequired / nodelist[p].width) * 4 * 255).toFixed(0);
                        el.css("color", "rgb(0," + greenness + ",0)");
                    }
                }
                else {
                    el.css("width", stretched + "px");
                }
            }
            else {
                // On the rare occasion that a line is perfect, reset it to natural.
                el.css("font-stretch", "");
                el.css("color", "black");
                el.css("letter-spacing", "normal");
            }
        }
        // Remove any breaks we added on previous times.
        domnode.find("br").remove();
        // Now we add the breaks.
        for (var _i = 0, points_1 = points; _i < points_1.length; _i++) {
            var p_1 = points_1[_i];
            nodelist[p_1].text.after($("<br>"));
        }
    };
    return DomBreak;
}());
exports.DomBreak = DomBreak;
//# sourceMappingURL=dombreak.js.map