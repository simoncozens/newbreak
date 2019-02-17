// Just an entry point to the typescript bundle.

import { DomBreak } from "./dombreak";

var d: DomBreak;

function changeFont(font) {
  $("div#testbox").css("font-family", font)
  window["fontSpy"](font, {
    success: function() {
      if (d) {
        d.rebuild()
      } else {
        d = new DomBreak($("#testbox"), {textLetterSpacingPriority: 0.25});
        $(".slidecontainer").show()
      }
    }
  })
}

changeFont("Encode Sans");

$(".slidecontainer").hide()
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
  } else {
    var v = (input.val() as number) / 100.0
    $(`#${id}Value`).text(v);
    d.options[id] = v;
  }
  d.rebuild();
})