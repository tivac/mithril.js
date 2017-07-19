import m from "./hyperscript.js";
import requestService from "./request.js";
import redrawService from "./redraw.js";

import mount from "./mount.js";
import route from "./route.js";
import withAttr from "./util/withAttr.js";
import render from "./render.js";
import parseQueryString from "./querystring/parse.js";
import buildQueryString from "./querystring/build.js";
import vnode from "./render/vnode.js";

requestService.setCompletionCallback(redrawService.redraw)

m.buildQueryString = buildQueryString
m.jsonp = requestService.jsonp
m.mount = mount
m.parseQueryString = parseQueryString
m.redraw = redrawService.redraw
m.render = render
m.request = requestService.request
m.route = route
m.version = "bleeding-edge"
m.vnode = vnode
m.withAttr = withAttr

export default m;
