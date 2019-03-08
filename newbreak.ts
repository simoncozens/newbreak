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
  public width: number;
  public stretch?: number;
  public shrink?: number;

  /**
  * The idea of a `breakClass`, which I haven't seriously used or tested,
  * is that you may want to try different methods of justification within
  * the same paragraph: setting spaces to break class 2 and hyphens to
  * break class 1 will try to justify the paragraph without hyphenating,
  * and then open the option of hyphenation up if that isn't possible.
  * Nodes of break class 0 can't be broken at.
  * @property {number} breakClass
  **/
  public breakClass: number;

  /**
   * The `breakHere...` members are the equivalent of Knuth-Plass's
   * discretionaries. They represent the additional width (and stretch and
   * shrink), plus any additional text used, when breaking at this node. So
   * a hyphen node will have `width` as zero, `text` as null, `breakHereText`
   * as the hyphen character, and `breakHereWidth` as the width of the hyphen
   * character.
   * @property {number} breakHereWidth
   * @property {number} breakHereStretch
   * @property {number} breakHereText
   */
  public breakHereWidth?: number;
  public breakHereStretch?: number;
  public breakHereShrink?: number;
  public breakHereText?: any;
  public text?: any;
  public debugText?: string;
  originalIndex?: number;
}

// Don't worry about this, it's just an internal thing to make the
// type checking neat.
interface BreakpointSet {
  points: number[];
  totalBadness: number;
}

interface Ratio {
  start: number;
  end: number;
  ratio: number;
}

