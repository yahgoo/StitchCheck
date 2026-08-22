## Candidate Idea 1 — TrueFare Lens

**1. Name and one-sentence pitch**
**TrueFare Lens — “The cheapest flight is not necessarily the cheapest trip.”** A budget-flight copilot that converts Atlas fare results into a comparable *realistic trip cost* after the traveller’s required baggage and other selected add-ons.

**2. Target budget-traveller segment**
Price-sensitive backpackers, students, solo travellers, and LCC passengers who compare flights primarily on the headline fare and normally travel with at least a cabin bag.

**3. Specific pain point and trigger moment**
**Pain:** Budget-airline headline fares can be misleading once baggage and other ancillary costs are added. Which?’s December 2025 investigation of more than 1,500 Ryanair, easyJet and Wizz Air flights found that the cheapest advertised cabin-bag prices were almost never actually available; easyJet’s advertised £5.99 fee was not found on any of the 500+ flights checked. ([Which?][1])
**Trigger:** The traveller sees Flight A advertised at $80 and Flight B at $105, but needs a cabin bag and wants to know which is actually cheaper before selecting a fare.

**4. Evidence and source URLs**
Which? found substantial differences between advertised and observed budget-airline cabin-bag pricing. ([Which?][1])
The U.S. DOT describes baggage, seat selection, meals, Wi-Fi and similar services as optional airline services and maintains specific fee-disclosure requirements. ([Department of Transportation][2])
Travel + Leisure's May 2026 consumer guidance likewise notes that baggage, seat selection and other extras can make an initially cheap flight materially more expensive, and that airport access costs can also erase an apparent airfare saving. ([Travel + Leisure][3])

