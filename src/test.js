"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var newbreak_1 = require("./newbreak");
require("mocha");
function makeNodeList(text) {
    var rv = [];
    for (var _i = 0, _a = text.split(/(\s+)/); _i < _a.length; _i++) {
        var t = _a[_i];
        if (t.match(/\s+/)) {
            rv.push({ penalty: 0, breakable: true, width: 1, stretch: 1, shrink: 0.1, debugText: " " });
        }
        else {
            rv.push({ text: t, penalty: 0, breakable: false, width: t.length, stretch: 0, shrink: 0 });
        }
    }
    rv.push({ penalty: 0, breakable: true, width: 0, stretch: 1000, shrink: 0 });
    console.log(rv);
    return rv;
}
describe('Line breaker: 012', function () {
    var nodelist = makeNodeList("012");
    it('Should return something sensible', function () {
        var breaker = new newbreak_1.Linebreaker(nodelist, [7]);
        var answer = breaker.doBreak();
        chai_1.expect(answer.length).equals(1);
    });
});
describe('Line breaker: 123456 789 012', function () {
    var nodelist = makeNodeList("123456 789 012");
    it('length 7 should split at 3', function () {
        var breaker = new newbreak_1.Linebreaker(nodelist, [7]);
        // breaker.debugging = true
        var answer = breaker.doBreak();
        chai_1.expect(answer.length).equals(2);
        chai_1.expect(answer[0].nodes.length).equals(2);
        chai_1.expect(answer[1].nodes.length).equals(4);
    });
});
// describe("Line breaker: HTML examples", () => {
//   let nodelist = [
//     {text: "abcdef", breakClass: 0, penalty: 0, width: 41.71195602416992, stretch: 0},
//     {text: " ", penalty: 0, breakClass: 1, width: 3.913043975830078, stretch: 1},
//     {text: "ghijkl", breakClass: 0, penalty: 0, width: 36.53532791137695, stretch: 0},
//     {text: " ", penalty: 0, breakClass: 1, width: 3.913043975830078, stretch: 1},
//   ] as Node[];
//   it('length 42 should split at 1', () => {
//     let breaker = new Linebreaker(nodelist, [42])
//     breaker.debugging = true;
//     let answer = breaker.doBreak()
//     expect(answer).deep.equals([1,4])
//   });
// });
//# sourceMappingURL=test.js.map