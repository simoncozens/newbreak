export class Node {
  public breakClass: number;
  public penalty: number;
  public width: number;
  public stretch?: number;
  public shrink?: number;
  public text?: string;
  originalIndex?: number;
}

interface BreakpointSet {
  points: number[];
  totalBadness: number;
}

var nodelist = [
 { "text":"To", breakClass: 0, penalty: 0, width: 10.14648 } as Node,
 { width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "Sherlock", breakClass: 0, penalty: 0, width: 35.82031 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "Holmes", breakClass: 0, penalty: 0, width: 30.79102 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "she", breakClass: 0, penalty: 0, width: 13.99902 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "is", breakClass: 0, penalty: 0, width: 6.57227 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "always", breakClass: 0, penalty: 0, width: 27.59766 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "the", breakClass: 0, penalty: 0, width: 13.5791 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "woman", breakClass: 0, penalty: 0, width: 32.37305 } as Node,
{ width: 2.93619, stretch: 3.30322, shrink: 0.24467, breakClass: 1, penalty:0 } as Node,
 { text: "I", breakClass: 0, penalty: 0, width: 2.97852 } as Node,
{ width: 2.20215, stretch: 1.09996, shrink: 0.73477, breakClass: 1, penalty:0 } as Node,
 { text: "have", breakClass: 0, penalty: 0, width: 19.26758 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "seldom", breakClass: 0, penalty: 0, width: 29.45313 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "heard", breakClass: 0, penalty: 0, width: 23.78906 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "him", breakClass: 0, penalty: 0, width: 16.25977 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "mention", breakClass: 0, penalty: 0, width: 34.86816 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "her", breakClass: 0, penalty: 0, width: 14.09668 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "under", breakClass: 0, penalty: 0, width: 24.59473 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "any", breakClass: 0, penalty: 0, width: 15.03906 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "other", breakClass: 0, penalty: 0, width: 22.56836 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "name", breakClass: 0, penalty: 0, width: 25.04883 } as Node,
{ width: 2.93619, stretch: 3.30322, shrink: 0.24467, breakClass: 1, penalty:0 } as Node,
 { text: "In", breakClass: 0, penalty: 0, width: 8.4961 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "his", breakClass: 0, penalty: 0, width: 12.08984 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "eyes", breakClass: 0, penalty: 0, width: 17.83691 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "she", breakClass: 0, penalty: 0, width: 13.99902 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "eclipses", breakClass: 0, penalty: 0, width: 31.9043 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "and", breakClass: 0, penalty: 0, width: 15.30762 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "predominates", breakClass: 0, penalty: 0, width: 56.7334 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "the", breakClass: 0, penalty: 0, width: 13.5791 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "whole", breakClass: 0, penalty: 0, width: 24.93652 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "of", breakClass: 0, penalty: 0, width: 8.13965 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "her", breakClass: 0, penalty: 0, width: 14.09668 } as Node,
{ width: 2.20215, stretch: 1.10107, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
 { text: "sex.", breakClass: 0, penalty: 0, width: 15.6543 } as Node,
{ width: 2.20215, stretch: 10000, shrink: 0.73404, breakClass: 1, penalty:0 } as Node,
];

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
  private debug(msg) { console.log(msg) }
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
    let bad = Math.floor(100 * (t/s)^3)
    return bad > INF_BAD ? INF_BAD : bad;
  }

  private computeBadness(shortfall: number, stretch: number, shrink: number) {
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
    if (key in this.memoizeCache) { return this.memoizeCache[key] }
    let target = this.hsize[lineNo > this.hsize.length-1 ? this.hsize.length-1 : lineNo]
    console.log(`Looking for breakpoints ${options.start}->${options.end} to fill ${target}`)
    let curWidth = 0;
    let curStretch = 0;
    let curShrink = 0;
    let considerations = [] as BreakpointSet[];
    let minTotalBadness = Infinity;
    for (let i = 1; i< relevant.length; i++) {
      let thisNode = relevant[i]
      if (thisNode.breakClass >= options.class) {
        let badness = this.computeBadness(target-curWidth, curStretch, curShrink);
        let d = (badness + LINE_PENALTY);
        d = d * d * d;
        // More demerits here. For now:
        badness = d;
        // this.debug(`Node ${i} is possible, badness = ${badness}`)
        if (badness < minTotalBadness) {
          considerations.push({
            totalBadness: badness,
            points: [ thisNode.originalIndex ]
          })
          // Recurse!
          // this.debug(`Recursing, now start at ${thisNode.originalIndex+1}`)
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
      }
      curWidth += thisNode.width;
      curStretch += thisNode.stretch || 0;
      curShrink += thisNode.shrink || 0;
    }
    if (considerations.length < 1) {
      return { totalBadness:0, points: [] } as BreakpointSet;
    }
    // Find the best of the considerations and return it
    let best = considerations.reduce( (a, b) => a.totalBadness < b.totalBadness ? a : b );
    this.debug(`Best answer for ${key} was: ${best.points} with badness ${best.totalBadness}`)
    this.memoizeCache[key] = best;
    return best
  }
}

let breaker = new Linebreaker(nodelist, [180])
let answer = breaker.doBreak()
let lines = [""]
for (let i= 0; i < nodelist.length; i++) {
  lines[lines.length-1] += nodelist[i].text || " ";
  if (i == answer[0]) {
    answer.shift();
    lines.push("");
  }
}
for (let l of lines) { console.log(l) }

