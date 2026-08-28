# StitchCheck Demo Media Skill

Generate demo video and media assets for the StitchCheck local React/Vite demo walkthrough.

## Purpose

This skill produces a six-scene video demonstrating the StitchCheck review-first flow:
1. Locked `Confirm itinerary first` state
2. Editable field and user correction
3. Confirmation and unlocked panels
4. Sanitized provider status labels
5. Comparison view
6. Local Keep/Switch ending

All scenes use synthetic fixture data only. No live provider calls. No PII. No credentials.

## Invocation

```
/skill stitchcheck-demo-media [options]
```

### Options

- `--scene <n>` — Generate a single scene (1-6)
- `--all` — Generate all six scenes sequentially
- `--narration` — Include narration audio track
- `--dry-run` — Validate scene manifest without generating output

## Pipeline Contract

The six-scene pipeline is defined in `references/pipeline-contract.md`. Each scene has:
- Fixed duration
- Required visual elements
- Required labels (if applicable)
- Narration script
- Screenshot capture points

## Scene Manifest

Scene configuration is defined in `templates/scene-manifest.json` and validated against `references/scene-manifest.schema.json`.

## Evidence Labels

Three exact labels must appear at specified scenes:
- `Demo itinerary — local demo fixture`
- `Local fallback — not Nosana evidence`
- `Demo alternatives — local demo fixture`

See `references/evidence-and-privacy.md` for placement rules and privacy constraints.

## Output Structure

```
output/stitchcheck-demo-media/
├── scenes/
│   ├── scene-01-locked-state.mp4
│   ├── scene-02-editable-correction.mp4
│   ├── scene-03-confirmation-unlock.mp4
│   ├── scene-04-provider-status.mp4
│   ├── scene-05-comparison.mp4
│   └── scene-06-keep-switch-ending.mp4
├── narration/
│   └── narration-track.mp3
├── final/
│   └── stitchcheck-demo-full.mp4
└── manifest.json
```

## Dependencies

- Local dev server running at `http://localhost:5173`
- Synthetic fixtures GEM-01 through GEM-05 available
- No external service credentials required

## Troubleshooting

See `references/troubleshooting.md` for common issues and recovery procedures.

## Constraints

- **No live provider calls** — all data is local synthetic fixtures
- **No PII** — no real passenger, booking, or payment data
- **No credentials** — no `.env.local` access or API key usage
- **No write actions** — no booking, payment, or order creation
- **Exact labels** — never abbreviate or paraphrase the three evidence labels
