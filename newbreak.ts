/**
 * This is newbreak, a text justification algorithm designed to play nice
 * with variable fonts and non-Latin scripts.
 *
 * It is based vaguely on the classic Knuth-Plass algorithm as implemented
 * in TeX and SILE, but with a few interesting changes. (It's also a lot
 * simpler, which may also mean dumber.)
 */

/**
 * A node class to feed to the linebreaker
 * @class Node
 */
export class Node {
  /**
   * The linebreaker just deals with nodes. Everything's a node. There's
   * no difference between boxes, glue, and penalties any more. This was
   * slightly inspired by Knuth's idea of the "kerf", but more to the point,
   * everything needs to be able to stretch, at least a bit!
   * @property {number} penalty
   * @property {number} width
   * @property {number} stretch
   * @property {number} shrink
   */
  public penalty: number;
  public substitutionPenalty?: number;
  public width: number;
  /**
  * This is the total amount of stretch and shrink available through all strategies
  */
  public stretch?: number;
  public shrink?: number;
  public breakable: boolean;

  /**
  * stretchContribution is a normalized (sums to one) array which represents
  * how much of the stretch value is allocated to different "levels" of justification.
  * For example, if kashidas are set to stretchContribution [1,0] and spaces have
  * stretchContribution [0,1], then kashidas will be stretched to their limit first
  * to fill a line, and if more room is needed then the engine will start expanding
  * spaces. If kashidas have [0.5, 0.5] and spaces have [1,0], then spaces and
  * kashidas will stretch at the same time, but kashidas will only stretch to half
  * their maximum width initially, and will only stretch the other half once spaces
  * have fully stretched.
  **/
  public stretchContribution: number[];
  public shrinkContribution: number[];
  public stretchPenalty?: number;

  public text?: any;
  public debugText?: string;
  originalIndex?: number;

  public alternates?: Node[];

  anyBreakable?: boolean;
  anyNegativePenalties?: boolean;
}

export interface Line {
  nodes: Node[]; // Includes selected alternates
  ratio?: number;
  totalStretch: number;
  totalShrink: number;
  shortfall: number;
  options: BreakOptions;
  targetWidths?: number[];
  badness?: number;
}

// Don't worry about this, it's just an internal thing to make the
// type checking neat.
interface Solution {
  lines: Line[];
  totalBadness: number;
}

interface BreakOptions {
  fullJustify?: boolean;
  start?: number;
  end?: number;
  unacceptableRatio?: number;
  linePenalty?: number;
}

const INF_BAD = 10000;

/**
 * The main line breaking algorithm
 * @class Linebreaker
 */

export class Linebreaker {
  public nodes: Node[];
  public hsize: number[];
  public breakpoints: number[];
  private memoizeCache: any;
  public debugging: boolean;

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
  constructor (nodes: Node[], hsize: number[]) {
    this.nodes = []; this.hsize = hsize;
    for (var n of nodes) {
      this.nodes.push({...n})
    }
    // Add dummy node to end.
    this.nodes.push({ width:0, breakable: true, penalty: 0} as Node)
    this.prepareNodes()
    this.memoizeCache = {}
  }

  /**
    Sets up helpful shortcuts on node objects
  */
  private prepareNodes() {
    for (var thisNodeIx = 0; thisNodeIx < this.nodes.length ; thisNodeIx++) {
      var n = this.nodes[thisNodeIx];
      this.prepareNode(n, thisNodeIx);
      if (n.alternates) { for (var a of n.alternates) {
        this.prepareNode(a, thisNodeIx);
      } }
    }
  }

  private prepareNode(n: Node, ix: number) {
    n.originalIndex = ix;
    if (n.penalty < 0) { n.anyNegativePenalties = true }
    if (n.breakable)   { n.anyBreakable         = true }
    if (!n.stretchContribution) {n.stretchContribution = [1] }
    if (!n.shrinkContribution) {n.shrinkContribution = [1] }
    if (n.alternates) { for (var a of n.alternates) {
        if (a.penalty < 0) { n.anyNegativePenalties = true }
        if (a.breakable)   { n.anyBreakable         = true }
    } }
  }

