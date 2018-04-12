(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.mithril = factory());
}(this, (function () { 'use strict';

	function Vnode(tag, key, attrs, children, text, dom) {
		return {tag: tag, key: key, attrs: attrs, children: children, text: text, dom: dom, domSize: undefined, state: undefined, events: undefined, instance: undefined, skip: false}
	}
	Vnode.normalize = function(node) {
		if (Array.isArray(node)) return Vnode("[", undefined, undefined, Vnode.normalizeChildren(node), undefined, undefined)
		if (node != null && typeof node !== "object") return Vnode("#", undefined, undefined, node === false ? "" : node, undefined, undefined)
		return node
	};
	Vnode.normalizeChildren = function normalizeChildren(children) {
		for (var i = 0; i < children.length; i++) {
			children[i] = Vnode.normalize(children[i]);
		}
		return children
	};

	var vnode = Vnode;

	var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g;
	var selectorCache = {};
	var hasOwn = {}.hasOwnProperty;

	function isEmpty(object) {
		for (var key in object) if (hasOwn.call(object, key)) return false
		return true
	}

	function compileSelector(selector) {
		var match, tag = "div", classes = [], attrs = {};
		while (match = selectorParser.exec(selector)) {
			var type = match[1], value = match[2];
			if (type === "" && value !== "") tag = value;
			else if (type === "#") attrs.id = value;
			else if (type === ".") classes.push(value);
			else if (match[3][0] === "[") {
				var attrValue = match[6];
				if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, "$1").replace(/\\\\/g, "\\");
				if (match[4] === "class") classes.push(attrValue);
				else attrs[match[4]] = attrValue === "" ? attrValue : attrValue || true;
			}
		}
		if (classes.length > 0) attrs.className = classes.join(" ");
		return selectorCache[selector] = {tag: tag, attrs: attrs}
	}

	function execSelector(state, attrs, children) {
		var hasAttrs = false, childList, text;
		var className = attrs.className || attrs.class;

		if (!isEmpty(state.attrs) && !isEmpty(attrs)) {
			var newAttrs = {};

			for(var key in attrs) {
				if (hasOwn.call(attrs, key)) {
					newAttrs[key] = attrs[key];
				}
			}

			attrs = newAttrs;
		}

		for (var key in state.attrs) {
			if (hasOwn.call(state.attrs, key)) {
				attrs[key] = state.attrs[key];
			}
		}

		if (className !== undefined) {
			if (attrs.class !== undefined) {
				attrs.class = undefined;
				attrs.className = className;
			}

			if (state.attrs.className != null) {
				attrs.className = state.attrs.className + " " + className;
			}
		}

		for (var key in attrs) {
			if (hasOwn.call(attrs, key) && key !== "key") {
				hasAttrs = true;
				break
			}
		}

		if (Array.isArray(children) && children.length === 1 && children[0] != null && children[0].tag === "#") {
			text = children[0].children;
		} else {
			childList = children;
		}

		return vnode(state.tag, attrs.key, hasAttrs ? attrs : undefined, childList, text)
	}

	function hyperscript(selector) {
		// Because sloppy mode sucks
		var attrs = arguments[1], start = 2, children;

		if (selector == null || typeof selector !== "string" && typeof selector !== "function" && typeof selector.view !== "function") {
			throw Error("The selector must be either a string or a component.");
		}

		if (typeof selector === "string") {
			var cached = selectorCache[selector] || compileSelector(selector);
		}

		if (attrs == null) {
			attrs = {};
		} else if (typeof attrs !== "object" || attrs.tag != null || Array.isArray(attrs)) {
			attrs = {};
			start = 1;
		}

		if (arguments.length === start + 1) {
			children = arguments[start];
			if (!Array.isArray(children)) children = [children];
		} else {
			children = [];
			while (start < arguments.length) children.push(arguments[start++]);
		}

		var normalized = vnode.normalizeChildren(children);

		if (typeof selector === "string") {
			return execSelector(cached, attrs, normalized)
		} else {
			return vnode(selector, attrs.key, attrs, normalized)
		}
	}

	var hyperscript_1 = hyperscript;

	var trust = function(html) {
		if (html == null) html = "";
		return vnode("<", undefined, undefined, html, undefined, undefined)
	};

	var fragment = function(attrs, children) {
		return vnode("[", attrs.key, attrs, vnode.normalizeChildren(children), undefined, undefined)
	};

	hyperscript_1.trust = trust;
	hyperscript_1.fragment = fragment;

	var hyperscript_1$1 = hyperscript_1;

	/** @constructor */
	var PromisePolyfill = function(executor) {
		if (!(this instanceof PromisePolyfill)) throw new Error("Promise must be called with `new`")
		if (typeof executor !== "function") throw new TypeError("executor must be a function")

		var self = this, resolvers = [], rejectors = [], resolveCurrent = handler(resolvers, true), rejectCurrent = handler(rejectors, false);
		var instance = self._instance = {resolvers: resolvers, rejectors: rejectors};
		var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout;
		function handler(list, shouldAbsorb) {
			return function execute(value) {
				var then;
				try {
					if (shouldAbsorb && value != null && (typeof value === "object" || typeof value === "function") && typeof (then = value.then) === "function") {
						if (value === self) throw new TypeError("Promise can't be resolved w/ itself")
						executeOnce(then.bind(value));
					}
					else {
						callAsync(function() {
							if (!shouldAbsorb && list.length === 0) console.error("Possible unhandled promise rejection:", value);
							for (var i = 0; i < list.length; i++) list[i](value);
							resolvers.length = 0, rejectors.length = 0;
							instance.state = shouldAbsorb;
							instance.retry = function() {execute(value);};
						});
					}
				}
				catch (e) {
					rejectCurrent(e);
				}
			}
		}
		function executeOnce(then) {
			var runs = 0;
			function run(fn) {
				return function(value) {
					if (runs++ > 0) return
					fn(value);
				}
			}
			var onerror = run(rejectCurrent);
			try {then(run(resolveCurrent), onerror);} catch (e) {onerror(e);}
		}

		executeOnce(executor);
	};
	PromisePolyfill.prototype.then = function(onFulfilled, onRejection) {
		var self = this, instance = self._instance;
		function handle(callback, list, next, state) {
			list.push(function(value) {
				if (typeof callback !== "function") next(value);
				else try {resolveNext(callback(value));} catch (e) {if (rejectNext) rejectNext(e);}
			});
			if (typeof instance.retry === "function" && state === instance.state) instance.retry();
		}
		var resolveNext, rejectNext;
		var promise = new PromisePolyfill(function(resolve, reject) {resolveNext = resolve, rejectNext = reject;});
		handle(onFulfilled, instance.resolvers, resolveNext, true), handle(onRejection, instance.rejectors, rejectNext, false);
		return promise
	};
	PromisePolyfill.prototype.catch = function(onRejection) {
		return this.then(null, onRejection)
	};
	PromisePolyfill.prototype.finally = function(callback) {
		return this.then(
			function(value) {
				return PromisePolyfill.resolve(callback()).then(function() {
					return value
				})
			},
			function(reason) {
				return PromisePolyfill.resolve(callback()).then(function() {
					return PromisePolyfill.reject(reason);
				})
			}
		)
	};
	PromisePolyfill.resolve = function(value) {
		if (value instanceof PromisePolyfill) return value
		return new PromisePolyfill(function(resolve) {resolve(value);})
	};
	PromisePolyfill.reject = function(value) {
		return new PromisePolyfill(function(resolve, reject) {reject(value);})
	};
	PromisePolyfill.all = function(list) {
		return new PromisePolyfill(function(resolve, reject) {
			var total = list.length, count = 0, values = [];
			if (list.length === 0) resolve([]);
			else for (var i = 0; i < list.length; i++) {
				(function(i) {
					function consume(value) {
						count++;
						values[i] = value;
						if (count === total) resolve(values);
					}
					if (list[i] != null && (typeof list[i] === "object" || typeof list[i] === "function") && typeof list[i].then === "function") {
						list[i].then(consume, reject);
					}
					else consume(list[i]);
				})(i);
			}
		})
	};
	PromisePolyfill.race = function(list) {
		return new PromisePolyfill(function(resolve, reject) {
			for (var i = 0; i < list.length; i++) {
				list[i].then(resolve, reject);
			}
		})
	};

	var polyfill = PromisePolyfill;

	function buildQueryString(object) {
		if (Object.prototype.toString.call(object) !== "[object Object]") return ""

		var args = [];
		for (var key in object) {
			destructure(key, object[key]);
		}

		return args.join("&")

		function destructure(key, value) {
			if (Array.isArray(value)) {
				for (var i = 0; i < value.length; i++) {
					destructure(key + "[" + i + "]", value[i]);
				}
			}
			else if (Object.prototype.toString.call(value) === "[object Object]") {
				for (var i in value) {
					destructure(key + "[" + i + "]", value[i]);
				}
			}
			else args.push(encodeURIComponent(key) + (value != null && value !== "" ? "=" + encodeURIComponent(value) : ""));
		}
	}

	var build = /*#__PURE__*/Object.freeze({
		default: buildQueryString
	});

	var mount = function(redrawService) {
		return function(root, component) {
			if (component === null) {
				redrawService.render(root, []);
				redrawService.unsubscribe(root);
				return
			}
			
			if (component.view == null && typeof component !== "function") throw new Error("m.mount(element, component) expects a component, not a vnode")
			
			var run = function() {
				redrawService.render(root, vnode(component));
			};
			redrawService.subscribe(root, run);
			run();
		}
	};

	var render = function($window) {
		var $doc = $window.document;
		var $emptyFragment = $doc.createDocumentFragment();

		var nameSpace = {
			svg: "http://www.w3.org/2000/svg",
			math: "http://www.w3.org/1998/Math/MathML"
		};

		var onevent;
		function setEventCallback(callback) {return onevent = callback}

		function getNameSpace(vnode$$1) {
			return vnode$$1.attrs && vnode$$1.attrs.xmlns || nameSpace[vnode$$1.tag]
		}

		//sanity check to discourage people from doing `vnode.state = ...`
		function checkState(vnode$$1, original) {
			if (vnode$$1.state !== original) throw new Error("`vnode.state` must not be modified")
		}

		//Note: the hook is passed as the `this` argument to allow proxying the
		//arguments without requiring a full array allocation to do so. It also
		//takes advantage of the fact the current `vnode` is the first argument in
		//all lifecycle methods.
		function callHook(vnode$$1) {
			var original = vnode$$1.state;
			try {
				return this.apply(original, arguments)
			} finally {
				checkState(vnode$$1, original);
			}
		}

		//create
		function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
			for (var i = start; i < end; i++) {
				var vnode$$1 = vnodes[i];
				if (vnode$$1 != null) {
					createNode(parent, vnode$$1, hooks, ns, nextSibling);
				}
			}
		}
		function createNode(parent, vnode$$1, hooks, ns, nextSibling) {
			var tag = vnode$$1.tag;
			if (typeof tag === "string") {
				vnode$$1.state = {};
				if (vnode$$1.attrs != null) initLifecycle(vnode$$1.attrs, vnode$$1, hooks);
				switch (tag) {
					case "#": return createText(parent, vnode$$1, nextSibling)
					case "<": return createHTML(parent, vnode$$1, ns, nextSibling)
					case "[": return createFragment(parent, vnode$$1, hooks, ns, nextSibling)
					default: return createElement(parent, vnode$$1, hooks, ns, nextSibling)
				}
			}
			else return createComponent(parent, vnode$$1, hooks, ns, nextSibling)
		}
		function createText(parent, vnode$$1, nextSibling) {
			vnode$$1.dom = $doc.createTextNode(vnode$$1.children);
			insertNode(parent, vnode$$1.dom, nextSibling);
			return vnode$$1.dom
		}
		var possibleParents = {caption: "table", thead: "table", tbody: "table", tfoot: "table", tr: "tbody", th: "tr", td: "tr", colgroup: "table", col: "colgroup"};
		function createHTML(parent, vnode$$1, ns, nextSibling) {
			var match = vnode$$1.children.match(/^\s*?<(\w+)/im) || [];
			// not using the proper parent makes the child element(s) vanish.
			//     var div = document.createElement("div")
			//     div.innerHTML = "<td>i</td><td>j</td>"
			//     console.log(div.innerHTML)
			// --> "ij", no <td> in sight.
			var temp = $doc.createElement(possibleParents[match[1]] || "div");
			if (ns === "http://www.w3.org/2000/svg") {
				temp.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\">" + vnode$$1.children + "</svg>";
				temp = temp.firstChild;
			} else {
				temp.innerHTML = vnode$$1.children;
			}
			vnode$$1.dom = temp.firstChild;
			vnode$$1.domSize = temp.childNodes.length;
			var fragment = $doc.createDocumentFragment();
			var child;
			while (child = temp.firstChild) {
				fragment.appendChild(child);
			}
			insertNode(parent, fragment, nextSibling);
			return fragment
		}
		function createFragment(parent, vnode$$1, hooks, ns, nextSibling) {
			var fragment = $doc.createDocumentFragment();
			if (vnode$$1.children != null) {
				var children = vnode$$1.children;
				createNodes(fragment, children, 0, children.length, hooks, null, ns);
			}
			vnode$$1.dom = fragment.firstChild;
			vnode$$1.domSize = fragment.childNodes.length;
			insertNode(parent, fragment, nextSibling);
			return fragment
		}
		function createElement(parent, vnode$$1, hooks, ns, nextSibling) {
			var tag = vnode$$1.tag;
			var attrs = vnode$$1.attrs;
			var is = attrs && attrs.is;

			ns = getNameSpace(vnode$$1) || ns;

			var element = ns ?
				is ? $doc.createElementNS(ns, tag, {is: is}) : $doc.createElementNS(ns, tag) :
				is ? $doc.createElement(tag, {is: is}) : $doc.createElement(tag);
			vnode$$1.dom = element;

			if (attrs != null) {
				setAttrs(vnode$$1, attrs, ns);
			}

			insertNode(parent, element, nextSibling);

			if (vnode$$1.attrs != null && vnode$$1.attrs.contenteditable != null) {
				setContentEditable(vnode$$1);
			}
			else {
				if (vnode$$1.text != null) {
					if (vnode$$1.text !== "") element.textContent = vnode$$1.text;
					else vnode$$1.children = [vnode("#", undefined, undefined, vnode$$1.text, undefined, undefined)];
				}
				if (vnode$$1.children != null) {
					var children = vnode$$1.children;
					createNodes(element, children, 0, children.length, hooks, null, ns);
					setLateAttrs(vnode$$1);
				}
			}
			return element
		}
		function initComponent(vnode$$1, hooks) {
			var sentinel;
			if (typeof vnode$$1.tag.view === "function") {
				vnode$$1.state = Object.create(vnode$$1.tag);
				sentinel = vnode$$1.state.view;
				if (sentinel.$$reentrantLock$$ != null) return $emptyFragment
				sentinel.$$reentrantLock$$ = true;
			} else {
				vnode$$1.state = void 0;
				sentinel = vnode$$1.tag;
				if (sentinel.$$reentrantLock$$ != null) return $emptyFragment
				sentinel.$$reentrantLock$$ = true;
				vnode$$1.state = (vnode$$1.tag.prototype != null && typeof vnode$$1.tag.prototype.view === "function") ? new vnode$$1.tag(vnode$$1) : vnode$$1.tag(vnode$$1);
			}
			if (vnode$$1.attrs != null) initLifecycle(vnode$$1.attrs, vnode$$1, hooks);
			initLifecycle(vnode$$1.state, vnode$$1, hooks);
			vnode$$1.instance = vnode.normalize(callHook.call(vnode$$1.state.view, vnode$$1));
			if (vnode$$1.instance === vnode$$1) throw Error("A view cannot return the vnode it received as argument")
			sentinel.$$reentrantLock$$ = null;
		}
		function createComponent(parent, vnode$$1, hooks, ns, nextSibling) {
			initComponent(vnode$$1, hooks);
			if (vnode$$1.instance != null) {
				var element = createNode(parent, vnode$$1.instance, hooks, ns, nextSibling);
				vnode$$1.dom = vnode$$1.instance.dom;
				vnode$$1.domSize = vnode$$1.dom != null ? vnode$$1.instance.domSize : 0;
				insertNode(parent, element, nextSibling);
				return element
			}
			else {
				vnode$$1.domSize = 0;
				return $emptyFragment
			}
		}

		//update
		/**
		 * @param {Element|Fragment} parent - the parent element
		 * @param {Vnode[] | null} old - the list of vnodes of the last `render()` call for
		 *                               this part of the tree
		 * @param {Vnode[] | null} vnodes - as above, but for the current `render()` call.
		 * @param {boolean} recyclingParent - was the parent vnode or one of its ancestor
		 *                                    fetched from the recycling pool?
		 * @param {Function[]} hooks - an accumulator of post-render hooks (oncreate/onupdate)
		 * @param {Element | null} nextSibling - the next DOM node if we're dealing with a
		 *                                       fragment that is not the last item in its
		 *                                       parent
		 * @param {'svg' | 'math' | String | null} ns) - the current XML namespace, if any
		 * @returns void
		 */
		// This function diffs and patches lists of vnodes, both keyed and unkeyed.
		//
		// We will:
		//
		// 1. describe its general structure
		// 2. focus on the diff algorithm optimizations
		// 3. describe how the recycling pool meshes into this
		// 4. discuss DOM node operations.

		// ## Overview:
		//
		// The updateNodes() function:
		// - deals with trivial cases
		// - determines whether the lists are keyed or unkeyed
		//   (Currently we look for the first pair of non-null nodes and deem the lists unkeyed
		//   if both nodes are unkeyed. TODO (v2) We may later take advantage of the fact that
		//   mixed diff is not supported and settle on the keyedness of the first vnode we find)
		// - diffs them and patches the DOM if needed (that's the brunt of the code)
		// - manages the leftovers: after diffing, are there:
		//   - old nodes left to remove?
		// 	 - new nodes to insert?
		//   - nodes left in the recycling pool?
		// 	 deal with them!
		//
		// The lists are only iterated over once, with an exception for the nodes in `old` that
		// are visited in the fourth part of the diff and in the `removeNodes` loop.

		// ## Diffing
		//
		// There's first a simple diff for unkeyed lists of equal length that eschews the pool.
		//
		// It is followed by a small section that activates the recycling pool if present, we'll
		// ignore it for now.
		//
		// Then comes the main diff algorithm that is split in four parts (simplifying a bit).
		//
		// The first part goes through both lists top-down as long as the nodes at each level have
		// the same key. This is always true for unkeyed lists that are entirely processed by this
		// step.
		//
		// The second part deals with lists reversals, and traverses one list top-down and the other
		// bottom-up (as long as the keys match).
		//
		// The third part goes through both lists bottom up as long as the keys match.
		//
		// The first and third sections allow us to deal efficiently with situations where one or
		// more contiguous nodes were either inserted into, removed from or re-ordered in an otherwise
		// sorted list. They may reduce the number of nodes to be processed in the fourth section.
		//
		// The fourth section does keyed diff for the situations not covered by the other three. It
		// builds a {key: oldIndex} dictionary and uses it to find old nodes that match the keys of
		// new ones.
		// The nodes from the `old` array that have a match in the new `vnodes` one are marked as
		// `vnode.skip: true`.
		//
		// If there are still nodes in the new `vnodes` array that haven't been matched to old ones,
		// they are created.
		// The range of old nodes that wasn't covered by the first three sections is passed to
		// `removeNodes()`. Those nodes are removed unless marked as `.skip: true`.
		//
		// Then some pool business happens.
		//
		// It should be noted that the description of the four sections above is not perfect, because those
		// parts are actually implemented as only two loops, one for the first two parts, and one for
		// the other two. I'm not sure it wins us anything except maybe a few bytes of file size.

		// ## The pool
		//
		// `old.pool` is an optional array that holds the vnodes that have been previously removed
		// from the DOM at this level (provided they met the pool eligibility criteria).
		//
		// If the `old`, `old.pool` and `vnodes` meet some criteria described in `isRecyclable`, the
		// elements of the pool are appended to the `old` array, which enables the reconciler to find
		// them.
		//
		// While this is optimal for unkeyed diff and map-based keyed diff (the fourth diff part),
		// that strategy clashes with the second and third parts of the main diff algo, because
		// the end of the old list is now filled with the nodes of the pool.
		//
		// To determine if a vnode was brought back from the pool, we look at its position in the
		// `old` array (see the various `oFromPool` definitions). That information is important
		// in three circumstances:
		// - If the old and the new vnodes are the same object (`===`), diff is not performed unless
		//   the old node comes from the pool (since it must be recycled/re-created).
		// - The value of `oFromPool` is passed as the `recycling` parameter of `updateNode()` (whether
		//   the parent is being recycled is also factred in here)
		// - It is used in the DOM node insertion logic (see below)
		//
		// At the very end of `updateNodes()`, the nodes in the pool that haven't been picked back
		// are put in the new pool for the next render phase.
		//
		// The pool eligibility and `isRecyclable()` criteria are to be updated as part of #1675.

		// ## DOM node operations
		//
		// In most cases `updateNode()` and `createNode()` perform the DOM operations. However,
		// this is not the case if the node moved (second and fourth part of the diff algo), or
		// if the node was brough back from the pool and both the old and new nodes have the same
		// `.tag` value (when the `.tag` differ, `updateNode()` does the insertion).
		//
		// The fourth part of the diff currently inserts nodes unconditionally, leading to issues
		// like #1791 and #1999. We need to be smarter about those situations where adjascent old
		// nodes remain together in the new list in a way that isn't covered by parts one and
		// three of the diff algo.

		function updateNodes(parent, old, vnodes, recyclingParent, hooks, nextSibling, ns) {
			if (old === vnodes && !recyclingParent || old == null && vnodes == null) return
			else if (old == null) createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, ns);
			else if (vnodes == null) removeNodes(old, 0, old.length, vnodes, recyclingParent);
			else {
				var start = 0, commonLength = Math.min(old.length, vnodes.length), originalOldLength = old.length, hasPool = false, isUnkeyed = false;
				for(; start < commonLength; start++) {
					if (old[start] != null && vnodes[start] != null) {
						if (old[start].key == null && vnodes[start].key == null) isUnkeyed = true;
						break
					}
				}
				if (isUnkeyed && originalOldLength === vnodes.length) {
					for (start = 0; start < originalOldLength; start++) {
						if (old[start] === vnodes[start] && !recyclingParent || old[start] == null && vnodes[start] == null) continue
						else if (old[start] == null) createNode(parent, vnodes[start], hooks, ns, getNextSibling(old, start + 1, originalOldLength, nextSibling));
						else if (vnodes[start] == null) removeNodes(old, start, start + 1, vnodes, recyclingParent);
						else updateNode(parent, old[start], vnodes[start], hooks, getNextSibling(old, start + 1, originalOldLength, nextSibling), recyclingParent, ns);
					}
					return
				}

				if (isRecyclable(old, vnodes)) {
					hasPool = true;
					old = old.concat(old.pool);
				}

				var oldStart = start = 0, oldEnd = old.length - 1, end = vnodes.length - 1, map, o, v, oFromPool;

				while (oldEnd >= oldStart && end >= start) {
					o = old[oldStart];
					v = vnodes[start];
					oFromPool = hasPool && oldStart >= originalOldLength;
					if (o === v && !oFromPool && !recyclingParent || o == null && v == null) oldStart++, start++;
					else if (o == null) {
						if (isUnkeyed || v.key == null) {
							createNode(parent, vnodes[start], hooks, ns, getNextSibling(old, ++start, originalOldLength, nextSibling));
						}
						oldStart++;
					} else if (v == null) {
						if (isUnkeyed || o.key == null) {
							removeNodes(old, start, start + 1, vnodes, recyclingParent);
							oldStart++;
						}
						start++;
					} else if (o.key === v.key) {
						oldStart++, start++;
						updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, originalOldLength, nextSibling), oFromPool || recyclingParent, ns);
						if (oFromPool && o.tag === v.tag) insertNode(parent, toFragment(v), nextSibling);
					} else {
						o = old[oldEnd];
						oFromPool = hasPool && oldEnd >= originalOldLength;
						if (o === v && !oFromPool && !recyclingParent) oldEnd--, start++;
						else if (o == null) oldEnd--;
						else if (v == null) start++;
						else if (o.key === v.key) {
							updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, originalOldLength, nextSibling), oFromPool || recyclingParent, ns);
							if (oFromPool && o.tag === v.tag || start < end) insertNode(parent, toFragment(v), getNextSibling(old, oldStart, originalOldLength, nextSibling));
							oldEnd--, start++;
						}
						else break
					}
				}
				while (oldEnd >= oldStart && end >= start) {
					o = old[oldEnd];
					v = vnodes[end];
					oFromPool = hasPool && oldEnd >= originalOldLength;
					if (o === v && !oFromPool && !recyclingParent) oldEnd--, end--;
					else if (o == null) oldEnd--;
					else if (v == null) end--;
					else if (o.key === v.key) {
						updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, originalOldLength, nextSibling), oFromPool || recyclingParent, ns);
						if (oFromPool && o.tag === v.tag) insertNode(parent, toFragment(v), nextSibling);
						if (o.dom != null) nextSibling = o.dom;
						oldEnd--, end--;
					} else {
						if (!map) map = getKeyMap(old, oldEnd);
						if (v != null) {
							var oldIndex = map[v.key];
							if (oldIndex != null) {
								o = old[oldIndex];
								oFromPool = hasPool && oldIndex >= originalOldLength;
								updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, originalOldLength, nextSibling), oFromPool || recyclingParent, ns);
								insertNode(parent, toFragment(v), nextSibling);
								o.skip = true;
								if (o.dom != null) nextSibling = o.dom;
							} else {
								var dom = createNode(parent, v, hooks, ns, nextSibling);
								nextSibling = dom;
							}
						}
						end--;
					}
					if (end < start) break
				}
				createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
				removeNodes(old, oldStart, Math.min(oldEnd + 1, originalOldLength), vnodes, recyclingParent);
				if (hasPool) {
					var limit = Math.max(oldStart, originalOldLength);
					for (; oldEnd >= limit; oldEnd--) {
						if (old[oldEnd].skip) old[oldEnd].skip = false;
						else addToPool(old[oldEnd], vnodes);
					}
				}
			}
		}
		// when recycling, we're re-using an old DOM node, but firing the oninit/oncreate hooks
		// instead of onbeforeupdate/onupdate.
		function updateNode(parent, old, vnode$$1, hooks, nextSibling, recycling, ns) {
			var oldTag = old.tag, tag = vnode$$1.tag;
			if (oldTag === tag) {
				vnode$$1.state = old.state;
				vnode$$1.events = old.events;
				if (!recycling && shouldNotUpdate(vnode$$1, old)) return
				if (typeof oldTag === "string") {
					if (vnode$$1.attrs != null) {
						if (recycling) {
							vnode$$1.state = {};
							initLifecycle(vnode$$1.attrs, vnode$$1, hooks);
						}
						else updateLifecycle(vnode$$1.attrs, vnode$$1, hooks);
					}
					switch (oldTag) {
						case "#": updateText(old, vnode$$1); break
						case "<": updateHTML(parent, old, vnode$$1, ns, nextSibling); break
						case "[": updateFragment(parent, old, vnode$$1, recycling, hooks, nextSibling, ns); break
						default: updateElement(old, vnode$$1, recycling, hooks, ns);
					}
				}
				else updateComponent(parent, old, vnode$$1, hooks, nextSibling, recycling, ns);
			}
			else {
				removeNode(old, null, recycling);
				createNode(parent, vnode$$1, hooks, ns, nextSibling);
			}
		}
		function updateText(old, vnode$$1) {
			if (old.children.toString() !== vnode$$1.children.toString()) {
				old.dom.nodeValue = vnode$$1.children;
			}
			vnode$$1.dom = old.dom;
		}
		function updateHTML(parent, old, vnode$$1, ns, nextSibling) {
			if (old.children !== vnode$$1.children) {
				toFragment(old);
				createHTML(parent, vnode$$1, ns, nextSibling);
			}
			else vnode$$1.dom = old.dom, vnode$$1.domSize = old.domSize;
		}
		function updateFragment(parent, old, vnode$$1, recycling, hooks, nextSibling, ns) {
			updateNodes(parent, old.children, vnode$$1.children, recycling, hooks, nextSibling, ns);
			var domSize = 0, children = vnode$$1.children;
			vnode$$1.dom = null;
			if (children != null) {
				for (var i = 0; i < children.length; i++) {
					var child = children[i];
					if (child != null && child.dom != null) {
						if (vnode$$1.dom == null) vnode$$1.dom = child.dom;
						domSize += child.domSize || 1;
					}
				}
				if (domSize !== 1) vnode$$1.domSize = domSize;
			}
		}
		function updateElement(old, vnode$$1, recycling, hooks, ns) {
			var element = vnode$$1.dom = old.dom;
			ns = getNameSpace(vnode$$1) || ns;

			if (vnode$$1.tag === "textarea") {
				if (vnode$$1.attrs == null) vnode$$1.attrs = {};
				if (vnode$$1.text != null) {
					vnode$$1.attrs.value = vnode$$1.text; //FIXME handle multiple children
					vnode$$1.text = undefined;
				}
			}
			updateAttrs(vnode$$1, old.attrs, vnode$$1.attrs, ns);
			if (vnode$$1.attrs != null && vnode$$1.attrs.contenteditable != null) {
				setContentEditable(vnode$$1);
			}
			else if (old.text != null && vnode$$1.text != null && vnode$$1.text !== "") {
				if (old.text.toString() !== vnode$$1.text.toString()) old.dom.firstChild.nodeValue = vnode$$1.text;
			}
			else {
				if (old.text != null) old.children = [vnode("#", undefined, undefined, old.text, undefined, old.dom.firstChild)];
				if (vnode$$1.text != null) vnode$$1.children = [vnode("#", undefined, undefined, vnode$$1.text, undefined, undefined)];
				updateNodes(element, old.children, vnode$$1.children, recycling, hooks, null, ns);
			}
		}
		function updateComponent(parent, old, vnode$$1, hooks, nextSibling, recycling, ns) {
			if (recycling) {
				initComponent(vnode$$1, hooks);
			} else {
				vnode$$1.instance = vnode.normalize(callHook.call(vnode$$1.state.view, vnode$$1));
				if (vnode$$1.instance === vnode$$1) throw Error("A view cannot return the vnode it received as argument")
				if (vnode$$1.attrs != null) updateLifecycle(vnode$$1.attrs, vnode$$1, hooks);
				updateLifecycle(vnode$$1.state, vnode$$1, hooks);
			}
			if (vnode$$1.instance != null) {
				if (old.instance == null) createNode(parent, vnode$$1.instance, hooks, ns, nextSibling);
				else updateNode(parent, old.instance, vnode$$1.instance, hooks, nextSibling, recycling, ns);
				vnode$$1.dom = vnode$$1.instance.dom;
				vnode$$1.domSize = vnode$$1.instance.domSize;
			}
			else if (old.instance != null) {
				removeNode(old.instance, null, recycling);
				vnode$$1.dom = undefined;
				vnode$$1.domSize = 0;
			}
			else {
				vnode$$1.dom = old.dom;
				vnode$$1.domSize = old.domSize;
			}
		}
		function isRecyclable(old, vnodes) {
			if (old.pool != null && Math.abs(old.pool.length - vnodes.length) <= Math.abs(old.length - vnodes.length)) {
				var oldChildrenLength = old[0] && old[0].children && old[0].children.length || 0;
				var poolChildrenLength = old.pool[0] && old.pool[0].children && old.pool[0].children.length || 0;
				var vnodesChildrenLength = vnodes[0] && vnodes[0].children && vnodes[0].children.length || 0;
				if (Math.abs(poolChildrenLength - vnodesChildrenLength) <= Math.abs(oldChildrenLength - vnodesChildrenLength)) {
					return true
				}
			}
			return false
		}
		function getKeyMap(vnodes, end) {
			var map = {}, i = 0;
			for (var i = 0; i < end; i++) {
				var vnode$$1 = vnodes[i];
				if (vnode$$1 != null) {
					var key = vnode$$1.key;
					if (key != null) map[key] = i;
				}
			}
			return map
		}
		function toFragment(vnode$$1) {
			var count = vnode$$1.domSize;
			if (count != null || vnode$$1.dom == null) {
				var fragment = $doc.createDocumentFragment();
				if (count > 0) {
					var dom = vnode$$1.dom;
					while (--count) fragment.appendChild(dom.nextSibling);
					fragment.insertBefore(dom, fragment.firstChild);
				}
				return fragment
			}
			else return vnode$$1.dom
		}
		// the vnodes array may hold items that come from the pool (after `limit`) they should
		// be ignored
		function getNextSibling(vnodes, i, limit, nextSibling) {
			for (; i < limit; i++) {
				if (vnodes[i] != null && vnodes[i].dom != null) return vnodes[i].dom
			}
			return nextSibling
		}

		function insertNode(parent, dom, nextSibling) {
			if (nextSibling) parent.insertBefore(dom, nextSibling);
			else parent.appendChild(dom);
		}

		function setContentEditable(vnode$$1) {
			var children = vnode$$1.children;
			if (children != null && children.length === 1 && children[0].tag === "<") {
				var content = children[0].children;
				if (vnode$$1.dom.innerHTML !== content) vnode$$1.dom.innerHTML = content;
			}
			else if (vnode$$1.text != null || children != null && children.length !== 0) throw new Error("Child node of a contenteditable must be trusted")
		}

		//remove
		function removeNodes(vnodes, start, end, context, recycling) {
			for (var i = start; i < end; i++) {
				var vnode$$1 = vnodes[i];
				if (vnode$$1 != null) {
					if (vnode$$1.skip) vnode$$1.skip = false;
					else removeNode(vnode$$1, context, recycling);
				}
			}
		}
		// when a node is removed from a parent that's brought back from the pool, its hooks should
		// not fire.
		function removeNode(vnode$$1, context, recycling) {
			var expected = 1, called = 0;
			if (!recycling) {
				var original = vnode$$1.state;
				if (vnode$$1.attrs && typeof vnode$$1.attrs.onbeforeremove === "function") {
					var result = callHook.call(vnode$$1.attrs.onbeforeremove, vnode$$1);
					if (result != null && typeof result.then === "function") {
						expected++;
						result.then(continuation, continuation);
					}
				}
				if (typeof vnode$$1.tag !== "string" && typeof vnode$$1.state.onbeforeremove === "function") {
					var result = callHook.call(vnode$$1.state.onbeforeremove, vnode$$1);
					if (result != null && typeof result.then === "function") {
						expected++;
						result.then(continuation, continuation);
					}
				}
			}
			continuation();
			function continuation() {
				if (++called === expected) {
					if (!recycling) {
						checkState(vnode$$1, original);
						onremove(vnode$$1);
					}
					if (vnode$$1.dom) {
						var count = vnode$$1.domSize || 1;
						if (count > 1) {
							var dom = vnode$$1.dom;
							while (--count) {
								removeNodeFromDOM(dom.nextSibling);
							}
						}
						removeNodeFromDOM(vnode$$1.dom);
						addToPool(vnode$$1, context);
					}
				}
			}
		}
		function removeNodeFromDOM(node) {
			var parent = node.parentNode;
			if (parent != null) parent.removeChild(node);
		}
		function addToPool(vnode$$1, context) {
			if (context != null && vnode$$1.domSize == null && !hasIntegrationMethods(vnode$$1.attrs) && typeof vnode$$1.tag === "string") { //TODO test custom elements
				if (!context.pool) context.pool = [vnode$$1];
				else context.pool.push(vnode$$1);
			}
		}
		function onremove(vnode$$1) {
			if (vnode$$1.attrs && typeof vnode$$1.attrs.onremove === "function") callHook.call(vnode$$1.attrs.onremove, vnode$$1);
			if (typeof vnode$$1.tag !== "string") {
				if (typeof vnode$$1.state.onremove === "function") callHook.call(vnode$$1.state.onremove, vnode$$1);
				if (vnode$$1.instance != null) onremove(vnode$$1.instance);
			} else {
				var children = vnode$$1.children;
				if (Array.isArray(children)) {
					for (var i = 0; i < children.length; i++) {
						var child = children[i];
						if (child != null) onremove(child);
					}
				}
			}
		}

		//attrs
		function setAttrs(vnode$$1, attrs, ns) {
			for (var key in attrs) {
				setAttr(vnode$$1, key, null, attrs[key], ns);
			}
		}
		function setAttr(vnode$$1, key, old, value, ns) {
			if (key === "key" || key === "is" || isLifecycleMethod(key)) return
			if (key[0] === "o" && key[1] === "n") return updateEvent(vnode$$1, key, value)
			if (typeof value === "undefined" && key === "value" && old !== value) {
				vnode$$1.dom.value = "";
				return
			}
			if ((old === value && !isFormAttribute(vnode$$1, key)) && typeof value !== "object" || value === undefined) return
			var element = vnode$$1.dom;
			if (key.slice(0, 6) === "xlink:") element.setAttributeNS("http://www.w3.org/1999/xlink", key, value);
			else if (key === "style") updateStyle(element, old, value);
			else if (key in element && !isAttribute(key) && ns === undefined && !isCustomElement(vnode$$1)) {
				if (key === "value") {
					var normalized = "" + value; // eslint-disable-line no-implicit-coercion
					//setting input[value] to same value by typing on focused element moves cursor to end in Chrome
					if ((vnode$$1.tag === "input" || vnode$$1.tag === "textarea") && vnode$$1.dom.value === normalized && vnode$$1.dom === $doc.activeElement) return
					//setting select[value] to same value while having select open blinks select dropdown in Chrome
					if (vnode$$1.tag === "select") {
						if (value === null) {
							if (vnode$$1.dom.selectedIndex === -1 && vnode$$1.dom === $doc.activeElement) return
						} else {
							if (old !== null && vnode$$1.dom.value === normalized && vnode$$1.dom === $doc.activeElement) return
						}
					}
					//setting option[value] to same value while having select open blinks select dropdown in Chrome
					if (vnode$$1.tag === "option" && old != null && vnode$$1.dom.value === normalized) return
				}
				// If you assign an input type that is not supported by IE 11 with an assignment expression, an error will occur.
				if (vnode$$1.tag === "input" && key === "type") {
					element.setAttribute(key, value);
					return
				}
				element[key] = value;
			}
			else {
				if (typeof value === "boolean") {
					if (value) element.setAttribute(key, "");
					else element.removeAttribute(key);
				}
				else element.setAttribute(key === "className" ? "class" : key, value);
			}
		}
		function setLateAttrs(vnode$$1) {
			var attrs = vnode$$1.attrs;
			if (vnode$$1.tag === "select" && attrs != null) {
				if ("value" in attrs) setAttr(vnode$$1, "value", null, attrs.value, undefined);
				if ("selectedIndex" in attrs) setAttr(vnode$$1, "selectedIndex", null, attrs.selectedIndex, undefined);
			}
		}
		function updateAttrs(vnode$$1, old, attrs, ns) {
			if (attrs != null) {
				for (var key in attrs) {
					setAttr(vnode$$1, key, old && old[key], attrs[key], ns);
				}
			}
			if (old != null) {
				for (var key in old) {
					if (attrs == null || !(key in attrs)) {
						if (key === "className") key = "class";
						if (key[0] === "o" && key[1] === "n" && !isLifecycleMethod(key)) updateEvent(vnode$$1, key, undefined);
						else if (key !== "key") vnode$$1.dom.removeAttribute(key);
					}
				}
			}
		}
		function isFormAttribute(vnode$$1, attr) {
			return attr === "value" || attr === "checked" || attr === "selectedIndex" || attr === "selected" && vnode$$1.dom === $doc.activeElement || vnode$$1.tag === "option" && vnode$$1.dom.parentNode === $doc.activeElement
		}
		function isLifecycleMethod(attr) {
			return attr === "oninit" || attr === "oncreate" || attr === "onupdate" || attr === "onremove" || attr === "onbeforeremove" || attr === "onbeforeupdate"
		}
		function isAttribute(attr) {
			return attr === "href" || attr === "list" || attr === "form" || attr === "width" || attr === "height"// || attr === "type"
		}
		function isCustomElement(vnode$$1){
			return vnode$$1.attrs.is || vnode$$1.tag.indexOf("-") > -1
		}
		function hasIntegrationMethods(source) {
			return source != null && (source.oncreate || source.onupdate || source.onbeforeremove || source.onremove)
		}

		//style
		function updateStyle(element, old, style) {
			if (old != null && style != null && typeof old === "object" && typeof style === "object" && style !== old) {
				// Both old & new are (different) objects.
				// Update style properties that have changed
				for (var key in style) {
					if (style[key] !== old[key]) element.style[key] = style[key];
				}
				// Remove style properties that no longer exist
				for (var key in old) {
					if (!(key in style)) element.style[key] = "";
				}
				return
			}
			if (old === style) element.style.cssText = "", old = null;
			if (style == null) element.style.cssText = "";
			else if (typeof style === "string") element.style.cssText = style;
			else {
				if (typeof old === "string") element.style.cssText = "";
				for (var key in style) {
					element.style[key] = style[key];
				}
			}
		}

		// Here's an explanation of how this works:
		// 1. The event names are always (by design) prefixed by `on`.
		// 2. The EventListener interface accepts either a function or an object
		//    with a `handleEvent` method.
		// 3. The object does not inherit from `Object.prototype`, to avoid
		//    any potential interference with that (e.g. setters).
		// 4. The event name is remapped to the handler before calling it.
		// 5. In function-based event handlers, `ev.target === this`. We replicate
		//    that below.
		function EventDict() {}
		EventDict.prototype = Object.create(null);
		EventDict.prototype.handleEvent = function (ev) {
			var handler = this["on" + ev.type];
			if (typeof handler === "function") handler.call(ev.target, ev);
			else if (typeof handler.handleEvent === "function") handler.handleEvent(ev);
			if (typeof onevent === "function") onevent.call(ev.target, ev);
		};

		//event
		function updateEvent(vnode$$1, key, value) {
			if (vnode$$1.events != null) {
				if (vnode$$1.events[key] === value) return
				if (value != null && (typeof value === "function" || typeof value === "object")) {
					if (vnode$$1.events[key] == null) vnode$$1.dom.addEventListener(key.slice(2), vnode$$1.events, false);
					vnode$$1.events[key] = value;
				} else {
					if (vnode$$1.events[key] != null) vnode$$1.dom.removeEventListener(key.slice(2), vnode$$1.events, false);
					vnode$$1.events[key] = undefined;
				}
			} else if (value != null && (typeof value === "function" || typeof value === "object")) {
				vnode$$1.events = new EventDict();
				vnode$$1.dom.addEventListener(key.slice(2), vnode$$1.events, false);
				vnode$$1.events[key] = value;
			}
		}

		//lifecycle
		function initLifecycle(source, vnode$$1, hooks) {
			if (typeof source.oninit === "function") callHook.call(source.oninit, vnode$$1);
			if (typeof source.oncreate === "function") hooks.push(callHook.bind(source.oncreate, vnode$$1));
		}
		function updateLifecycle(source, vnode$$1, hooks) {
			if (typeof source.onupdate === "function") hooks.push(callHook.bind(source.onupdate, vnode$$1));
		}
		function shouldNotUpdate(vnode$$1, old) {
			var forceVnodeUpdate, forceComponentUpdate;
			if (vnode$$1.attrs != null && typeof vnode$$1.attrs.onbeforeupdate === "function") {
				forceVnodeUpdate = callHook.call(vnode$$1.attrs.onbeforeupdate, vnode$$1, old);
			}
			if (typeof vnode$$1.tag !== "string" && typeof vnode$$1.state.onbeforeupdate === "function") {
				forceComponentUpdate = callHook.call(vnode$$1.state.onbeforeupdate, vnode$$1, old);
			}
			if (!(forceVnodeUpdate === undefined && forceComponentUpdate === undefined) && !forceVnodeUpdate && !forceComponentUpdate) {
				vnode$$1.dom = old.dom;
				vnode$$1.domSize = old.domSize;
				vnode$$1.instance = old.instance;
				return true
			}
			return false
		}

		function render(dom, vnodes) {
			if (!dom) throw new Error("Ensure the DOM element being passed to m.route/m.mount/m.render is not undefined.")
			var hooks = [];
			var active = $doc.activeElement;
			var namespace = dom.namespaceURI;

			// First time rendering into a node clears it out
			if (dom.vnodes == null) dom.textContent = "";

			if (!Array.isArray(vnodes)) vnodes = [vnodes];
			updateNodes(dom, dom.vnodes, vnode.normalizeChildren(vnodes), false, hooks, null, namespace === "http://www.w3.org/1999/xhtml" ? undefined : namespace);
			dom.vnodes = vnodes;
			// document.activeElement can return null in IE https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement
			if (active != null && $doc.activeElement !== active) active.focus();
			for (var i = 0; i < hooks.length; i++) hooks[i]();
		}

		return {render: render, setEventCallback: setEventCallback}
	};

	function throttle(callback) {
		//60fps translates to 16.6ms, round it down since setTimeout requires int
		var delay = 16;
		var last = 0, pending = null;
		var timeout = typeof requestAnimationFrame === "function" ? requestAnimationFrame : setTimeout;
		return function() {
			var elapsed = Date.now() - last;
			if (pending === null) {
				pending = timeout(function() {
					pending = null;
					callback();
					last = Date.now();
				}, delay - elapsed);
			}
		}
	}


	var redraw = function($window, throttleMock) {
		var renderService = render($window);
		renderService.setEventCallback(function(e) {
			if (e.redraw === false) e.redraw = undefined;
			else redraw();
		});

		var callbacks = [];
		var rendering = false;

		function subscribe(key, callback) {
			unsubscribe(key);
			callbacks.push(key, callback);
		}
		function unsubscribe(key) {
			var index = callbacks.indexOf(key);
			if (index > -1) callbacks.splice(index, 2);
		}
		function sync() {
			if (rendering) throw new Error("Nested m.redraw.sync() call")
			rendering = true;
			for (var i = 1; i < callbacks.length; i+=2) try {callbacks[i]();} catch (e) {if (typeof console !== "undefined") console.error(e);}
			rendering = false;
		}

		var redraw = (throttleMock || throttle)(sync);
		redraw.sync = sync;
		return {subscribe: subscribe, unsubscribe: unsubscribe, redraw: redraw, render: renderService.render}
	};

	var redraw$1 = redraw(window);

	var mount$1 = mount(redraw$1)

	function parseQueryString(string) {
		if (string === "" || string == null) return {}
		if (string.charAt(0) === "?") string = string.slice(1);

		var entries = string.split("&"), data = {}, counters = {};
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i].split("=");
			var key = decodeURIComponent(entry[0]);
			var value = entry.length === 2 ? decodeURIComponent(entry[1]) : "";

			if (value === "true") value = true;
			else if (value === "false") value = false;

			var levels = key.split(/\]\[?|\[/);
			var cursor = data;
			if (key.indexOf("[") > -1) levels.pop();
			for (var j = 0; j < levels.length; j++) {
				var level = levels[j], nextLevel = levels[j + 1];
				var isNumber = nextLevel == "" || !isNaN(parseInt(nextLevel, 10));
				var isValue = j === levels.length - 1;
				if (level === "") {
					var key = levels.slice(0, j).join();
					if (counters[key] == null) counters[key] = 0;
					level = counters[key]++;
				}
				if (cursor[level] == null) {
					cursor[level] = isValue ? value : isNumber ? [] : {};
				}
				cursor = cursor[level];
			}
		}
		return data
	}

	var parse = /*#__PURE__*/Object.freeze({
		default: parseQueryString
	});

	var render$1 = render(window);

	var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var promise = createCommonjsModule(function (module) {
	if (typeof window !== "undefined") {
		if (typeof window.Promise === "undefined") {
			window.Promise = polyfill;
		} else if (!window.Promise.prototype.finally) {
			window.Promise.prototype.finally = polyfill.prototype.finally;
		}
		module.exports = window.Promise;
	} else if (typeof commonjsGlobal !== "undefined") {
		if (typeof commonjsGlobal.Promise === "undefined") {
			commonjsGlobal.Promise = polyfill;
		} else if (!commonjsGlobal.Promise.prototype.finally) {
			commonjsGlobal.Promise.prototype.finally = polyfill.prototype.finally;
		}
		module.exports = commonjsGlobal.Promise;
	} else {
		module.exports = polyfill;
	}
	});

	var buildQueryString$1 = ( build && buildQueryString ) || build;

	var FILE_PROTOCOL_REGEX = new RegExp("^file://", "i");

	var request = function($window, Promise) {
		var callbackCount = 0;

		var oncompletion;
		function setCompletionCallback(callback) {oncompletion = callback;}

		function finalizer() {
			var count = 0;
			function complete() {if (--count === 0 && typeof oncompletion === "function") oncompletion();}

			return function finalize(promise) {
				var then = promise.then;
				promise.then = function() {
					count++;
					var next = then.apply(promise, arguments);
					next.then(complete, function(e) {
						complete();
						if (count === 0) throw e
					});
					return finalize(next)
				};
				return promise
			}
		}
		function normalize(args, extra) {
			if (typeof args === "string") {
				var url = args;
				args = extra || {};
				if (args.url == null) args.url = url;
			}
			return args
		}

		function request(args, extra) {
			var finalize = finalizer();
			args = normalize(args, extra);

			var promise = new Promise(function(resolve, reject) {
				if (args.method == null) args.method = "GET";
				args.method = args.method.toUpperCase();

				var useBody = (args.method === "GET" || args.method === "TRACE") ? false : (typeof args.useBody === "boolean" ? args.useBody : true);

				if (typeof args.serialize !== "function") args.serialize = typeof FormData !== "undefined" && args.data instanceof FormData ? function(value) {return value} : JSON.stringify;
				if (typeof args.deserialize !== "function") args.deserialize = deserialize;
				if (typeof args.extract !== "function") args.extract = extract;

				args.url = interpolate(args.url, args.data);
				if (useBody) args.data = args.serialize(args.data);
				else args.url = assemble(args.url, args.data);

				var xhr = new $window.XMLHttpRequest(),
					aborted = false,
					_abort = xhr.abort;


				xhr.abort = function abort() {
					aborted = true;
					_abort.call(xhr);
				};

				xhr.open(args.method, args.url, typeof args.async === "boolean" ? args.async : true, typeof args.user === "string" ? args.user : undefined, typeof args.password === "string" ? args.password : undefined);

				if (args.serialize === JSON.stringify && useBody && !(args.headers && args.headers.hasOwnProperty("Content-Type"))) {
					xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
				}
				if (args.deserialize === deserialize && !(args.headers && args.headers.hasOwnProperty("Accept"))) {
					xhr.setRequestHeader("Accept", "application/json, text/*");
				}
				if (args.withCredentials) xhr.withCredentials = args.withCredentials;

				if (args.timeout) xhr.timeout = args.timeout;

				for (var key in args.headers) if ({}.hasOwnProperty.call(args.headers, key)) {
					xhr.setRequestHeader(key, args.headers[key]);
				}

				if (typeof args.config === "function") xhr = args.config(xhr, args) || xhr;

				xhr.onreadystatechange = function() {
					// Don't throw errors on xhr.abort().
					if(aborted) return

					if (xhr.readyState === 4) {
						try {
							var response = (args.extract !== extract) ? args.extract(xhr, args) : args.deserialize(args.extract(xhr, args));
							if (args.extract !== extract || (xhr.status >= 200 && xhr.status < 300) || xhr.status === 304 || FILE_PROTOCOL_REGEX.test(args.url)) {
								resolve(cast(args.type, response));
							}
							else {
								var error = new Error(xhr.responseText);
								error.code = xhr.status;
								error.response = response;
								reject(error);
							}
						}
						catch (e) {
							reject(e);
						}
					}
				};

				if (useBody && (args.data != null)) xhr.send(args.data);
				else xhr.send();
			});
			return args.background === true ? promise : finalize(promise)
		}

		function jsonp(args, extra) {
			var finalize = finalizer();
			args = normalize(args, extra);

			var promise = new Promise(function(resolve, reject) {
				var callbackName = args.callbackName || "_mithril_" + Math.round(Math.random() * 1e16) + "_" + callbackCount++;
				var script = $window.document.createElement("script");
				$window[callbackName] = function(data) {
					script.parentNode.removeChild(script);
					resolve(cast(args.type, data));
					delete $window[callbackName];
				};
				script.onerror = function() {
					script.parentNode.removeChild(script);
					reject(new Error("JSONP request failed"));
					delete $window[callbackName];
				};
				if (args.data == null) args.data = {};
				args.url = interpolate(args.url, args.data);
				args.data[args.callbackKey || "callback"] = callbackName;
				script.src = assemble(args.url, args.data);
				$window.document.documentElement.appendChild(script);
			});
			return args.background === true? promise : finalize(promise)
		}

		function interpolate(url, data) {
			if (data == null) return url

			var tokens = url.match(/:[^\/]+/gi) || [];
			for (var i = 0; i < tokens.length; i++) {
				var key = tokens[i].slice(1);
				if (data[key] != null) {
					url = url.replace(tokens[i], data[key]);
				}
			}
			return url
		}

		function assemble(url, data) {
			var querystring = buildQueryString$1(data);
			if (querystring !== "") {
				var prefix = url.indexOf("?") < 0 ? "?" : "&";
				url += prefix + querystring;
			}
			return url
		}

		function deserialize(data) {
			try {return data !== "" ? JSON.parse(data) : null}
			catch (e) {throw new Error(data)}
		}

		function extract(xhr) {return xhr.responseText}

		function cast(type, data) {
			if (typeof type === "function") {
				if (Array.isArray(data)) {
					for (var i = 0; i < data.length; i++) {
						data[i] = new type(data[i]);
					}
				}
				else return new type(data)
			}
			return data
		}

		return {request: request, jsonp: jsonp, setCompletionCallback: setCompletionCallback}
	};

	var request$1 = request(window, promise);

	var parseQueryString$1 = ( parse && parseQueryString ) || parse;

	var router = function($window) {
		var supportsPushState = typeof $window.history.pushState === "function";
		var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout;

		function normalize(fragment) {
			var data = $window.location[fragment].replace(/(?:%[a-f89][a-f0-9])+/gim, decodeURIComponent);
			if (fragment === "pathname" && data[0] !== "/") data = "/" + data;
			return data
		}

		var asyncId;
		function debounceAsync(callback) {
			return function() {
				if (asyncId != null) return
				asyncId = callAsync(function() {
					asyncId = null;
					callback();
				});
			}
		}

		function parsePath(path, queryData, hashData) {
			var queryIndex = path.indexOf("?");
			var hashIndex = path.indexOf("#");
			var pathEnd = queryIndex > -1 ? queryIndex : hashIndex > -1 ? hashIndex : path.length;
			if (queryIndex > -1) {
				var queryEnd = hashIndex > -1 ? hashIndex : path.length;
				var queryParams = parseQueryString$1(path.slice(queryIndex + 1, queryEnd));
				for (var key in queryParams) queryData[key] = queryParams[key];
			}
			if (hashIndex > -1) {
				var hashParams = parseQueryString$1(path.slice(hashIndex + 1));
				for (var key in hashParams) hashData[key] = hashParams[key];
			}
			return path.slice(0, pathEnd)
		}

		var router = {prefix: "#!"};
		router.getPath = function() {
			var type = router.prefix.charAt(0);
			switch (type) {
				case "#": return normalize("hash").slice(router.prefix.length)
				case "?": return normalize("search").slice(router.prefix.length) + normalize("hash")
				default: return normalize("pathname").slice(router.prefix.length) + normalize("search") + normalize("hash")
			}
		};
		router.setPath = function(path, data, options) {
			var queryData = {}, hashData = {};
			path = parsePath(path, queryData, hashData);
			if (data != null) {
				for (var key in data) queryData[key] = data[key];
				path = path.replace(/:([^\/]+)/g, function(match, token) {
					delete queryData[token];
					return data[token]
				});
			}

			var query = buildQueryString$1(queryData);
			if (query) path += "?" + query;

			var hash = buildQueryString$1(hashData);
			if (hash) path += "#" + hash;

			if (supportsPushState) {
				var state = options ? options.state : null;
				var title = options ? options.title : null;
				$window.onpopstate();
				if (options && options.replace) $window.history.replaceState(state, title, router.prefix + path);
				else $window.history.pushState(state, title, router.prefix + path);
			}
			else $window.location.href = router.prefix + path;
		};
		router.defineRoutes = function(routes, resolve, reject) {
			function resolveRoute() {
				var path = router.getPath();
				var params = {};
				var pathname = parsePath(path, params, params);

				var state = $window.history.state;
				if (state != null) {
					for (var k in state) params[k] = state[k];
				}
				for (var route in routes) {
					var matcher = new RegExp("^" + route.replace(/:[^\/]+?\.{3}/g, "(.*?)").replace(/:[^\/]+/g, "([^\\/]+)") + "\/?$");

					if (matcher.test(pathname)) {
						pathname.replace(matcher, function() {
							var keys = route.match(/:[^\/]+/g) || [];
							var values = [].slice.call(arguments, 1, -2);
							for (var i = 0; i < keys.length; i++) {
								params[keys[i].replace(/:|\./g, "")] = decodeURIComponent(values[i]);
							}
							resolve(routes[route], params, path, route);
						});
						return
					}
				}

				reject(path, params);
			}

			if (supportsPushState) $window.onpopstate = debounceAsync(resolveRoute);
			else if (router.prefix.charAt(0) === "#") $window.onhashchange = resolveRoute;
			resolveRoute();
		};

		return router
	};

	var router$1 = function($window, redrawService) {
		var routeService = router($window);

		var identity = function(v) {return v};
		var render, component, attrs, currentPath, lastUpdate;
		var route = function(root, defaultRoute, routes) {
			if (root == null) throw new Error("Ensure the DOM element that was passed to `m.route` is not undefined")
			function run() {
				if (render != null) redrawService.render(root, render(vnode(component, attrs.key, attrs)));
			}
			var redraw = function() {
				run();
				redraw = redrawService.redraw;
			};
			redrawService.subscribe(root, run);
			var bail = function(path) {
				if (path !== defaultRoute) routeService.setPath(defaultRoute, null, {replace: true});
				else throw new Error("Could not resolve default route " + defaultRoute)
			};
			routeService.defineRoutes(routes, function(payload, params, path) {
				var update = lastUpdate = function(routeResolver, comp) {
					if (update !== lastUpdate) return
					component = comp != null && (typeof comp.view === "function" || typeof comp === "function")? comp : "div";
					attrs = params, currentPath = path, lastUpdate = null;
					render = (routeResolver.render || identity).bind(routeResolver);
					redraw();
				};
				if (payload.view || typeof payload === "function") update({}, payload);
				else {
					if (payload.onmatch) {
						promise.resolve(payload.onmatch(params, path)).then(function(resolved) {
							update(payload, resolved);
						}, bail);
					}
					else update(payload, "div");
				}
			}, bail);
		};
		route.set = function(path, data, options) {
			if (lastUpdate != null) {
				options = options || {};
				options.replace = true;
			}
			lastUpdate = null;
			routeService.setPath(path, data, options);
		};
		route.get = function() {return currentPath};
		route.prefix = function(prefix) {routeService.prefix = prefix;};
		var link = function(options, vnode$$1) {
			vnode$$1.dom.setAttribute("href", routeService.prefix + vnode$$1.attrs.href);
			vnode$$1.dom.onclick = function(e) {
				if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) return
				e.preventDefault();
				e.redraw = false;
				var href = this.getAttribute("href");
				if (href.indexOf(routeService.prefix) === 0) href = href.slice(routeService.prefix.length);
				route.set(href, undefined, options);
			};
		};
		route.link = function(args) {
			if (args.tag == null) return link.bind(link, args)
			return link({}, args)
		};
		route.param = function(key) {
			if(typeof attrs !== "undefined" && typeof key !== "undefined") return attrs[key]
			return attrs
		};

		return route
	};

	var route = router$1(window, redraw$1);

	var withAttr = function(attrName, callback, context) {
		return function(e) {
			callback.call(context || this, attrName in e.currentTarget ? e.currentTarget[attrName] : e.currentTarget.getAttribute(attrName));
		}
	};

	request$1.setCompletionCallback(redraw$1.redraw);

	hyperscript_1$1.version = "bleeding-edge";

	hyperscript_1$1.PromisePolyfill = polyfill;

	hyperscript_1$1.buildQueryString = buildQueryString;
	hyperscript_1$1.jsonp = request$1.jsonp;
	hyperscript_1$1.mount = mount$1;
	hyperscript_1$1.parseQueryString = parseQueryString;
	hyperscript_1$1.redraw = redraw$1.redraw;
	hyperscript_1$1.render = render$1;
	hyperscript_1$1.request = request$1.request;
	hyperscript_1$1.route = route;
	hyperscript_1$1.vnode = vnode;
	hyperscript_1$1.withAttr = withAttr;

	return hyperscript_1$1;

})));
