# StitchCheck Options Screen — Persona UX Critique

## Scope and evidence

This critique combines a live, local run on 2026-08-26 with source inspection. The app was started with `DATA_MODE=live` and I followed Welcome → **Try a sample itinerary** → **Check my itinerary** → Options. The live run used the sample KUL → SIN → BKK itinerary. It reported **Live checks: 2 of 3 passed**: MiniMax M3 was offline for the intentionally skipped sample extraction; Nosana and Atlas Sandbox were live. The Atlas alternatives and per-leg preview observations below are live-observed; field names, state transitions, and implementation feasibility are code-inferred from the named files.

Observed Options state after the preview pipeline settled:

- The featured recovery card showed KUL → SIN, nonstop, onward SIN → BKK, and `Arrival impact: —`.
- **First flight — unbooked previews (up to 5)** showed **We don't have this yet**. The second-leg section showed one featured verified card, SIN → DMK (FD FD356), 14:40–16:20, at USD 104.85, plus **See more verified options (4)**. Expanding it revealed TR626 (USD 107.10), TR624 (USD 107.57), TR610 (USD 114.11), and TR608 (USD 119.39).
- **Live Atlas alternatives (20)** displayed all 20 first-leg cards expanded. They were not price-ordered: OD805 at USD 38.60 appeared first, while AK701 at USD 21.80 appeared eighth. The list included two SZB → SIN results as well as KUL → SIN results; each card showed time, price, availability, **Verify offer**, and **Switch to this plan**.

## 1. Priya’s walkthrough — price-conscious backpacker

I start at StitchCheck, choose **Try a sample itinerary**, and confirm the two sample legs: KUL → SIN on SC-101 from 08:00 to 09:15, then SIN → BKK on SC-202 from 12:30 to 13:45, with a 195-minute connection. After I select **Check my itinerary**, the screen says my connection is at risk and that live alternatives are ready.

The recommended KUL → SIN card looks like a suggestion, but it gives me no price and says `Arrival impact: —`. I do see an onward SIN → BKK route, but I cannot judge whether this recommendation fits my budget. I then reach a first-leg verified-preview section that only says **We don't have this yet**, so it does not help me compare a verified KUL → SIN fare.

The second-leg previews are more reassuring: FD356 is verified at USD 104.85 and the hidden four alternatives can be opened. But I have to expand them to compare prices, and the featured FD356 goes to DMK rather than BKK, which means I need to inspect the route rather than relying on its featured position alone.

The 20 live first-leg cards finally contain the price information I need, but their visible order is not a price order: USD 38.60 appears first, USD 35.55 second, USD 44.54 third, USD 36.26 fourth, USD 27.11 fifth, and the actual lowest observed fare, AK701 at USD 21.80, is eighth. I have to scan the whole set manually, compare USD amounts, and then choose between **Verify offer** and **Switch to this plan**. The compact header says **2 of 3 passed**, which is useful context, but it does not make the lowest viable fare apparent.

### Priya’s top frustrations

1. I cannot identify the cheapest first-leg alternative without reading all 20 unsorted prices; the USD 21.80 option is not near the top.
2. The recommendation offers no price or arrival-impact figure, while the first-leg verified-preview panel has no card at all.
3. I must separately decide whether to verify or select a card, even though price verification is the key confidence step before I would submit a non-binding switch request.

## 2. Marcus’s walkthrough — time-pressed traveller

I choose the sample itinerary and tap **Check my itinerary** because I want a quick answer. The Options screen immediately gives me the useful headline, **Your connection is at risk**, and a recommended KUL → SIN / onward SIN → BKK card. But the card’s `Arrival impact: —` makes the supposedly quick recommendation feel incomplete, so I cannot confidently act on it.

The page next shows two preview sections. The first says **We don't have this yet**; the second takes time to finish verifying and then gives me one featured USD 104.85 card plus four hidden cards. I can expand the second group, but that is another decision and additional reading when I have less than two minutes.

Below that is a fully expanded, 20-card live alternatives list. Every card repeats route, time, price, availability, **Verify offer**, and **Switch to this plan**. The list has no compact “start here” state, even though I already have a separately featured recommended card. To act on a raw alternative, I first have to choose whether to verify it or select it; after selection, the existing decision area still asks for an explicit **Submit switch request**. That last confirmation is appropriate, but the earlier duplicated choice costs attention. **Live checks: 2 of 3 passed** is compact and unobtrusive; opening **How this works** makes the detail available without crowding the task.

### Marcus’s top frustrations

1. The screen offers no single, complete quick answer: its “Recommended” card is missing the arrival-impact value, and the first-leg preview is unavailable.
2. Twenty fully expanded alternatives create substantial scrolling and repeated controls before I can make a decision.
3. Each raw card presents Verify and Switch as two competing actions, then the flow needs a final request confirmation as well.

## 3. Shared pain points