  /**
   * Run the break algorithm.
   * You may want to feed the output of this into the `ratios` method below.
   * @returns {number[]} An array of node indexes at which to break.
   */
  public doBreak (options:BreakOptions = {}) :Line[] {
    var defaultOptions :BreakOptions = {
      start: 0,
      end: this.nodes.length-1,
      fullJustify: false,
      unacceptableRatio: 0.5,
      linePenalty: 10
    }
    var best = this.findBreakpoints(0, { ...options, ...defaultOptions });
    this.assignTargetWidths(best);
    this.debug("Final best consideration:")
    this.debugConsideration(best.lines);
    return best.lines;
  }

  // A shortcut for finding the target length of the given line number.
  public targetFor(lineNo: number) :number {
    return this.hsize[lineNo > this.hsize.length-1 ? this.hsize.length-1 : lineNo]
  }

  public hasAnyNegativePenalties(nodelist: Node[]) :boolean {
    for (var n of nodelist) {
      if (n.anyNegativePenalties) { return true }
    }
    return false;
  }

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

  public findBreakpoints(lineNo: number, options: BreakOptions) : Solution {
    let target = this.targetFor(lineNo)

    /*
    One of the reasons for *not* using a recursive solution is that
    they tend to balloon time and memory, and also redo the same computation
    lots of times. We avoid both these problems by memoization.
    */
    let key = JSON.stringify(options)
    this.debug(`Looking for breakpoints ${options.start}->${options.end} to fill ${target} on line ${lineNo}`,lineNo)
    if (key in this.memoizeCache) {
      this.debug(`Returned from cache`,lineNo);
      this.debug(this.memoizeCache[key],lineNo);
      return this.memoizeCache[key]
    }

    let relevant = this.nodes.slice(options.start, options.end+1);

    // This represents how far along the line we are towards the target width.
    let curWidth = 0;
    let curStretch = 0;
    let curShrink = 0;

    let considerations = [] as Solution[];
    var bestBadness = Infinity;
    var seenAlternate = false;
    var that = this;
    var node
    let addNodeToTotals = function (n) {
      that.debug(`Adding width ${n.width} for node ${n.debugText||n.text||""}`, lineNo)
      curWidth += n.width;
      curStretch += n.stretch || 0;
      curShrink += n.shrink || 0;
    }

    /*
    Now we walk through the relevant nodes, looking for feasible breakpoints
    and keeping track of how close we are to the target.
    */
    for (var thisNodeIx = 0; thisNodeIx < relevant.length ; thisNodeIx++) {
      let thisNode = relevant[thisNodeIx];
      if (thisNode.alternates && thisNode.alternates.length > 0) {
        seenAlternate = true;
      }

      // If we can't break here... don't try to break here.
      this.debug(`Node ${thisNode.originalIndex} ${thisNode.debugText||thisNode.text||""}`, lineNo)
      if (!thisNode.anyBreakable) {
        addNodeToTotals(thisNode);
        continue;
      }
      this.debug(` Target: ${target}. Current width: ${curWidth}. Current stretch: ${curStretch}`, lineNo);
      var lastLine = thisNode.originalIndex >= this.nodes[this.nodes.length-1].originalIndex-2;
      // If we're a long way from the end and stretching to get there would be horrible,
      // don't even bother investigating this breakpoint.
      // console.log("Width",curWidth, "Target:", target, "Ratio: ",curWidth/target, "Unacceptable: ",options.unacceptableRatio)
      if ( (curWidth / target < options.unacceptableRatio &&!lastLine) ||
            curWidth / target > (2-options.unacceptableRatio)) {
        this.debug(` Too far`, lineNo);
        addNodeToTotals(thisNode);
        continue;
      }

      // We have a potential breakpoint. Build a Line node
      // Find out how bad this potential breakpoint is.
      this.debug(`Possibility!`, lineNo)
      var line:Line = {
        nodes: relevant.slice(0,thisNodeIx),
        ratio: curWidth / target,
        shortfall: target - curWidth,
        totalShrink: curShrink,
        totalStretch: curStretch,
        options: options
      }

      line.badness = this.badness(line)
      if (seenAlternate) {
        line = this.tryToImprove(line, target);
      }

      // If we are at e.g. a hyphenation point (not breakable but has breakable
      // alternate) then only consider this is if the last node has become breakable
      // through considering the alternates
      if (!thisNode.breakable && !(line.nodes[line.nodes.length-1].breakable)) {
        that.debug(`Adding width ${thisNode.width} for node ${thisNode.debugText||thisNode.text||""}`, lineNo)
        curWidth += thisNode.width;
        addNodeToTotals(thisNode);
        continue;
      }

      let badness = line.badness;
      this.debug(` Badness was ${badness}`, lineNo)

      var anyNegativePenalties = this.hasAnyNegativePenalties(relevant)
      if (bestBadness < badness && !anyNegativePenalties) {
        // We have a better option already, and we have no chance
        // to improve this option, don't bother.
      } else if (relevant.length == 1) {
        // We aren't going to find any other nodes. Don't bother
      } else {
        // It's worth a further look at this breakpoint.
        // If we have nodes A...Z and we test a break at C, we need to work
        // out the best way to break the sub-paragraph D...Z.

        // Remembering that "Breakpoint path = Breakpoint for first line
        // + breakpoint path for remainder of paragraph", first we make
        // a line set which holds the first line...

        var newConsideration : Solution = {
          totalBadness: badness,
          lines: [ line ]
        };

        if (thisNode.originalIndex+1 < options.end) {
          this.debug(`Recursing, now start at ${thisNode.originalIndex+1}`, lineNo)
          let recursed = this.findBreakpoints(lineNo+1, {
            ...options,
            start: thisNode.originalIndex+1,
            end: options.end,
          })
          this.debug(`In that recursion, total badness = ${recursed.totalBadness}`)

          // ...and then we add to it the current solution
          newConsideration.lines = newConsideration.lines.concat(recursed.lines);
          newConsideration.totalBadness += recursed.totalBadness;

          // Save this option if it's better than we've seen already,
          // to save recursing into worse ones.
          if (newConsideration.totalBadness < bestBadness) {
            bestBadness = newConsideration.totalBadness
          }
          considerations.push(newConsideration);
        } else {
          considerations.push(newConsideration);
        }
      }
      addNodeToTotals(thisNode);
    }

    // If we found nothing, give up.
    if (considerations.length < 1) {
      return { totalBadness: INF_BAD * INF_BAD, lines: [] } as Solution;
    }

    // Otherwise, find the best of the bunch.
    this.debug("Choosing between considerations:")
    for (var c of considerations) {
      this.debug("With badness "+c.totalBadness+": ")
      this.debugConsideration(c.lines)
    }
    let best = considerations.reduce( (a, b) => a.totalBadness <= b.totalBadness ? a : b );
    this.debug(`Best answer for ${key} was:`, lineNo)
    this.debugConsideration(best.lines)
    this.debug(` with badness ${best.totalBadness}`,lineNo)

    // Store it in the memoize cache for next time.
    this.memoizeCache[key] = best;
    return best;
  }

