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
    for (var _i = 0, _a = ["font-style", "font-variant", "font-weight", "font-size", "font-family", "font-stretch", "font-variation-settings", "font-feature-settings"]; _i < _a.length; _i++) {
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
        this.cacheComputedStretch = {};
        this.cacheComputedShrink = {};
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
            stretchContribution: [1, 0],
            shrinkContribution: [1, 0],
            breakable: true,
            width: sp.width(),
            stretch: this.options.spaceStretch * sp.width(),
            shrink: this.options.spaceShrink * sp.width()
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
                breakable: false,
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
            breakable: true,
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
        var width = textWidth(t, domnode);
        var maximumLSavailable = (length - 1) * this.options.textLetterSpacing;
        var maximumVarfontStretchAvailable;
        var shrink;
        if (this.options.textStretch == "computed") {
            maximumVarfontStretchAvailable = this.computeMaxWidth(sp) - width;
            // console.log(t+" can stretch by "+maximumVarfontStretchAvailable+"px")
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
            breakable: false,
            penalty: 0,
            stretchContribution: [0, 1],
            shrinkContribution: [0, 1],
            width: width,
            stretch: stretch,
            shrink: shrink
        };
        if (this.options.customizeTextNode) {
            // Avoid horrible recursive mess
            var saveThisFunction = this.options.customizeTextNode;
            delete this.options["customizeTextNode"];
            var res = saveThisFunction(t, node);
            this.options.customizeTextNode = saveThisFunction;
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
            var guess = width / (0.001 + el.width()) * 1000;
            var min = 0; // XXX
            var max = 1000; // XXX
        }
        while (tries--) {
            if (this.options.method == "font-stretch") {
                el.css("font-stretch", guess + "%");
            }
            else {
                el.css("font-variation-settings", "'" + this.options.method + "' " + guess);
                el.attr("font-variation-settings", "'" + this.options.method + "' " + guess);
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
        var lines = breaker.doBreak({ fullJustify: this.options.fullJustify });
        domnode.find("br").remove();
        domnode.children("span").remove();
        // Stretch and shrink each node as appropriate. We'll add linebreaks later.
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var l = lines_1[_i];
            for (var ix = 0; ix < l.nodes.length; ix++) {
                var n = l.nodes[ix];
                var el = n.text;
                domnode.append(el);
                if (n.stretch > 0 || n.shrink > 0) {
                    if (el.hasClass("text")) {
                        // Text gets shrunk with the variable font CSS rule.
                        this.setToWidth(el, l.targetWidths[ix]);
                        el.css("letter-spacing", "normal");
                        if (this.options.colorize) {
                            var stretchShrink = (n.width - l.targetWidths[ix]) / n.width;
                            var color;
                            if (stretchShrink > 0) {
                                var redness = (stretchShrink * 4 * 255).toFixed(0);
                                color = "rgb(" + redness + ",0,0)";
                            }
                            else {
                                var greenness = -(stretchShrink * 4 * 255).toFixed(0);
                                color = "rgb(0," + greenness + ",0)";
                            }
                            el.css("color", color);
                        }
                    }
                    else {
                        // Glue gets shrunk by setting its width directly.
                        el.css("width", l.targetWidths[ix] + "px");
                    }
                }
                if (ix == l.nodes.length - 1) {
                    // el.next().after($("<br>"));
                    domnode.append($("<br>"));
                }
            }
        }
    };
    return DomBreak;
}());
exports.DomBreak = DomBreak;
//# sourceMappingURL=dombreak.js.map