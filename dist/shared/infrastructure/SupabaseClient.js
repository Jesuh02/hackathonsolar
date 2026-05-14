"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getSupabaseClient", {
    enumerable: true,
    get: function() {
        return getSupabaseClient;
    }
});
const _supabasejs = require("@supabase/supabase-js");
const _ws = /*#__PURE__*/ _interop_require_default(require("ws"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
let instance = null;
function getSupabaseClient() {
    if (!instance) {
        const url = process.env.SUPABASE_URL ?? '';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required');
        }
        instance = (0, _supabasejs.createClient)(url, key, {
            auth: {
                persistSession: false
            },
            realtime: {
                transport: _ws.default
            }
        });
    }
    return instance;
}

//# sourceMappingURL=SupabaseClient.js.map