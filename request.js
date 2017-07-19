import PromisePolyfill from "./promise/promise.js"
import request from "./request/request.js"

export default request(window, PromisePolyfill())
