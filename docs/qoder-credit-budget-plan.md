# Qoder Credit Budget Plan — 2026-08-20

## Mode Availability Rule

- Qwen3.7-Max and Qwen3.7-Plus are currently available in Agent mode.
- Do not assume a model is available in Expert mode; check the current model selector before scheduling.
- If Qwen3.8-Max is available in Expert mode, reserve it for a bounded, unattended overnight refinement task only after the awake local UI build has passed type-check and production build.
- If Qwen3.8-Max is not available in Expert mode, do not force Expert mode. Use one bounded Agent-mode task with the cheapest suitable available model.

## Revised Cost Strategy

| Time / Trigger | Qoder Mode | Model | Credit Rate | Use It For | Guardrails |
|---|---:|---|---:|---|---|
| Awake — initial implementation | Agent | Qwen3.7-Plus | 0.04x off-peak | Read-only reviews, small fixes, docs, handoff notes, one-file edits, checking agent output, inspection, focused fixes | Avoid Expert mode and parallel teams unless a critical blocker appears. |
| Awake — real unresolved blocker | Agent | Qwen3.7-Max | 0.1x off-peak | Escalation only for a real unresolved React/TypeScript blocker | Single bounded task; do not chain multiple escalation tasks. |
| Overnight (22:00–08:00 Singapore time) | Expert | Qwen3.8-Max | 0.25x off-peak | One-time tightly bounded local UI refinement only if available in Expert-mode selector and local UI build is already working | See Overnight Sandbox Policy below. |
| After UI is working | Agent | Qwen3.7-Plus | 0.04x off-peak | Focused UI polish, responsive fixes, empty/error states, README, test cleanup | Keep tasks narrow and sequential. |
| Real service test rounds | Agent | Qwen3.7-Plus or Qwen3.7-Max if needed | Low-cost preference | One authorized Gemini, Nosana, or Atlas case at a time; evidence capture and bug fixes | No parallel service calls; each call needs explicit approval. |
| Final submission phase | Agent | Qwen3.7-Plus | Lowest available rate | Demo script, README, slides, video checklist, submission QA | Preserve a credit buffer for last-minute fixes. |

- Do not use parallel agent teams merely because off-peak pricing is active.

## Overnight Sandbox Policy

- Use Experts Mode only for a one-time, tightly bounded local UI refinement task.
- Allow work only within `app/`, plus read-only access to explicitly listed local plan/checklist/fixture-contract files.
- Do not pre-approve terminal permission escalation outside the sandbox.
- If Qoder requests escalation, package installation, credentials, external access, or any write outside `app/`, stop and wait for human review.
- Experts Mode sandbox automation does not override project safety constraints.
- The task must prohibit `.env.local` access, network requests, authentication, Gemini/OpenRouter/Nosana/Atlas execution, Git operations, and evidence edits.

## Credit Allocation

| Credit Allocation | Suggested Reserve |
|---|---:|
| Awake Agent-mode implementation (Qwen3.7-Plus) | 150–200 credits |
| Awake escalation (Qwen3.7-Max, Agent mode) | 100–150 credits |
| Overnight Expert-mode refinement (Qwen3.8-Max, if available) | 250–350 credits |
| Authorized service-test debugging | 250–350 credits |
| Final submission materials and emergency fixes | 400 credits minimum |
| Avoidable spend | Broad parallel expert teams, duplicate agents, repeated audits without a clear failure |

## Default Rule

Use Qwen3.7-Plus in Agent mode at 0.04x off-peak for all awake coding work. Escalate to Qwen3.7-Max in Agent mode at 0.1x off-peak only for a real unresolved React/TypeScript blocker. Reserve Expert mode with Qwen3.8-Max at 0.25x off-peak for a single bounded overnight refinement task, and only if it is available in the Expert-mode selector and the local UI build is already passing type-check and production build.

## Safety Reminders

- Do not let agents access `.env.local`.
- Do not make external calls without separate explicit human approval.
- Keep OpenRouter temporary-path evidence separate from direct Gemini validation.
- Keep Nosana and Atlas local placeholders separate from live-service evidence.
- Do not initialize Git, commit, or push before Saturday.
- Do not state that Expert mode automatically grants safe unrestricted access.
