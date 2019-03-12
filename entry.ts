// Just an entry point to the typescript bundle.

import { DomBreak } from "./dombreak";
var box = $("#testbox")

var d: DomBreak = new DomBreak(box, {textLetterSpacingPriority: 0});
if (box.data("text-stretch")) {
  d.options.textStretch = box.data("text-stretch")
}
if (box.data("text-shrink")) {
  d.options.textShrink = box.data("text-shrink")
}
if (box.data("method")) {
  d.options.method = box.data("method")
}

d.options.customizeTextNode = function(text, node) {
  if (text.length < 2) { node.stretch = 0 }
}
d.rebuild()

function changeFont(font) {
  box.css("font-family", font)
  window["fontSpy"](font, {
    success: function() {
      d.rebuild()
    }
  })
}

$("select").on("change", (e) => {
  changeFont($(e.target).val());
})

$(".slidecontainer input").on("input", (e) => {
  var input = $(e.target);
  var id = input[0].id;
  var v = (input.val() as number) / 100.0
  $(`#${id}Value`).text(v);
});

$(".slidecontainer input").change((e) => {
  var input = $(e.target);
  var id = input[0].id;
  if (id == "hyphenate") {
    d.options.hyphenate = !!input.prop('checked');
  } else if (id == "fulljustify") {
    d.options.fullJustify = !!input.prop('checked');
  } else {
    var v = (input.val() as number) / 100.0
    $(`#${id}Value`).text(v);
    d.options[id] = v;
  }
  d.rebuild();
})