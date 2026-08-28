# MiniMax M3 Visibility Fix — Design Specification

**Scope:** Welcome screen and extraction visibility only. This is an analysis and implementation specification, not application code. `Upload itinerary` remains the only primary CTA; neither sample path becomes an equal-primary action. Do not change Options, Recovery, Atlas, or downstream product behavior.

## 1. Confirmed current-state problem

The Welcome screen currently has one correct primary CTA, **Upload itinerary**, but its two secondary samples are ordered in a way that obscures the product's MiniMax M3 capability:

- The structured-data shortcut, currently labelled **Try a sample itinerary**, appears first and has more prominence.
- That shortcut loads prebuilt itinerary data directly. When provider status is checked, MiniMax M3 correctly appears offline because no extraction was performed.
- The screenshot sample, currently labelled **Try sample itinerary screenshot**, can perform real MiniMax extraction, but only after the visitor selects it and then clicks **Check my itinerary**.

A judge who takes the first sample path sees no MiniMax work and can reasonably mistake a correct offline status for a broken integration. The fix must make the extraction-capable sample the clearly preferred *secondary* demo path while retaining Upload itinerary as the sole primary action.

## 2. Recommended approach — Option A: reorder the secondary options

Recommend **Option A**. Put the screenshot sample first and frame it as the recommended way to see the product work, while retaining the structured-data route as a clearly labelled fast path below it. This removes the highest judging risk—following the most prominent sample and never seeing MiniMax—without removing a useful instant-preview route. It also preserves the Stripe single-primary-CTA rule: Upload itinerary is still the only filled, dominant control; the screenshot sample gains position and stronger secondary styling, not equal-primary status. Option B would guarantee extraction but unnecessarily removes the fast path, and Option C leaves the risk that the first choice is perceived as the expected demo journey despite improved labels.

## 3. Exact Welcome and extraction-visibility specification

### Welcome-screen CTA order and styling

Keep the existing primary control first and unchanged in hierarchy:

1. **Upload itinerary** — the only **primary** CTA. Use the existing filled indigo primary treatment.
2. **Try the screenshot sample — extract with MiniMax M3** — the first **emphasized-secondary** CTA. This uses an indigo outline, indigo text, white background, and no solid fill. It is full-width only if the Upload itinerary control is full-width, so the visual layout remains aligned without making it read as a second primary. Place this exact helper text directly below it: **“Use a sample itinerary screenshot. On the next step, select ‘Check my itinerary’ to start MiniMax M3 extraction.”**
3. **Use the ready-made sample — skips extraction** — the second **tertiary-secondary** action. Style it as a subdued text link or neutral ghost button, below the screenshot-sample helper text, with no indigo-filled treatment and less visual weight than the screenshot action. Place this exact helper text directly below it: **“Fast preview with itinerary data already loaded.”**

The screenshot-sample action is more discoverable through order, precise benefit copy, and the stronger outlined secondary tier. It is not a primary action and must never be rendered as a filled button competing with Upload itinerary.

### Actual MiniMax loading and completion states

On the screenshot path, when the visitor clicks **Check my itinerary** and the app actually starts the MiniMax M3 extraction request, show a visible in-progress status beside the extraction/review transition:

> **MiniMax M3 is reading your itinerary…**

Show that copy and an activity indicator only for the real request's actual in-flight duration. Do not add a minimum dwell time, scripted pause, or simulated progress stages.

When that request completes successfully, show this provenance tag at the top of the review/correction screen, adjacent to the extracted-itinerary summary:

> **Extracted by MiniMax M3**

Use a compact neutral-to-positive provenance tag (for example, a small outlined pill with a functional check icon), not a large promotional badge. The tag is permitted only when this visit's extraction result was actually returned by MiniMax M3. If extraction fails, times out, is skipped, or uses another provider, replace it with an accurate status appropriate to that outcome; never retain or reuse the MiniMax provenance tag.

### Ready-made sample MiniMax status

On the structured shortcut, retain the accurate status label:

> **MiniMax M3: offline**

Place the following inline note immediately next to or directly beneath that status, not in a tooltip alone:

> **Expected for this fast path — a ready-made itinerary was loaded directly, so no MiniMax M3 extraction request was made.**

