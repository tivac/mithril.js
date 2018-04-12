import m from "./hyperscript.js"

import PromisePolyfill from "./promise/polyfill.js"

import buildQueryString from "./querystring/build.js"
import mount from "./mount.js"
import parseQueryString from "./querystring/parse.js"
import redrawService from "./redraw.js"
import render from "./render.js"
import requestService from "./request.js"
import route from "./route.js"
import vnode from "./render/vnode.js"
import withAttr from "./util/withAttr.js"

requestService.setCompletionCallback(redrawService.redraw)

m.version = "bleeding-edge"

m.PromisePolyfill = PromisePolyfill

m.buildQueryString = buildQueryString
m.jsonp = requestService.jsonp
m.mount = mount
m.parseQueryString = parseQueryString
m.redraw = redrawService.redraw
m.render = render
m.request = requestService.request
m.route = route
m.vnode = vnode
m.withAttr = withAttr

export default m
