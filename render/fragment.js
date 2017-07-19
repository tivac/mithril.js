import Vnode from "./vnode.js"

export default function(attrs, children) {
	return Vnode("[", attrs.key, attrs, Vnode.normalizeChildren(children), undefined, undefined)
}
