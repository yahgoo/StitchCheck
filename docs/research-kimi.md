# Research Output — Kimi (Build with Gemini Hackathon, 22 Aug 2026)

Three distinct candidate ideas for budget travellers. No winner is recommended;
NotebookLM compares all nine model outputs.

## Theme source

Official themes for this event (65labs × Google DeepMind DX × Lorong AI,
22 Aug 2026, Lorong AI @ one-north, Singapore) — announcement:
https://www.linkedin.com/posts/sherrypeek_65labs-is-excited-to-be-co-hosting-a-build-activity-7493103942420287488-IYe4
(reshared by Google DeepMind's Abhishek Modi:
https://www.linkedin.com/posts/abhishekmodi_hackathon-deepmind-google-activity-7493496554222219264-Y4qq)

The three official tracks:
1. **Best Use of Gemma** — ship something with the open Gemma models.
2. **Best Elderly Hack** — tech built for the aging population ("by 2030 nearly 1 in 3 people here will be seniors").
3. **Most Creative Gemini Hack** — wildest/fastest/most creative use of Gemini Flash.

---

## Idea 1 — GateMate

**1. Name and pitch.** GateMate — a voice-first day-of-travel companion that lets an elderly
budget traveller point their phone at a boarding pass or departure board, speak in their own
dialect, and get one spoken, verified next step ("Gate B7, boarding 20:40, you have 50 minutes")
plus an automatic ping to family.

**2. Target segment.** Travellers 65+ flying low-cost carriers in Southeast Asia, often alone,
often not English-first, typically visiting family.

**3. Pain point and trigger moment.** Day-of-travel airport navigation has gone self-service
(check-in kiosks, app boarding passes, app-only gate alerts). The trigger: an elderly traveller
standing in front of a departure board or holding a paper boarding pass, unsure of gate, time,
or whether anything changed — with airline staffing reduced and family not physically present.

**4. Evidence and sources.**
- Only 54% of UK adults aged 75+ are recent internet users vs 99% of ages 16–44 (ONS 2020 data,
  via peer-reviewed study): https://pmc.ncbi.nlm.nih.gov/articles/PMC10938227/
- ACI EUROPE passenger survey: 11% of passengers are not confident with or avoid digital services,
  concentrated in over-65s, who disproportionately still use staffed check-in desks:
  https://www.aci-europe.org/downloads/resources/ACI%20%20EUROPE%20Survey%20on%20the%20impact%20of%20digitalisation%20and%20automation%20on%20the%20passenger%20experience%20-%20RESULTS.pdf
- AARP 2024: 38% of 50+ travellers feel overwhelmed by the number of digital tools; many still
  use paper boarding passes despite knowing mobile passes exist:
  https://www-pi.aarp.org/pri/topics/social-leisure/travel/2024-travel-technology-older-adults/
- Singapore context (the hackathon's own framing): by 2030 nearly 1 in 3 people in Singapore will
  be seniors: https://www.linkedin.com/posts/sherrypeek_65labs-is-excited-to-be-co-hosting-a-build-activity-7493103942420287488-IYe4

**5. Existing workaround and why it fails.** Ask airport staff or call family. Staffing at
budget terminals is being cut in favour of self-service (per the ACI survey trend), and family
is remote with no visibility into the actual booking state.

**6. Theme: Best Elderly Hack.** The product exists only for this user; voice-and-photo input is
designed around elderly abilities, not retrofitted. Removing the elderly use case removes the
product.

**7. Gemini role and visible evidence.** Gemini multimodal intake: photo of boarding pass or
departure board + a spoken note (e.g., Mandarin) → structured "situation JSON"
`{flight, gate, scheduled_time, traveller_concern, mobility_note}` that decides the next step.
Visible on screen: the photo, the extracted JSON, and the spoken reply it drove.

**8. Atlas Sandbox role and visible evidence.** Atlas verifies the traveller's actual booking in
the sandbox (order status, flight, times) so the spoken instruction is grounded in a verified
travel record, not model invention. Visible: a "verified against booking" card with sandbox order
status. Read-only in P0; any write would sit behind human confirmation.

**9. Nosana role and visible evidence.** A Nosana GPU job runs multilingual ASR (dialect speech →
text) and neural TTS for the reply; the app consumes the transcript and audio it returns.
Visible: Nosana job ID + status panel completing before the reply plays.

**10. Primary flow.** Trigger: voice note + photo at the airport → Decision: Gemini situation JSON
+ Atlas-verified flight status → Outcome: one spoken instruction in the traveller's dialect, a
large-print card, and a family notification.

**11. Smallest P0 slice.** One synthetic persona, one fixture voice note + one fixture photo, one
Atlas sandbox order verification, one Nosana ASR/TTS job, one spoken reply. No real personal data,
no real bookings, no payments.

**12. Risks / assumptions / fallback.** Live ASR is the stage risk → fallback to pre-recorded
fixture audio and pre-rendered TTS. Atlas sandbox degraded → announce and show a labelled replay
of a verified record. No real PII: synthetic persona only.

---

## Idea 2 — ClaimMate

**1. Name and pitch.** ClaimMate — a privacy-first flight-compensation copilot: snap the delay
email and boarding pass, and it verifies the disruption, checks eligibility, and drafts the claim
letter — without sending your documents to a claims farm.

**2. Target segment.** Budget travellers on disrupted low-cost flights (EU/UK-touching or other
compensation regimes) who are owed money but never claim it.

**3. Pain point and trigger moment.** After a long delay or cancellation, the traveller doesn't
know compensation exists, can't tell if their case qualifies, or gives up after a form-letter
rejection. Trigger: sitting at home days after the disruption, staring at the airline's apology
email.

**4. Evidence and sources.**
- AirHelp 2025 global survey (3,100 travellers): 81% know they have rights but only 21% can
  correctly identify when they're entitled — 79% effectively don't know their rights; only ~40%
  of disrupted passengers even try to claim:
  https://www.airhelp.com/en-int/blog/air-passengers-rights-survey-2025-what-we-found-out/
- BEUC via European Pulse: only 38% of eligible passengers actually receive compensation; an
  estimated €3.2B unpaid; airlines wrongfully reject 52% of claims:
  https://europeanpulse.com/how-claim-agencies-fill-the-gap-in-eu-air-passenger-rights-enforcement
- Compensation statistics roundup: ~€5.5–5.9B in EU261 compensation goes unclaimed annually;
  only ~5–8% of eligible passengers file:
  https://flightowed.com/blog/eu-flight-compensation-statistics

**5. Existing workaround and why it fails.** Airline web forms (opaque, reject-prone) or claims
agencies that take a large success-fee cut and warehouse personal documents. Awareness plus
procedure friction defeats most eligible travellers before they start.

**6. Theme: Best Use of Gemma.** Gemma (open model) is the eligibility classifier and claim
drafter — the core engine. Privacy is the product reason for Gemma: claim documents contain IDs
and travel history, so the drafting runs on user-chosen compute, not a claims farm.

**7. Gemini role and visible evidence.** Gemini multimodal intake: photos of the disruption email
and boarding pass → structured case-facts JSON `{flight, disruption_type, delay_minutes,
reason_stated}` that selects the eligibility path. Visible: the photos next to the extracted
case JSON.

**8. Atlas Sandbox role and visible evidence.** Atlas verifies the booking record in the sandbox
(order status, flight, timing) as the evidentiary spine of the claim, so case facts are anchored
to a real travel record. Visible: a "verified booking record" panel from the sandbox.

**9. Nosana role and visible evidence.** Nosana hosts the Gemma workload on decentralized GPU;
the app submits the case JSON and consumes Gemma's eligibility verdict and drafted letter.
Visible: Nosana job/endpoint status plus the returned verdict + letter. Removing Nosana removes
the drafting engine.

**10. Primary flow.** Trigger: photos of disruption evidence → Decision: Gemini case facts +
Atlas-verified record + Gemma eligibility verdict → Outcome: a ready-to-review claim letter and
document checklist; the human sends it themselves.

**11. Smallest P0 slice.** One fixture disruption case (synthetic email + boarding pass), one
Atlas sandbox order verification, one Nosana-hosted Gemma job, one letter preview. No auto-send,
no real claims filed.

**12. Risks / assumptions / fallback.** Legal accuracy → scoped to informational drafting with
human review before anything is sent (nothing is filed automatically). Gemma cold-start latency
on stage → pre-computed verdict/letter cache for the demo case. Atlas degraded → labelled replay.

---

## Idea 3 — StitchCheck

**1. Name and pitch.** StitchCheck — a self-transfer risk auditor: screenshot your two cheap
separate tickets before paying, and it shows your real missed-connection risk, the failure-cascade
cost, and a protected alternative at a real price.

**2. Target segment.** Budget travellers — students, backpackers, migrant workers — who stitch
separate low-cost tickets to save money, typically via OTA "hacky fare" results.

**3. Pain point and trigger moment.** The savings are visible at checkout; the risk is not. The
trigger: the booking screen showing two separate tickets with a tight layover — no warning that a
modest delay forfeits the onward ticket (and can no-show-cancel the return).

**4. Evidence and sources.**
- OAG survey (cited in self-transfer explainer): 55% of travellers cite missing a connection as
  their biggest worry; 21% fear their luggage won't make it on self-transfer itineraries:
  https://mingooland.com/2026/01/self-transfer-flights-how-they-work-and-when-to-avoid-them/
- European Transport Research Review study (same source): a 30-minute delay causes ~40% of
  self-connecting passengers to miss their onward flight:
  https://mingooland.com/2026/01/self-transfer-flights-how-they-work-and-when-to-avoid-them/
- Missed self-transfer outcomes: no-show forfeits the fare; walk-up replacement typically
  $200–$2,000+; budget carriers offer no standby, no rebooking, no goodwill exception:
  https://www.layoverguard.com/guides/self-transfer-flights-risk-guide and
  https://www.layoverguard.com/guides/self-transfer-flights-budget-airlines
- Roughly 20% of flights arrive more than 15 minutes late (US DOT on-time data analysis), and a
  no-show on the outbound cancels the return leg:
  https://www.layoverguard.com/guides/will-airline-rebook-missed-self-transfer
- Context on why travellers accept this: self-transfer can save 20–40% vs a single ticket:
  https://www.layoverguard.com/guides/self-transfer-flights-risk-guide

**5. Existing workaround and why it fails.** Eyeballing layover length against airport minimum
connection times fails because MCTs are published for through-ticketed passengers — self-transfer
adds immigration, baggage reclaim, re-check-in, and security. Paid connection guarantees
(e.g., Kiwi.com's) cover only itineraries bought inside that one platform.

**6. Theme: Most Creative Gemini Hack.** The creative use: Gemini turns two unstructured booking
screenshots into a structured itinerary and then generates a narrated "failure-cascade timeline"
(what happens minute-by-minute if the first leg is 30 minutes late) — a decision artifact no
form-based tool produces.

**7. Gemini role and visible evidence.** Gemini multimodal extraction: two booking
screenshots/emails → structured itinerary JSON `{leg1, leg2, airports, terminals, times, baggage}`
plus the cascade narrative that drives the keep/switch decision. Visible: screenshots beside the
parsed itinerary and the timeline.

**8. Atlas Sandbox role and visible evidence.** Atlas sandbox search finds protected alternatives
for the same journey (real sandbox fares, verified offers) so "switch" is a concrete, priced option
— not advice. Visible: a sandbox results table with real prices; any sandbox booking sits behind
explicit human confirmation.

**9. Nosana role and visible evidence.** A Nosana batch job scores route/airport reliability from
a delay dataset and serves a risk-score API; the app consumes that score in its keep/switch
decision. Visible: the Nosana job completing and the score rendered in the UI. Removing Nosana
removes the risk number.

**10. Primary flow.** Trigger: two booking screenshots before purchase → Decision: Nosana risk
score + Gemini cascade verdict + Atlas-priced protected alternative → Outcome: "keep" with a clear
buffer plan, or "switch" to the priced protected option (human-confirmed sandbox hold).

**11. Smallest P0 slice.** One fixture pair of booking screenshots, one small delay dataset, one
Nosana scoring job, one Atlas sandbox search, one keep/switch verdict screen. Sandbox only, no
real payments, no real personal data.

**12. Risks / assumptions / fallback.** The reliability score is a heuristic, not a prediction —
labelled as such on screen. Atlas sandbox unavailable → labelled replay of a recorded search.
Gemini extraction errors → user confirms the parsed itinerary before the verdict is shown.

---

*No winner recommended. Sources as cited inline; checked 20 Aug 2026.*