[Which? — The hidden cost of flying](https://www.which.co.uk/news/article/the-hidden-cost-of-flying-budget-airlines-bag-prices-exposed-aP9rb9G6QP6L?utm_source=chatgpt.com)
[U.S. DOT — Airline baggage/optional-fee disclosure](https://www.transportation.gov/airconsumer/baggage-optional-fees?utm_source=chatgpt.com)
[Travel + Leisure — Hidden travel fees](https://www.travelandleisure.com/hidden-airline-fees-11965180?utm_source=chatgpt.com)

**5. Existing workaround and why it fails**
Travellers manually open airline baggage/fare pages, calculate the extras, and compare the totals in their heads or a spreadsheet. This is slow and error-prone because the traveller must normalize different fare structures, baggage rules and currencies themselves; the existence of formal government fee-disclosure rules also illustrates how complicated ancillary pricing has become. ([Department of Transportation][2])

**6. Official hackathon theme selected and justification**
**Best Use Of Gemma.** The August 22, 2026 Singapore **Build with Gemini Hackathon 2026** lists “Best Use Of Gemma” as one of its three tracks. ([AI Competition Hub][4])
This idea gives Gemma a concrete technical job: normalize semi-structured fare/ancillary information into a machine-readable cost model rather than using a model merely as a chatbot.

**7. Gemini role and visible demo evidence**
Gemini is the user-facing decision engine. The traveller can say:

> “Singapore to Bangkok, one cabin bag, cheapest total, no seat selection.”

Gemini converts that request into constraints, asks Atlas for candidates, receives the Nosana cost-normalization output, and explains:

**“Flight A: $92 realistic trip cost. Flight B: $105. Flight A is $13 cheaper after your cabin bag.”**

Visible evidence: the UI shows the Gemini-generated constraint summary, comparison explanation, and final recommendation.

**8. Atlas Sandbox role and visible demo evidence**
Atlas provides the actual flight-shopping data: origin, destination, dates, available flights, fares and fare options. Its sandbox supports searching flights, reviewing fares/availability, testing workflows and building customer-facing flight experiences; its API also supports baggage and branded-fare ancillary flows where available. ([Atlas Loves Travel][5])

Visible evidence: the demo displays the raw Atlas flight options alongside their calculated “realistic cost.”

**9. Nosana role and visible demo evidence**
Nosana runs a **Gemma-based fare normalization workload**. The job receives a compact Atlas fare/ancillary JSON payload and outputs structured fields such as:

`base_fare → baggage_cost → mandatory_extra → selected_extra → realistic_total`

Nosana explicitly supports containerized GPU workloads and one-shot jobs, and its inference endpoints can expose running models as services. ([Nosana][6])

Visible evidence: a small “Nosana: fare-normalizer job → COMPLETED” panel and the structured output used by the app.

**10. Primary user flow: trigger → decision → outcome**
**Trigger:** “I need the cheapest flight, but I have one cabin bag.”
→ **Decision:** Atlas retrieves candidate flights; Nosana normalizes fare/ancillary costs; Gemini interprets the traveller’s budget and preferences.
→ **Outcome:** The traveller sees a ranked list by realistic cost, not headline fare.

**11. Smallest P0 vertical slice**
One route, one passenger, economy only, one baggage profile and 3–5 Atlas flight results. Nosana runs one Gemma normalization job per search. Gemini produces a ranked comparison. No payment and no actual booking.

**12. Key risks, assumptions, and fallback path**
**Risk:** Atlas sandbox may not return identical ancillary fields for every carrier.
**Assumption:** A small set of supported baggage/fare attributes is sufficient for the demo.
**Fallback:** Ship a deterministic fixture containing Atlas-shaped fare responses, while clearly labelling the fixture mode; Gemini and the Nosana workload still operate on the same JSON contract. No real passenger information or payment details are required.

---

## Candidate Idea 2 — Miss-It-Not

**1. Name and one-sentence pitch**
**Miss-It-Not — “Save $40, but don't accidentally lose the whole trip.”** An AI flight planner that quantifies the trade-off between a cheaper itinerary and the risk of a missed connection, especially when budget travellers stitch together separate tickets.

**2. Target budget-traveller segment**
Backpackers and independent travellers willing to accept long layovers, airport changes or separate-ticket itineraries to reduce airfare.

**3. Specific pain point and trigger moment**
**Pain:** Separate tickets can save money but create significant connection risk. NerdWallet explicitly warns that when flights are booked under separate reservation records, the second airline is generally not responsible if a delay on the first flight causes the traveller to miss the second; it also warns that separate-ticket connections can require collecting bags and allowing much more connection time. ([NerdWallet][7])
Consumer Reports similarly notes that connecting flights can save money but increase travel time and the chance that a delay causes a missed connection. ([Consumer Reports][8])

**Trigger:** “This itinerary is $70 cheaper, but it has a 75-minute self-transfer. Is it actually worth it?”

**4. Evidence and source URLs**
NerdWallet documents the specific risk of separate reservation records and missed connections. ([NerdWallet][7])
Consumer Reports discusses the cost/risk trade-off of connections and recommends substantially longer buffers for some international connections. ([Consumer Reports][8])
The European Commission emphasizes passenger rights and rerouting/rebooking protections when travel is disrupted, illustrating why the ticket structure matters to the traveller's protection. ([Mobility and Transport][9])

[NerdWallet — What happens if I miss my flight?](https://www.nerdwallet.com/travel/learn/what-happens-if-i-miss-my-flight?utm_source=chatgpt.com)
[Consumer Reports — Connecting flights](https://www.consumerreports.org/airline-travel/5-ways-to-make-your-connecting-flights/?utm_source=chatgpt.com)
[European Commission — Passenger rights](https://transport.ec.europa.eu/transport-themes/passenger-rights_en?utm_source=chatgpt.com)

**5. Existing workaround and why it fails**
Travellers manually compare connection duration, airport changes and ticket numbers, then apply a personal “two-hour/three-hour/four-hour” buffer. That gives no explicit quantitative comparison between savings and risk, and it becomes difficult when evaluating many alternatives.

**6. Official hackathon theme selected and justification**
**Most Creative Gemini Hack.** The August 22 Singapore Build with Gemini Hackathon lists “Most Creative Gemini Hack” as an official track. ([AI Competition Hub][4])
The creative element is a conversational **“what would you risk?” flight simulator** rather than another conventional flight-search chatbot.

**7. Gemini role and visible demo evidence**
Gemini acts as the traveller's interactive decision-maker:

> “Save money.”
> “How much are you willing to risk?”
> “Low risk.”
> “What if I accept one missed-connection scenario?”

Gemini turns the user's qualitative preference into explicit parameters and explains the resulting trade-off.

Visible evidence: Gemini generates a human-readable statement such as:

**“You save $63, but your 75-minute self-transfer has a high modeled disruption exposure. Paying $21 more buys a 3h 10m protected connection.”**

The system clearly labels this as a **scenario model, not a guarantee or prediction of an actual missed flight.**

**8. Atlas Sandbox role and visible demo evidence**
Atlas supplies the candidate flight schedules, fares, flight segments and itinerary structure. Its flight-shopping API supports one-way, round-trip and multi-segment searches and price verification. ([Atlas Loves Travel][10])

Visible evidence: the app displays the Atlas itinerary as a timeline showing arrival, departure, elapsed connection time and total fare.

**9. Nosana role and visible demo evidence**
Nosana runs a **Monte Carlo connection-risk workload**. For each itinerary, the workload repeatedly perturbs hypothetical delay and transfer-time variables and returns a scenario distribution such as:

`comfortable / borderline / high-risk`

The workload is GPU-deployable and returns structured output consumed by the application; Nosana supports job execution and GPU resources for containerized workloads. ([Nosana][6])

Visible evidence: a “10,000 simulated scenarios” result card generated by the Nosana job, with the simulation inputs and resulting risk bands.

**10. Primary user flow: trigger → decision → outcome**
**Trigger:** Traveller sees a cheaper connection.
→ **Decision:** Gemini asks/infers risk tolerance; Atlas provides itineraries; Nosana simulates disruption scenarios.
→ **Outcome:** Traveller chooses between “cheapest,” “balanced,” and “safer” itineraries with the financial/risk trade-off visible.

**11. Smallest P0 vertical slice**
Only compare three Atlas itineraries. Model one connection type: a same-airport self-transfer. Nosana runs 1,000–10,000 synthetic scenarios. Gemini explains the three results. No real-world delay prediction, payments or booking.

**12. Key risks, assumptions, and fallback path**
**Risk:** Sandbox data may not contain enough information to distinguish every type of connection.
**Assumption:** A synthetic delay distribution is acceptable for a hackathon demonstration if explicitly presented as a scenario model.
**Fallback:** Bundle deterministic scenario distributions for 3 known itinerary fixtures and let Nosana reproduce them from the same inputs. If the live Nosana call fails, display the last successful job result and its job ID; the Atlas itinerary remains visible.

---

## Candidate Idea 3 — Senior Fare Copilot

**1. Name and one-sentence pitch**
**Senior Fare Copilot — “Tell me where you want to go; I'll turn the cheapest safe-looking options into one simple choice.”** A voice-first flight-shopping assistant designed for older budget travellers who want to save money without navigating multiple complicated travel tools.

**2. Target budget-traveller segment**
Adults 50+ who are budget conscious, particularly travellers who prefer simple conversational assistance over juggling airline sites, comparison sites and multiple travel apps.

**3. Specific pain point and trigger moment**
**Pain:** AARP's 2026 research reports that cost remains the biggest barrier for older travellers: 45% are concerned about high airfare and 39% cite cost overall; 89% shop for bargains. ([AARP][11])
AARP's earlier travel-technology research found that 38% of older travellers felt overwhelmed by the number of digital tools available, while 38% worried about fraud or digital security during travel research and planning. ([AARP][12])

**Trigger:** An older traveller says, “I want to visit my daughter next month, but I don't know which website or flight to use and I don't want to accidentally pay too much.”

**4. Evidence and source URLs**
AARP's 2026 survey reports high airfare as a major concern among adults 50+ and shows strong bargain-shopping behaviour. ([AARP][11])
AARP's technology study reports digital-tool overload and concerns around fraud/security during travel planning and booking. ([AARP][12])
A 2025/2026 academic study also identifies a digital divide affecting senior travellers using smart-tourism systems. ([ScienceDirect][13])

[AARP — 2026 Travel Trends](https://www.aarp.org/press/releases/2026-03-10-aarp-travel-trends-2026/?utm_source=chatgpt.com)
[AARP Research — Travel Technology and Older Adults](https://www.aarp.org/pri/topics/social-leisure/travel/2024-travel-technology-older-adults/?utm_source=chatgpt.com)
[Journal of Hospitality and Tourism Management — Senior travelers and the digital divide](https://www.sciencedirect.com/science/article/pii/S1447677025001123?utm_source=chatgpt.com)

**5. Existing workaround and why it fails**
The current workaround is to ask a family member, travel agent or technically confident friend, or manually navigate airline and OTA websites. AARP reports that websites are widely used by older travellers, while many still feel overwhelmed by the volume of digital tools. ([AARP][12])
The result is either additional dependence on another person or a fragmented self-service process.

**6. Official hackathon theme selected and justification**
**Best Elderly Hack.** The August 22, 2026 Singapore Build with Gemini Hackathon lists “Best Elderly Hack” as one of its official tracks. ([AI Competition Hub][4])
This idea directly targets the track rather than merely adding an accessibility layer to a generic flight search.

**7. Gemini role and visible demo evidence**
Gemini provides the conversational interface and decision explanation. The user can speak naturally:

> “I want to fly from Singapore to Bangkok in September. I want the cheapest option, but I don't want a very long journey.”

Gemini converts the statement into a structured search, calls Atlas, receives the Nosana result, and presents **two or three choices in plain language**:

**Cheapest — $142 — 1 stop — 7h 20m**
**Easier — $159 — 1 stop — 5h 10m**

Visible evidence: the Gemini interaction is shown as a large-text conversational transcript plus a simplified “Choose this” decision card.

**8. Atlas Sandbox role and visible demo evidence**
Atlas performs the real flight-search part of the experience, returning available flight and fare options from its sandbox. Atlas explicitly positions the sandbox for AI-native travel assistants and conversational booking experiences. ([Atlas Loves Travel][5])

Visible evidence: the user sees the actual Atlas-returned flight options underlying Gemini's answer.

**9. Nosana role and visible demo evidence**
Nosana hosts a **Whisper speech-to-text endpoint** used for the voice interface. Nosana's inference examples explicitly include Whisper, and its endpoint architecture allows a deployed workload to be accessed through a service endpoint. ([Nosana][14])

Flow:

**Voice → Nosana Whisper → transcript → Gemini → Atlas flight search → Gemini explanation**

Visible evidence: the UI shows **“Nosana Whisper: RUNNING → transcript received”** before Gemini processes the request.

This gives Nosana an essential workload role rather than using it merely for backend hosting.

**10. Primary user flow: trigger → decision → outcome**
**Trigger:** Older traveller speaks a travel request.
→ **Decision:** Nosana transcribes; Gemini interprets preferences; Atlas searches flights; Gemini simplifies the choices.
→ **Outcome:** Traveller receives two or three understandable options and can select a sandbox booking flow without entering real payment information.

**11. Smallest P0 vertical slice**
One voice input → Nosana Whisper → Gemini intent extraction → one Atlas flight search → two simplified recommendations. Use large text, very few controls and synthetic traveller information. A sandbox “booking preview” is enough; do not complete a real transaction.

**12. Key risks, assumptions, and fallback path**
**Risk:** Nosana Whisper availability or latency could affect a live demonstration.
**Assumption:** A simple English-language voice demo is sufficient for the P0; multilingual support can come later.
**Fallback:** Provide a microphone button plus three prerecorded, non-personal voice clips. If the live Whisper endpoint fails, load the corresponding transcript fixture and continue through Gemini and Atlas. No passport, payment-card, email, phone number or other real personal data is required.

### Hackathon-theme verification

The **August 22, 2026 Singapore Build with Gemini Hackathon** is listed with the three tracks used above: **Best Use Of Gemma, Best Elderly Hack, and Most Creative Gemini Hack**. ([AI Competition Hub][4]) This is distinct from the separate **Build with Gemini XPRIZE**, whose categories are Education & Human Potential, Entrepreneurship & Job Creation, Small Business Services, Money & Financial Access, and Professional Services. ([XPRIZE][15])

[1]: https://www.which.co.uk/news/article/the-hidden-cost-of-flying-budget-airlines-bag-prices-exposed-aP9rb9G6QP6L?utm_source=chatgpt.com "The hidden cost of flying - budget airlines' bag prices exposed - Which?"
[2]: https://www.transportation.gov/airconsumer/baggage-optional-fees?utm_source=chatgpt.com "Disclosure of Baggage/Optional Fees | US Department of Transportation"
[3]: https://www.travelandleisure.com/hidden-airline-fees-11965180?utm_source=chatgpt.com "Hidden Travel Fees Experts Say You’re Still Missing—and How to Avoid Them"
[4]: https://www.competehub.dev/en/competitions/lumaevt-KzbpjN2sHNGkWHD?utm_source=chatgpt.com "Build with Gemini Hackathon 2026 - CompeteHub"
[5]: https://atlaslovestravel.com/resources/start-selling-flights-online/?utm_source=chatgpt.com "How to Start Selling Flights Online"
[6]: https://learn.nosana.com/api/jobs.html?utm_source=chatgpt.com "Jobs | Nosana Docs"
[7]: https://www.nerdwallet.com/travel/learn/what-happens-if-i-miss-my-flight?utm_source=chatgpt.com "What Happens If I Miss My Flight? - NerdWallet"
[8]: https://www.consumerreports.org/airline-travel/5-ways-to-make-your-connecting-flights/?utm_source=chatgpt.com "5 Ways to Make Your Connecting Flights - Consumer Reports"
[9]: https://transport.ec.europa.eu/transport-themes/passenger-rights_en?utm_source=chatgpt.com "Passenger rights - Mobility and Transport - European Commission"
[10]: https://atlaslovestravel.com/api-capabilities/?utm_source=chatgpt.com "LCC Retailing API for Flight Booking, Ancillaries & Post-Booking"
[11]: https://www.aarp.org/press/releases/2026-03-10-aarp-travel-trends-2026/?utm_source=chatgpt.com "New AARP Report: Older Americans Plan More Travel in 2026 as They Embrace AI and Deal Hunting - March 10, 2026"
[12]: https://www.aarp.org/pri/topics/social-leisure/travel/2024-travel-technology-older-adults/?utm_source=chatgpt.com "Travel Tech Makes Traveling Easier for Older Adults"
[13]: https://www.sciencedirect.com/science/article/pii/S1447677025001123?utm_source=chatgpt.com "Chinese senior travelers encounter with smart tourism: why are they falling into the travel digital divide? - ScienceDirect"
[14]: https://learn.nosana.com/inference/endpoints.html?utm_source=chatgpt.com "Endpoints | Nosana Docs"
[15]: https://www.xprize.org/news/xprize-launches-hackathon-with-2-million-prize-pool-backed-by-google?utm_source=chatgpt.com "XPRIZE Launches Hackathon With $2 Million Prize Pool, Backed by Google News Page | XPRIZE Foundation"
