# 🔋 Sustentación Técnica — Innovaciones vs. Problemas Críticos de las PYMES

> **¿Por qué estas innovaciones resuelven los problemas energéticos reales?**  
> Cada argumento está anclado a módulos concretos del sistema y a decisiones de arquitectura ya implementadas.

---

## Problema 1 — Costos de OpEx Críticos
> *La energía representa hasta un 33% de los gastos operativos de las PYMES locales.*

### Causa raíz
Las PYMES no tienen visibilidad de cuánto consumen, cuándo consumen más caro, ni cuánto podrían ahorrar con solar. Sin esa información, no toman decisiones. Sin decisiones, el 33% sigue siendo opaco e irrecuperable.

### Cómo lo resuelve el sistema

#### #6 Motor de Simulación Financiera → *Cuantifica el ahorro antes de invertir*
La barrera de entrada para adoptar solar no es la tecnología, es la incertidumbre financiera. Este módulo elimina esa barrera: usando solo la ubicación GPS y el sector de la empresa, simula tres escenarios comparativos con la radiación histórica de la NASA (30 años de datos):

| Escenario | Descripción |
|-----------|-------------|
| Sin solar | Costo base pagando tarifa plena |
| Con solar | Generación propia descontada de la factura |
| Solar + batería | Máxima autonomía, mínimo consumo de red |

**Output accionable:** `"Podrías reducir costos energéticos entre 18–27%"` — sin auditorías, sin sensores, sin consultores.

#### #1 Gemelo Solar Predictivo → *Hace visible lo invisible*
Sin datos de consumo real, el sistema asume perfiles típicos por sector (hotel, retail, frío industrial) y construye un modelo energético hora a hora. Esto convierte el 33% opaco en un mapa claro de:
- **Cuándo** hay energía solar disponible gratis
- **Cuándo** la empresa está comprando energía cara de la red innecesariamente
- **Cuánto** potencial solar está desperdiciando cada día

#### #5 ISO Score → *Convierte datos complejos en una decisión diaria*
Un operador de PYME no puede interpretar curvas de irradiancia. El ISO Score condensa toda esa complejidad en un número 0–100 diario:

```
ISO 90 → "Día óptimo: maximiza uso de energía solar"
ISO 40 → "Día de ahorro: conserva batería, evita red"
```

Eso es suficiente para que un operador sin formación técnica tome decisiones que impactan directamente la factura.

---

## Problema 2 — Picos de Demanda
> *Los cobros por potencia máxima encarecen la factura por falta de gestión de cargas.*

### Causa raíz
En Colombia, la factura eléctrica no cobra solo consumo (kWh) sino también potencia máxima (kW). Un solo pico de 15 minutos al mes puede determinar el cargo de potencia de toda la factura. Las PYMES no tienen medidores inteligentes ni sistemas SCADA para detectar y evitar esos picos.

### Cómo lo resuelve el sistema

#### #2 Optimizador de Picos Invisibles → *Elimina picos sin medidores inteligentes*
Esta es la innovación más diferenciadora del sistema. El principio es simple pero poderoso:

> **Si hay alta radiación solar → hay generación propia disponible → es el momento seguro para encender cargas intensivas.**  
> **Si la radiación cae → cualquier carga pesada que enciendas la paga la red → eso es un pico facturable.**

El módulo `LoadSchedule` toma las cargas eléctricas del sector (refrigeración industrial, aires acondicionados, maquinaria) y las distribuye en las ventanas solares óptimas del día. Sin necesidad de ningún hardware adicional.

**Resultado:**
```
✅ Ventanas óptimas:  11:00–14:30 (irradiancia > umbral)
⛔ Ventanas a evitar: 17:30–20:00 (radiación en descenso, red cara)
```

#### #7 Agente Solar Proactivo → *De recomendación pasiva a instrucción operativa*
El salto crítico que diferencia este sistema de un dashboard cualquiera: en lugar de mostrar datos para que alguien decida, el agente emite un **plan operativo diario con acciones concretas y horarios exactos**:

```
📋 Plan operativo — Hoy 13/05/2026

12:30 → ENCENDER  maquinaria de refrigeración  [ALTA prioridad]
14:00 → CARGAR    baterías al 100%              [MEDIA prioridad]
17:00 → REDUCIR   consumo general               [ALTA prioridad]
17:30 → APAGAR    equipos no esenciales         [CRÍTICA prioridad]
```

Esto elimina la dependencia de que alguien interprete un gráfico. El operador recibe instrucciones, no datos. Esa diferencia es lo que realmente mueve la aguja en los cobros por potencia máxima.

#### #8 Modelo de Incertidumbre Solar → *Anticipa el riesgo de pico antes de que ocurra*
Los días de alta variabilidad solar (nubes intermitentes) son los más peligrosos para los picos: la generación solar cae inesperadamente y las cargas siguen corriendo, pasando automáticamente a la red. El modelo de incertidumbre detecta esos días **con anticipación**:

```
⚠️ Riesgo energético hoy: ALTO
   Variabilidad solar elevada (CV: 0.42)
   → Reducir cargas no esenciales antes de las 15:00
```