  private badness(line: Line): number {
    var bad = 0;
    if (line.shortfall == 0) {
      bad = 0
    } else if (line.shortfall > 0) {
      // XXX use stretch/shrink penalties here instead
      bad = Math.floor(100 * (line.shortfall/line.totalStretch)**3)
    } else {
      bad = Math.floor(100 * (-line.shortfall/line.totalShrink)**3)
    }
    // consider also penalties. Break penalty:
    bad += line.nodes[line.nodes.length-1].penalty
    // Line penalty
    bad += line.options.linePenalty
    // Any substitutions
    for (var n of line.nodes) {
      bad += n.substitutionPenalty || 0;
    }
    return bad;
  }


  private tryToImprove(line: Line, target:number): Line {
    var nodesWithAlternates = line.nodes.map( n => [ n, ...(n.alternates||[]) ])
    var set:Node[];
    var bestLine = line;
    this.debug("Trying to improve, base badness is "+ line.badness)
    for (set of this._cartesian_set(nodesWithAlternates)) {
      var newLine:Line = {nodes: set, totalShrink: 0, totalStretch: 0, shortfall: target, options: line.options }
      for (var n of set) {
        newLine.totalShrink += n.shrink;
        newLine.totalStretch += n.stretch;
        newLine.shortfall -= n.width;
      }
      newLine.badness = this.badness(newLine)
      this.debug("New line is "+ newLine.badness)
      if (newLine.badness < bestLine.badness) {
        bestLine = newLine;
      }
    }
    bestLine.ratio = (target-bestLine.shortfall) / target;
    return bestLine
  }