const INF_BAD = 10000;
const LINE_PENALTY = 10;

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
    this.nodes = []; this.hsize = hsize; this.breakpoints = []
    for (var n of nodes) {
      this.nodes.push({...n})
    }
    // Add dummy node to end.
    this.nodes.push({ width:0, breakClass:1, penalty: 0} as Node)
    this.memoizeCache = {}
  }

  /**
   * Run the break algorithm.
   * You may want to feed the output of this into the `ratios` method below.
   * @returns {number[]} An array of node indexes at which to break.
   */
  public doBreak (options:any = {}) :number[] {
    let maxBreakClass = Math.max( ...this.nodes.map( x => x.breakClass) );
    // Basically we run through the break classes from highest to lowest,
    // trying to `findBreakpoints` for each class.
    for (let i = maxBreakClass; i>0; i--) {
      this.debug(`Trying breaks of class ${i}`);
      let best = this.findBreakpoints(0, { class: i, start: 0, end: this.nodes.length-1, ...options });
      if (best.points.length > 0 ) {
        return best.points;
      }
    }
    this.debug("Nothing found, giving up")
    return [];
  }

  // Not all nodes can be broken at, if their class is below the minimum
  // class that we are trying for right now. (Or of course if their class
  // is zero, in which case they can't be broken at at all.) So we reduce
  // the problem space by merging any adjacent non-breakable nodes, creating
  // a new list of nodes which collates the widths of the non-breakables.
  private findRelevantNodes (minClass: number, start: number, end:number) {
    let relevant: Node[] = [];
    for (let i = start; i <= end; i++) {
      let thisNode = {...this.nodes[i]}
      if (thisNode.breakClass < minClass) { // We are not interested in breaking here
        // If we're just starting out, or if we have just changed from a
        // non-interesting node to an interesting one, then we need to
        // put a new node onto our list. We keep track of where it used to be.
        if (relevant.length == 0 || relevant[relevant.length-1].breakClass >= minClass) {
          thisNode.originalIndex = i;
          relevant.push(thisNode);
        } else {
          // We aren't just starting out, and the current node is just as
          // non-breakable as the previous node, so we add our widths together.
          relevant[relevant.length-1].width += thisNode.width;
          relevant[relevant.length-1].stretch += thisNode.stretch;
          relevant[relevant.length-1].shrink += thisNode.shrink;
        }
      } else {
        // This is a potential breakpoint, so should not be merged.
        thisNode.originalIndex = i;
        relevant.push(thisNode);
      }
    }
    return relevant;
  }

  // The following three functions are classic TeX - given a shortfall and an amount
  // stretchability or shrinkability available, provide a metric of how bad this breakpoint is.
  private badnessFunction (t,s) {
    if (t==0) return 0;
    let bad = Math.floor(100 * (t/s)**3)
    return bad > INF_BAD ? INF_BAD : bad;
  }

  private computeBadness(shortfall: number, stretch: number, shrink: number, lineNo: number) {
    this.debug(` Shortfall: ${shortfall}, stretch: ${stretch}, shrink: ${shrink}`, lineNo)
    if (shortfall > 0) {
      if (shortfall > 110 && stretch < 25) { return INF_BAD }
      else { return this.badnessFunction(shortfall, stretch) }
    } else {
      shortfall = -shortfall
      if (shortfall > shrink) { return INF_BAD+1 }
      else { return this.badnessFunction(shortfall, shrink) }
    }
  }

  private considerDemerits(badness: number, thisNode: Node) {
    let d = (badness + LINE_PENALTY);
    if (Math.abs(d) >= 10000) { d = 100000000} else {
      d = d * d
    }
    if (thisNode.penalty) {
      this.debug(`Node ${thisNode.debugText||thisNode.text} has penalty ${thisNode.penalty}`)
      if (thisNode.penalty > 0) {
        d += thisNode.penalty * thisNode.penalty
      } else {
        d -= thisNode.penalty * thisNode.penalty
      }
    }
    return d;
  }

  // A shortcut for finding the target length of the given line number.
  public targetFor(lineNo: number) :number {
    return this.hsize[lineNo > this.hsize.length-1 ? this.hsize.length-1 : lineNo]
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

  public findBreakpoints(lineNo: number, options: any) : BreakpointSet {
    let relevant = this.findRelevantNodes(options.class, options.start, options.end);
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

    // This represents how far along the line we are towards the target width.
    let curWidth = 0;
    let curStretch = 0;
    let curShrink = 0;

    let considerations = [] as BreakpointSet[];
    var that = this;
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
    for (var thisNode of relevant) {
      if (thisNode.breakClass >= options.class) {
        this.debug(`Node ${thisNode.originalIndex} ${thisNode.debugText||thisNode.text||""} is possible`, lineNo)

        // As we're looking at the possibility of breaking here, add
        // any additional discretionary width (eg hyphens). We'll take it
        // out again later if we decide not to make the break.
        if (thisNode.breakHereWidth) {
          curWidth += thisNode.breakHereWidth; curShrink += thisNode.breakHereShrink||0; curStretch += thisNode.breakHereStretch||0;
        }
        this.debug(` Target: ${target}. Current width: ${curWidth}`, lineNo);

        // If we're a long way from the end and shrinking/stretching to get
        // there would be horrible, don't even both investigating this breakpoint
        // unless there is no other choice.
        if (target-curWidth < 0 && target-curWidth < -3 * curShrink && !options.fullJustify) {
          this.debug(` Too shrunk ${target-curWidth} needed, ${3 * curShrink} available; not bothering`, lineNo)
          addNodeToTotals(thisNode);
          continue;
        }
        if (target-curWidth > 0 && target-curWidth > 3 * curStretch && !options.fullJustify) {
          this.debug(` Too stretched ${target-curWidth} needed, ${3 * curStretch} available; not bothering`, lineNo)
          addNodeToTotals(thisNode);
          continue;
        }

        // Find out how bad this potential breakpoint is.
        let badness = this.computeBadness(target-curWidth, curStretch, curShrink, lineNo);
        badness = this.considerDemerits(badness, thisNode);
        this.debug(` Badness was ${badness}`, lineNo)

        // If we've already got a better option or there are
        // no other options, don't bother. But if there are, we
        // need to do a full investigation of this node.
        if (relevant.length > 1) {
          // Now recursively investigate the consequences of this breakpoint.
          // If we have nodes A...Z and we test a break at C, we need to work
          // out the best way to break the sub-paragraph D...Z.

          // Remembering that "Breakpoint path = Breakpoint for first line
          // + breakpoint path for remainder of paragraph", first we make
          // a breakpoint set which holds the breakpoint for the first line...

          var newConsideration : BreakpointSet = {
            totalBadness: badness,
            points: [ thisNode.originalIndex ]
          };

          if (thisNode.originalIndex+1 < options.end) {
            this.debug(`Recursing, now start at ${thisNode.originalIndex+1}`, lineNo)
            let recursed = this.findBreakpoints(lineNo+1, {
              class: options.class,
              start: thisNode.originalIndex+1,
              end: options.end,
              fullJustify: options.fullJustify
            })
            this.debug(`In that recursion, total badness = ${recursed.totalBadness}`)

            // ...and then we add to it the breakpoints for the rest of the paragraph.
            newConsideration.points = newConsideration.points.concat(recursed.points);
            newConsideration.totalBadness += recursed.totalBadness;

            considerations.push(newConsideration);
          }
        }
        // Remove the discretionary when we consider future breakpoints.
        if (thisNode.breakHereWidth) {
          curWidth -= thisNode.breakHereWidth; curShrink -= thisNode.breakHereShrink||0; curStretch -= thisNode.breakHereStretch||0;
        }
      }
      addNodeToTotals(thisNode);
    }

    // If we found nothing, give up.
    if (considerations.length < 1) {
      return { totalBadness: INF_BAD * INF_BAD, points: [] } as BreakpointSet;
    }

    // Otherwise, find the best of the bunch.
    let best = considerations.reduce( (a, b) => a.totalBadness <= b.totalBadness ? a : b );
    this.debug(`Best answer for ${key} was: ${best.points}`, lineNo)
    this.debugConsideration(options, best.points)
    this.debug(` with badness ${best.totalBadness}`,lineNo)

    // Store it in the memoize cache for next time.
    this.memoizeCache[key] = best;
    return best;
  }

  private debugConsideration(options, origpoints) {
    let lines = [""]
    this.debug("---")
    let points = origpoints.slice(0)
    for (let i= options.start; i < options.end; i++) {
      var debugText = this.nodes[i].debugText || this.nodes[i].text
      lines[lines.length-1] += debugText || (this.nodes[i].width>0?" ":"");
      if (i == points[0]) {
        if (this.nodes[i].breakHereText) { lines[lines.length-1] += this.nodes[i].breakHereText}
        points.shift();
        lines.push("");
      }
    }
    for (let l of lines) { this.debug(l) }
    this.debug("---")
  }

  /**
   * Given a set of breakpoints, compute the stretch/shrink ratio for
   * each line, and the nodes which make up each line. This is what you
   * would feed to the justification engine.
   * @param {number[]} pointSet: list of nodes to be broken at
   * @returns {Ratio[]} array of start and end node indexes and ratio to apply.
   **/
  public ratios(pointSet: number[]) :Ratio[] {
    let rv = [ { start: 0, end: 0, ratio: 0 } ]
    var curWidth = 0
    var curStretch = 0
    var curShrink = 0
    var lineNo = 0
    // Copy the pointset so we can modify it.
    var ps = [...pointSet]
    for (var i = 0; i < this.nodes.length; i++) {
      let target = this.targetFor(lineNo)
      if (ps[0] == i || i == this.nodes.length-1) {
        // We're at a breakpoint.

        // If we're breaking at a discretionary, take that into account.
        curWidth += this.nodes[i].breakHereWidth || 0
        curStretch += this.nodes[i].breakHereStretch || 0
        curShrink += this.nodes[i].breakHereShrink || 0

        // Work out the shortfall and ratio
        let shortfall = target-curWidth
        if (shortfall > 0) {
          rv[rv.length-1].ratio =  shortfall / curStretch
        } else {
          rv[rv.length-1].ratio =  shortfall / curShrink
        }
        this.debug(`Line ${lineNo}: target ${target}, break width ${curWidth} plus ${curStretch} minus ${curShrink}, ratio ${rv[rv.length-1].ratio}`)
        rv[rv.length-1].end = i

        // Move onto finding next breakpoint and start again.
        ps.shift()
        rv.push({start: i+1, end: 0, ratio: 0})
        curWidth = 0
        curStretch = 0
        curShrink = 0
      } else {
        curWidth += this.nodes[i].width || 0
        curStretch += this.nodes[i].stretch || 0
        curShrink += this.nodes[i].shrink || 0
      }
    }
    // We added a Ratio node on the end to store information
    // about the *next* line, but obviously at the end there
    // isn't going to be a next line, so get rid of it again.
    rv.pop()
    return rv
  }

  private debug(msg: any, lineNo=0) {
    if (this.debugging) {
      var spacer = new Array(lineNo+1).join(" + ")
      console.log(spacer + msg);
    }
  }

}