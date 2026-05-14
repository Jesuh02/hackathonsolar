# 🌞 Innovaciones Solar — Guía de Implementación Profesional

> Arquitectura: **DDD (Domain-Driven Design) + Clean Architecture + Hexagonal**  
> Stack: **TypeScript · Express · Node.js · OpenRouter LLM · NASA Power API**  
> Estilo: **Clean Code · SOLID · Single Responsibility · Dependency Injection**

---

## Índice

1. [Gemelo Solar Predictivo](#1-gemelo-solar-predictivo)
2. [Optimizador de Picos Invisibles](#2-optimizador-de-picos-invisibles)
3. [Orquestador Autónomo de Energía](#3-orquestador-autónomo-de-energía)
4. [Clasificador Inteligente de Negocios](#4-clasificador-inteligente-de-negocios)
5. [Índice Solar de Oportunidad (ISO Score)](#5-índice-solar-de-oportunidad-iso-score)
6. [Motor de Simulación Financiera](#6-motor-de-simulación-financiera)
7. [Agente Solar Proactivo](#7-agente-solar-proactivo)
8. [Modelo de Incertidumbre Solar](#8-modelo-de-incertidumbre-solar)
9. [Estructura de carpetas final](#9-estructura-de-carpetas-final)

---

## Principios arquitectónicos aplicados

Cada innovación sigue la misma estructura de capas:

```
domain/          ← Entidades, Value Objects, Puertos (interfaces)
application/     ← Use Cases, DTOs, Services
infrastructure/  ← Adaptadores externos (APIs, DB, LLM)
api/             ← Controllers, Routes (HTTP layer)
```

**Regla de dependencia:** `infrastructure → application → domain` (nunca al revés).

---

## 1. Gemelo Solar Predictivo

> Simula generación energética a partir de radiación histórica sin sensores.

### Estructura

```
src/modules/digital-twin/
  domain/
    entities/
      EnergyProfile.ts          ← Perfil energético simulado por hora/día
      SectorProfile.ts          ← hotel | retail | industrial-cold
    value-objects/
      GenerationWindow.ts       ← Ventana horaria con exceso/déficit
    ports/
      DigitalTwinRepositoryPort.ts
  application/
    dtos/
      DigitalTwinInputDto.ts
      DigitalTwinOutputDto.ts
    use-cases/
      BuildDigitalTwinUseCase.ts
      PredictDailyGenerationUseCase.ts
  infrastructure/
    adapters/
      SectorProfileProviderAdapter.ts   ← Perfiles por sector (JSON/DB)
```

### Código clave

**`domain/entities/EnergyProfile.ts`**
```typescript
export class EnergyProfile {
  private constructor(
    readonly sector: SectorType,
    readonly hourlyGenerationKwh: ReadonlyMap<number, number>,
    readonly surplusWindows: GenerationWindow[],
    readonly deficitWindows: GenerationWindow[],
  ) {}

  static create(
    sector: SectorType,
    irradianceByHour: Map<number, number>,
    panelCapacityKw: number,
  ): EnergyProfile {
    const hourlyGeneration = new Map<number, number>();
    for (const [hour, irradiance] of irradianceByHour) {
      hourlyGeneration.set(hour, irradiance * panelCapacityKw * EFFICIENCY_FACTOR);
    }
    const surplusWindows = EnergyProfile.detectWindows(hourlyGeneration, 'surplus');
    const deficitWindows = EnergyProfile.detectWindows(hourlyGeneration, 'deficit');
    return new EnergyProfile(sector, hourlyGeneration, surplusWindows, deficitWindows);
  }

  private static detectWindows(
    generation: Map<number, number>,
    type: 'surplus' | 'deficit',
  ): GenerationWindow[] { /* ... */ }
}
```

**`application/use-cases/BuildDigitalTwinUseCase.ts`**
```typescript
export class BuildDigitalTwinUseCase {
  constructor(
    private readonly solarRepo: SolarDataRepositoryPort,
    private readonly sectorProvider: SectorProfileProviderAdapter,
  ) {}

  async execute(dto: DigitalTwinInputDto): Promise<DigitalTwinOutputDto> {
    const radiation = await this.solarRepo.getHistorical(dto.lat, dto.lon, dto.dateRange);
    const sectorProfile = this.sectorProvider.getProfile(dto.sector);
    const profile = EnergyProfile.create(dto.sector, radiation.byHour, sectorProfile.capacityKw);
    return DigitalTwinOutputDto.fromDomain(profile);
  }
}
```

---

## 2. Optimizador de Picos Invisibles

> Detecta cuándo NO usar la red eléctrica basado solo en radiación solar.

### Estructura

```
src/modules/peak-optimizer/
  domain/
    entities/
      LoadSchedule.ts           ← Programación de cargas eléctricas
    value-objects/
      LoadRecommendation.ts     ← hora + tipo de carga + prioridad
    ports/
      PeakOptimizerPort.ts
  application/
    use-cases/
      OptimizePeakLoadsUseCase.ts
    dtos/
      PeakOptimizationInputDto.ts
      PeakOptimizationOutputDto.ts
  infrastructure/
    adapters/
      LoadProfileAdapter.ts     ← Perfiles de carga típicos por sector
```

### Código clave

**`application/use-cases/OptimizePeakLoadsUseCase.ts`**
```typescript
export class OptimizePeakLoadsUseCase {
  constructor(private readonly solarRepo: SolarDataRepositoryPort) {}

  async execute(dto: PeakOptimizationInputDto): Promise<PeakOptimizationOutputDto> {
    const todayRadiation = await this.solarRepo.getTodayForecast(dto.lat, dto.lon);
    const solarHours = todayRadiation.getPeakHours(); // horas con irradiancia > umbral

    const schedule = LoadSchedule.create(dto.loads, solarHours);
    return {
      optimalWindows: schedule.getOptimalWindows(),
      avoidWindows: schedule.getLowSolarWindows(),
      message: schedule.buildHumanMessage(),
    };
  }
}
```

---

## 3. Orquestador Autónomo de Energía

> Predice impacto de apagones basado en radiación y genera estrategias de batería.

### Estructura

```
src/modules/energy-orchestrator/
  domain/
    entities/
      BatteryStrategy.ts        ← charge | reserve | discharge
    value-objects/
      RiskLevel.ts              ← LOW | MEDIUM | HIGH
      EnergyAction.ts           ← acción + hora + justificación
    ports/
      EnergyOrchestratorPort.ts
  application/
    use-cases/
      OrchestrateEnergyStrategyUseCase.ts
    services/
      OutageRiskCalculatorService.ts    ← calcula riesgo sin datos de red
```

### Código clave

**`domain/value-objects/RiskLevel.ts`**
```typescript
export class RiskLevel {
  private static readonly THRESHOLDS = { LOW: 4.5, MEDIUM: 2.5 } as const;

  private constructor(readonly value: 'LOW' | 'MEDIUM' | 'HIGH') {}

  static fromIrradiance(avgIrradiance: number): RiskLevel {
    if (avgIrradiance >= RiskLevel.THRESHOLDS.LOW) return new RiskLevel('LOW');
    if (avgIrradiance >= RiskLevel.THRESHOLDS.MEDIUM) return new RiskLevel('MEDIUM');
    return new RiskLevel('HIGH');
  }

  isHigh(): boolean { return this.value === 'HIGH'; }
}
```

**`application/use-cases/OrchestrateEnergyStrategyUseCase.ts`**
```typescript
export class OrchestrateEnergyStrategyUseCase {
  constructor(
    private readonly solarRepo: SolarDataRepositoryPort,
    private readonly riskCalculator: OutageRiskCalculatorService,
  ) {}

  async execute(dto: OrchestrationInputDto): Promise<OrchestrationOutputDto> {
    const todayRadiation = await this.solarRepo.getToday(dto.lat, dto.lon);
    const tomorrowForecast = await this.solarRepo.getForecast(dto.lat, dto.lon, 1);

    const todayRisk = this.riskCalculator.calculate(todayRadiation);
    const tomorrowRisk = this.riskCalculator.calculate(tomorrowForecast);

    const strategy = BatteryStrategy.create(todayRisk, tomorrowRisk);
    return OrchestrationOutputDto.fromStrategy(strategy);
  }
}
```

---

## 4. Clasificador Inteligente de Negocios

> Deduce el tipo de negocio que mejor encaja con el perfil de radiación de la ubicación.

### Estructura

```
src/modules/business-classifier/
  domain/
    entities/
      BusinessClassification.ts   ← sector + confianza + justificación
    value-objects/
      SectorScore.ts              ← sector + score 0-1
    ports/
      BusinessClassifierPort.ts
  application/
    use-cases/
      ClassifyBusinessUseCase.ts
    services/
      SectorMatchingService.ts    ← compara perfiles vs radiación real
  infrastructure/
    data/
      sector-profiles.json        ← perfiles energéticos por sector
```

### Código clave

**`application/services/SectorMatchingService.ts`**
```typescript
export class SectorMatchingService {
  constructor(private readonly profiles: SectorProfile[]) {}

  rank(irradiancePattern: IrradiancePattern): SectorScore[] {
    return this.profiles
      .map(profile => ({
        sector: profile.sector,
        score: this.computeCorrelation(irradiancePattern, profile.idealPattern),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private computeCorrelation(actual: IrradiancePattern, ideal: IrradiancePattern): number {
    // Pearson correlation entre vectores horarios
    const n = actual.hourly.length;
    const meanA = actual.hourly.reduce((s, v) => s + v, 0) / n;
    const meanI = ideal.hourly.reduce((s, v) => s + v, 0) / n;
    const num = actual.hourly.reduce((s, v, i) => s + (v - meanA) * (ideal.hourly[i] - meanI), 0);
    const den = Math.sqrt(
      actual.hourly.reduce((s, v) => s + (v - meanA) ** 2, 0) *
      ideal.hourly.reduce((s, v) => s + (v - meanI) ** 2, 0),
    );
    return den === 0 ? 0 : num / den;
  }
}
```

---

## 5. Índice Solar de Oportunidad (ISO Score)

> Indicador diario 0–100 que simplifica la complejidad solar en una decisión accionable.

### Estructura

```
src/modules/iso-score/
  domain/
    entities/
      IsoScore.ts               ← score + nivel + mensaje
    value-objects/
      ScoreLevel.ts             ← OPTIMAL | MODERATE | LOW | CRITICAL
    ports/
      IsoScoreRepositoryPort.ts
  application/
    use-cases/
      ComputeIsoScoreUseCase.ts
    services/
      IsoScoreCalculatorService.ts
```

### Código clave

**`domain/entities/IsoScore.ts`**
```typescript
export class IsoScore {
  private constructor(
    readonly value: number,          // 0–100
    readonly level: ScoreLevel,
    readonly recommendation: string,
    readonly components: IsoComponents,
  ) {}

  static create(components: IsoComponents): IsoScore {
    const value = IsoScore.calculateScore(components);
    const level = ScoreLevel.fromScore(value);
    const recommendation = IsoScore.buildRecommendation(level, components);
    return new IsoScore(value, level, recommendation, components);
  }

  private static calculateScore(c: IsoComponents): number {
    const normalized = (c.avgIrradiance / MAX_IRRADIANCE) * 0.5
      + (1 - c.variability / MAX_VARIABILITY) * 0.3
      + (c.trend > 0 ? 0.2 : 0);
    return Math.round(Math.min(100, Math.max(0, normalized * 100)));
  }
}
```

---

## 6. Motor de Simulación Financiera

> Estima ahorro energético potencial sin datos reales del negocio.

### Estructura

```
src/modules/financial-simulator/
  domain/
    entities/
      FinancialSimulation.ts    ← escenarios + ahorro proyectado
    value-objects/
      EnergyTariff.ts           ← tarifa + moneda + país
      SavingsRange.ts           ← min%, max%, expected%
    ports/
      FinancialSimulatorPort.ts
  application/
    use-cases/
      SimulateFinancialSavingsUseCase.ts
    dtos/
      SimulationInputDto.ts
      SimulationOutputDto.ts
  infrastructure/
    data/
      colombia-energy-tariffs.json
```

### Código clave

**`application/use-cases/SimulateFinancialSavingsUseCase.ts`**
```typescript
export class SimulateFinancialSavingsUseCase {
  constructor(
    private readonly solarRepo: SolarDataRepositoryPort,
    private readonly tariffProvider: TariffProviderPort,
  ) {}

  async execute(dto: SimulationInputDto): Promise<SimulationOutputDto> {
    const historical = await this.solarRepo.getHistorical(dto.lat, dto.lon, SIMULATION_YEARS);
    const tariff = this.tariffProvider.getByRegion(dto.region);
    const sector = SectorProfile.getDefaults(dto.sector);

    const scenarios = [
      FinancialScenario.withoutSolar(sector, tariff),
      FinancialScenario.withSolar(sector, tariff, historical),
      FinancialScenario.withSolarAndBattery(sector, tariff, historical),
    ];

    const savings = SavingsRange.computeAcrossScenarios(scenarios);
    return SimulationOutputDto.fromSimulation(scenarios, savings);
  }
}
```

---

## 7. Agente Solar Proactivo

> Transforma el sistema de un dashboard pasivo a un operador energético autónomo.

### Estructura

```
src/modules/proactive-agent/
  domain/
    entities/
      DailyOperationPlan.ts     ← lista de acciones con hora + justificación
    value-objects/
      AgentAction.ts            ← TURN_ON | TURN_OFF | CHARGE | REDUCE
      ActionPriority.ts         ← CRITICAL | HIGH | MEDIUM | LOW
    ports/
      ProactiveAgentPort.ts
  application/
    use-cases/
      GenerateDailyOperationPlanUseCase.ts
    services/
      ActionPrioritizerService.ts
      LlmActionEnricherService.ts   ← usa OpenRouter para lenguaje natural
```

### Código clave

**`domain/entities/DailyOperationPlan.ts`**
```typescript
export class DailyOperationPlan {
  private constructor(
    readonly date: Date,
    readonly actions: AgentAction[],
    readonly summary: string,
  ) {}

  static create(
    isoScore: IsoScore,
    solarWindows: GenerationWindow[],
    sectorLoads: SectorLoad[],
  ): DailyOperationPlan {
    const actions = ActionPrioritizerService.prioritize(solarWindows, sectorLoads, isoScore);
    return new DailyOperationPlan(new Date(), actions, DailyOperationPlan.buildSummary(actions));
  }

  private static buildSummary(actions: AgentAction[]): string {
    return actions.map(a => `${a.time}: ${a.description}`).join('\n');
  }
}
```

**`application/services/LlmActionEnricherService.ts`**
```typescript
export class LlmActionEnricherService {
  constructor(private readonly llm: LlmPort) {}

  async enrich(plan: DailyOperationPlan): Promise<DailyOperationPlan> {
    const prompt = this.buildPrompt(plan);
    const enrichedSummary = await this.llm.complete(prompt);
    return plan.withSummary(enrichedSummary);
  }

  private buildPrompt(plan: DailyOperationPlan): string {
    return `Convierte este plan operativo en lenguaje natural accionable para un operador:
${plan.actions.map(a => `- ${a.time}: ${a.type} - ${a.load}`).join('\n')}
Responde con instrucciones claras, cortas y en español.`;
  }
}
```

---

## 8. Modelo de Incertidumbre Solar

> Cuantifica el riesgo energético diario usando variabilidad histórica de radiación.

### Estructura

```
src/modules/uncertainty-model/
  domain/
    entities/
      UncertaintyReport.ts      ← riesgo + variabilidad + confianza
    value-objects/
      EnergyRisk.ts             ← LOW | MEDIUM | HIGH | CRITICAL
      VariabilityIndex.ts       ← desviación estándar normalizada
    ports/
      UncertaintyRepositoryPort.ts
  application/
    use-cases/
      ComputeEnergyRiskUseCase.ts
    services/
      StatisticalAnalysisService.ts   ← std dev, CV, percentiles
```

### Código clave

**`application/services/StatisticalAnalysisService.ts`**
```typescript
export class StatisticalAnalysisService {
  computeVariabilityIndex(irradianceValues: number[]): VariabilityIndex {
    const mean = this.mean(irradianceValues);
    const stdDev = this.stdDev(irradianceValues, mean);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    return VariabilityIndex.fromCV(coefficientOfVariation);
  }

  private mean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private stdDev(values: number[], mean: number): number {
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
```

**`domain/entities/UncertaintyReport.ts`**
```typescript
export class UncertaintyReport {
  private constructor(
    readonly date: Date,
    readonly risk: EnergyRisk,
    readonly variabilityIndex: VariabilityIndex,
    readonly confidencePercent: number,
    readonly humanMessage: string,
  ) {}

  static create(variability: VariabilityIndex, forecast: IrradianceForecast): UncertaintyReport {
    const risk = EnergyRisk.fromVariability(variability);
    const confidence = UncertaintyReport.calculateConfidence(variability, forecast);
    const message = `Riesgo energético hoy: ${risk.value} (variabilidad solar ${variability.level})`;
    return new UncertaintyReport(new Date(), risk, variability, confidence, message);
  }
}
```

---

## 9. Estructura de carpetas final

```
src/
  modules/
    solar/                        ← existente
    recommendations/              ← existente
    reports/                      ← existente
    whatsapp/                     ← existente
    digital-twin/                 ← Innovación #1
    peak-optimizer/               ← Innovación #2
    energy-orchestrator/          ← Innovación #3
    business-classifier/          ← Innovación #4
    iso-score/                    ← Innovación #5
    financial-simulator/          ← Innovación #6
    proactive-agent/              ← Innovación #7 (orquesta #1–#6)
    uncertainty-model/            ← Innovación #8
  api/
    controllers/
      digitalTwin.controller.ts
      peakOptimizer.controller.ts
      energyOrchestrator.controller.ts
      businessClassifier.controller.ts
      isoScore.controller.ts
      financialSimulator.controller.ts
      proactiveAgent.controller.ts
      uncertaintyModel.controller.ts
    routes/
      digitalTwin.routes.ts
      peakOptimizer.routes.ts
      ...
  shared/
    domain/
      Entity.ts
      ValueObject.ts
      Result.ts
    infrastructure/
      HttpClient.ts
```

---

## Orden de implementación recomendado

| Prioridad | Módulo | Depende de |
|-----------|--------|-----------|
| 1 | `iso-score` | `solar` (existente) |
| 2 | `uncertainty-model` | `solar` (existente) |
| 3 | `digital-twin` | `solar`, `iso-score` |
| 4 | `peak-optimizer` | `digital-twin` |
| 5 | `energy-orchestrator` | `uncertainty-model`, `peak-optimizer` |
| 6 | `business-classifier` | `solar`, `digital-twin` |
| 7 | `financial-simulator` | `solar`, `business-classifier` |
| 8 | `proactive-agent` | todos los anteriores + `recommendations` (LLM) |

---

## Convenciones de Clean Code aplicadas

- **Nombres descriptivos**: `ComputeIsoScoreUseCase` > `calcScore`
- **Single Responsibility**: cada use case hace exactamente una cosa
- **Inmutabilidad**: entidades de dominio con `private constructor` + `static create()`
- **Ports & Adapters**: nunca importar implementaciones concretas en `domain/` o `application/`
- **DTOs de frontera**: transformar datos en el límite de capas, no exponer entidades de dominio
- **Errores explícitos**: usar `Result<T, E>` del shared domain en lugar de `throw` genérico