---

## Problema 3 — Inestabilidad de Red
> *Necesidad de orquestar el uso de baterías y paneles solares de forma autónoma ante apagones.*

### Causa raíz
En La Guajira y otras regiones con red eléctrica inestable, los apagones son impredecibles. Las PYMES con paneles solares y baterías instaladas no saben cuándo cargar, cuándo reservar y cuándo descargar. Gestionar eso manualmente requiere monitoreo constante que ninguna PYME puede sostener.

### Cómo lo resuelve el sistema

#### #3 Orquestador Autónomo de Energía → *Resiliencia sin datos de red eléctrica*
El diseño del `OrchestrateEnergyStrategyUseCase` es deliberadamente independiente de datos de la red eléctrica. Eso no es una limitación: es una ventaja. Un sistema que depende de datos de red para funcionar falla exactamente cuando más se necesita (durante el apagón). Este sistema usa solo radiación solar como señal de entrada:

```
Radiación hoy ALTA + Radiación mañana BAJA
→ BatteryStrategy: CHARGE_MAX
→ "Carga baterías hoy al máximo, mañana habrá baja generación"

Radiación hoy BAJA
→ BatteryStrategy: RESERVE
→ "Conserva energía, evita consumo no esencial"
```

El `BatteryStrategy` se construye a partir del riesgo de hoy y la proyección de mañana, creando una **estrategia anticipatoria**, no reactiva. La diferencia es crítica: cuando ocurre el apagón, las baterías ya están cargadas.

#### #8 Modelo de Incertidumbre Solar → *Cuantifica el riesgo antes del evento*
El `OutageRiskCalculatorService` y el `StatisticalAnalysisService` calculan el coeficiente de variación (CV) de la irradiancia histórica del día y la semana. Un CV alto significa que ese tipo de día históricamente tiene caídas bruscas de generación, lo que correlaciona con mayor riesgo de necesitar la red o las baterías inesperadamente.

```
VariabilityIndex.HIGH + IrradianceForecast.LOW_TOMORROW
→ EnergyRisk: CRITICAL
→ "Prepara sistema para modo isla, alta probabilidad de déficit energético"
```

#### #7 Agente Solar Proactivo → *Instrucciones de contingencia automáticas*
Cuando el `RiskLevel` llega a `HIGH` o `CRITICAL`, el agente proactivo escala la prioridad de sus acciones automáticamente y genera instrucciones de contingencia enviadas por WhatsApp (canal ya integrado en el stack):

```
🚨 Alerta energética — 14:30
   Radiación cayendo. Activando protocolo de reserva.
   → Cargar baterías ahora
   → Apagar equipos de baja prioridad
   → Reducir climatización al 60%
```

Esto convierte el sistema en un **operador autónomo de energía** que no necesita supervisión humana constante para proteger la operación ante inestabilidad de red.

---

## Diagrama de cobertura

```
                    ┌─────────────────────────────────────────────┐
                    │           AGENTE PROACTIVO (#7)             │
                    │    Orquesta todos los módulos → 1 plan      │
                    └──────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
 ┌────────────────┐     ┌─────────────────┐     ┌──────────────────┐
 │  ISO Score #5  │     │  Pico Optimizer │     │  Orquestador     │
 │  Gemelo DT #1  │     │       #2        │     │  Energía #3      │
 │  Financiero #6 │     │                 │     │  Incertidumbre#8 │
 └───────┬────────┘     └────────┬────────┘     └────────┬─────────┘
         │                       │                        │
         ▼                       ▼                        ▼
 ┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
 │  PROBLEMA 1   │     │   PROBLEMA 2    │     │   PROBLEMA 3     │
 │  OpEx 33%     │     │ Picos demanda   │     │ Inestabilidad    │
 │  energía      │     │ potencia máxima │     │ de red           │
 └───────────────┘     └─────────────────┘     └──────────────────┘
```

---

## Ventaja diferencial: sin hardware adicional

Los tres problemas se atacan usando **exclusivamente** la NASA Power API (ya integrada en el sistema). No se requiere:

- ❌ Medidores inteligentes (AMI)
- ❌ Sensores IoT en campo
- ❌ Sistemas SCADA
- ❌ Auditorías energéticas presenciales
- ❌ Datos históricos propios de la empresa

Esto democratiza el acceso a gestión energética avanzada para PYMES que hoy no pueden costear ninguna de esas soluciones.

---

## Resumen ejecutivo

| Problema | Módulo principal | Mecanismo | Output concreto |
|----------|-----------------|-----------|-----------------|
| OpEx 33% energía | #6 Financiero + #1 Gemelo | Simulación con datos NASA históricos | Rango de ahorro % proyectado |
| Picos de demanda | #2 Peak Optimizer + #7 Agente | Programación de cargas en ventanas solares | Plan horario de cargas del día |
| Inestabilidad de red | #3 Orquestador + #8 Incertidumbre | Estrategia anticipatoria de baterías | Instrucción: cargar/reservar/descargar |
