export class Node {
  public breakClass: number;
  public penalty: number;
  public width: number;
  public stretch?: number;
  public shrink?: number;
  public breakHereWidth?: number;
  public breakHereStretch?: number;
  public breakHereShrink?: number;
  public breakHereText?: any;
  public text?: any;
  originalIndex?: number;
}

interface BreakpointSet {
  points: number[];
  totalBadness: number;
}


const INF_BAD = 10000;
const LINE_PENALTY = 10;

export class Linebreaker {
  public nodes: Node[];
  public hsize: number[];
  public breakpoints: number[];
  private memoizeCache: any;
  public debugging: boolean;
  constructor (nodes: Node[], hsize: number[]) {
    this.nodes = []; this.hsize = hsize; this.breakpoints = []
    for (var n of nodes) {
      this.nodes.push({...n})
    }
    // Add dummy node to end.
    this.nodes.push({ width:0, breakClass:1, penalty: INF_BAD} as Node)
    this.memoizeCache = {}
  }
  private debug(msg: any, lineNo=0) {
    if (this.debugging) {
      var spacer = new Array(lineNo+1).join("  ")
      console.log(spacer + msg);
    }
  }
  public doBreak () {
    let maxBreakClass = Math.max( ...this.nodes.map( x => x.breakClass) );
    for (let i = maxBreakClass; i>0; i--) {
      this.debug(`Trying breaks of class ${i}`);
      let best = this.findBreakpoints(0, { class: i, start: 0, end: this.nodes.length-1 });
      if (best.points.length > 0 ) {
        return best.points;
      }
    }
    this.debug("Nothing found, giving up")
    return [];
  }

  private findRelevantNodes (minClass: number, start: number, end:number) {
    let relevant: Node[] = [];
    for (let i = start; i <= end; i++) {
      let thisNode = {...this.nodes[i]}
      if (thisNode.breakClass < minClass) {
        // We are not interested in breaking here
        if (relevant.length == 0 || relevant[relevant.length-1].breakClass >= minClass) {
          thisNode.originalIndex = i;
          relevant.push(thisNode);
        } else {
          // Merge
          relevant[relevant.length-1].width += thisNode.width;
          relevant[relevant.length-1].stretch += thisNode.stretch;
          relevant[relevant.length-1].shrink += thisNode.shrink;
        }
      } else {
        // This is a potential breakpoint
        thisNode.originalIndex = i;
        relevant.push(thisNode);
      }
    }
    return relevant;
  }

  private badnessFunction (t,s) {
    if (t==0) return 0;
    let bad = Math.floor(100 * (t/s)**3)
    return bad > INF_BAD ? INF_BAD : bad;
    // return bad;
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
    if (thisNode.penalty) { d += thisNode.penalty * thisNode.penalty }
    return d;
  }

  public targetFor(lineNo: number) :number {
    return this.hsize[lineNo > this.hsize.length-1 ? this.hsize.length-1 : lineNo]
  }

