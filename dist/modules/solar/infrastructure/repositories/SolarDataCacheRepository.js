"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SolarDataCacheRepository", {
    enumerable: true,
    get: function() {
        return SolarDataCacheRepository;
    }
});
const _nodecache = /*#__PURE__*/ _interop_require_default(require("node-cache"));
const _Result = require("../../../../shared/domain/Result");
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
let SolarDataCacheRepository = class SolarDataCacheRepository {
    async findByDateRange(params) {
        const cacheKey = this.buildCacheKey(params);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return _Result.Result.ok(cached);
        }
        return _Result.Result.ok([]);
    }
    async save(data) {
        if (data.length === 0) return;
        const grouped = this.groupByDateRange(data);
        for (const [key, records] of grouped.entries()){
            this.cache.set(key, records);
        }
    }
    async getAnnualStats(year, latitude, longitude) {
        const startDate = `${year}0101`;
        const endDate = `${year}1231`;
        const result = await this.findByDateRange({
            startDate,
            endDate,
            latitude,
            longitude
        });
        if (result.isFailure || result.value.length === 0) {
            return _Result.Result.fail('Sin datos para el año solicitado');
        }
        const data = result.value;
        const irradianceValues = data.map((d)=>d.irradiance);
        const totalIrradiance = irradianceValues.reduce((a, b)=>a + b, 0);
        const monthlyAvg = this.calculateMonthlyAverages(data);
        const optimalMonths = monthlyAvg.filter((m)=>m.avg > 5.5).map((m)=>m.month);
        return _Result.Result.ok({
            year,
            totalIrradiance: parseFloat(totalIrradiance.toFixed(2)),
            averageIrradiance: parseFloat((totalIrradiance / data.length).toFixed(2)),
            maxIrradiance: parseFloat(Math.max(...irradianceValues).toFixed(2)),
            minIrradiance: parseFloat(Math.min(...irradianceValues).toFixed(2)),
            optimalMonths,
            totalRecords: data.length
        });
    }
    buildCacheKey(params) {
        return `solar:${params.startDate}:${params.endDate}:${params.latitude}:${params.longitude}`;
    }
    groupByDateRange(data) {
        if (data.length === 0) return new Map();
        const sorted = [
            ...data
        ].sort((a, b)=>a.date.localeCompare(b.date));
        const key = this.buildCacheKey({
            startDate: sorted[0].date,
            endDate: sorted[sorted.length - 1].date,
            latitude: sorted[0].latitude,
            longitude: sorted[0].longitude
        });
        return new Map([
            [
                key,
                data
            ]
        ]);
    }
    calculateMonthlyAverages(data) {
        const monthMap = new Map();
        for (const record of data){
            const monthKey = record.date.substring(0, 6); // YYYYMM
            if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
            monthMap.get(monthKey).push(record.irradiance);
        }
        return Array.from(monthMap.entries()).map(([month, values])=>({
                month,
                avg: values.reduce((a, b)=>a + b, 0) / values.length
            }));
    }
    constructor(ttlSeconds = 3600){
        _define_property(this, "cache", void 0);
        this.cache = new _nodecache.default({
            stdTTL: ttlSeconds,
            checkperiod: 600
        });
    }
};

//# sourceMappingURL=SolarDataCacheRepository.js.map