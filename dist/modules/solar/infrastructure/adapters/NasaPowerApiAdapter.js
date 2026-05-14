"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NasaPowerApiAdapter", {
    enumerable: true,
    get: function() {
        return NasaPowerApiAdapter;
    }
});
const _SolarRadiation = require("../../domain/entities/SolarRadiation");
const _Result = require("../../../../shared/domain/Result");
const _HttpClient = require("../../../../shared/infrastructure/HttpClient");
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
let NasaPowerApiAdapter = class NasaPowerApiAdapter {
    async fetchDailyRadiation(params) {
        try {
            const queryParams = new URLSearchParams({
                start: params.start,
                end: params.end,
                latitude: params.latitude.toString(),
                longitude: params.longitude.toString(),
                community: params.community,
                parameters: params.parameters.join(','),
                format: 'JSON'
            });
            const response = await this.httpClient.get(`/temporal/daily/point?${queryParams.toString()}`);
            const rawData = response.properties.parameter.ALLSKY_SFC_SW_DWN;
            const solarData = this.mapResponseToEntities(rawData, params.latitude, params.longitude);
            return _Result.Result.ok(solarData);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido en NASA POWER API';
            return _Result.Result.fail(`NasaPowerApiAdapter: ${message}`);
        }
    }
    mapResponseToEntities(rawData, latitude, longitude) {
        return Object.entries(rawData).filter(([, value])=>value !== -999) // Filtrar valores inválidos de NASA
        .map(([dateStr, irradiance])=>_SolarRadiation.SolarRadiation.create({
                date: dateStr,
                irradiance,
                latitude,
                longitude,
                location: NasaPowerApiAdapter.LOCATION
            })).sort((a, b)=>a.date.localeCompare(b.date));
    }
    constructor(baseUrl){
        _define_property(this, "httpClient", void 0);
        this.httpClient = new _HttpClient.HttpClient(baseUrl, 120000);
    }
};
_define_property(NasaPowerApiAdapter, "LOCATION", 'Riohacha, La Guajira, Colombia');

//# sourceMappingURL=NasaPowerApiAdapter.js.map