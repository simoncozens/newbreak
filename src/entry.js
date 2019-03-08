"use strict";
// Just an entry point to the typescript bundle.
Object.defineProperty(exports, "__esModule", { value: true });
var dombreak_1 = require("./dombreak");
var d;
function changeFont(font) {
    $("div#testbox").css("font-family", font);
    window["fontSpy"](font, {
        success: function () {
            if (d) {
                d.rebuild();
            }
            else {
                d = new dombreak_1.DomBreak($("#testbox"), { textLetterSpacingPriority: 0.25 });
            }
        }
    });
}
changeFont("Encode Sans");
$("select").on("change", function (e) {
    changeFont($(e.target).val());
});
$(".slidecontainer input").on("input", function (e) {
    var input = $(e.target);
    var id = input[0].id;
    var v = input.val() / 100.0;
    $("#" + id + "Value").text(v);
});
$(".slidecontainer input").change(function (e) {
    var input = $(e.target);
    var id = input[0].id;
    if (id == "hyphenate") {
        d.options.hyphenate = !!input.prop('checked');
    }
    else if (id == "fulljustify") {
        $("#testbox").toggleClass("fulljustify");
    }
    else {
        var v = input.val() / 100.0;
        $("#" + id + "Value").text(v);
        d.options[id] = v;
    }
    d.rebuild();
});
//# sourceMappingURL=entry.js.map