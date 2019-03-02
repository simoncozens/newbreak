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
var LINE_PENALTY = 10;
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
        this.nodes.push({ width: 0, breakClass: 1, penalty: INF_BAD });
        this.memoizeCache = {};
    }
    /**
     * Run the break algorithm.
     * You may want to feed the output of this into the `ratios` method below.
     * @returns {number[]} An array of node indexes at which to break.
     */
    Linebreaker.prototype.doBreak = function () {
        var maxBreakClass = Math.max.apply(Math, this.nodes.map(function (x) { return x.breakClass; }));
        // Basically we run through the break classes from highest to lowest,
        // trying to `findBreakpoints` for each class.
        for (var i = maxBreakClass; i > 0; i--) {
            this.debug("Trying breaks of class " + i);
            var best = this.findBreakpoints(0, { class: i, start: 0, end: this.nodes.length - 1 });
            if (best.points.length > 0) {
                return best.points;
            }
        }
        this.debug("Nothing found, giving up");
        return [];
    };
    // Not all nodes can be broken at, if their class is below the minimum
    // class that we are trying for right now. (Or of course if their class
    // is zero, in which case they can't be broken at at all.) So we reduce
    // the problem space by merging any adjacent non-breakable nodes, creating
    // a new list of nodes which collates the widths of the non-breakables.
    Linebreaker.prototype.findRelevantNodes = function (minClass, start, end) {
        var relevant = [];
        for (var i = start; i <= end; i++) {
            var thisNode = __assign({}, this.nodes[i]);
            if (thisNode.breakClass < minClass) { // We are not interested in breaking here
                // If we're just starting out, or if we have just changed from a
                // non-interesting node to an interesting one, then we need to
                // put a new node onto our list. We keep track of where it used to be.
                if (relevant.length == 0 || relevant[relevant.length - 1].breakClass >= minClass) {
                    thisNode.originalIndex = i;
                    relevant.push(thisNode);
                }
                else {
                    // We aren't just starting out, and the current node is just as
                    // non-breakable as the previous node, so we add our widths together.
                    relevant[relevant.length - 1].width += thisNode.width;
                    relevant[relevant.length - 1].stretch += thisNode.stretch;
                    relevant[relevant.length - 1].shrink += thisNode.shrink;
                }
            }
            else {
                // This is a potential breakpoint, so should not be merged.
                thisNode.originalIndex = i;
                relevant.push(thisNode);
            }
        }
        return relevant;
    };
    // The following three functions are classic TeX - given a shortfall and an amount
    // stretchability or shrinkability available, provide a metric of how bad this breakpoint is.
    Linebreaker.prototype.badnessFunction = function (t, s) {
        if (t == 0)
            return 0;
        var bad = Math.floor(100 * Math.pow((t / s), 3));
        return bad > INF_BAD ? INF_BAD : bad;
    };
    Linebreaker.prototype.computeBadness = function (shortfall, stretch, shrink, lineNo) {
        this.debug(" Shortfall: " + shortfall + ", stretch: " + stretch + ", shrink: " + shrink, lineNo);
        if (shortfall > 0) {
            if (shortfall > 110 && stretch < 25) {
                return INF_BAD;
            }
            else {
                return this.badnessFunction(shortfall, stretch);
            }
        }
        else {
            shortfall = -shortfall;
            if (shortfall > shrink) {
                return INF_BAD + 1;
            }
            else {
                return this.badnessFunction(shortfall, shrink);
            }
        }
    };
    Linebreaker.prototype.considerDemerits = function (badness, thisNode) {
        var d = (badness + LINE_PENALTY);
        if (Math.abs(d) >= 10000) {
            d = 100000000;
        }
        else {
            d = d * d;
        }
        if (thisNode.penalty) {
            d += thisNode.penalty * thisNode.penalty;
        }
        return d;
    };
    // A shortcut for finding the target length of the given line number.
    Linebreaker.prototype.targetFor = function (lineNo) {
        return this.hsize[lineNo > this.hsize.length - 1 ? this.hsize.length - 1 : lineNo];
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
        var relevant = this.findRelevantNodes(options.class, options.start, options.end);
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
        // This represents how far along the line we are towards the target width.
        var curWidth = 0;
        var curStretch = 0;
        var curShrink = 0;
        var considerations = [];
        var minTotalBadness = Infinity;
        var that = this;
        var addNodeToTotals = function (n) {
            that.debug("Adding width " + n.width + " for node " + (n.text || ""), lineNo);
            curWidth += n.width;
            curStretch += n.stretch || 0;
            curShrink += n.shrink || 0;
        };
        /*
        Now we walk through the relevant nodes, looking for feasible breakpoints
        and keeping track of how close we are to the target.
        */
        for (var _i = 0, relevant_1 = relevant; _i < relevant_1.length; _i++) {
            var thisNode = relevant_1[_i];
            if (thisNode.breakClass >= options.class) {
                this.debug("Node " + thisNode.originalIndex + " is possible", lineNo);
                // As we're looking at the possibility of breaking here, add
                // any additional discretionary width (eg hyphens). We'll take it
                // out again later if we decide not to make the break.
                if (thisNode.breakHereWidth) {
                    curWidth += thisNode.breakHereWidth;
                    curShrink += thisNode.breakHereShrink || 0;
                    curStretch += thisNode.breakHereStretch || 0;
                }
                this.debug(" Target: " + target + ". Current width: " + curWidth, lineNo);
                // If we're a long way from the end and shrinking/stretching to get
                // there would be horrible, don't even both investigating this breakpoint.
                if (target - curWidth < 0 && target - curWidth < -3 * curShrink) {
                    this.debug(" Too shrunk " + (target - curWidth) + " needed, " + 3 * curShrink + " available; not bothering", lineNo);
                    addNodeToTotals(thisNode);
                    continue;
                }
                if (target - curWidth > 0 && target - curWidth > 3 * curStretch) {
                    this.debug(" Too stretched " + (target - curWidth) + " needed, " + 3 * curStretch + " available; not bothering", lineNo);
                    addNodeToTotals(thisNode);
                    continue;
                }
                // Find out how bad this potential breakpoint is.
                var badness = this.computeBadness(target - curWidth, curStretch, curShrink, lineNo);
                badness = this.considerDemerits(badness, thisNode);
                this.debug(" Badness was " + badness, lineNo);
                // If we've already got a better option or there are
                // no other options, don't bother. But if there are, we
                // need to do a full investigation of this node.
                if (badness < minTotalBadness && relevant.length > 1) {
                    // Now recursively investigate the consequences of this breakpoint.
                    // If we have nodes A...Z and we test a break at C, we need to work
                    // out the best way to break the sub-paragraph D...Z.
                    // Remembering that "Breakpoint path = Breakpoint for first line
                    // + breakpoint path for remainder of paragraph", first we make
                    // a breakpoint set which holds the breakpoint for the first line...
                    var newConsideration = {
                        totalBadness: badness,
                        points: [thisNode.originalIndex]
                    };
                    if (thisNode.originalIndex + 1 < options.end) {
                        this.debug("Recursing, now start at " + (thisNode.originalIndex + 1), lineNo);
                        var recursed = this.findBreakpoints(lineNo + 1, {
                            class: options.class,
                            start: thisNode.originalIndex + 1,
                            end: options.end,
                        });
                        this.debug("In that recursion, total badness = " + recursed.totalBadness);
                        // ...and then we add to it the breakpoints for the rest of the paragraph.
                        newConsideration.points = newConsideration.points.concat(recursed.points);
                        newConsideration.totalBadness += recursed.totalBadness;
                        // This is just a timesaver - keep track of winner, and don't
                        // investigate anything worse than it.
                        if (newConsideration.totalBadness < minTotalBadness) {
                            minTotalBadness = newConsideration.totalBadness;
                        }
                        considerations.push(newConsideration);
                    }
                }
                // Remove the discretionary when we consider future breakpoints.
                if (thisNode.breakHereWidth) {
                    curWidth -= thisNode.breakHereWidth;
                    curShrink -= thisNode.breakHereShrink || 0;
                    curStretch -= thisNode.breakHereStretch || 0;
                }
            }
            addNodeToTotals(thisNode);
        }
        // If we found nothing, give up.
        if (considerations.length < 1) {
            return { totalBadness: 0, points: [] };
        }
        // Otherwise, find the best of the bunch.
        var best = considerations.reduce(function (a, b) { return a.totalBadness <= b.totalBadness ? a : b; });
        this.debug("Best answer for " + key + " was: " + best.points, lineNo);
        this.debugConsideration(options, best.points);
        this.debug(" with badness " + best.totalBadness, lineNo);
        // Store it in the memoize cache for next time.
        this.memoizeCache[key] = best;
        return best;
    };
    Linebreaker.prototype.debugConsideration = function (options, origpoints) {
        var lines = [""];
        this.debug("---");
        var points = origpoints.slice(0);
        for (var i = options.start; i < options.end; i++) {
            lines[lines.length - 1] += this.nodes[i].text || (this.nodes[i].width > 0 ? " " : "");
            if (i == points[0]) {
                if (this.nodes[i].breakHereText) {
                    lines[lines.length - 1] += this.nodes[i].breakHereText;
                }
                points.shift();
                lines.push("");
            }
        }
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var l = lines_1[_i];
            this.debug(l);
        }
        this.debug("---");
    };
    /**
     * Given a set of breakpoints, compute the stretch/shrink ratio for
     * each line, and the nodes which make up each line. This is what you
     * would feed to the justification engine.
     * @param {number[]} pointSet: list of nodes to be broken at
     * @returns {Ratio[]} array of start and end node indexes and ratio to apply.
     **/
    Linebreaker.prototype.ratios = function (pointSet) {
        var rv = [{ start: 0, end: 0, ratio: 0 }];
        var curWidth = 0;
        var curStretch = 0;
        var curShrink = 0;
        var lineNo = 0;
        // Copy the pointset so we can modify it.
        var ps = pointSet.slice();
        for (var i = 0; i < this.nodes.length; i++) {
            var target = this.targetFor(lineNo);
            if (ps[0] == i || i == this.nodes.length - 1) {
                // We're at a breakpoint.
                // If we're breaking at a discretionary, take that into account.
                curWidth += this.nodes[i].breakHereWidth || 0;
                curStretch += this.nodes[i].breakHereStretch || 0;
                curShrink += this.nodes[i].breakHereShrink || 0;
                // Work out the shortfall and ratio
                var shortfall = target - curWidth;
                if (shortfall > 0) {
                    rv[rv.length - 1].ratio = shortfall / curStretch;
                }
                else {
                    rv[rv.length - 1].ratio = shortfall / curShrink;
                }
                this.debug("Line " + lineNo + ": target " + target + ", break width " + curWidth + " plus " + curStretch + " minus " + curShrink + ", ratio " + rv[rv.length - 1].ratio);
                rv[rv.length - 1].end = i;
                // Move onto finding next breakpoint and start again.
                ps.shift();
                rv.push({ start: i + 1, end: 0, ratio: 0 });
                curWidth = 0;
                curStretch = 0;
                curShrink = 0;
            }
            else {
                curWidth += this.nodes[i].width || 0;
                curStretch += this.nodes[i].stretch || 0;
                curShrink += this.nodes[i].shrink || 0;
            }
        }
        // We added a Ratio node on the end to store information
        // about the *next* line, but obviously at the end there
        // isn't going to be a next line, so get rid of it again.
        rv.pop();
        return rv;
    };
    Linebreaker.prototype.debug = function (msg, lineNo) {
        if (lineNo === void 0) { lineNo = 0; }
        if (this.debugging) {
            var spacer = new Array(lineNo + 1).join("  ");
            console.log(spacer + msg);
        }
    };
    return Linebreaker;
}());
exports.Linebreaker = Linebreaker;
//# sourceMappingURL=newbreak.js.map