This is explanatory context, not an error treatment. It makes the status's provenance clear before a judge can interpret it as a failure.

### Compact provider-check bar

Do **not** render **“Live checks: N of 3 passed”** before provider checks have actually started. Before any applicable provider work, omit the compact bar entirely; an unrun workflow must not look like it has live results.

During real provider checking, render the bar in its existing compact check-status location with this exact, outcome-neutral copy:

> **Provider checks: N of 3 complete**

Replace `N` only as each real check completes. Do not call a check “passed” merely because it completed. After all checks finish, retain the same wording with `3`, and show each provider's actual result separately. Keep MiniMax extraction progress separate from this bar: extraction is represented by the exact MiniMax loading copy above, and provider-check counting begins only when those checks truly begin.

## 4. Non-negotiable honesty constraint

**MiniMax M3's status must always reflect what actually happened. Never fake a “live” badge, fabricate a loading delay, force a successful status, or display MiniMax provenance when MiniMax did not perform the extraction.** The screenshot sample may show in-progress and completed MiniMax states only around a real MiniMax request and response. The ready-made shortcut must continue to say MiniMax M3 is offline, with the prescribed explanation, because it deliberately skips extraction.

## 5. What a judge will now see

1. On the Welcome screen, the judge first sees the clearly dominant **Upload itinerary** CTA. Directly below it, the first secondary option reads **Try the screenshot sample — extract with MiniMax M3** and explains that MiniMax starts after **Check my itinerary** on the next step.
2. The judge selects that recommended sample and reaches the normal confirmation point. The secondary fast path remains available below the preferred path, explicitly saying it skips extraction, so there is no ambiguity about the two routes.
3. When the judge selects **Check my itinerary**, the UI shows **MiniMax M3 is reading your itinerary…** for the real duration of the extraction request. There is no invented wait: a quick provider response is quick, and a slower one remains visibly in progress.
4. When MiniMax returns the extracted itinerary, the review/correction screen shows **Extracted by MiniMax M3** beside the extracted details. The judge can see both the extraction result and its real provenance before making corrections.
5. Only when provider checks genuinely begin does the compact status show **Provider checks: N of 3 complete**. It advances from actual completions and does not misrepresent incomplete work as passed work.
6. If the judge instead chooses the ready-made sample, **MiniMax M3: offline** is immediately accompanied by the explanation that the fast path loaded prebuilt data and made no MiniMax extraction request. The status reads as intentional and correct, not as a failed integration.

## 6. Stripe design reference — self-contained implementation values

Apply the following values to this Welcome-screen change and retain them for future Welcome-screen work:

- **Color:** Use one brand accent, indigo `#533afd`, sparingly for primary actions and focus only. Use near-white backgrounds: `#FFFFFF` or subtle cool gray `#F6F9FC`. Use deep navy text: `#0A2540` or similar, never pure black. Use a lighter slate gray for secondary text.
- **Spacing:** Use a strict 8px-based grid: `4`, `8`, `12`, `16`, `24`, `32`, and `64px`. Generous whitespace is deliberate restraint, not decoration.
- **Corners and shadows:** Use low border radius, `4–6px`, with flat-to-minimal shadow. Do not use heavy elevation.
- **Typography:** Use a humanist sans-serif. Headings use tight letter spacing; body text uses relaxed line height of approximately `1.5`; maintain a clear hierarchy of a large headline and smaller supporting text.
- **Buttons and hierarchy:** Preserve the single-primary-CTA principle exactly: one clearly dominant primary action per screen or section, never two competing filled buttons side by side in the same visual band. Style secondary actions with lower emphasis—outline, ghost, or text-link—so the hierarchy is unmistakable at a glance. The screenshot demo's increased prominence comes from secondary-tier position and framing, not from a second primary-filled button next to Upload itinerary.
- **Icons:** Use them sparingly and functionally only, such as a small route or plane icon next to a route string. Do not add decorative illustration.
- **Trust cues:** Use short, plain-language reassurance exactly where doubt arises, not hidden in a generic footer. The ready-made-path explanation next to **MiniMax M3: offline** is a required trust cue.
