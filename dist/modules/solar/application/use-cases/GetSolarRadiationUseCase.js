"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GetSolarRadiationUseCase", {
    enumerable: true,
    get: function() {
        return GetSolarRadiationUseCase;
    }
});
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
let GetSolarRadiationUseCase = class GetSolarRadiationUseCase {
    async execute(request) {
        const latitude = request.latitude ?? 11.5444;
        const longitude = request.longitude ?? -72.9072;
        // Build today's date string (YYYYMMDD) to detect current-day requests
        const today = new Date();
        const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        // Skip cache when the range covers today so NASA data is always fresh
        const bypassCache = request.endDate >= todayStr;
        let solarData;
        if (!bypassCache) {
            // Intentar primero desde caché/repositorio
            const cached = await this.repository.findByDateRange({
                startDate: request.startDate,
                endDate: request.endDate,
                latitude,
                longitude
            });
            if (cached.isSuccess && cached.value.length > 0) {
                solarData = cached.value;
            } else {
                // Obtener de NASA POWER API
                const apiResult = await this.nasaApi.fetchDailyRadiation({
                    start: request.startDate,
                    end: request.endDate,
                    latitude,
                    longitude,
                    community: 'RE',
                    parameters: [
                        'ALLSKY_SFC_SW_DWN'
                    ]
                });
                if (apiResult.isFailure) {
                    return _Result.Result.fail(apiResult.error);
                }
                solarData = apiResult.value;
                await this.repository.save(solarData);
            }
        } else {
            // Siempre consultar NASA POWER API para datos actuales
            const apiResult = await this.nasaApi.fetchDailyRadiation({
                start: request.startDate,
                end: request.endDate,
                latitude,
                longitude,
                community: 'RE',
                parameters: [
                    'ALLSKY_SFC_SW_DWN'
                ]
            });
            if (apiResult.isFailure) {
                return _Result.Result.fail(apiResult.error);
            }
            solarData = apiResult.value;
            // Save to cache with a short TTL (handled by repository default)
            await this.repository.save(solarData);
        }
        return _Result.Result.ok(this.mapToResponseDto(solarData, latitude, longitude, request));
    }
    mapToResponseDto(data, latitude, longitude, request) {
        const irradianceValues = data.map((d)=>d.irradiance);
        const total = irradianceValues.reduce((a, b)=>a + b, 0);
        const points = data.map((d)=>({
                id: d.id,
                date: d.date,
                irradiance: d.irradiance,
                radiationLevel: d.getRadiationLevel(),
                estimatedPanelOutput: d.estimatePanelOutput(),
                latitude: d.latitude,
                longitude: d.longitude,
                location: d.location
            }));
        return {
            data: points,
            stats: {
                total: parseFloat(total.toFixed(2)),
                average: parseFloat((total / data.length).toFixed(2)),
                max: parseFloat(Math.max(...irradianceValues).toFixed(2)),
                min: parseFloat(Math.min(...irradianceValues).toFixed(2)),
                period: {
                    start: request.startDate,
                    end: request.endDate
                }
            },
            location: {
                name: 'Riohacha, La Guajira, Colombia',
                latitude,
                longitude
            }
        };
    }
    constructor(repository, nasaApi){
        _define_property(this, "repository", void 0);
        _define_property(this, "nasaApi", void 0);
        this.repository = repository;
        this.nasaApi = nasaApi;
    }
};

//# sourceMappingURL=GetSolarRadiationUseCase.js.map