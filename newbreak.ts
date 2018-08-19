export class Node {
  public breakClass: number;
  public penalty: number;
  public width: number;
  public stretch?: number;
  public shrink?: number;
  public breakHereWidth?: number;
  public breakHereStretch?: number;
  public breakHereShrink?: number;
  public breakHereText?: string;
  public text?: string;
  originalIndex?: number;
}

interface BreakpointSet {
  points: number[];
  totalBadness: number;
}


const INF_BAD = 10000;
const LINE_PENALTY = 10;

class Linebreaker {
  public nodes: Node[];
  public hsize: number[];
  public breakpoints: number[];
  public potentialBreakpoints: any[];
  public memoizeCache: any;
  constructor (nodes: Node[], hsize: number[]) {
    this.nodes = nodes; this.hsize = hsize; this.breakpoints = []
    // Add dummy node to end.
    this.nodes.push({ width:0, breakClass:1} as Node)
    this.memoizeCache = {}
  }
  private debug(msg) { }; // console.log(msg) }
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
      let thisNode = this.nodes[i]
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
    let bad = Math.floor(100 * (t/(s))**3)
    // return bad > INF_BAD ? INF_BAD : bad;
    return bad;
  }

  private computeBadness(shortfall: number, stretch: number, shrink: number) {
    this.debug(`Shortfall: ${shortfall}, stretch: ${stretch}, shrink: ${shrink}`)
    if (shortfall > 0) {
      if (shortfall > 110 && stretch < 25) { return INF_BAD }
      else { return this.badnessFunction(shortfall, stretch) }
    } else {
      shortfall = -shortfall
      if (shortfall > shrink) { return INF_BAD+1 }
      else { return this.badnessFunction(shortfall, shrink) }
    }
  }

  public findBreakpoints(lineNo: number, options: any) : BreakpointSet {
    let relevant = this.findRelevantNodes(options.class, options.start, options.end);
    let key = JSON.stringify(options)
    let target = this.hsize[lineNo > this.hsize.length-1 ? this.hsize.length-1 : lineNo]
    this.debug(`Looking for breakpoints ${options.start}->${options.end} to fill ${target}`)
    if (key in this.memoizeCache) {return this.memoizeCache[key] }
    let curWidth = 0;
    let curStretch = 0;
    let curShrink = 0;
    let considerations = [] as BreakpointSet[];
    let minTotalBadness = Infinity;
    for (let i = 0; i< relevant.length; i++) {
      let thisNode = relevant[i]
      this.debug(`Adding width ${thisNode.width} for node`)
      curWidth += thisNode.width;
      curStretch += thisNode.stretch || 0;
      curShrink += thisNode.shrink || 0;

      if (thisNode.breakClass >= options.class) {
        if (thisNode.breakHereWidth) {
          curWidth += thisNode.breakHereWidth; curShrink += thisNode.breakHereShrink||0; curStretch += thisNode.breakHereStretch||0;
        }
        let badness = this.computeBadness(target-curWidth, curStretch, curShrink);
        this.debug(`Baseness was ${badness}`)
        let d = (badness + LINE_PENALTY);
        if (Math.abs(d) >= 10000) { d = 100000000} else { d = d * d }
        if (thisNode.penalty) { d += thisNode.penalty * thisNode.penalty }
        // More demerits here. For now:
        badness = d;
        this.debug(`Node ${i} is possible, badness = ${badness}`)
        if (badness < minTotalBadness) {
          considerations.push({
            totalBadness: badness,
            points: [ thisNode.originalIndex ]
          })
          // Recurse!
          this.debug(`Recursing, now start at ${thisNode.originalIndex+1}`)
          let recursed = this.findBreakpoints(lineNo+1, {
            class: options.class,
            start: thisNode.originalIndex+1,
            end: options.end,
          })
          considerations[considerations.length-1].points = considerations[considerations.length-1].points.concat(recursed.points);
          considerations[considerations.length-1].totalBadness += recursed.totalBadness;
          if (considerations[considerations.length-1].totalBadness < minTotalBadness) {
            minTotalBadness = considerations[considerations.length-1].totalBadness
          }
        }
        if (thisNode.breakHereWidth) {
          curWidth -= thisNode.breakHereWidth; curShrink -= thisNode.breakHereShrink||0; curStretch -= thisNode.breakHereStretch||0;
        }
      }
    }
    if (considerations.length < 1) {
      return { totalBadness:0, points: [] } as BreakpointSet;
    }
    // Find the best of the considerations and return it
    this.debug("Considerations: ")
    this.debug(considerations)
    let best = considerations.reduce( (a, b) => a.totalBadness <= b.totalBadness ? a : b );
    this.debug(`Best answer for ${key} was: ${best.points}`)
    this.debugConsideration(options, best.points)
    this.debug(` with badness ${best.totalBadness}`)
    this.memoizeCache[key] = best;
    return best
  }

  private debugConsideration(options, origpoints) {
    let lines = [""]
    this.debug("---")
    let points = origpoints.slice(0)
    for (let i= 0; i < this.nodes.length; i++) {
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
  return rv;
}

let nodelist = makeNodeList("To Sher-lock Holmes she is al-ways 'the woman'. I have sel-dom heard him men-tion her under any other name. In his eyes she ec-lipses and pre-domi-nates the whole of her sex.")
let breaker = new Linebreaker(nodelist, [22])
let answer = breaker.doBreak()
let lines = [""]
for (let i= 0; i < nodelist.length; i++) {
  lines[lines.length-1] += nodelist[i].text || (nodelist[i].width>0?" ":"");
  if (i == answer[0]) {
    if (nodelist[i].breakHereText) { lines[lines.length-1] += nodelist[i].breakHereText}
    answer.shift();
    lines.push("");
  }
}
for (let l of lines) { console.log(l) }

