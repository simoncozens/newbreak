"use strict";
/**
 * This is newbreak, a text justification algorithm designed to play nice
 * with variable fonts and non-Latin scripts.
 *
 * It is based vaguely on the classic Knuth-Plass algorithm as implemented
 * in TeX and SILE, but with a few interesting changes. (It's also a lot
 * simpler, which may also mean dumber.)
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
/**
 * A node class to feed to the linebreaker
 * @class Node
 */
var Node = /** @class */ (function () {
    function Node() {
    }
    return Node;
}());
exports.Node = Node;
var INF_BAD = 10000;
/**
 * The main line breaking algorithm
 * @class Linebreaker
 */
var Linebreaker = /** @class */ (function () {
    /**
     * Create a new linebreaker.
     * @constructor
     * @param {Node[]} nodes - array of nodes to break
     * @param {number[]} hsize - array of target line widths
     *
     * As with TeX, the last width in the `hsize` array is propagated to all
     * future lines. For example, if `hsize` is `[70,50]` then the first line
     * of the paragraph will be set at 70 units wide and all further lines will
     * be 50 units.
     **/
    function Linebreaker(nodes, hsize) {
        this.nodes = [];
        this.hsize = hsize;
        this.breakpoints = [];
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var n = nodes_1[_i];
            this.nodes.push(__assign({}, n));
        }
        // Add dummy node to end.
        this.nodes.push({ width: 0, breakable: true, penalty: 0 });
        this.prepareNodes();
        this.memoizeCache = {};
    }
    /**
      Sets up helpful shortcuts on node objects
    */
    Linebreaker.prototype.prepareNodes = function () {
        for (var thisNodeIx = 0; thisNodeIx < this.nodes.length; thisNodeIx++) {
            var n = this.nodes[thisNodeIx];
            this.prepareNode(n, thisNodeIx);
            if (n.alternates) {
                for (var _i = 0, _a = n.alternates; _i < _a.length; _i++) {
                    var a = _a[_i];
                    this.prepareNode(a, thisNodeIx);
                }
            }
        }
    };
    Linebreaker.prototype.prepareNode = function (n, ix) {
        n.originalIndex = ix;
        if (n.penalty < 0) {
            n.anyNegativePenalties = true;
        }
        if (n.breakable) {
            n.anyBreakable = true;
        }
        if (!n.stretchContribution) {
            n.stretchContribution = [1];
        }
        if (!n.shrinkContribution) {
            n.shrinkContribution = [1];
        }
        if (n.alternates) {
            for (var _i = 0, _a = n.alternates; _i < _a.length; _i++) {
                var a = _a[_i];
                if (a.penalty < 0) {
                    n.anyNegativePenalties = true;
                }
                if (a.breakable) {
                    n.anyBreakable = true;
                }
            }
        }
    };
    /**
     * Run the break algorithm.
     * You may want to feed the output of this into the `ratios` method below.
     * @returns {number[]} An array of node indexes at which to break.
     */
    Linebreaker.prototype.doBreak = function (options) {
        if (options === void 0) { options = {}; }
        var defaultOptions = {
            start: 0,
            end: this.nodes.length - 1,
            fullJustify: false,
            unacceptableRatio: 0.5,
            linePenalty: 10
        };
        var best = this.findBreakpoints(0, __assign({}, options, defaultOptions));
        this.assignTargetWidths(best);
        this.debug("Final best consideration:");
        this.debugConsideration(best.lines);
        return best.lines;
    };
    // A shortcut for finding the target length of the given line number.
    Linebreaker.prototype.targetFor = function (lineNo) {
        return this.hsize[lineNo > this.hsize.length - 1 ? this.hsize.length - 1 : lineNo];
    };
    Linebreaker.prototype.hasAnyNegativePenalties = function (nodelist) {
        for (var _i = 0, nodelist_1 = nodelist; _i < nodelist_1.length; _i++) {
            var n = nodelist_1[_i];
            if (n.anyNegativePenalties) {
                return true;
            }
        }
        return false;
    };
    /*
      Finally we arrive at the core of the algorithm. The basic principle is
      actually quite simple: find the optimum solution (minimize the number
      of demerits) given all the possible, feasible breakpoints in a paragraph.
      You do this by walking the tree of all possible breakpoints. Tree
      search algorithms are recursive algorithms. Here's another way to
      say it: To find the best way to break a paragraph,
  
      * Find the possible breakpoints for line one.
      * For each possible line-one breakpoint, find the best way to
        break the rest of the paragraph.
      * Compare the solutions and return the best one.
  
      This leads itself very naturally to a recursive implementation.
  
      The reason this is so complicated in the case of TeX is that Knuth was
      a great programmer trying to write a really neat algorithm that would
      run quickly on a small computer with little memory. So he had to do all
      kinds of clever linear programming to run in the optimum time and memory.
      I am not a great programmer and I don't give a damn. I'm quite happy to
      use the recursive implementation, trading off time and memory for
      simplicity.
    */
    Linebreaker.prototype.findBreakpoints = function (lineNo, options) {
        var target = this.targetFor(lineNo);
        /*
        One of the reasons for *not* using a recursive solution is that
        they tend to balloon time and memory, and also redo the same computation
        lots of times. We avoid both these problems by memoization.
        */
        var key = JSON.stringify(options);
        this.debug("Looking for breakpoints " + options.start + "->" + options.end + " to fill " + target + " on line " + lineNo, lineNo);
        if (key in this.memoizeCache) {
            this.debug("Returned from cache", lineNo);
            this.debug(this.memoizeCache[key], lineNo);
            return this.memoizeCache[key];
        }
        var relevant = this.nodes.slice(options.start, options.end + 1);
        // This represents how far along the line we are towards the target width.
        var curWidth = 0;
        var curStretch = 0;
        var curShrink = 0;
        var considerations = [];
        var bestBadness = Infinity;
        var seenAlternate = false;
        var that = this;
        var node;
        var addNodeToTotals = function (n) {
            that.debug("Adding width " + n.width + " for node " + (n.debugText || n.text || ""), lineNo);
            curWidth += n.width;
            curStretch += n.stretch || 0;
            curShrink += n.shrink || 0;
        };
        /*
        Now we walk through the relevant nodes, looking for feasible breakpoints
        and keeping track of how close we are to the target.
        */
        for (var thisNodeIx = 0; thisNodeIx < relevant.length; thisNodeIx++) {
            var thisNode = relevant[thisNodeIx];
            // If we can't break here... don't try to break here.
            this.debug("Node " + thisNode.originalIndex + " " + (thisNode.debugText || thisNode.text || ""), lineNo);
            if (!thisNode.anyBreakable) {
                addNodeToTotals(thisNode);
                continue;
            }
            this.debug(" Target: " + target + ". Current width: " + curWidth + ". Current stretch: " + curStretch, lineNo);
            var lastLine = thisNode.originalIndex >= this.nodes[this.nodes.length - 1].originalIndex - 2;
            // If we're a long way from the end and stretching to get there would be horrible,
            // don't even bother investigating this breakpoint.
            if ((curWidth / target < options.unacceptableRatio ||
                curWidth / target > (2 - options.unacceptableRatio))
                && !lastLine) {
                this.debug(" Too far", lineNo);
                addNodeToTotals(thisNode);
                continue;
            }
            if (thisNode.alternates && thisNode.alternates.length > 0) {
                seenAlternate = true;
            }
            // We have a potential breakpoint. Build a Line node
            // Find out how bad this potential breakpoint is.
            this.debug("Possibility!", lineNo);
            var line = {
                nodes: relevant.slice(0, thisNodeIx),
                ratio: curWidth / target,
                shortfall: target - curWidth,
                totalShrink: curShrink,
                totalStretch: curStretch,
                options: options
            };
            line.badness = this.badness(line);
            if (seenAlternate) {
                this.tryToImprove(line);
            }
            // If we are at e.g. a hyphenation point (not breakable but has breakable
            // alternate) then only consider this is if the last node has become breakable
            // through considering the alternates
            if (!thisNode.breakable && !(line.nodes[line.nodes.length - 1].breakable)) {
                that.debug("Adding width " + thisNode.width + " for node " + (thisNode.debugText || thisNode.text || ""), lineNo);
                curWidth += thisNode.width;
                addNodeToTotals(thisNode);
                continue;
            }
            var badness = line.badness;
            this.debug(" Badness was " + badness, lineNo);
            var anyNegativePenalties = this.hasAnyNegativePenalties(relevant);
            if (bestBadness < badness && !anyNegativePenalties) {
                // We have a better option already, and we have no chance
                // to improve this option, don't bother.
            }
            else if (relevant.length == 1) {
                // We aren't going to find any other nodes. Don't bother
            }
            else {
                // It's worth a further look at this breakpoint.
                // If we have nodes A...Z and we test a break at C, we need to work
                // out the best way to break the sub-paragraph D...Z.
                // Remembering that "Breakpoint path = Breakpoint for first line
                // + breakpoint path for remainder of paragraph", first we make
                // a line set which holds the first line...
                var newConsideration = {
                    totalBadness: badness,
                    lines: [line]
                };
                if (thisNode.originalIndex + 1 < options.end) {
                    this.debug("Recursing, now start at " + (thisNode.originalIndex + 1), lineNo);
                    var recursed = this.findBreakpoints(lineNo + 1, __assign({}, options, { start: thisNode.originalIndex + 1, end: options.end }));
                    this.debug("In that recursion, total badness = " + recursed.totalBadness);
                    // ...and then we add to it the current solution
                    newConsideration.lines = newConsideration.lines.concat(recursed.lines);
                    newConsideration.totalBadness += recursed.totalBadness;
                    // Save this option if it's better than we've seen already,
                    // to save recursing into worse ones.
                    if (newConsideration.totalBadness < bestBadness) {
                        bestBadness = newConsideration.totalBadness;
                    }
                    considerations.push(newConsideration);
                }
                else {
                    considerations.push(newConsideration);
                }
            }
            addNodeToTotals(thisNode);
        }
        // If we found nothing, give up.
        if (considerations.length < 1) {
            return { totalBadness: INF_BAD * INF_BAD, lines: [] };
        }
        // Otherwise, find the best of the bunch.
        this.debug("Choosing between considerations:");
        for (var _i = 0, considerations_1 = considerations; _i < considerations_1.length; _i++) {
            var c = considerations_1[_i];
            this.debug("With badness " + c.totalBadness + ": ");
            this.debugConsideration(c.lines);
        }
        var best = considerations.reduce(function (a, b) { return a.totalBadness <= b.totalBadness ? a : b; });
        this.debug("Best answer for " + key + " was:", lineNo);
        this.debugConsideration(best.lines);
        this.debug(" with badness " + best.totalBadness, lineNo);
        // Store it in the memoize cache for next time.
        this.memoizeCache[key] = best;
        return best;
    };
    Linebreaker.prototype.badness = function (line) {
        var bad = 0;
        if (line.shortfall == 0) {
            bad = 0;
        }
        else if (line.shortfall > 0) {
            // XXX use stretch/shrink penalties here instead
            bad = Math.floor(100 * Math.pow((line.shortfall / line.totalStretch), 3));
        }
        else {
            bad = Math.floor(100 * Math.pow((-line.shortfall / line.totalShrink), 3));
        }
        // consider also penalties. Break penalty:
        bad += line.nodes[line.nodes.length - 1].penalty;
        // Line penalty
        bad += line.options.linePenalty;
        // Any substitutions
        for (var _i = 0, _a = line.nodes; _i < _a.length; _i++) {
            var n = _a[_i];
            bad += n.substitutionPenalty || 0;
        }
        return bad;
    };
    Linebreaker.prototype.tryToImprove = function (line) {
        console.log("UNIMPLEMENTED");
    };
    Linebreaker.prototype.debugConsideration = function (lines) {
        this.debug("---");
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var l = lines_1[_i];
            this.debug(l.ratio.toFixed(3) + " " + l.nodes.map(function (a) { return a.debugText || a.text || ""; }).join(""));
        }
        this.debug("---");
    };
    Linebreaker.prototype.debug = function (msg, lineNo) {
        if (lineNo === void 0) { lineNo = 0; }
        if (this.debugging) {
            var spacer = new Array(lineNo + 1).join(" + ");
            console.log(spacer + msg);
        }
    };
    Linebreaker.prototype.assignTargetWidths = function (solution) {
        for (var _i = 0, _a = solution.lines; _i < _a.length; _i++) {
            var line = _a[_i];
            console.log("Line", line.nodes.map(function (x) { return x.debugText; }));
            this.assignTargetWidthsToLine(line);
        }
    };
    Linebreaker.prototype.assignTargetWidthsToLine = function (line) {
        line.targetWidths = line.nodes.map(function (n) { return n.width; });
        console.log("Original widths:" + line.targetWidths.join(", "));
        if (line.shortfall == 0) {
            return;
        }
        var level = 0;
        console.log("Shortfall: " + line.shortfall);
        if (line.shortfall > 0) {
            while (line.shortfall > 0) { // We need to expand
                var thisLevelStretch = line.nodes.map(function (n) { return n.stretch * (n.stretchContribution[level] || 0); });
                console.log("Level ", level, " stretch ", thisLevelStretch);
                var thisLevelTotalStretch = thisLevelStretch.reduce(function (a, c) { return a + c; }, 0); // Sum
                if (thisLevelTotalStretch == 0) {
                    break;
                }
                var ratio = line.shortfall / thisLevelTotalStretch;
                if (ratio > 1) {
                    ratio = 1;
                }
                line.targetWidths = line.targetWidths.map(function (w, ix) { return w + ratio * thisLevelStretch[ix]; });
                console.log("Done stretch ", line.targetWidths);
                line.shortfall -= thisLevelTotalStretch * ratio;
                level = level + 1;
            }
        }
        else {
            while (line.shortfall < 0) { // We need to expand
                var thisLevelShrink = line.nodes.map(function (n) { return n.shrink * (n.shrinkContribution[level] || 0); });
                console.log("Level ", level, " shrink ", thisLevelShrink);
                var thisLevelTotalShrink = thisLevelShrink.reduce(function (a, c) { return a + c; }, 0); // Sum
                if (thisLevelTotalShrink == 0) {
                    break;
                }
                var ratio = -line.shortfall / thisLevelTotalShrink;
                if (ratio > 1) {
                    ratio = 1;
                }
                line.targetWidths = line.targetWidths.map(function (w, ix) { return w - ratio * thisLevelShrink[ix]; });
                console.log("Done shrink ", line.targetWidths);
                line.shortfall += thisLevelTotalShrink * ratio;
                level = level + 1;
            }
        }
        this.debug("Final widths:" + line.targetWidths.join(", "));
    };
    return Linebreaker;
}());
exports.Linebreaker = Linebreaker;
//# sourceMappingURL=newbreak.js.map