  private debugConsideration(lines: Line[]) {
    this.debug("---")
    for (let l of lines) {
      this.debug(l.ratio.toFixed(3)+ " " + l.nodes.map( (a) => a.debugText||a.text||"").join(""))
    }
    this.debug("---")
  }

  private debug(msg: any, lineNo=0) {
    if (this.debugging) {
      var spacer = new Array(lineNo+1).join(" + ")
      console.log(spacer + msg);
    }
  }

  private assignTargetWidths(solution: Solution) {
    for (var line of solution.lines) {
      this.assignTargetWidthsToLine(line)
    }
  }

  private assignTargetWidthsToLine(line: Line) {
    line.targetWidths = line.nodes.map(n => n.width);
    if (line.shortfall == 0) {
      return
    }
    var level = 0;
    if (line.shortfall > 0) {
      while (line.shortfall > 0) { // We need to expand
        var thisLevelStretch = line.nodes.map( n => n.stretch*(n.stretchContribution[level] || 0));
        var thisLevelTotalStretch = thisLevelStretch.reduce( (a,c) => a+c, 0); // Sum
        if (thisLevelTotalStretch == 0) { break; }

        var ratio = line.shortfall / thisLevelTotalStretch;
        if (ratio > 1) { ratio = 1 }

        line.targetWidths = line.targetWidths.map( (w,ix) => w + ratio * thisLevelStretch[ix]);
        line.shortfall -= thisLevelTotalStretch * ratio;
        level = level + 1;
      }
    } else {
      while (line.shortfall < 0) { // We need to expand
        var thisLevelShrink = line.nodes.map( n => n.shrink*(n.shrinkContribution[level] || 0));
        var thisLevelTotalShrink = thisLevelShrink.reduce( (a,c) => a+c, 0); // Sum
        if (thisLevelTotalShrink == 0) { break; }

        var ratio = -line.shortfall / thisLevelTotalShrink;
        if (ratio > 1) { ratio = 1 }

        line.targetWidths = line.targetWidths.map( (w,ix) => w - ratio * thisLevelShrink[ix]);
        line.shortfall += thisLevelTotalShrink * ratio;
        level = level + 1;
      }
    }
    this.debug("Final widths:"+ line.targetWidths.join(", "))
  }

  public _cartesian_set(arg) {
    const r = [];
    const max = arg.length-1;
    let helper = (arr, i) => {
      for (let j=0, l=arg[i].length; j<l; j++) {
        const a = arr.slice(0);
        a.push(arg[i][j]);
        if (i==max)
            r.push(a);
        else
            helper(a, i+1);
      }
    }
    helper([], 0);
    return r;
  }
}