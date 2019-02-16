// Just an entry point to the typescript bundle.

import { addBreaker } from "./dombreak";

// We have to do this on a click because it needs to measure
// the width of the characters to make its various nodes, and
// that can only be done when the font is fully loaded and
// rendered.
// How do we know when the rendering is finished?  \_(ツ)_/¯
// So we make the user click a button instead.
$("#go").click(function() {
  addBreaker($("#testbox"));
})