| Priority | Pain point | Persona coverage | Evidence |
| --- | --- | --- | --- |
| Highest | The 20 live alternatives are all expanded and are not ordered by cost, so comparison is laborious. | Priya and Marcus | Live run: USD 38.60 preceded USD 21.80; `App.tsx` renders `alternatives.map(...)` directly. |
| Highest | The recommendation looks decision-ready but exposes `Arrival impact: —`, while first-leg verified previews may have no result. | Priya and Marcus | Live run; `RecoveryTradeoffs.arrivalImpactMinutes` is nullable in `app/src/types/recovery-plan.ts`. |
| High | Verify and Switch require users to understand two per-card actions before the existing final request confirmation. | Priya and Marcus | `handleVerifyOffer` and the raw-card `setDecision('switch')` handler are separate in `app/src/App.tsx`. |
| Persona-specific | Priya has no price-first shortcut to the lowest first-leg offer. | Priya | `AtlasRawOffer.total_price` exists in `app/src/atlas/types.ts`; the live list did not use it for ordering. |
| Persona-specific | Marcus needs a compact default and a clear single next action more than a complete visible comparison table. | Marcus | `UnbookedTicketPreviewLegSection` already demonstrates a featured-card-plus-disclosure pattern. |

## 4. Prioritized improvement list

Ordered as lowest-effort, highest-shared-coverage first. All proposed values come from current Atlas/recovery fields or reuse an existing component pattern; none requires a new metric, booking capability, or hidden data.

1. **Price-sort the raw “Live Atlas alternatives” list ascending by default, with `offer_id` as the tie-break.** Serves Priya and Marcus; use `AtlasRawOffer.total_price` and `offer_id` from `app/src/atlas/types.ts`, exactly matching the existing `OFFER_SELECTION_RULE` (`lowest total_price ascending, tie-break offer_id lexicographic`) and `selectOffersForPreview` in `app/src/atlas/unbooked-previews.ts`; this makes the first visible offer a direct, explainable lowest-price result rather than a composite recommendation. **Effort: Small.**

2. **Collapse the raw 20-card list after a small price-sorted leading set and provide a working “See more live alternatives (N)” disclosure.** Serves Priya and Marcus; reuse the exact local `expanded` state, `remaining.length`, `aria-expanded`, and featured/remaining rendering pattern in `app/src/components/UnbookedTicketPreviewLegSection.tsx` (rather than permanently hiding offers). The ordering comes from the same real `total_price` / `offer_id` rule above. **Effort: Medium.**

3. **Make the price-sorted first raw card a clearly labelled lowest-listed-price starting point, not a new “best” score.** Serves Priya immediately and gives Marcus a fast default; derive the label solely from the first item after the `total_price` / `offer_id` ordering used by `selectOffersForPreview` in `app/src/atlas/unbooked-previews.ts`. Keep the card’s existing `availabilityLabel`, which is mapped from `bookable` / `price_status` by `mapOfferToAlternative` in `app/src/atlas/adapter.ts`, so the shortcut does not imply verification or booking. **Effort: Small.**

4. **Replace the raw-card Verify + Switch choice with one “Verify and select plan” action that only selects after successful Verify; preserve the separate final “Submit switch request” confirmation.** Serves Priya and Marcus; use the existing `handleVerifyOffer(offerId)` and `VerifySummary.status`, `currentPrice`, and `currency` in `app/src/App.tsx` / `app/src/atlas/adapter.ts`. The safety condition is strict: call `setDecision('switch')` only when `mapVerifyResponse(...).status === 'success'`, show the verified `currentPrice` if available, and retain the current confirmation whose copy states that no booking, payment, reservation, or order is created. This merges comparison friction without auto-booking or claiming a verified supplier outcome. **Effort: Large.**

5. **De-emphasize an unavailable recommendation trade-off instead of presenting it as a blank measurement.** Serves Priya and Marcus; conditionally omit the top-card arrival-impact line when `recommendedPlan.tradeoffs.arrivalImpactMinutes === null`, while retaining the explicit unavailable state in the expandable recovery explanation (`PlanCard` already renders the same nullable `arrivalImpactMinutes` in `app/src/components/RecoveryPlanAnimation.tsx`). This is honest about a field the current recovery model does not have, rather than making the featured card look broken. **Effort: Small.**

## 5. What NOT to change

- Keep the per-leg cards explicitly labelled **Unbooked preview · Not a real ticket · No booking, payment, or reservation created**. That disclosure and the `isLiveVerified` / `status` distinction in `app/src/atlas/unbooked-previews.ts` preserve clear provenance for both personas.
- Keep the second-leg featured verified card plus optional expansion model. `selectBestOptionCard` uses `BEST_OPTION_SELECTION_RULE` in `app/src/atlas/unbooked-previews.ts`, and the live run showed that it lets Marcus see one verified result while Priya can still expand and compare all five.
- Keep the compact **Live checks: 2 of 3 passed** primary status and place provider names only under **How this works**. `ProviderStatusBar` and `countLiveSuccess` in `app/src/components/ProviderStatusBar.tsx` already implement that progressive disclosure well.
- Keep **Keep current itinerary** alongside the switch path and retain the explicit non-binding request confirmation. `app/src/App.tsx` correctly says **Request submitted — awaiting verified supplier outcome** and never presents selection as a booking.
- Keep the source/provenance cues (for example, **Atlas Sandbox · live** and individually verified-offer counts). They provide confidence without pretending that a search result is a ticket.
