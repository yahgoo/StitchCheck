/* ── Centralised disclaimer / safety label constants ──
 *
 * MIGRATED: This file now re-exports from the shared core.
 * The canonical source is core/provenance/. This file exists for
 * backward compatibility with existing component imports.
 *
 * New code should import from '../../core' directly. */

export type {
  ExtractionProvenance,
  GeminiProvenance,
  AtlasProvenance,
  NosanaProvenance,
} from '../../../core/provenance/metadata';

export {
  EXTRACTION_PROVIDER_LABELS,
  GEMINI_LABELS,
  getExtractionProviderLabel,
  getGeminiLabel,
  ATLAS_UI_LABELS,
  getAtlasLabel,
  NOSANA_UI_LABELS,
  getNosanaLabel,
  OPENROUTER_HISTORICAL_LABEL,
  LABELS,
  DISABLED_MESSAGE,
  FINAL_STATEMENT,
} from '../../../core/provenance/labels';

export {
  MISSING_FIELD_LABELS,
  formatMissingField,
  type MissingFieldCategory,
} from '../../../core/copy/missing-field-labels';
