(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.m = factory());
}(this, (function () { 'use strict';

function Vnode(tag, key, attrs, children, text, dom) {
	return {tag: tag, key: key, attrs: attrs, children: children, text: text, dom: dom, domSize: undefined, state: undefined, _state: undefined, events: undefined, instance: undefined, skip: false}
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

var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g;
var selectorCache = {};
var hasOwn = {}.hasOwnProperty;

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

	return Vnode(state.tag, attrs.key, hasAttrs ? attrs : undefined, childList, text)
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

	var normalized = Vnode.normalizeChildren(children);

	if (typeof selector === "string") {
		return execSelector(cached, attrs, normalized)
	} else {
		return Vnode(selector, attrs.key, attrs, normalized)
	}
}

var fragment = function(attrs, children) {
	return Vnode("[", attrs.key, attrs, Vnode.normalizeChildren(children), undefined, undefined)
};

var trust = function(html) {
	if (html == null) html = "";
	return Vnode("<", undefined, undefined, html, undefined, undefined)
};

hyperscript.fragment = fragment;
hyperscript.trust = trust;

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

var promisePolyfill = function() {
	if (typeof window !== "undefined") {
		if (typeof window.Promise === "undefined") window.Promise = PromisePolyfill;
		return window.Promise
	} else if (typeof global !== "undefined") {
		if (typeof global.Promise === "undefined") global.Promise = PromisePolyfill;
		return global.Promise
	} else {
		return PromisePolyfill
	}
};

var buildQueryString = function(object) {
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
};

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

			if (args.serialize === JSON.stringify && useBody) {
				xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
			}
			if (args.deserialize === deserialize) {
				xhr.setRequestHeader("Accept", "application/json, text/*");
			}
			if (args.withCredentials) xhr.withCredentials = args.withCredentials;

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
						if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304 || FILE_PROTOCOL_REGEX.test(args.url)) {
							resolve(cast(args.type, response));
						}
						else {
							var error = new Error(xhr.responseText);
							for (var key in response) error[key] = response[key];
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
		var querystring = buildQueryString(data);
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

var requestService = request(window, promisePolyfill());

var render = function($window) {
	var $doc = $window.document;
	var $emptyFragment = $doc.createDocumentFragment();

	var nameSpace = {
		svg: "http://www.w3.org/2000/svg",
		math: "http://www.w3.org/1998/Math/MathML"
	};

	var onevent;
	function setEventCallback(callback) {return onevent = callback}

	function getNameSpace(vnode) {
		return vnode.attrs && vnode.attrs.xmlns || nameSpace[vnode.tag]
	}

	//create
	function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
		for (var i = start; i < end; i++) {
			var vnode = vnodes[i];
			if (vnode != null) {
				createNode(parent, vnode, hooks, ns, nextSibling);
			}
		}
	}
	function createNode(parent, vnode, hooks, ns, nextSibling) {
		var tag = vnode.tag;
		if (typeof tag === "string") {
			vnode.state = {};
			if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks);
			switch (tag) {
				case "#": return createText(parent, vnode, nextSibling)
				case "<": return createHTML(parent, vnode, nextSibling)
				case "[": return createFragment(parent, vnode, hooks, ns, nextSibling)
				default: return createElement(parent, vnode, hooks, ns, nextSibling)
			}
		}
		else return createComponent(parent, vnode, hooks, ns, nextSibling)
	}
	function createText(parent, vnode, nextSibling) {
		vnode.dom = $doc.createTextNode(vnode.children);
		insertNode(parent, vnode.dom, nextSibling);
		return vnode.dom
	}
	function createHTML(parent, vnode, nextSibling) {
		var match = vnode.children.match(/^\s*?<(\w+)/im) || [];
		var parent1 = {caption: "table", thead: "table", tbody: "table", tfoot: "table", tr: "tbody", th: "tr", td: "tr", colgroup: "table", col: "colgroup"}[match[1]] || "div";
		var temp = $doc.createElement(parent1);

		temp.innerHTML = vnode.children;
		vnode.dom = temp.firstChild;
		vnode.domSize = temp.childNodes.length;
		var fragment = $doc.createDocumentFragment();
		var child;
		while (child = temp.firstChild) {
			fragment.appendChild(child);
		}
		insertNode(parent, fragment, nextSibling);
		return fragment
	}
	function createFragment(parent, vnode, hooks, ns, nextSibling) {
		var fragment = $doc.createDocumentFragment();
		if (vnode.children != null) {
			var children = vnode.children;
			createNodes(fragment, children, 0, children.length, hooks, null, ns);
		}
		vnode.dom = fragment.firstChild;
		vnode.domSize = fragment.childNodes.length;
		insertNode(parent, fragment, nextSibling);
		return fragment
	}
	function createElement(parent, vnode, hooks, ns, nextSibling) {
		var tag = vnode.tag;
		var attrs = vnode.attrs;
		var is = attrs && attrs.is;

		ns = getNameSpace(vnode) || ns;

		var element = ns ?
			is ? $doc.createElementNS(ns, tag, {is: is}) : $doc.createElementNS(ns, tag) :
			is ? $doc.createElement(tag, {is: is}) : $doc.createElement(tag);
		vnode.dom = element;

		if (attrs != null) {
			setAttrs(vnode, attrs, ns);
		}

		insertNode(parent, element, nextSibling);

		if (vnode.attrs != null && vnode.attrs.contenteditable != null) {
			setContentEditable(vnode);
		}
		else {
			if (vnode.text != null) {
				if (vnode.text !== "") element.textContent = vnode.text;
				else vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)];
			}
			if (vnode.children != null) {
				var children = vnode.children;
				createNodes(element, children, 0, children.length, hooks, null, ns);
				setLateAttrs(vnode);
			}
		}
		return element
	}
	function initComponent(vnode, hooks) {
		var sentinel;
		if (typeof vnode.tag.view === "function") {
			vnode.state = Object.create(vnode.tag);
			sentinel = vnode.state.view;
			if (sentinel.$$reentrantLock$$ != null) return $emptyFragment
			sentinel.$$reentrantLock$$ = true;
		} else {
			vnode.state = void 0;
			sentinel = vnode.tag;
			if (sentinel.$$reentrantLock$$ != null) return $emptyFragment
			sentinel.$$reentrantLock$$ = true;
			vnode.state = (vnode.tag.prototype != null && typeof vnode.tag.prototype.view === "function") ? new vnode.tag(vnode) : vnode.tag(vnode);
		}
		vnode._state = vnode.state;
		if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks);
		initLifecycle(vnode._state, vnode, hooks);
		vnode.instance = Vnode.normalize(vnode._state.view.call(vnode.state, vnode));
		if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as argument")
		sentinel.$$reentrantLock$$ = null;
	}
	function createComponent(parent, vnode, hooks, ns, nextSibling) {
		initComponent(vnode, hooks);
		if (vnode.instance != null) {
			var element = createNode(parent, vnode.instance, hooks, ns, nextSibling);
			vnode.dom = vnode.instance.dom;
			vnode.domSize = vnode.dom != null ? vnode.instance.domSize : 0;
			insertNode(parent, element, nextSibling);
			return element
		}
		else {
			vnode.domSize = 0;
			return $emptyFragment
		}
	}

	//update
	function updateNodes(parent, old, vnodes, recycling, hooks, nextSibling, ns) {
		if (old === vnodes || old == null && vnodes == null) return
		else if (old == null) createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, ns);
		else if (vnodes == null) removeNodes(old, 0, old.length, vnodes);
		else {
			if (old.length === vnodes.length) {
				var isUnkeyed = false;
				for (var i = 0; i < vnodes.length; i++) {
					if (vnodes[i] != null && old[i] != null) {
						isUnkeyed = vnodes[i].key == null && old[i].key == null;
						break
					}
				}
				if (isUnkeyed) {
					for (var i = 0; i < old.length; i++) {
						if (old[i] === vnodes[i]) continue
						else if (old[i] == null && vnodes[i] != null) createNode(parent, vnodes[i], hooks, ns, getNextSibling(old, i + 1, nextSibling));
						else if (vnodes[i] == null) removeNodes(old, i, i + 1, vnodes);
						else updateNode(parent, old[i], vnodes[i], hooks, getNextSibling(old, i + 1, nextSibling), recycling, ns);
					}
					return
				}
			}
			recycling = recycling || isRecyclable(old, vnodes);
			if (recycling) {
				var pool = old.pool;
				old = old.concat(old.pool);
			}

			var oldStart = 0, start = 0, oldEnd = old.length - 1, end = vnodes.length - 1, map;
			while (oldEnd >= oldStart && end >= start) {
				var o = old[oldStart], v = vnodes[start];
				if (o === v && !recycling) oldStart++, start++;
				else if (o == null) oldStart++;
				else if (v == null) start++;
				else if (o.key === v.key) {
					var shouldRecycle = (pool != null && oldStart >= old.length - pool.length) || ((pool == null) && recycling);
					oldStart++, start++;
					updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, nextSibling), shouldRecycle, ns);
					if (recycling && o.tag === v.tag) insertNode(parent, toFragment(o), nextSibling);
				}
				else {
					var o = old[oldEnd];
					if (o === v && !recycling) oldEnd--, start++;
					else if (o == null) oldEnd--;
					else if (v == null) start++;
					else if (o.key === v.key) {
						var shouldRecycle = (pool != null && oldEnd >= old.length - pool.length) || ((pool == null) && recycling);
						updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), shouldRecycle, ns);
						if (recycling || start < end) insertNode(parent, toFragment(o), getNextSibling(old, oldStart, nextSibling));
						oldEnd--, start++;
					}
					else break
				}
			}
			while (oldEnd >= oldStart && end >= start) {
				var o = old[oldEnd], v = vnodes[end];
				if (o === v && !recycling) oldEnd--, end--;
				else if (o == null) oldEnd--;
				else if (v == null) end--;
				else if (o.key === v.key) {
					var shouldRecycle = (pool != null && oldEnd >= old.length - pool.length) || ((pool == null) && recycling);
					updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), shouldRecycle, ns);
					if (recycling && o.tag === v.tag) insertNode(parent, toFragment(o), nextSibling);
					if (o.dom != null) nextSibling = o.dom;
					oldEnd--, end--;
				}
				else {
					if (!map) map = getKeyMap(old, oldEnd);
					if (v != null) {
						var oldIndex = map[v.key];
						if (oldIndex != null) {
							var movable = old[oldIndex];
							var shouldRecycle = (pool != null && oldIndex >= old.length - pool.length) || ((pool == null) && recycling);
							updateNode(parent, movable, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), recycling, ns);
							insertNode(parent, toFragment(movable), nextSibling);
							old[oldIndex].skip = true;
							if (movable.dom != null) nextSibling = movable.dom;
						}
						else {
							var dom = createNode(parent, v, hooks, ns, nextSibling);
							nextSibling = dom;
						}
					}
					end--;
				}
				if (end < start) break
			}
			createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
			removeNodes(old, oldStart, oldEnd + 1, vnodes);
		}
	}
	function updateNode(parent, old, vnode, hooks, nextSibling, recycling, ns) {
		var oldTag = old.tag, tag = vnode.tag;
		if (oldTag === tag) {
			vnode.state = old.state;
			vnode._state = old._state;
			vnode.events = old.events;
			if (!recycling && shouldNotUpdate(vnode, old)) return
			if (typeof oldTag === "string") {
				if (vnode.attrs != null) {
					if (recycling) {
						vnode.state = {};
						initLifecycle(vnode.attrs, vnode, hooks);
					}
					else updateLifecycle(vnode.attrs, vnode, hooks);
				}
				switch (oldTag) {
					case "#": updateText(old, vnode); break
					case "<": updateHTML(parent, old, vnode, nextSibling); break
					case "[": updateFragment(parent, old, vnode, recycling, hooks, nextSibling, ns); break
					default: updateElement(old, vnode, recycling, hooks, ns);
				}
			}
			else updateComponent(parent, old, vnode, hooks, nextSibling, recycling, ns);
		}
		else {
			removeNode(old, null);
			createNode(parent, vnode, hooks, ns, nextSibling);
		}
	}
	function updateText(old, vnode) {
		if (old.children.toString() !== vnode.children.toString()) {
			old.dom.nodeValue = vnode.children;
		}
		vnode.dom = old.dom;
	}
	function updateHTML(parent, old, vnode, nextSibling) {
		if (old.children !== vnode.children) {
			toFragment(old);
			createHTML(parent, vnode, nextSibling);
		}
		else vnode.dom = old.dom, vnode.domSize = old.domSize;
	}
	function updateFragment(parent, old, vnode, recycling, hooks, nextSibling, ns) {
		updateNodes(parent, old.children, vnode.children, recycling, hooks, nextSibling, ns);
		var domSize = 0, children = vnode.children;
		vnode.dom = null;
		if (children != null) {
			for (var i = 0; i < children.length; i++) {
				var child = children[i];
				if (child != null && child.dom != null) {
					if (vnode.dom == null) vnode.dom = child.dom;
					domSize += child.domSize || 1;
				}
			}
			if (domSize !== 1) vnode.domSize = domSize;
		}
	}
	function updateElement(old, vnode, recycling, hooks, ns) {
		var element = vnode.dom = old.dom;
		ns = getNameSpace(vnode) || ns;

		if (vnode.tag === "textarea") {
			if (vnode.attrs == null) vnode.attrs = {};
			if (vnode.text != null) {
				vnode.attrs.value = vnode.text; //FIXME handle multiple children
				vnode.text = undefined;
			}
		}
		updateAttrs(vnode, old.attrs, vnode.attrs, ns);
		if (vnode.attrs != null && vnode.attrs.contenteditable != null) {
			setContentEditable(vnode);
		}
		else if (old.text != null && vnode.text != null && vnode.text !== "") {
			if (old.text.toString() !== vnode.text.toString()) old.dom.firstChild.nodeValue = vnode.text;
		}
		else {
			if (old.text != null) old.children = [Vnode("#", undefined, undefined, old.text, undefined, old.dom.firstChild)];
			if (vnode.text != null) vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)];
			updateNodes(element, old.children, vnode.children, recycling, hooks, null, ns);
		}
	}
	function updateComponent(parent, old, vnode, hooks, nextSibling, recycling, ns) {
		if (recycling) {
			initComponent(vnode, hooks);
		} else {
			vnode.instance = Vnode.normalize(vnode._state.view.call(vnode.state, vnode));
			if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as argument")
			if (vnode.attrs != null) updateLifecycle(vnode.attrs, vnode, hooks);
			updateLifecycle(vnode._state, vnode, hooks);
		}
		if (vnode.instance != null) {
			if (old.instance == null) createNode(parent, vnode.instance, hooks, ns, nextSibling);
			else updateNode(parent, old.instance, vnode.instance, hooks, nextSibling, recycling, ns);
			vnode.dom = vnode.instance.dom;
			vnode.domSize = vnode.instance.domSize;
		}
		else if (old.instance != null) {
			removeNode(old.instance, null);
			vnode.dom = undefined;
			vnode.domSize = 0;
		}
		else {
			vnode.dom = old.dom;
			vnode.domSize = old.domSize;
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
			var vnode = vnodes[i];
			if (vnode != null) {
				var key = vnode.key;
				if (key != null) map[key] = i;
			}
		}
		return map
	}
	function toFragment(vnode) {
		var count = vnode.domSize;
		if (count != null || vnode.dom == null) {
			var fragment = $doc.createDocumentFragment();
			if (count > 0) {
				var dom = vnode.dom;
				while (--count) fragment.appendChild(dom.nextSibling);
				fragment.insertBefore(dom, fragment.firstChild);
			}
			return fragment
		}
		else return vnode.dom
	}
	function getNextSibling(vnodes, i, nextSibling) {
		for (; i < vnodes.length; i++) {
			if (vnodes[i] != null && vnodes[i].dom != null) return vnodes[i].dom
		}
		return nextSibling
	}

	function insertNode(parent, dom, nextSibling) {
		if (nextSibling && nextSibling.parentNode) parent.insertBefore(dom, nextSibling);
		else parent.appendChild(dom);
	}

	function setContentEditable(vnode) {
		var children = vnode.children;
		if (children != null && children.length === 1 && children[0].tag === "<") {
			var content = children[0].children;
			if (vnode.dom.innerHTML !== content) vnode.dom.innerHTML = content;
		}
		else if (vnode.text != null || children != null && children.length !== 0) throw new Error("Child node of a contenteditable must be trusted")
	}

	//remove
	function removeNodes(vnodes, start, end, context) {
		for (var i = start; i < end; i++) {
			var vnode = vnodes[i];
			if (vnode != null) {
				if (vnode.skip) vnode.skip = false;
				else removeNode(vnode, context);
			}
		}
	}
	function removeNode(vnode, context) {
		var expected = 1, called = 0;
		if (vnode.attrs && typeof vnode.attrs.onbeforeremove === "function") {
			var result = vnode.attrs.onbeforeremove.call(vnode.state, vnode);
			if (result != null && typeof result.then === "function") {
				expected++;
				result.then(continuation, continuation);
			}
		}
		if (typeof vnode.tag !== "string" && typeof vnode._state.onbeforeremove === "function") {
			var result = vnode._state.onbeforeremove.call(vnode.state, vnode);
			if (result != null && typeof result.then === "function") {
				expected++;
				result.then(continuation, continuation);
			}
		}
		continuation();
		function continuation() {
			if (++called === expected) {
				onremove(vnode);
				if (vnode.dom) {
					var count = vnode.domSize || 1;
					if (count > 1) {
						var dom = vnode.dom;
						while (--count) {
							removeNodeFromDOM(dom.nextSibling);
						}
					}
					removeNodeFromDOM(vnode.dom);
					if (context != null && vnode.domSize == null && !hasIntegrationMethods(vnode.attrs) && typeof vnode.tag === "string") { //TODO test custom elements
						if (!context.pool) context.pool = [vnode];
						else context.pool.push(vnode);
					}
				}
			}
		}
	}
	function removeNodeFromDOM(node) {
		var parent = node.parentNode;
		if (parent != null) parent.removeChild(node);
	}
	function onremove(vnode) {
		if (vnode.attrs && typeof vnode.attrs.onremove === "function") vnode.attrs.onremove.call(vnode.state, vnode);
		if (typeof vnode.tag !== "string" && typeof vnode._state.onremove === "function") vnode._state.onremove.call(vnode.state, vnode);
		if (vnode.instance != null) onremove(vnode.instance);
		else {
			var children = vnode.children;
			if (Array.isArray(children)) {
				for (var i = 0; i < children.length; i++) {
					var child = children[i];
					if (child != null) onremove(child);
				}
			}
		}
	}

	//attrs
	function setAttrs(vnode, attrs, ns) {
		for (var key in attrs) {
			setAttr(vnode, key, null, attrs[key], ns);
		}
	}
	function setAttr(vnode, key, old, value, ns) {
		var element = vnode.dom;
		if (key === "key" || key === "is" || (old === value && !isFormAttribute(vnode, key)) && typeof value !== "object" || typeof value === "undefined" || isLifecycleMethod(key)) return
		var nsLastIndex = key.indexOf(":");
		if (nsLastIndex > -1 && key.substr(0, nsLastIndex) === "xlink") {
			element.setAttributeNS("http://www.w3.org/1999/xlink", key.slice(nsLastIndex + 1), value);
		}
		else if (key[0] === "o" && key[1] === "n" && typeof value === "function") updateEvent(vnode, key, value);
		else if (key === "style") updateStyle(element, old, value);
		else if (key in element && !isAttribute(key) && ns === undefined && !isCustomElement(vnode)) {
			if (key === "value") {
				var normalized = "" + value; // eslint-disable-line no-implicit-coercion
				//setting input[value] to same value by typing on focused element moves cursor to end in Chrome
				if ((vnode.tag === "input" || vnode.tag === "textarea") && vnode.dom.value === normalized && vnode.dom === $doc.activeElement) return
				//setting select[value] to same value while having select open blinks select dropdown in Chrome
				if (vnode.tag === "select") {
					if (value === null) {
						if (vnode.dom.selectedIndex === -1 && vnode.dom === $doc.activeElement) return
					} else {
						if (old !== null && vnode.dom.value === normalized && vnode.dom === $doc.activeElement) return
					}
				}
				//setting option[value] to same value while having select open blinks select dropdown in Chrome
				if (vnode.tag === "option" && old != null && vnode.dom.value === normalized) return
			}
			// If you assign an input type that is not supported by IE 11 with an assignment expression, an error will occur.
			if (vnode.tag === "input" && key === "type") {
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
	function setLateAttrs(vnode) {
		var attrs = vnode.attrs;
		if (vnode.tag === "select" && attrs != null) {
			if ("value" in attrs) setAttr(vnode, "value", null, attrs.value, undefined);
			if ("selectedIndex" in attrs) setAttr(vnode, "selectedIndex", null, attrs.selectedIndex, undefined);
		}
	}
	function updateAttrs(vnode, old, attrs, ns) {
		if (attrs != null) {
			for (var key in attrs) {
				setAttr(vnode, key, old && old[key], attrs[key], ns);
			}
		}
		if (old != null) {
			for (var key in old) {
				if (attrs == null || !(key in attrs)) {
					if (key === "className") key = "class";
					if (key[0] === "o" && key[1] === "n" && !isLifecycleMethod(key)) updateEvent(vnode, key, undefined);
					else if (key !== "key") vnode.dom.removeAttribute(key);
				}
			}
		}
	}
	function isFormAttribute(vnode, attr) {
		return attr === "value" || attr === "checked" || attr === "selectedIndex" || attr === "selected" && vnode.dom === $doc.activeElement
	}
	function isLifecycleMethod(attr) {
		return attr === "oninit" || attr === "oncreate" || attr === "onupdate" || attr === "onremove" || attr === "onbeforeremove" || attr === "onbeforeupdate"
	}
	function isAttribute(attr) {
		return attr === "href" || attr === "list" || attr === "form" || attr === "width" || attr === "height"// || attr === "type"
	}
	function isCustomElement(vnode){
		return vnode.attrs.is || vnode.tag.indexOf("-") > -1
	}
	function hasIntegrationMethods(source) {
		return source != null && (source.oncreate || source.onupdate || source.onbeforeremove || source.onremove)
	}

	//style
	function updateStyle(element, old, style) {
		if (old === style) element.style.cssText = "", old = null;
		if (style == null) element.style.cssText = "";
		else if (typeof style === "string") element.style.cssText = style;
		else {
			if (typeof old === "string") element.style.cssText = "";
			for (var key in style) {
				element.style[key] = style[key];
			}
			if (old != null && typeof old !== "string") {
				for (var key in old) {
					if (!(key in style)) element.style[key] = "";
				}
			}
		}
	}

	//event
	function updateEvent(vnode, key, value) {
		var element = vnode.dom;
		var callback = typeof onevent !== "function" ? value : function(e) {
			var result = value.call(element, e);
			onevent.call(element, e);
			return result
		};
		if (key in element) element[key] = typeof value === "function" ? callback : null;
		else {
			var eventName = key.slice(2);
			if (vnode.events === undefined) vnode.events = {};
			if (vnode.events[key] === callback) return
			if (vnode.events[key] != null) element.removeEventListener(eventName, vnode.events[key], false);
			if (typeof value === "function") {
				vnode.events[key] = callback;
				element.addEventListener(eventName, vnode.events[key], false);
			}
		}
	}

	//lifecycle
	function initLifecycle(source, vnode, hooks) {
		if (typeof source.oninit === "function") source.oninit.call(vnode.state, vnode);
		if (typeof source.oncreate === "function") hooks.push(source.oncreate.bind(vnode.state, vnode));
	}
	function updateLifecycle(source, vnode, hooks) {
		if (typeof source.onupdate === "function") hooks.push(source.onupdate.bind(vnode.state, vnode));
	}
	function shouldNotUpdate(vnode, old) {
		var forceVnodeUpdate, forceComponentUpdate;
		if (vnode.attrs != null && typeof vnode.attrs.onbeforeupdate === "function") forceVnodeUpdate = vnode.attrs.onbeforeupdate.call(vnode.state, vnode, old);
		if (typeof vnode.tag !== "string" && typeof vnode._state.onbeforeupdate === "function") forceComponentUpdate = vnode._state.onbeforeupdate.call(vnode.state, vnode, old);
		if (!(forceVnodeUpdate === undefined && forceComponentUpdate === undefined) && !forceVnodeUpdate && !forceComponentUpdate) {
			vnode.dom = old.dom;
			vnode.domSize = old.domSize;
			vnode.instance = old.instance;
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
		updateNodes(dom, dom.vnodes, Vnode.normalizeChildren(vnodes), false, hooks, null, namespace === "http://www.w3.org/1999/xhtml" ? undefined : namespace);
		dom.vnodes = vnodes;
		for (var i = 0; i < hooks.length; i++) hooks[i]();
		if ($doc.activeElement !== active) active.focus();
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
		for (var i = 1; i < callbacks.length; i+=2) try {callbacks[i]();} catch (e) {/*noop*/}
		rendering = false;
	}

	var redraw = (throttleMock || throttle)(sync);
	redraw.sync = sync;
	return {subscribe: subscribe, unsubscribe: unsubscribe, redraw: redraw, render: renderService.render}
};

var redrawService = redraw(window);

var mount$1 = function(redrawService) {
	return function(root, component) {
		if (component === null) {
			redrawService.render(root, []);
			redrawService.unsubscribe(root);
			return
		}

		if (component.view == null && typeof component !== "function") throw new Error("m.mount(element, component) expects a component, not a vnode")

		var run = function() {
			redrawService.render(root, Vnode(component));
		};
		redrawService.subscribe(root, run);
		run();
	}
};

var mount = mount$1(redrawService);

var parseQueryString = function(string) {
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
};

var coreRouter = function($window) {
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
			var queryParams = parseQueryString(path.slice(queryIndex + 1, queryEnd));
			for (var key in queryParams) queryData[key] = queryParams[key];
		}
		if (hashIndex > -1) {
			var hashParams = parseQueryString(path.slice(hashIndex + 1));
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

		var query = buildQueryString(queryData);
		if (query) path += "?" + query;

		var hash = buildQueryString(hashData);
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

var Promise = promisePolyfill();

var router = function($window, redrawService) {
	var routeService = coreRouter($window);

	var identity = function(v) {return v};
	var render, component, attrs, currentPath, lastUpdate;
	var route = function(root, defaultRoute, routes) {
		if (root == null) throw new Error("Ensure the DOM element that was passed to `m.route` is not undefined")
		function run() {
			if (render != null) redrawService.render(root, render(Vnode(component, attrs.key, attrs)));
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
					Promise.resolve(payload.onmatch(params, path)).then(function(resolved) {
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
	route.link = function(vnode) {
		vnode.dom.setAttribute("href", routeService.prefix + vnode.attrs.href);
		vnode.dom.onclick = function(e) {
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) return
			e.preventDefault();
			e.redraw = false;
			var href = this.getAttribute("href");
			if (href.indexOf(routeService.prefix) === 0) href = href.slice(routeService.prefix.length);
			route.set(href, undefined, undefined);
		};
	};
	route.param = function(key) {
		if(typeof attrs !== "undefined" && typeof key !== "undefined") return attrs[key]
		return attrs
	};

	return route
};

var route = router(window, redrawService);

var withAttr = function(attrName, callback, context) {
	return function(e) {
		callback.call(context || this, attrName in e.currentTarget ? e.currentTarget[attrName] : e.currentTarget.getAttribute(attrName));
	}
};

var render$1 = render(window);

requestService.setCompletionCallback(redrawService.redraw);

hyperscript.buildQueryString = buildQueryString;
hyperscript.jsonp = requestService.jsonp;
hyperscript.mount = mount;
hyperscript.parseQueryString = parseQueryString;
hyperscript.redraw = redrawService.redraw;
hyperscript.render = render$1;
hyperscript.request = requestService.request;
hyperscript.route = route;
hyperscript.version = "bleeding-edge";
hyperscript.vnode = Vnode;
hyperscript.withAttr = withAttr;

return hyperscript;

})));
