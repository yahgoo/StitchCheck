# StitchCheck Dependency-Graph Recovery Feature — Implementation Specification

## 1. Product Goal

Enable StitchCheck to visualize and compute the chain reaction caused by a disrupted self-transfer itinerary, showing travellers how a single flight delay cascades through downstream dependencies (connection window, onward leg, hotel check-in, downstream commitments), and present one explainable recovery plan while keeping the traveller in control.

**Core value proposition:**
- Transform an opaque risk score into a visible, explainable cascade
- Show downstream impact before the traveller commits to a decision
- Present candidate alternatives and collapse them into one recommended plan
- Maintain full provenance transparency and safety boundaries
- Keep the traveller in control: review, confirm switch request, await verified outcome

**User journey extension:**
```
flight screenshot
→ itinerary extraction
→ traveller correction
→ itinerary confirmation
→ self-transfer risk explanation
→ [NEW] dependency cascade visualization
→ [NEW] candidate alternatives
→ [NEW] recovery plan collapse
→ [NEW] traveller review and confirm switch request
→ [NEW] request submitted (awaiting verified outcome)
→ safer alternatives
→ traveller Keep/Switch decision
```

## 2. Current Architecture

### 2.1 Shared Core (`core/`)

**Domain models** (`core/domain/`):
- `FlightLeg`, `ExtractionResult`, `RiskResult`, `SearchResult`, `ComparisonData`, `Decision`
- Canonical source for all TypeScript types
- Re-exported by `app/src/data/types.ts` for backward compatibility

**Provenance system** (`core/provenance/`):
- `GeminiProvenance`, `AtlasProvenance`, `NosanaProvenance`, `DaytonaProvenance`
- Label resolution functions: `getGeminiLabel()`, `getAtlasLabel()`, `getNosanaLabel()`
- Central label constants in `core/provenance/labels.ts`

**Safety gates** (`core/safety/`):
- `checkTicketingPrerequisites()` — all 7 prerequisites default to false
- `assertWriteBlocked()` — throws if writes enabled without prerequisites
- `assertUserConfirmed()` 
[ai-coding: truncated for UI, totalLength=47432]