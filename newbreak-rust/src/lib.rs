extern crate libc;
use core::cmp::Ordering::Equal;
use std::collections::HashMap;

use std::ptr;

use libc::c_void;

#[derive(Debug, Clone)]
pub struct Node {
	penalty: i32,
	width: f32,
	substitution_penalty: i32,
	stretch: f32,
	shrink: f32,
	breakable: bool,
	stretch_contribution: Vec<f32>,
	shrink_contribution: Vec<f32>,
	stretch_penalty: f32,
	text: *mut c_void,
	debug_text: String,
	original_index: usize,
	alternates: Vec<Node>,
	any_breakable: bool,
	any_negative_penalties: bool
}

#[derive(Debug, Hash, PartialEq, Eq, Clone)]
struct BreakOptions {
	full_justify: bool,
	start: usize,
	end: usize,
	unacceptable_ratio: u32,
	line_penalty: i32
}

#[derive(Debug, Clone)]
struct Line<'a> {
	ratio: f32,
	total_stretch: f32,
	total_shrink: f32,
	shortfall: f32,
	options: BreakOptions,
	target_widths: Vec<f32>,
	badness: i32,
	nodes: &'a [Node]
}

#[derive(Debug, Clone)]
struct Solution<'a> {
	lines: Vec<Line<'a>>,
	// nodes: &'a [Node],
	total_badness: i32
}

#[derive(Debug)]
pub struct Linebreaker<'a> {
	nodes: Vec<Node>,
	hsize: Vec<f32>,
	memoize_cache: HashMap<BreakOptions,Solution<'a>>,
	debugging: bool
}

impl Node {
	fn dummy () -> Node{
		Node {
			width: 0.0,
			breakable: true,
			penalty: 0,
			alternates: vec![],
			any_breakable: true,
			any_negative_penalties: false,
			stretch: 0.0,
			shrink: 0.0,
			stretch_contribution: vec![],
			shrink_contribution: vec![],
			original_index: 0,
			stretch_penalty: 0.0,
			substitution_penalty: 0,
			debug_text: String::new(),
			text: ptr::null_mut()
		}
	}
	// add code here
}

impl Node {
	fn prepare(&mut self, ix: usize) {
		self.original_index = ix;
		if self.penalty < 0   { self.any_negative_penalties = true }
		if self.breakable     { self.any_breakable = true }
		if self.stretch_contribution.is_empty() { self.stretch_contribution.push(1.0) }
		if self.shrink_contribution.is_empty()  { self.shrink_contribution.push(1.0) }
		for nn in self.alternates.iter() {
			if nn.penalty < 0 { self.any_negative_penalties = true }
			if nn.breakable   { self.breakable = true }
		}
	}
}

impl<'a> Linebreaker<'a> {
	fn prepare_nodes(&mut self) {
		for (ix,n) in self.nodes.iter_mut().enumerate() {
			n.prepare(ix);
			for nn in n.alternates.iter_mut() {
				nn.prepare(ix)
			}
		}
	}

	fn target_for(&self, line_no: usize) -> f32 {
		let max_index = self.hsize.len()-1;
		if line_no > max_index {
			self.hsize[max_index]
		} else {
			self.hsize[line_no]
		}
	}

	fn has_any_negative_penalties(&self, nodes: Vec<Node>) -> bool {
		for n in nodes {
			if n.any_negative_penalties { return true; }
		}
		false
	}

	fn badness(&self, line: &Line) -> i32 {
		let mut bad: i32;
		if line.shortfall == 0.0 {
			bad = 0
		} else if line.shortfall > 0.0 {
			bad = (100.0 * (line.shortfall/(0.001+line.total_stretch)).powf(3.0)).floor() as i32
		} else {
			bad = (100.0 * (-line.shortfall/(0.001+line.total_shrink)).powf(3.0)).floor() as i32
		}
		if let Some(last) = line.nodes.last() { bad += last.penalty }
		bad += line.options.line_penalty;
		for n in line.nodes {
			bad += n.substitution_penalty;
		}
		bad
	}

