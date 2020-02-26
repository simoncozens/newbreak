"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var mocha_1 = require("mocha");
var newbreak_1 = require("./newbreak");
function makeSomeStuff(count) {
    var nodelist = [];
    for (var i = 0; i < count; i++) {
        var node = {
            debugText: "laa" + i,
            width: 100,
            stretch: 0,
            shrink: 0,
            penalty: 0,
            breakable: false
        };
        nodelist.push(node);
        var glue = {
            debugText: " ",
            width: 10,
            stretch: (i == count - 1 ? 1000000 : 15),
            penalty: 0,
            shrink: 3,
            breakable: true
        };
        nodelist.push(glue);
    }
    return nodelist;
}
function checkAllNonBreakablesReturned(nodelist, lines) {
    var nonbreakablecount = nodelist.filter(function (x) { return !x.breakable; }).length;
    var nodesout = 0;
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var l = lines_1[_i];
        nodesout += l.nodes.filter(function (x) { return !x.breakable; }).length;
    }
    mocha_1.it('should return all the nodes', function () {
        chai_1.expect(nodesout).to.equal(nonbreakablecount);
    });
}
mocha_1.describe("Single line", function () {
    var nodelist = makeSomeStuff(2);
    var breaker = new newbreak_1.Linebreaker(nodelist, [220]);
    var lines = breaker.doBreak({});
    mocha_1.it('should have one line', function () {
        chai_1.expect(lines.length).to.equal(1);
    });
    checkAllNonBreakablesReturned(nodelist, lines);
});
mocha_1.describe("Two lines", function () {
    var nodelist = makeSomeStuff(4);
    console.log(nodelist);
    var breaker = new newbreak_1.Linebreaker(nodelist, [220]);
    var lines = breaker.doBreak({});
    mocha_1.it('should have two lines', function () {
        chai_1.expect(lines.length).to.equal(2);
    });
    console.log(lines);
    checkAllNonBreakablesReturned(nodelist, lines);
});
//# sourceMappingURL=test.js.map