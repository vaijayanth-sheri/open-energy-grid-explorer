# INSTRUCTION DOCUMENT — UPGRADE TO REALISTIC ELECTRICAL NETWORK (MV + LV)

## 1. Objective

Upgrade the existing system from a simplified visualization into a **realistic urban electrical distribution network model**.

The system must now reflect a **multi-layer grid architecture** including:

* High Voltage (HV)
* Medium Voltage (MV)
* Low Voltage (LV)

The focus is on **structural realism and correct hierarchy**, not complex physics.

---

## 2. Core Requirement

The system must represent a **hierarchical electrical network**:

Generation / Grid → HV → MV → LV → Consumers

Every asset must:

* Have a defined voltage level
* Belong to a layer
* Be connected logically within the network

---

## 3. Voltage Levels (STRICT)

Use the following fixed values:

* HV: 110 kV
* MV: 11 kV
* LV: 0.4 kV

Do NOT introduce other voltage levels.

---

## 4. Required Asset Types (MANDATORY)

The system MUST include the following asset types:

---

### 4.1 High Voltage Layer

* generator (solar, gas)
* transmission_line_hv
* substation_hv_mv

Purpose:

* Bulk power supply into city

---

### 4.2 Medium Voltage Layer (CRITICAL ADDITION)

* feeder_mv
* rmu (Ring Main Unit)
* switch (optional alias of rmu if needed)

Purpose:

* Distribute power across districts
* Enable network switching and branching

---

### 4.3 Transformation Layer

* transformer_mv_lv

Purpose:

* Step down voltage from 11 kV → 0.4 kV

---

### 4.4 Low Voltage Layer

* feeder_lv

---

### 4.5 Consumers

* consumer_residential
* consumer_industrial
* consumer_critical (e.g., hospital)

---

## 5. Network Topology (STRICT STRUCTURE)

The network MUST follow this hierarchical pattern:

```plaintext
[Generators]
   ↓
[HV Transmission Lines]
   ↓
[HV/MV Substation]
   ↓
[MV Feeders]
   ↓
[RMUs / Switch Nodes]
   ↓
[Transformers (MV→LV)]
   ↓
[LV Feeders]
   ↓
[Consumers]
```

---

## 6. MV Network Design Rules (IMPORTANT)

* MV network must include **at least 3 feeders**
* Feeders must branch into multiple RMUs
* RMUs must connect to transformers
* At least one feeder must simulate **ring topology capability**
* Others can be radial

---

## 7. Minimum Asset Count (LOCKED)

The system must include:

* 2 generators (solar + gas)

* 2 HV transmission lines

* 2 HV/MV substations

* 3 MV feeders

* 6–8 RMUs

* 4–6 transformers

* 4–6 LV feeders

* 8 consumers:

  * 6 residential
  * 1 industrial
  * 1 critical (hospital)

---

## 8. Data Model Requirements

Each asset must include:

```json
{
  "id": "string",
  "type": "string",
  "voltage_level": "HV | MV | LV",
  "location": { "lat": number, "lon": number },
  "connections": ["asset_id"],
  "metadata": {}
}
```

---

## 9. Behavioral Logic (MANDATORY)

---

### 9.1 Load Aggregation

* Consumer demand flows upstream
* LV feeder load = sum of connected consumers
* Transformer load = sum of LV feeders
* MV feeder load = sum of transformers

---

### 9.2 Generation Balancing

* Total generation must equal total demand
* Solar output = time-based curve
* Gas output = adjusts to balance system

---

### 9.3 Line / Feeder Loading

Each line or feeder must expose:

* load_mw
* loading_percent

---

### 9.4 Transformer Metrics

Each transformer must expose:

* capacity_kva
* current_load
* utilization_percent

---

## 10. Switching Logic (HIGH PRIORITY FEATURE)

RMUs must support:

* state: open / closed

Behavior:

* If RMU is open → downstream assets receive no power
* System must reflect this in load calculations

---

## 11. Visualization Requirements

---

### 11.1 Color Coding (MANDATORY)

* HV: Orange
* MV: Blue
* LV: Green

---

### 11.2 Line Thickness

* HV: Thick
* MV: Medium
* LV: Thin

---

### 11.3 Asset Icons

Each asset type must have a distinct visual representation:

* Generator
* Substation
* RMU
* Transformer
* Consumer

---

## 12. Interaction Requirements

When user clicks any asset:

Display:

* Type
* Voltage level
* Metadata
* Current load / output
* Connected assets

---

## 13. Constraints (STRICT)

* Do NOT introduce real-world datasets
* Do NOT use paid services
* Do NOT add advanced physics simulation
* Do NOT simplify hierarchy
* Do NOT skip MV layer

---

## 14. Development Priority

Implement in this order:

1. Update data model with new asset types
2. Build full network topology (connections)
3. Implement load propagation logic
4. Add RMU switching behavior
5. Update visualization (layers + styling)

---

## 15. Definition of Done

The upgrade is complete when:

* MV layer is clearly visible and functional
* Transformers correctly connect MV → LV
* Load flows from consumers → upstream
* RMU switching affects downstream supply
* System visually distinguishes HV, MV, LV

---

END OF INSTRUCTION DOCUMENT