	fn find_breakpoints(&'a self, line_no: usize, options: BreakOptions) -> Solution<'a> {
		let target = self.target_for(line_no);
		if self.debugging {
			println!("Looking for breakpoints {:?}-{:?} to fill {:?} on line {:?}", options.start, options.end, target, line_no);
		}
	  if self.memoize_cache.contains_key(&options) {
      return self.memoize_cache.get(&options).unwrap().clone()
    }

    let relevant : &[Node] = &self.nodes[options.start .. options.end];
    let mut cur_width = 0.0;
    let mut cur_stretch = 0.0;
    let mut cur_shrink = 0.0;
    let mut considerations: Vec<Solution> = vec![];
    let mut best_badness = i32::MAX;
    // let mut seen_alternate = false;
		for (this_node_ix, this_node) in relevant.iter().enumerate() {
			// if !this_node.alternates.is_empty() { seen_alternate = true }
			if self.debugging { println!("Node {:?} ({:?}) line {:?}", this_node.debug_text, this_node.original_index, line_no);}
			if !this_node.any_breakable {
				if self.debugging { println!("Adding width {:?} for node {:?}", this_node.width, this_node.debug_text);}
	    	cur_width += this_node.width; cur_stretch += this_node.stretch; cur_shrink += this_node.shrink;
				continue;
			}
			if self.debugging { println!("Target: {:?} Current Width: {:?} Current Stretch: {:?}", target, cur_width, cur_stretch) }

			let last_line = this_node.original_index >= self.nodes.last().unwrap().original_index-2;
			if self.debugging { println!("Ratio: {:?} Unacceptable Ratio: {:?} Last line: {:?}", cur_width / target,(options.unacceptable_ratio as f32)/ 100.0, last_line) }

			if (cur_width / target < (options.unacceptable_ratio as f32)/ 1000.0 &&!last_line) ||
				cur_width / target > (2.0-(options.unacceptable_ratio as f32)/1000.0) {
				if self.debugging { println!("Too far") }
	    	cur_width += this_node.width; cur_stretch += this_node.stretch; cur_shrink += this_node.shrink;
				continue;
			}
			// We now have a potential breakpoint
			let mut line = Line {
					ratio: cur_width / target,
					shortfall: target - cur_width,
					total_shrink: cur_shrink,
					total_stretch: cur_stretch,
					target_widths: vec![],
					options: options.clone(),
					badness: 0,
					nodes: &relevant[0..this_node_ix],
			};
			line.badness = self.badness(&line);
			// if seen_alternate { self.try_to_improve(line, target) }
      // if !this_node.breakable && !(line.nodes[line.nodes.len()-1].breakable) {
	    	// cur_width += this_node.width; cur_stretch += this_node.stretch; cur_shrink += this_node.shrink;
      //   continue;
      // }
      let badness = line.badness; // May have been improved
      let any_negative_penalties = self.has_any_negative_penalties(relevant.to_vec());
      if (best_badness < badness && any_negative_penalties)
      	|| relevant.len() == 1 {
      	// Won't find any others
      } else {
      	let mut new_consideration = Solution {
      		total_badness: badness,
      		lines: vec![line]
      	};
      	if this_node.original_index+1 < options.end {
      		// Recurse
      		let mut new_options = options.clone();
      		new_options.start = this_node.original_index + 1;
      		let recursed = self.find_breakpoints(line_no+1, new_options);
      		for l in recursed.lines {
	      		new_consideration.lines.push(l)
	      	}
          new_consideration.total_badness += recursed.total_badness;
          if new_consideration.total_badness < best_badness {
            best_badness = new_consideration.total_badness
          }
          considerations.push(new_consideration)
      	} else {
      		considerations.push(new_consideration)
      	}
      }
    	cur_width += this_node.width; cur_stretch += this_node.stretch; cur_shrink += this_node.shrink;
		}

		if considerations.is_empty() {
			return Solution {
				lines: vec![],
				total_badness: i32::MAX
			}
		}
		// Otherwise find the best of the bunch
		let best_ref = considerations.iter().min_by(|a, b| a.total_badness.partial_cmp(&b.total_badness).unwrap_or(Equal)).unwrap();
  	// self.memoize_cache.insert(options, best_ref.clone());
  	best_ref.clone()
  }
}

// C Interface

#[no_mangle]
pub extern "C" fn nb_new(first_line: f32) -> Linebreaker {
	let lb = Linebreaker {
			nodes: vec![],
			hsize: vec![first_line],
			breakpoints: vec![],
			debugging: false,
			memoize_cache: HashMap::new()
	};
	unimplemented!()
}

// pub fn nb_add_node(mut lb: Linebreaker) {
// 	lb.nodes.push(Node::dummy());
// }

pub fn nb_finalize(lb: &mut Linebreaker) {
	lb.nodes.push(Node::dummy());
	lb.prepare_nodes();
}

// pub fn nb_dobreak<'a>(lb: Linebreaker<'a>, full_justify: bool,
// 									start: usize, end: usize, unacceptable_ratio: u32,
// 									line_penalty: i32) -> Solution<'a> {
// 	let options = BreakOptions { full_justify,
// 		start,
// 		end: if end > 0 { end } else { lb.nodes.len()-1 },
// 		unacceptable_ratio: if unacceptable_ratio != 0 { unacceptable_ratio } else { 500 },
// 		line_penalty: if line_penalty != 0 { line_penalty } else { 10 },
// 	};
// 	lb.find_breakpoints(0, options)
// }

#[cfg(test)]
fn make_some_stuff(count: usize) -> Vec<Node> {
	let mut nodelist = vec![];
	for i in 0..count	{
		nodelist.push(Node {
			width: 100.0,
			breakable: false,
			penalty: 0,
			alternates: vec![],
			any_breakable: false,
			any_negative_penalties: false,
			stretch: 0.0,
			shrink: 0.0,
			stretch_contribution: vec![],
			shrink_contribution: vec![],
			original_index: 0,
			stretch_penalty: 0.0,
			substitution_penalty: 0,
			debug_text: format!("laa{:?}", i),
			text: ptr::null_mut()
		});
		nodelist.push(Node {
			width: 10.0,
			breakable: true,
			penalty: 0,
			alternates: vec![],
			any_breakable: false,
			any_negative_penalties: false,
			stretch: if i==count-1 { 1000000.0 } else { 15.0 },
			shrink: 3.0,
			stretch_contribution: vec![],
			shrink_contribution: vec![],
			original_index: 0,
			stretch_penalty: 0.0,
			substitution_penalty: 0,
			debug_text: String::from(" "),
			text: ptr::null_mut()
		});
	}
	nodelist
}

#[cfg(test)]
fn check_all_breakables_returned(nl: &[Node], lines: Vec<Line>) {
	let mut nonbreakablecount = 0;
	let mut nodesout = 0;
	for n in nl { if !n.breakable { nonbreakablecount += 1 } }
	for l in lines {
		for n in l.nodes {
			if !n.breakable { nodesout += 1 }
		}
	}
	assert_eq!(nonbreakablecount, nodesout);
}

#[test]
fn test_nb_1() {
	let mut lb = Linebreaker { nodes: make_some_stuff(2),
		hsize: vec![220.0],
		debugging: true,
		memoize_cache: HashMap::new()
	};
	nb_finalize(&mut lb);
	let options = BreakOptions { full_justify: false,
		start: 0,
		end: lb.nodes.len()-1,
		unacceptable_ratio: 500,
		line_penalty: 10
	};
	let sol = lb.find_breakpoints(0, options);
	assert_eq!(sol.lines.len(), 1);
	check_all_breakables_returned(&lb.nodes, sol.lines);
}

#[test]
fn test_nb_2() {
	let mut lb = Linebreaker { nodes: make_some_stuff(4),
		hsize: vec![220.0],
		debugging: true,
		memoize_cache: HashMap::new()
	};
	nb_finalize(&mut lb);
	let options = BreakOptions { full_justify: false,
		start: 0,
		end: lb.nodes.len()-1,
		unacceptable_ratio: 500,
		line_penalty: 10
	};
	let sol = lb.find_breakpoints(0, options);
	assert_eq!(sol.lines.len(), 2);
	check_all_breakables_returned(&lb.nodes, sol.lines);
}
