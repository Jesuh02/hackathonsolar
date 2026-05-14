"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DailySchedulerService", {
    enumerable: true,
    get: function() {
        return DailySchedulerService;
    }
});
const _nodecron = /*#__PURE__*/ _interop_require_default(require("node-cron"));
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
let DailySchedulerService = class DailySchedulerService {
    start() {
        // Every day at 12:00 UTC = 07:00 Colombia time
        this.task = _nodecron.default.schedule('0 12 * * *', async ()=>{
            console.log('[DailyScheduler] Sending daily energy recommendations to all users...');
            const result = await this.sendDailyToAll.execute();
            if (result.isFailure) {
                console.error('[DailyScheduler] Failed:', result.error);
            } else {
                console.log('[DailyScheduler] Daily recommendations sent successfully.');
            }
        });
        console.log('[DailyScheduler] WhatsApp daily scheduler started (07:00 Colombia time).');
    }
    stop() {
        this.task?.stop();
        console.log('[DailyScheduler] Stopped.');
    }
    constructor(sendDailyToAll){
        _define_property(this, "sendDailyToAll", void 0);
        _define_property(this, "task", void 0);
        this.sendDailyToAll = sendDailyToAll;
        this.task = null;
    }
};

//# sourceMappingURL=DailySchedulerService.js.map