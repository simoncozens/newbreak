// Kashida insertion rules

var joiningData = {
  0x0621: 'U', 0x0622: 'R', 0x0623: 'R', 0x0624: 'R', 0x0625: 'R',
  0x0627: 'R', 0x0629: 'R', 0x062F: 'R', 0x0630: 'R', 0x0631: 'R',
  0x0632: 'R', 0x0640: 'C', 0x0648: 'R', 0x0671: 'R', 0x0672: 'R',
  0x0673: 'R', 0x0674: 'U', 0x0675: 'R', 0x0676: 'R', 0x0677: 'R',
  0x0688: 'R', 0x0689: 'R', 0x068A: 'R', 0x068B: 'R', 0x068C: 'R',
  0x068D: 'R', 0x068E: 'R', 0x068F: 'R', 0x0690: 'R', 0x0691: 'R',
  0x0692: 'R', 0x0693: 'R', 0x0694: 'R', 0x0695: 'R', 0x0696: 'R',
  0x0697: 'R', 0x0698: 'R', 0x0699: 'R', 0x06C0: 'R', 0x06C3: 'R',
  0x06C4: 'R', 0x06C5: 'R', 0x06C6: 'R', 0x06C7: 'R', 0x06C8: 'R',
  0x06C9: 'R', 0x06CA: 'R', 0x06CB: 'R', 0x06CD: 'R', 0x06CF: 'R',
  0x06D2: 'R', 0x06D3: 'R', 0x06D5: 'R', 0x06DD: 'U', 0x06EE: 'R',
  0x06EF: 'R'
}

var kashidaTable = {
  "با": 1, "بج": -1, "بد": -1, "بر": -1, "بط": 1, "بل": -1, "بم": 1, "بن": 1, "به":1,
  "جا": -1, "جج": -1, "جد": -1, "جر": -1, "جط": 1, "جع": -1, "جك": -1, "جل": -1, "جم": -1, "جن": -1, "جم": -1, "جن": -1, "جه": -1, "جو": -1,
  "سا": 1, "سن": 2, "سج": -1, "سد": -1, "سر": -1, "سس": 2, "سص": 2, "سط": 1, "سع": -1, "سف": -1, "سق": -1, "سك": 2, "سل": 2, "سم": -1, "سن": 2, "سه": -1, "سو": -1,
  "صا": 1, "صن": 2, "صج": -1, "صد": -1, "صر": -1, "صس": 2, "صص": 2, "صط": 1, "صع": -1, "صف": -1, "صق": -1, "صك": 2, "صل": 2, "صم": -1, "صن": 2, "صه": -1, "صو": -1,
  "طا": 1, "طن": 2, "طج": -1, "طد": -1, "طر": -1, "طس": 2, "طص": 2, "طط": 1, "طع": -1, "طف": -1, "طق": -1, "طك": 2, "طل": 2, "طم": -1, "طن": 2, "طه": -1, "طو": -1,
  "عا": -1, "عج": -1, "عد": -1, "عر": -1, "عط": 1, "عع": -1, "عل": -1, "عم": -1, "عن": -1, "عه": -1,
  // XXX
  "كل": 1,
  "لم": -1,
}
var zwj = '\u200d'

for (var i = 0x620; i <= 0x6FF; i++) { if (!joiningData[i]) joiningData[i] = "D" }

function needsJoiner(pre,post) {
  var pre2 = pre.replace(/[^\u0620-\u064A]/g, "")
  var post2 = post.replace(/[^\u0620-\u064A]/g, "")
  var prejoin = joiningData[pre2.charCodeAt(pre2.length-1)]
  var postjoin = joiningData[post2.charCodeAt(0)]
  if ((prejoin == "D") && (postjoin == "D" || postjoin == "R")) {
    return true;
  }
  return false;
}

function applyKashidaRules(s) {
  // Standard Arabic "letters" run from 0x620 to 0x64A.
  // For the purposes of counting letters in a word, we ignore all others.
  var letters =  s.replace(/[^\u0620-\u064A]/g, "")
  var length = letters.length
  var dontStretch = [ {'token': s, 'kashida': false} ]
  if (length < 2) { return dontStretch }

  if (length == 2) {
    // Initial Seen can be lengthened
    if (letters[0] == "س" || letters[0] == "ش") { return [ {'token': s, 'kashida': true} ] }
    else { return dontStretch }
  }

  if (length == 3) { // Play it safe
    return dontStretch
  }

  if (length == 4 || length == 5) { // Ibn Khalouf
    if (letters == "الله") {
      return dontStretch // This one is special
    }
    // Split into three chunks: one before the stretchable letter, one containing just the
    // second stretchable letter, and one containing the rest. Insert ZWJs as appropriate.
    var chunks  = s.match(/^([^\u0620-\u064A]*[\u0620-\u064A][^\u0620-\u064A]*)([\u0620-\u064A])(.*)$/)

    var pre = chunks[1]
    var stretchy = chunks[2]
    var post = chunks[3]
    if (needsJoiner(pre,stretchy)) {
      pre = pre + zwj; stretchy = zwj + stretchy
    }
    if (needsJoiner(stretchy,post)) {
      // You would hope so...
      stretchy = stretchy + zwj;
      post = zwj + post
    }
    return [
      {'token': pre, 'kashida': false },
      {'token': stretchy, 'kashida': true },
      {'token': post, 'kashida': false },
    ]
  }

  chunks  = s.match(/([^\u0620-\u064A]*[\u0620-\u064A])/g)

  nodes = [ { 'token': chunks[0], 'kashida': false } ]
  var post;
  for (var i = 2; i < chunks.length; i++) {
    var pre = chunks[i-1]; var pre2 = pre.substr(-1)
    post = chunks[i];  var post2 = post.substr(-1);
    if (needsJoiner(nodes[nodes.length-1].token.substr(-1), pre2)) {
     pre = zwj + pre
     nodes[nodes.length-1].token = nodes[nodes.length-1].token + zwj
    }
    if (kashidaTable[pre2+post2]) {
     nodes.push({ 'token': pre, 'kashida': true })
    } else {
     nodes.push({ 'token': pre, 'kashida': false })
    }
  }
  nodes.push({ 'token': post, 'kashida': false })
  return nodes;
}

var testing = false;
if (testing) {
  const assert = require('assert');
  assert.deepEqual(applyKashidaRules("سر"), [ {'token': "سر", 'kashida': true}])
  assert.deepEqual(applyKashidaRules("تر"), [ {'token': "تر", 'kashida': false}])
  assert.deepEqual(applyKashidaRules("ترن"), [ {'token': "ترن", 'kashida': false}])
}