  public findBreakpoints(lineNo: number, options: any) : BreakpointSet {
    let relevant = this.findRelevantNodes(options.class, options.start, options.end);
    let key = JSON.stringify(options)
    let target = this.targetFor(lineNo)
    this.debug(`Looking for breakpoints ${options.start}->${options.end} to fill ${target} on line ${lineNo}`,lineNo)
    if (key in this.memoizeCache) {
      this.debug(`Returned from cache`,lineNo);
      this.debug(this.memoizeCache[key],lineNo);
      return this.memoizeCache[key]
    }
    console.log(relevant)
    let curWidth = 0;
    let curStretch = 0;
    let curShrink = 0;
    let considerations = [] as BreakpointSet[];
    let minTotalBadness = Infinity;
    for (let i = 0; i< relevant.length; i++) {
      let thisNode = relevant[i]
      if (thisNode.breakClass >= options.class) {
        this.debug(`Node ${thisNode.originalIndex} is possible`, lineNo)
        if (thisNode.breakHereWidth) {
          curWidth += thisNode.breakHereWidth; curShrink += thisNode.breakHereShrink||0; curStretch += thisNode.breakHereStretch||0;
        }
        this.debug(` Target: ${target}. Current width: ${curWidth}`, lineNo)
        if (target-curWidth < 0 && target-curWidth < -3 * curShrink) {
          this.debug(` Too shrunk ${target-curWidth} needed, ${3 * curShrink} available; not bothering`, lineNo)
          this.debug(`Adding width ${thisNode.width} for node ${thisNode.text||""}`, lineNo)
          curWidth += thisNode.width;
          curStretch += thisNode.stretch || 0;
          curShrink += thisNode.shrink || 0;
          continue;
        }
        if (target-curWidth > 0 && target-curWidth > 3 * curStretch) {
          this.debug(` Too stretched ${target-curWidth} needed, ${3 * curStretch} available; not bothering`, lineNo)
          this.debug(`Adding width ${thisNode.width} for node ${thisNode.text||""}`, lineNo)
          curWidth += thisNode.width;
          curStretch += thisNode.stretch || 0;
          curShrink += thisNode.shrink || 0;
          continue;
        }

        let badness = this.computeBadness(target-curWidth, curStretch, curShrink, lineNo);
        badness = this.considerDemerits(badness, thisNode);
        this.debug(` Badness was ${badness}`, lineNo)

        if (badness < minTotalBadness && relevant.length > 1) {

          considerations.push({
            totalBadness: badness,
            points: [ thisNode.originalIndex ]
          })

          // Recurse!
          if (thisNode.originalIndex+1 < options.end) {
            this.debug(`Recursing, now start at ${thisNode.originalIndex+1}`, lineNo)
            let oldDebug = this.debugging
            // this.debugging = false
            let recursed = this.findBreakpoints(lineNo+1, {
              class: options.class,
              start: thisNode.originalIndex+1,
              end: options.end,
            })
            // this.debugging = oldDebug
            this.debug(`In that recursion, total badness = ${recursed.totalBadness}`)
            // var me = considerations.pop()

            // for (let newConsideration of recursed) {
            //     considerations.push({
            //       totalBadness: me.totalBadness + newConsideration.totalBadness,
            //       points: [].concat(me.points,newConsideration.points)
            //     })
            // }
            // this.debug("Considerations after that recursion: ", lineNo)
            // this.debug(considerations, lineNo)
            considerations[considerations.length-1].points = considerations[considerations.length-1].points.concat(recursed.points);
            // considerations[considerations.length-1].totalBadness += recursed.totalBadness;
            if (considerations[considerations.length-1].totalBadness < minTotalBadness) {
              minTotalBadness = considerations[considerations.length-1].totalBadness
            }
          }
        }
        if (thisNode.breakHereWidth) {
          curWidth -= thisNode.breakHereWidth; curShrink -= thisNode.breakHereShrink||0; curStretch -= thisNode.breakHereStretch||0;
        }
      }
      this.debug(`Adding width ${thisNode.width} for node ${thisNode.text||""}`, lineNo)
      curWidth += thisNode.width;
      curStretch += thisNode.stretch || 0;
      curShrink += thisNode.shrink || 0;
    }
    if (considerations.length < 1) {
      return { totalBadness:0, points: [] } as BreakpointSet;
    }
    // Find the best of the considerations and return it
    this.debug("Considerations: ", lineNo)
    this.debug(considerations, lineNo)
    let best = considerations.reduce( (a, b) => a.totalBadness <= b.totalBadness ? a : b );
    this.debug(`Best answer for ${key} was: ${best.points}`, lineNo)
    this.debugConsideration(options, best.points)
    this.debug(` with badness ${best.totalBadness}`,lineNo)
    this.memoizeCache[key] = best;
    return best;
  }

  private debugConsideration(options, origpoints) {
    let lines = [""]
    this.debug("---")
    let points = origpoints.slice(0)
    for (let i= options.start; i < options.end; i++) {
      lines[lines.length-1] += this.nodes[i].text || (this.nodes[i].width>0?" ":"");
      if (i == points[0]) {
        if (this.nodes[i].breakHereText) { lines[lines.length-1] += this.nodes[i].breakHereText}
        points.shift();
        lines.push("");
      }
    }
    for (let l of lines) { this.debug(l) }
    this.debug("---")
  }

  public ratios(pointSet: number[]) :any[] {
    let rv = [ { start: 0 } ]
    var curWidth = 0
    var curStretch = 0
    var curShrink = 0
    var lineNo = 0
    var ps = [...pointSet]
    for (var i = 0; i < this.nodes.length; i++) {
      console.log(`Looking for node ${ps[0]}, at node ${i}`)
      let target = this.targetFor(lineNo)
      if (ps[0] == i || i == this.nodes.length-1) {
        curWidth += this.nodes[i].breakHereWidth || 0
        curStretch += this.nodes[i].breakHereStretch || 0
        curShrink += this.nodes[i].breakHereShrink || 0
        let shortfall = target-curWidth
        if (shortfall > 0) {
          rv[rv.length-1]["ratio"] =  shortfall / curStretch
        } else {
          rv[rv.length-1]["ratio"] =  shortfall / curShrink
        }
        rv[rv.length-1]["end"] = i
        ps.shift()
        rv.push({start: i+1})
        curWidth = 0
        curStretch = 0
        curShrink = 0
      } else {
        curWidth += this.nodes[i].width || 0
        curStretch += this.nodes[i].stretch || 0
        curShrink += this.nodes[i].shrink || 0
      }
    }
    rv.pop()
    return rv
  }
}

function makeNodeList(text): Node[] {
  let rv = []
  for (let t of text.split(/(\s+)/)) {
    if (t.match(/\s+/)) {
      rv.push({penalty: 0,breakClass: 1, width: 1, stretch: 1, shrink:0 } as Node);
    } else {
      for (let frag of t.split(/(-)/)) {
        if (frag == "-") {
          rv.push({text:"", breakHereText: "-", width:0, breakHereWidth:1, breakClass:1} as Node);
        } else {
          rv.push({ text: frag, breakClass:0, penalty:0, width: frag.length, stretch:0, shrink:0 } as Node);
        }
      }
    }
  }
  rv.push({penalty: 0,breakClass: 1, width: 0, stretch: 1000, shrink:0 } as Node);
  return rv;
}