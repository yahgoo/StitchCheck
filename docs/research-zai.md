# Build with Gemini × Atlas × Nosana — Three Candidate Ideas (Budget Traveller Pain Points)

**Deliverable per brief:** exactly three distinct candidate ideas, each mapped to exactly one official Build with Gemini hackathon theme ("Everyday AI," "The Next Frontier," "Social Good"), each giving Gemini, Atlas Flight Booking Sandbox, and Nosana essential and visible roles. No winner is recommended; comparison is left to NotebookLM. All three ideas book exclusively in Atlas sandbox mode with a synthetic traveller ("Demo Traveller / demo@example.com") — no real payments, no production bookings, no personal data.

---

## Idea 1 — TrueFare

1. **Name and one-sentence pitch.** TrueFare converts a budget carrier's teaser fare into the all-in total you'll actually pay for *your* bag, seat, and check-in style — with every fee line cited to the airline's own rules.

2. **Target budget-traveller segment.** Price-first short-haul leisure travellers (students, shift/gig workers, young city-breakers) flying low-cost carriers with one cabin bag, who sort by headline fare and hold no airline status or co-branded cards.

3. **Specific pain point and trigger moment.** Ancillary-fee drip pricing: headline fares exclude baggage, seat selection, check-in method, and card fees. The U.S. DOT moved to mandate upfront fee disclosure in 2024 precisely because travellers compare sticker prices and discover fees at checkout or the gate; that rule was vacated in July 2025, leaving disclosure uneven ([DOT](https://www.transportation.gov/briefing-room/biden-harris-administration-announces-final-rule-automatic-refunds-and-new-rule-protect-travelers-junk-fees); [Reuters](https://www.reuters.com/legal/us-appeals-court-strikes-down-us-airline-junk-fee-disclosure-rule-2025-07-02/)). Economics literature shows sellers deliberately "shroud" add-on prices because a share of consumers fail to anticipate them ([Gabaix & Laibson, QJE 2006](https://doi.org/10.1162/qjec.2006.121.2.505)), and ancillaries are a core revenue line for low-cost carriers — around a third of Ryanair's revenue ([Ryanair IR](https://investor.ryanair.com/)). **Trigger moments:** (a) checkout, when a €19.99 fare becomes ~€58; (b) the gate, being penalised for a bag that misses the sizer.

4. **Evidence and source URLs.**
   - DOT junk-fee/ancillary disclosure rulemaking and consumer protection: https://www.transportation.gov/airconsumer and https://www.transportation.gov/briefing-room/biden-harris-administration-announces-final-rule-automatic-refunds-and-new-rule-protect-travelers-junk-fees
   - Fifth Circuit vacatur of the disclosure rule (July 2025): https://www.reuters.com/legal/us-appeals-court-strikes-down-us-airline-junk-fee-disclosure-rule-2025-07-02/
   - Shrouded attributes / drip pricing (myopic-consumer harm): https://doi.org/10.1162/qjec.2006.121.2.505
   - LCC ancillary-revenue dependence: https://investor.ryanair.com/

5. **Existing workaround and why it fails.** Travellers open each airline's fee page in separate tabs and do mental math, or rely on third-party fee tables. This fails because fee schedules vary by airline × bundle × route × season, change frequently, are buried in long policies, and never appear at the comparison moment — so the cheapest-*looking* fare keeps winning the click.

6. **Official hackathon theme selected and justification.** **Everyday AI** (only this theme). It is the canonical everyday question — "what will this actually cost me?" — where Gemini performs the tedious, cited reading that humans skip. Pure practical daily utility; no frontier claims required.

7. **Gemini role and visible demo evidence.** Gemini (Flash-class, structured output + grounded retrieval) reads date-pinned snapshots of each carrier's fare-family and baggage rules, extracts a normalised fee schema (personal-item dimensions, cabin-bag fee with/without priority, seat bands, airport check-in fee, card surcharge), and writes a plain-language explanation with line-level citations. **Visible evidence:** split-screen of raw policy text → generated "fee card" with quoted source lines; live Q&A ("40L backpack, no seat, debit card — my total?") answered with citations; a diff view when a fee page changes.

8. **Atlas Sandbox role and visible demo evidence.** Atlas supplies the teaser fares and fare-family metadata for the searched route/date, and performs the travel action: a sandbox booking whose itemised confirmation total must match TrueFare's prediction. **Visible evidence:** BCN→FCO search returning a €19.99 base + bundle options; sandbox booking confirmation ID shown beside TrueFare's predicted itemised total.

9. **Nosana role and visible demo evidence.** A containerised "fee-profile builder" runs on Nosana's GPU network: it pulls current fare families from Atlas, invokes Gemini to extract/refresh the fee schema, validates it, and publishes per-airline fee-profile artifacts (versioned JSON) — the app's API serves *only* these Nosana outputs. **Visible evidence:** Nosana job page (job ID, market, runtime), artifact hash, and the app's provenance panel: "Fee data: Nosana job #1284, refreshed 06:00 UTC."

10. **Primary user flow.** Trigger: traveller searches a route (or pastes a fare they're eyeing) → Decision: side-by-side true totals for three profiles (personal-item-only / cabin bag / checked bag), every line cited, cheapest compliant strategy highlighted → Outcome: traveller mock-books via Atlas sandbox (confirmation restates the true total) — or discovers the "expensive" legacy fare is actually cheaper and books that instead.

11. **Smallest P0 vertical slice.** One corridor (AMS↔BCN), 3 airlines, ~6 date-pinned policy snapshots, cached Gemini extraction + "re-extract" button, Atlas search + sandbox booking, one Nosana job producing the fee-profile JSON, single web page (comparison table, provenance panel, book button). ~2–3 days; freeze P0 by Wed 19 Aug 2026; rehearse the 90-second demo 20–21 Aug.

12. **Key risks, assumptions, and fallback path.** (a) Atlas sandbox may lack bundle-level detail → map base fares + documented bundles; otherwise show computed scenarios from fee profiles alone. (b) Gemini extraction drift → JSON-schema validation + gold-set tests + hand-curated fallback fee file. (c) Nosana node unavailable at demo → run the identical Docker image locally, keep the previous night's mainnet job ID/artifact as evidence; UI labels the source. (d) Fee changes → date-stamped snapshots with freshness labels. Demo is repeatable via a seeded query and deterministic cached outputs; recorded API responses as final fallback.

---

## Idea 2 — ConnectionGuard

1. **Name and one-sentence pitch.** ConnectionGuard stress-tests cheap multi-leg itineraries for missed-connection risk — tight gates, terminal transfers, unprotected self-transfers — and books a safer alternative you can still afford.

2. **Target budget-traveller segment.** Long-haul backpackers, gap-year and early-career nomads (18–30) booking stitched intercontinental itineraries on price, often via OTAs that combine separate tickets.

3. **Specific pain point and trigger moment.** Cheap long-haul itineraries depend on tight or self-transfer connections; if the inbound leg is late, the traveller is stranded mid-journey with an unprotected booking and must buy a replacement at walk-up prices. EU air passenger rights apply per booking, leaving self-transfer passengers on separate tickets outside the protection a single connecting booking enjoys ([European Commission](https://ec.europa.eu/transport/themes/passengers/air-passenger-rights_en)); U.S. guidance on delays/cancellations likewise offers no separate-ticket rebooking protection ([DOT](https://www.transportation.gov/airconsumer/flight-delays-cancellations)); public on-time statistics document how common delays are ([BTS TranStats](https://www.transtats.bts.gov/)); travel press repeatedly warns about self-transfer pitfalls ([The Points Guy](https://thepointsguy.com/guide/what-is-a-self-transfer-flight/)). **Trigger moments:** (a) checkout, facing a 1h05 connection at an unfamiliar hub; (b) stranded at the hub late at night after a delay.

4. **Evidence and source URLs.**
   - EC air passenger rights (scope of EU261; separate bookings unprotected): https://ec.europa.eu/transport/themes/passengers/air-passenger-rights_en
   - DOT flight delays & cancellations consumer guidance: https://www.transportation.gov/airconsumer/flight-delays-cancellations
   - BTS TranStats on-time performance data: https://www.transtats.bts.gov/
   - Self-transfer risk explainer: https://thepointsguy.com/guide/what-is-a-self-transfer-flight/

5. **Existing workaround and why it fails.** Folk wisdom ("always leave 3–4 hours") or the OTA's paid "missed-connection guarantee." Rules of thumb ignore hub-specific realities (minimum connecting times, terminal changes, re-clearing security on self-transfers, bus gates); guarantees cost a slice of the fare, carry exclusions, and reimburse only after claims friction — exactly when the traveller has no cash buffer.

6. **Official hackathon theme selected and justification.** **The Next Frontier** (only this theme). This is an agentic, tool-using, document-grounded Gemini system (read hub dossier → retrieve → reason over simulated risk → explain → act via Atlas) — frontier-style autonomous orchestration, not a single-shot chat wrapper.

7. **Gemini role and visible demo evidence.** A Gemini agent with tools ingests the candidate itinerary plus a curated hub dossier (terminal-map excerpts, transfer times, MCT table, security/transit notes) and produces a connection feasibility report: a minute-by-minute gate-to-gate plan, explicit risk drivers, a plain-language verdict, and a contingency plan ("if you miss it: rebook option X; here's why EU261 won't help you"). **Visible evidence:** agent trace panel showing tool calls and retrieved snippets; rendered timeline with citations; grounded follow-up Q&A.

8. **Atlas Sandbox role and visible demo evidence.** Atlas provides the itinerary data (multi-leg search; if self-transfers aren't natively modelled, two one-way searches composed and labelled) and the travel actions: sandbox-booking the safer alternative, plus mock-booking the contingency flight in "stranded simulation" mode. **Visible evidence:** side-by-side Atlas results (risky 1h05 vs safer 3h20 for +€14), sandbox confirmation for the chosen itinerary, and the simulated day-of-travel replay.

9. **Nosana role and visible demo evidence.** A Nosana GPU job runs the Monte-Carlo risk engine: it simulates 10,000+ delay/connection outcomes per itinerary using bundled, clearly labelled *synthetic* delay distributions seeded from public aggregate statistics, emitting per-itinerary risk scores and per-hub buffer distributions as a JSON artifact that the web app consumes (the app never runs simulations). **Visible evidence:** Nosana job logs (simulation count, runtime), artifact hash, UI badge "Risk engine: Nosana job #1291."

10. **Primary user flow.** Trigger: traveller imports the cheap multi-leg itinerary they're about to buy → Decision: ConnectionGuard shows the feasibility timeline, risk score, and up to three options (keep / safer alternative / re-timed cheaper-safe) with explicit €-and-minutes trade-offs → Outcome: traveller mock-books the safer itinerary via Atlas sandbox, or keeps the cheap one and exports a cited "contingency card" for the hub.

11. **Smallest P0 vertical slice.** One hub (e.g., IST or LGW), one origin–destination pair, two candidate itineraries, one curated hub dossier, Nosana simulation job with cached artifact, Gemini agent report, single-page UI + sandbox booking. ~2–3 days; freeze 19 Aug 2026; two rehearsals before the 22 Aug deadline.

12. **Key risks, assumptions, and fallback path.** (a) No licensed historical delay data → use documented synthetic distributions labelled "simulated," never presented as official statistics. (b) Gemini misreads hub docs → small human-reviewed dossier with citations surfaced to the user. (c) Atlas may lack native multi-leg composition → documented two-search assembly. (d) Nosana latency/availability → cached artifact by default, optional live "re-run job" button, local Docker fallback with prior mainnet job as evidence. Repeatable demo via fixed random seed (identical risk score every run), synthetic traveller, sandbox-only bookings, recorded-response fallback.

---

## Idea 3 — DoorFare

1. **Name and one-sentence pitch.** DoorFare re-ranks "cheap" flights by true door-to-door cost, exposing the last-mile time and money that city-named secondary airports hide.

2. **Target budget-traveller segment.** First-time and low-income city-break travellers and students without cars, comparing headline fares across nearby regions (London→"Paris," "Frankfurt" Hahn, "Barcelona" Girona), arriving and departing by public transport.

3. **Specific pain point and trigger moment.** Low-cost carriers serve distant secondary airports marketed under major-city names; the required shuttle/coach adds real money and 60–120 minutes each way, and late arrivals can strand travellers when transfers stop running. Documented examples: Frankfurt–Hahn sits roughly 120 km by road from Frankfurt ([Wikipedia](https://en.wikipedia.org/wiki/Frankfurt%E2%80%93Hahn_Airport); [airport site](https://www.hahn-airport.de/)); Beauvais–Tillé is ~85 km from Paris with a paid dedicated shuttle ([Wikipedia](https://en.wikipedia.org/wiki/Beauvais%E2%80%93Till%C3%A9_Airport); [official airport site](https://www.aeroportbeauvais.com/)); Girona–Costa Brava is ~90 km from Barcelona and was long marketed as serving "Barcelona" ([Wikipedia](https://en.wikipedia.org/wiki/Girona%E2%80%93Costa_Brava_Airport)). **Trigger moments:** (a) the results screen, when a too-good fare appears; (b) landing at 23:40 to find the last transfer has gone.

4. **Evidence and source URLs.**
   - Frankfurt–Hahn Airport (distance/base of low-cost operations): https://en.wikipedia.org/wiki/Frankfurt%E2%80%93Hahn_Airport and https://www.hahn-airport.de/
   - Beauvais–Tillé Airport (~85 km from Paris; official shuttle): https://en.wikipedia.org/wiki/Beauvais%E2%80%93Till%C3%A9_Airport and https://www.aeroportbeauvais.com/
   - Girona–Costa Brava Airport (~90 km; "Barcelona" marketing): https://en.wikipedia.org/wiki/Girona%E2%80%93Costa_Brava_Airport
   - Headline-price/shrouded-cost context: https://www.transportation.gov/airconsumer

5. **Existing workaround and why it fails.** Experienced travellers carry a mental surcharge map ("Beauvais = extra cost and ~2 hours each way"). This fails because the knowledge lives in forums and veterans' heads, goes stale when shuttle schedules and prices change, and never appears on the fare-comparison screen where the decision is actually made — so first-time and low-income travellers, who can least absorb a surprise round-trip transfer or a midnight taxi, keep buying the headline-cheapest fare.

6. **Official hackathon theme selected and justification.** **Social Good** (only this theme). The product's value is information equity: protecting financially vulnerable, first-time travellers from systematically misleading airport-name marketing — transparency for the travellers with the least slack, which is squarely the theme's positive-societal-impact criterion.

7. **Gemini role and visible demo evidence.** Gemini ingests each airport's ground-transport corpus (official shuttle pages/timetables, rail links) and produces a normalised "last-mile profile" — cost, minutes, frequency, first/last service, night-arrival penalty — with citations, then generates the comparison narrative (illustrative: "Beauvais €9.99 + paid shuttle + ~80 min vs CDG €34 + RER + ~35 min — the 'expensive' fare can be cheaper door-to-door"). **Visible evidence:** raw timetable/PDF on one side → structured last-mile card with cited lines on the other; live Q&A ("landing 23:40 — my options?") answered with grounded citations.

8. **Atlas Sandbox role and visible demo evidence.** Atlas returns the competing itineraries into secondary vs primary airports for the searched city (mapped by IATA code); DoorFare re-ranks them by true door-to-door cost and executes the sandbox booking, with the confirmation showing headline fare + last-mile line + true total. **Visible evidence:** Atlas search response (Beauvais and CDG options) → re-ranked results table → sandbox booking confirmation with the itemised true total.

9. **Nosana role and visible demo evidence.** The "last-mile matrix builder" runs as a Nosana GPU job: for every airport in the demo region it runs Gemini extraction over that airport's ground-transport corpus, validates numeric fields, computes cost/time matrices to the advertised city centre, and publishes a versioned JSON artifact the app consumes for re-ranking (nightly refresh). **Visible evidence:** Nosana job listing (job ID, market, runtime), artifact hash, provenance panel "Last-mile data: Nosana job #1302, refreshed 06:00 UTC," and a live "re-run job" button.

10. **Primary user flow.** Trigger: traveller searches "London → Paris, cheapest" and a headline-cheap Beauvais fare tops the list → Decision: DoorFare shows true door-to-door totals (fare + transfer, with an optional time-value slider defaulting to €0/h) with cited evidence and a night-arrival warning → Outcome: traveller mock-books the genuinely cheapest option via Atlas sandbox and receives a "getting to the city" card; the confirmation restates the true total and which fare won, and why.

11. **Smallest P0 vertical slice.** Two city sets (London→"Paris": Beauvais vs CDG; plus "Frankfurt": Hahn vs FRA), pre-loaded ground-transport snapshots for 4 airports, cached Gemini extraction + re-run, one Nosana job producing the matrix artifact, single-page UI (re-ranked table, evidence drawer, book button). ~2–3 days; freeze 19 Aug 2026; rehearsals 20–21 Aug.

12. **Key risks, assumptions, and fallback path.** (a) Shuttle prices/schedules change → date-pinned snapshots with freshness labels. (b) Gemini misparses timetables → schema validation + hand-curated fallback profiles. (c) Atlas airport tagging assumptions → explicit IATA-code mapping table shown in the UI. (d) Time-monetisation is subjective → slider defaults to €0/h so no contested assumption drives the headline ranking. (e) Nosana availability → identical local Docker run + prior mainnet job as evidence. Safe, repeatable demo: synthetic traveller, sandbox-only bookings, seeded documents, recorded-response fallback if APIs fail.

---

**Source note (for NotebookLM import):** URLs and official theme names were compiled from the assistant's knowledge base and should be re-verified against the live pages before import; pain-point claims above are anchored to the named sources, and all bookings shown in any demo occur in Atlas's sandbox with synthetic travellers. Per the brief, no winner is recommended.