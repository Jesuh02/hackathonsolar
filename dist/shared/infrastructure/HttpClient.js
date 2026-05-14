"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "HttpClient", {
    enumerable: true,
    get: function() {
        return HttpClient;
    }
});
const _axios = /*#__PURE__*/ _interop_require_default(require("axios"));
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
let HttpClient = class HttpClient {
    async get(url, config) {
        const response = await this.client.get(url, config);
        return response.data;
    }
    async post(url, data, config) {
        const response = await this.client.post(url, data, config);
        return response.data;
    }
    setAuthHeader(token) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setHeader(name, value) {
        this.client.defaults.headers.common[name] = value;
    }
    constructor(baseURL, timeoutMs){
        _define_property(this, "client", void 0);
        this.client = _axios.default.create({
            baseURL,
            ...timeoutMs === undefined ? {} : {
                timeout: timeoutMs
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};

//# sourceMappingURL=HttpClient.js.map