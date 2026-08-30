import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { RecoveryPlanAnimation } from './components/RecoveryPlanAnimation';
import { useNarration } from './components/useNarration';
import {
  getDefaultExtraction,
  getRiskFixture,
  getAlternativesFixture,
  loadNosanaRiskResult,
  screenshotFixtures,
} from './data/fixtures';
import { getDaytonaOfflineRecoveryAnimation } from './data/daytona-offline-risk';
import {
  loadDaytonaLiveEnvelope,
  liveEnvelopeToAnimationData,
  liveEnvelopeToHowCalculated,
  DAYTONA_LIVE_EXECUTION_MODE,
  type DaytonaLiveEnvelope,
} from './data/daytona-live-risk';
import { atlasSearch, atlasVerify } from './atlas/client';
import {
  CLIENT_TRANSIENT_ATTEMPTS,
  CLIENT_TRANSIENT_DELAY_MS,
  atlasErrorCode,
  delay,
  isTransientAtlasCode,
} from './atlas/transient-retry';
import { mapSearchResponseToResult, mapVerifyResponse, mapErrorToResult } from './atlas/adapter';
import type { VerifySummary } from './atlas/adapter';
import {
  createEmptyLegSection,
  loadLegUnbookedPreviews,
  shouldSelectPlanAfterVerify,
  type LegUnbookedPreviewSection,
} from './atlas/unbooked-previews';
import { UnbookedTicketPreviewLegSection } from './components/UnbookedTicketPreviewLegSection';
import { LiveAlternativesList } from './components/LiveAlternativesList';
import { SandboxOrderPanel } from './components/SandboxOrderPanel';
import { extractItinerary } from './extraction/client';
import { mergeExtractionResult } from './extraction/merge-extraction-result';
import {
  createConfirmedItinerarySnapshot,
  confirmedItineraryToContext,
  warnIfAtlasSearchRouteMismatch,
  type ConfirmedItinerary,
  type ItineraryInputMode,
} from './domain/confirmed-itinerary';
import {
  getSampleItineraryExtraction,
} from './data/sample-itinerary';
import {
  SAMPLE_SCREENSHOT_BANNER,
  getSampleScreenshotExtraction,
} from './data/sample-itinerary-screenshot';
import {
  MINIMAX_EXTRACTION_LOADING,
  WELCOME_READY_MADE_CTA,
  WELCOME_READY_MADE_HELPER,
  WELCOME_SCREENSHOT_SAMPLE_CTA,
  WELCOME_SCREENSHOT_SAMPLE_HELPER,
} from './data/minimax-visibility-copy';
import { MiniMaxProvenanceTag } from './components/MiniMaxProvenanceTag';
import { Icon } from './components/Icon';
import { LuggageAirplaneHero } from './components/icons/LuggageAirplaneHero';
/* Demo fixture screenshots bundled inline (base64 data URLs) so the live
 * Live extraction receives the same itinerary image the traveller
 * selected in the ticket selectors, not a stand-in placeholder image. */
import gem01Image from '../../smoke-tests/extraction/fixtures/gem-01-two-leg-clean.png?inline';
import gem02Image from '../../smoke-tests/extraction/fixtures/gem-02-two-leg-missing-optional.png?inline';
import gem03Image from '../../smoke-tests/extraction/fixtures/gem-03-two-leg-fragmented.png?inline';
import gem04Image from '../../smoke-tests/extraction/fixtures/gem-04-non-itinerary.png?inline';
import gem05Image from '../../smoke-tests/extraction/fixtures/gem-05-unreadable-field.png?inline';
import sampleItineraryScreenshot from './assets/sample-itinerary-screenshot.png?inline';
import type { ItineraryContext } from '../../core/domain';
import type { ProviderStatusResult } from '../../core/provenance';
import { ProviderStatusBar } from './components/ProviderStatusBar';
import type { RecoveryPlanAnimationData } from './types/recovery-plan';
import type {
  AppStep,
  ExtractionResult,
  FlightLeg,
  RiskResult,
  SearchResult,
  AlternativesScenario,
  RiskScenario,
  Decision,
} from './data/types';
import './App.css';

/* ═══════════════════════════════════════════════════════
   StitchCheck — Simplified traveller flow
   ═══════════════════════════════════════════════════════
   Screen 1: Welcome / Safety
   Screen 2: Upload / Select ticket → Itinerary review
   Screen 3: The risk (cascade animation)
   Screen 4: Safer options + Keep / Switch decision
   Screen 5: Done
   ═══════════════════════════════════════════════════════ */

const DATA_MODE: string = (typeof __DATA_MODE__ !== 'undefined' ? __DATA_MODE__ : 'offline');

/* ── Fixture image lookup for live extraction ── */
const fixtureImages: Record<string, string> = {
  'gem-01': gem01Image,
  'gem-02': gem02Image,
  'gem-03': gem03Image,
  'gem-04': gem04Image,
  'gem-05': gem05Image,
};

function toImagePayload(dataUrl: string): { base64: string; mediaType: 'image/png' | 'image/jpeg' } {
  const [header, base64] = dataUrl.split(',');
  const mediaType = /image\/jpeg/.test(header) ? 'image/jpeg' : 'image/png';
  return { base64, mediaType };
}

export default function App() {
  const [step, setStep] = useState<AppStep>('welcome');
  const [extraction, setExtraction] = useState<ExtractionResult>(getDefaultExtraction());
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [alternativesResult, setAlternativesResult] = useState<SearchResult | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [correctionNotes, setCorrectionNotes] = useState<string[]>([]);
  const [riskScenario, setRiskScenario] = useState<RiskScenario>('success');
  const [altScenario, setAltScenario] = useState<AlternativesScenario>('success');
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [daytonaLiveEnvelope, setDaytonaLiveEnvelope] = useState<DaytonaLiveEnvelope | null>(null);
  const [originalExtraction] = useState<ExtractionResult>(getDefaultExtraction());
  const [isEditing, setIsEditing] = useState(false);
  const [showAllAlternatives, setShowAllAlternatives] = useState(false);
  const [showHowCalculated, setShowHowCalculated] = useState(false);
  const [selectedTicket1, setSelectedTicket1] = useState<string>('');
  const [selectedTicket2, setSelectedTicket2] = useState<string>('');
  const [uploadAcknowledged, setUploadAcknowledged] = useState(false);
  const [itineraryInputMode, setItineraryInputMode] = useState<ItineraryInputMode>('default');
  const [confirmedItinerary, setConfirmedItinerary] = useState<ConfirmedItinerary | null>(null);
  /* ── Live-mode state ── */
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifySummary | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [firstLegPreviews, setFirstLegPreviews] = useState<LegUnbookedPreviewSection>(() =>
    createEmptyLegSection('first', getDefaultExtraction().firstLeg.origin, getDefaultExtraction().firstLeg.destination),
  );
  const [secondLegPreviews, setSecondLegPreviews] = useState<LegUnbookedPreviewSection>(() =>
    createEmptyLegSection('second', getDefaultExtraction().secondLeg.origin, getDefaultExtraction().secondLeg.destination),
  );
  const [previewsLoading, setPreviewsLoading] = useState(false);
  /* ── Provider status tracking ── */
  const [extractionProviderStatus, setExtractionProviderStatus] = useState<ProviderStatusResult | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [liveExtractionReviewed, setLiveExtractionReviewed] = useState(false);
  const [nosanaProviderStatus, setNosanaProviderStatus] = useState<ProviderStatusResult | null>(null);
  const [atlasProviderStatus, setAtlasProviderStatus] = useState<ProviderStatusResult | null>(null);
  /* Reset key for the Atlas Sandbox write-rehearsal panel (additive).
     Bumped on restart so the panel remounts back at hidden/opt-in. */
  const [sandboxPanelKey, setSandboxPanelKey] = useState(0);
  const [confirmTransitionInFlight, setConfirmTransitionInFlight] = useState(false);
  const initRef = useRef(false);
  const skipNextHistoryPush = useRef(false);

  /* ── Itinerary context for route-consistent recovery plan ──
   * After confirmation, use the immutable snapshot only — never live extraction. */
  const itineraryContext = useMemo<ItineraryContext>(() => {
    if (confirmedItinerary) {
      return confirmedItineraryToContext(confirmedItinerary);
    }
    return {
      firstLegOrigin: extraction.firstLeg.origin,
      firstLegDestination: extraction.firstLeg.destination,
      secondLegOrigin: extraction.secondLeg.origin,
      secondLegDestination: extraction.secondLeg.destination,
    };
  }, [confirmedItinerary, extraction.firstLeg.origin, extraction.firstLeg.destination,
       extraction.secondLeg.origin, extraction.secondLeg.destination]);

  /* ── Recovery animation data ── */
  useEffect(() => {
    let cancelled = false;
    loadDaytonaLiveEnvelope().then((envelope) => {
      if (!cancelled) setDaytonaLiveEnvelope(envelope);
    });
    return () => { cancelled = true; };
  }, []);

  const recoveryAnimation = useMemo(
    () => (userConfirmed ? getDaytonaOfflineRecoveryAnimation(undefined, itineraryContext) : null),
    [userConfirmed, itineraryContext],
  );

  const recoveryUsesLiveDaytona = Boolean(daytonaLiveEnvelope);
  const recoveryExecutionMode = recoveryUsesLiveDaytona
    ? DAYTONA_LIVE_EXECUTION_MODE
    : 'daytona-offline-mock';

  const recoveryAnimationData = useMemo<RecoveryPlanAnimationData | null>(() => {
    if (!userConfirmed) return null;
    if (daytonaLiveEnvelope) {
      const confirmationPhase: RecoveryPlanAnimationData['confirmationPhase'] =
        recoverySubmitted ? 'request-submitted' : 'review-recovery-plan';
      return liveEnvelopeToAnimationData(daytonaLiveEnvelope, confirmationPhase);
    }
    if (!recoveryAnimation) return null;
    const base = recoveryAnimation.plan.animationData;
    if (base.recommendedPlan === null) return base;
    const confirmationPhase: RecoveryPlanAnimationData['confirmationPhase'] =
      recoverySubmitted ? 'request-submitted' : base.confirmationPhase;
    return { ...base, confirmationPhase };
  }, [userConfirmed, daytonaLiveEnvelope, recoveryAnimation, recoverySubmitted]);

  const howCalculated = useMemo(() => {
    if (daytonaLiveEnvelope) {
      return liveEnvelopeToHowCalculated(daytonaLiveEnvelope);
    }
    if (!riskResult) return null;
    return {
      riskBand: riskResult.riskBand,
      heuristicDisclaimer: riskResult.heuristicDisclaimer,
      failureCascadeExplanation: riskResult.failureCascadeExplanation,
      datasetVersion: riskResult.datasetVersion,
      latencyMs: riskResult.latencyMs,
    };
  }, [daytonaLiveEnvelope, riskResult]);

  const narration = useNarration();

  useEffect(() => {
    narration.speak(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (initRef.current) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const root = document.querySelector('.sc-app');
          if (root) {
            root.setAttribute('data-demo-ready', 'true');
            initRef.current = true;
          }
        }, 80);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [step]);

  /* ── Navigation handlers ── */
  const handleGetStarted = useCallback(() => {
    setItineraryInputMode('upload');
    setLiveExtractionReviewed(false);
    setExtractionError(null);
    setStep('trip');
  }, []);

  const handleTrySampleItinerary = useCallback(() => {
    setExtraction(getSampleItineraryExtraction());
    setItineraryInputMode('sample');
    setUploadAcknowledged(false);
    setSelectedTicket1('');
    setSelectedTicket2('');
    setConfirmedItinerary(null);
    setUserConfirmed(false);
    setLiveExtractionReviewed(false);
    setExtractionError(null);
    setStep('trip');
  }, []);

  const handleTrySampleScreenshot = useCallback(() => {
    const seeded = getSampleScreenshotExtraction();
    setExtraction(seeded);
    setItineraryInputMode('sample-screenshot');
    setUploadAcknowledged(true);
    setSelectedTicket1('');
    setSelectedTicket2('');
    setConfirmedItinerary(null);
    setUserConfirmed(false);
    setLiveExtractionReviewed(false);
    setExtractionError(null);
    setStep('trip');
  }, []);

  const isLive = DATA_MODE === 'live';

  /* ── Live Atlas Search (always from confirmed snapshot) ── */
  const performLiveSearchForConfirmed = useCallback(async (confirmed: ConfirmedItinerary) => {
    setSearchLoading(true);
    setSearchError(null);
    setAlternativesResult(null);
    setVerifyResult(null);
    setSelectedOfferId(null);
    try {
      const params = {
        origin: confirmed.firstLeg.origin,
        destination: confirmed.firstLeg.destination,
        depart: confirmed.firstLeg.departureDate,
        adults: 1,
        currency: 'USD',
      };
      let lastError: unknown;
      for (let attempt = 0; attempt < CLIENT_TRANSIENT_ATTEMPTS; attempt += 1) {
        try {
          const response = await atlasSearch(params);
          warnIfAtlasSearchRouteMismatch(response.offers, confirmed, 'first');
          const result = mapSearchResponseToResult(response);
          setAlternativesResult(result);
          setAtlasProviderStatus({
            provider: 'atlas',
            status: result.executed && !result.fallbackUsed ? 'live-success' : 'live-failed',
            executed: result.executed ?? true,
            fallbackUsed: result.fallbackUsed ?? false,
            evidenceSource: result.evidenceSource ?? 'atlas-sandbox',
            retrievedAt: new Date().toISOString(),
            correlationId: result.correlationId,
          });
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          const code = atlasErrorCode(err);
          if (!isTransientAtlasCode(code) || attempt === CLIENT_TRANSIENT_ATTEMPTS - 1) {
            break;
          }
          await delay(CLIENT_TRANSIENT_DELAY_MS);
        }
      }
      if (lastError !== undefined) {
        const code = atlasErrorCode(lastError) || 'UNKNOWN';
        const message = lastError instanceof Error ? lastError.message : 'Atlas Search failed';
        const result = mapErrorToResult({ code, message });
        setAlternativesResult(result);
        setSearchError(message);
        setAtlasProviderStatus({
          provider: 'atlas',
          status: 'live-failed',
          executed: true,
          fallbackUsed: false,
          evidenceSource: 'atlas-sandbox',
          retrievedAt: new Date().toISOString(),
          correlationId: `error-${Date.now()}`,
          errorCode: code,
        });
      }
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const performLiveSearch = useCallback(async () => {
    if (!confirmedItinerary) return;
    await performLiveSearchForConfirmed(confirmedItinerary);
  }, [confirmedItinerary, performLiveSearchForConfirmed]);

  /* ── Live Atlas Verify ── */
  const handleVerifyOffer = useCallback(async (offerId: string) => {
    setVerifyLoading(true);
    setVerifyResult(null);
    setSelectedOfferId(offerId);
    try {
      let summary: VerifySummary | null = null;
      for (let attempt = 0; attempt < CLIENT_TRANSIENT_ATTEMPTS; attempt += 1) {
        try {
          const response = await atlasVerify(offerId);
          summary = mapVerifyResponse(offerId, response);
          if (shouldSelectPlanAfterVerify(summary.status)) break;
          if (!isTransientAtlasCode(summary.code) || attempt === CLIENT_TRANSIENT_ATTEMPTS - 1) break;
        } catch (err) {
          const code = atlasErrorCode(err);
          if (!isTransientAtlasCode(code) || attempt === CLIENT_TRANSIENT_ATTEMPTS - 1) {
            throw err;
          }
        }
        await delay(CLIENT_TRANSIENT_DELAY_MS);
      }
      if (summary) {
        setVerifyResult(summary);
        if (shouldSelectPlanAfterVerify(summary.status)) {
          setDecision('switch');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Atlas Verify failed';
      setVerifyResult({
        offerId,
        status: 'error',
        code: 'verify_failed',
        message,
        previousPrice: 'Not available from Atlas response',
        currentPrice: 'Not available from Atlas response',
        currency: 'Not available from Atlas response',
        priceChange: 'Not available from Atlas response',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setVerifyLoading(false);
    }
  }, []);

  const handleRetrySearch = useCallback(() => {
    performLiveSearch();
  }, [performLiveSearch]);

  /* ── Per-leg unbooked ticket previews (live Search + sequential Verify) ──
   * Start only after the primary live alternatives Search finishes so both
   * paths do not hit atlas-flight for the same leg concurrently (macOS
   * secure-store contention surfaces as SECURE_STORE_UNAVAILABLE or
   * SERVICE_TEMPORARILY_UNAVAILABLE on the main fetch). */
  useEffect(() => {
    const confirmed = confirmedItinerary;
    if (step !== 'options' || !isLive || !confirmed) return undefined;
    if (searchLoading || searchError) return undefined;
    if (!alternativesResult || alternativesResult.searchStatus !== 'completed') return undefined;

    let cancelled = false;

    async function loadUnbookedPreviews(active: ConfirmedItinerary) {
      setPreviewsLoading(true);
      setFirstLegPreviews(createEmptyLegSection(
        'first',
        active.firstLeg.origin,
        active.firstLeg.destination,
        true,
      ));
      setSecondLegPreviews(createEmptyLegSection(
        'second',
        active.secondLeg.origin,
        active.secondLeg.destination,
        true,
      ));

      const first = await loadLegUnbookedPreviews({
        legKey: 'first',
        origin: active.firstLeg.origin,
        destination: active.firstLeg.destination,
        depart: active.firstLeg.departureDate,
      });
      if (cancelled) return;

      setFirstLegPreviews({ ...first, loading: false });

      const second = await loadLegUnbookedPreviews({
        legKey: 'second',
        origin: active.secondLeg.origin,
        destination: active.secondLeg.destination,
        depart: active.secondLeg.departureDate,
      });
      if (cancelled) return;

      setSecondLegPreviews({ ...second, loading: false });
      setPreviewsLoading(false);
    }

    loadUnbookedPreviews(confirmed);

    return () => {
      cancelled = true;
    };
  }, [
    step,
    isLive,
    confirmedItinerary,
    searchLoading,
    alternativesResult,
    searchError,
  ]);

  const handleCheckMyTrip = useCallback(async () => {
    if (confirmTransitionInFlight) return;
    setConfirmTransitionInFlight(true);
    try {
    const snapshotInputMode =
      itineraryInputMode === 'sample'
        ? 'sample'
        : itineraryInputMode === 'upload' || itineraryInputMode === 'sample-screenshot'
          ? 'upload'
          : 'default';
    const skipLiveExtraction = itineraryInputMode === 'sample';
    const needsLiveExtraction = isLive && !skipLiveExtraction && !liveExtractionReviewed;

    /* ── Live MiniMax extract first; stay on Review after success (items 2, 7) ── */
    if (needsLiveExtraction) {
      setExtractionLoading(true);
      setExtractionError(null);
      try {
        const fixtureDataUrl = itineraryInputMode === 'sample-screenshot'
          ? sampleItineraryScreenshot
          : fixtureImages[selectedTicket1]
            ?? fixtureImages[selectedTicket2]
            ?? gem01Image;
        const { base64: imageBase64, mediaType: imageMediaType } = toImagePayload(fixtureDataUrl);
        const extractionResponse = await extractItinerary({
          image: imageBase64,
          mediaType: imageMediaType,
          instruction: 'Extract flight itinerary details from this image.',
        });
        setExtractionProviderStatus(extractionResponse.providerStatus);
        const incoming = extractionResponse.extraction;
        const liveOk = Boolean(
          incoming
          && incoming.extractionStatus !== 'error'
          && incoming.extractionStatus !== 'disabled',
        );
        if (liveOk && incoming) {
          const merged = mergeExtractionResult(extraction, incoming);
          setExtraction(merged);
          setLiveExtractionReviewed(true);
          const extractedSnapshot = createConfirmedItinerarySnapshot(merged, snapshotInputMode);
          setConfirmedItinerary(extractedSnapshot);
          return;
        }
        const failMessage = incoming?.validationMessages?.filter(Boolean).join('; ')
          || 'Extraction did not return a usable itinerary';
        setExtractionError(
          `Extraction failed: ${failMessage}. Please try again or use the ready-made sample.`,
        );
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI extraction failed';
        setExtractionError(
          `Extraction failed: ${message}. Please try again or use the ready-made sample.`,
        );
        setExtractionProviderStatus({
          provider: 'openrouter',
          status: 'live-failed',
          executed: true,
          fallbackUsed: true,
          evidenceSource: 'local-fallback',
          retrievedAt: new Date().toISOString(),
          correlationId: `extract-err-${Date.now()}`,
          errorCode: err instanceof Error && 'code' in err ? (err as { code: string }).code : 'UNKNOWN',
        });
        return;
      } finally {
        setExtractionLoading(false);
      }
    }

    /* ── Confirm: snapshot current (merged + edits), then Options ── */
    const snapshot = createConfirmedItinerarySnapshot(extraction, snapshotInputMode);
    setConfirmedItinerary(snapshot);
    setUserConfirmed(true);

    if (!liveExtractionReviewed) {
      if (isLive && skipLiveExtraction) {
        setExtractionProviderStatus({
          provider: 'openrouter',
          status: 'offline-fallback',
          executed: false,
          fallbackUsed: true,
          evidenceSource: 'local-fixture',
          retrievedAt: new Date().toISOString(),
          correlationId: `extract-sample-skipped-${Date.now()}`,
        });
      } else if (!isLive) {
        setExtractionProviderStatus({
          provider: 'openrouter',
          status: 'offline-fallback',
          executed: false,
          fallbackUsed: true,
          evidenceSource: 'local-fixture',
          retrievedAt: new Date().toISOString(),
          correlationId: `extract-offline-${Date.now()}`,
        });
      }
    }

    /* ── Nosana risk result ── */
    const nosanaResult = await loadNosanaRiskResult();
    if (nosanaResult) {
      setRiskResult(nosanaResult);
      setNosanaProviderStatus({
        provider: 'nosana',
        status: (nosanaResult as unknown as { evidenceSource?: string }).evidenceSource === 'nosana-evidence'
          ? 'live-success' : 'offline-fallback',
        executed: (nosanaResult as unknown as { evidenceSource?: string }).evidenceSource === 'nosana-evidence',
        fallbackUsed: (nosanaResult as unknown as { fallbackUsed?: boolean }).fallbackUsed !== false,
        evidenceSource: (nosanaResult as unknown as { evidenceSource?: string }).evidenceSource ?? 'local-fallback',
        retrievedAt: new Date().toISOString(),
        correlationId: nosanaResult.correlationId,
      });
    } else {
      setRiskResult(getRiskFixture(riskScenario));
      setNosanaProviderStatus({
        provider: 'nosana',
        status: 'blocked-pending-approval',
        executed: false,
        fallbackUsed: true,
        evidenceSource: 'safety-gate-blocked',
        retrievedAt: new Date().toISOString(),
        correlationId: `nosana-blocked-${Date.now()}`,
      });
    }

    if (isLive) {
      setSearchLoading(true);
      setSearchError(null);
      setStep('options');
      await performLiveSearchForConfirmed(snapshot);
    } else {
      /* Offline mode: use local fixture data. */
      setAlternativesResult(getAlternativesFixture(altScenario));
      setAtlasProviderStatus({
        provider: 'atlas',
        status: 'offline-fallback',
        executed: false,
        fallbackUsed: true,
        evidenceSource: 'local-fixture',
        retrievedAt: new Date().toISOString(),
        correlationId: `atlas-offline-${Date.now()}`,
      });
      setStep('options');
    }
    } finally {
      setConfirmTransitionInFlight(false);
    }
  }, [riskScenario, altScenario, isLive, performLiveSearchForConfirmed, selectedTicket1, selectedTicket2, extraction, itineraryInputMode, confirmTransitionInFlight, liveExtractionReviewed]);

  const handleRestart = useCallback(() => {
    setStep('welcome');
    setExtraction(getDefaultExtraction());
    setUserConfirmed(false);
    setRiskResult(null);
    setAlternativesResult(null);
    setDecision(null);
    setCorrectionNotes([]);
    setRiskScenario('success');
    setAltScenario('success');
    setRecoverySubmitted(false);
    setIsEditing(false);
    setShowAllAlternatives(false);
    setShowHowCalculated(false);
    setSelectedTicket1('');
    setSelectedTicket2('');
    setUploadAcknowledged(false);
    setItineraryInputMode('default');
    setConfirmedItinerary(null);
    setSearchLoading(false);
    setSearchError(null);
    setVerifyResult(null);
    setVerifyLoading(false);
    setSelectedOfferId(null);
    setExtractionProviderStatus(null);
    setExtractionLoading(false);
    setExtractionError(null);
    setLiveExtractionReviewed(false);
    setNosanaProviderStatus(null);
    setAtlasProviderStatus(null);
    setSandboxPanelKey((k) => k + 1);
    setConfirmTransitionInFlight(false);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      skipNextHistoryPush.current = true;
      handleRestart();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleRestart]);

  useEffect(() => {
    if (skipNextHistoryPush.current) {
      skipNextHistoryPush.current = false;
      return;
    }
    if (step === 'welcome') return;
    window.history.pushState({ stitchcheckStep: step }, '');
  }, [step]);

  const handleFieldChange = useCallback(
    (leg: 'firstLeg' | 'secondLeg', field: keyof FlightLeg, value: string) => {
      if (itineraryInputMode === 'sample' || itineraryInputMode === 'sample-screenshot') {
        setItineraryInputMode('default');
      }
      setExtraction((prev) => ({
        ...prev,
        [leg]: { ...prev[leg], [field]: value },
      }));
      const origVal = String(originalExtraction[leg][field]);
      const notes = correctionNotes.filter((n) => !n.includes(`${leg}.${String(field)}`));
      if (value !== origVal) {
        notes.push(`Changed ${leg}.${String(field)}: "${origVal}" → "${value}"`);
      }
      setCorrectionNotes(notes);
    },
    [correctionNotes, originalExtraction, itineraryInputMode],
  );

  /* ── Derived data for screens ── */
  const firstLeg = extraction.firstLeg;
  const secondLeg = extraction.secondLeg;
  const recommendedPlan = recoveryAnimationData?.recommendedPlan ?? null;
  const alternatives = alternativesResult?.alternatives ?? [];
  const remainingAlternatives = alternatives.slice(1);
  const showMiniMaxProvenance =
    extractionProviderStatus?.status === 'live-success'
    && extractionProviderStatus.executed
    && !extractionProviderStatus.fallbackUsed;
  const showMiniMaxOfflineExplanation =
    itineraryInputMode === 'sample' || confirmedItinerary?.inputMode === 'sample';

  /* Risk headline score (0–100) — never invented; null when band is unavailable. */
  const riskScoreOutOf100 =
    riskResult && riskResult.riskScore !== null && riskResult.riskBand !== 'unavailable'
      ? Math.round(riskResult.riskScore * 100)
      : null;
  /* Provenance qualifier — driven by real evidenceSource/fallbackUsed, not hardcoded. */
  const riskProvenanceVerifiedLive =
    riskResult?.evidenceSource === 'nosana-evidence' && riskResult?.fallbackUsed === false;
  const riskProvenanceQualifier = riskProvenanceVerifiedLive
    ? ' — verified live'
    : ' — replayed evidence';
  const alternativesCount = alternatives.length;

  return (
    <div className="sc-app">
      <header className="sc-header">
        <h1>StitchCheck</h1>
        <ProviderStatusBar
          extraction={extractionProviderStatus}
          nosana={nosanaProviderStatus}
          atlas={atlasProviderStatus}
          extractionLoading={extractionLoading}
          showMiniMaxOfflineExplanation={showMiniMaxOfflineExplanation}
        />
      </header>

      <NarrationBar
        mode={narration.mode}
        currentText={narration.currentText}
      />

      <main className="sc-main">
        {/* ═══ Screen 1 — Welcome / Safety ═══ */}
        {step === 'welcome' && (
          <section className="sc-screen sc-screen--welcome" aria-label="Welcome">
            <div className="sc-screen__inner">
              <LuggageAirplaneHero />
              <h2 className="sc-screen__title">StitchCheck</h2>
              <p className="sc-screen__subtitle">
                Check your multi-leg itinerary for connection risks and find safer alternatives.
              </p>
              <p className="sc-safety-sentence">
                <strong>Sample documents only.</strong> Do not upload real travel documents.
              </p>
              <div className="sc-welcome-actions">
                <button
                  className="sc-btn sc-btn--primary sc-btn--large"
                  onClick={handleGetStarted}
                  type="button"
                >
                  Upload itinerary
                </button>
                <button
                  className="sc-btn sc-btn--emphasized-secondary sc-btn--large"
                  onClick={handleTrySampleScreenshot}
                  type="button"
                >
                  <Icon name="camera" />
                  {WELCOME_SCREENSHOT_SAMPLE_CTA}
                </button>
                <p className="sc-welcome-helper">
                  {WELCOME_SCREENSHOT_SAMPLE_HELPER}
                </p>
                <button
                  className="sc-btn sc-btn--tertiary-secondary sc-btn--large"
                  onClick={handleTrySampleItinerary}
                  type="button"
                >
                  <Icon name="document" />
                  {WELCOME_READY_MADE_CTA}
                </button>
                <p className="sc-welcome-helper sc-welcome-helper--tertiary">
                  {WELCOME_READY_MADE_HELPER}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ═══ Screen 2 — Upload / Select ticket → Itinerary review ═══ */}
        {step === 'trip' && (
          <section className="sc-screen sc-screen--trip" aria-label="Your trip">
            <h2 className="sc-screen__title">Your trip</h2>

            {itineraryInputMode === 'sample' && (
              <p className="sc-sample-itinerary-banner" role="status">
                Sample itinerary — not uploaded. Edit or replace it with your own.
              </p>
            )}

            {itineraryInputMode === 'sample-screenshot' && (
              <p className="sc-sample-itinerary-banner sc-sample-itinerary-banner--screenshot" role="status">
                {SAMPLE_SCREENSHOT_BANNER}
              </p>
            )}

            {/* ── Upload / Ticket selectors ── */}
            <div className="sc-input-section">
              <h3 className="sc-input-section__title">Provide your itinerary</h3>

              <div className="sc-upload-area">
                <button
                  className="sc-btn sc-btn--secondary"
                  type="button"
                  onClick={() => setUploadAcknowledged(true)}
                  disabled={uploadAcknowledged}
                >
                  {uploadAcknowledged
                    ? itineraryInputMode === 'sample-screenshot'
                      ? 'Sample demo screenshot loaded'
                      : 'Sample itinerary loaded'
                    : 'Upload itinerary'}
                </button>
                <p className="sc-input-section__help">
                  Upload an itinerary image or flight-ticket document to review.
                </p>
                <p className="sc-safety-note">
                  Sample documents only. Do not upload real travel documents.
                </p>
                {uploadAcknowledged && itineraryInputMode === 'sample-screenshot' && (
                  <p className="sc-input-note">Sample demo itinerary image — not a real ticket</p>
                )}
                {uploadAcknowledged && itineraryInputMode !== 'sample-screenshot' && (
                  <p className="sc-input-note">Sample itinerary input</p>
                )}
              </div>

              <div className="sc-ticket-selectors">
                <div className="sc-ticket-selector">
                  <label htmlFor="ticket-1" className="sc-ticket-label">First flight ticket</label>
                  <select
                    id="ticket-1"
                    value={selectedTicket1}
                    onChange={(e) => setSelectedTicket1(e.target.value)}
                    className="sc-ticket-select"
                    disabled={itineraryInputMode === 'sample-screenshot'}
                  >
                    <option value="">Select an unbooked flight-ticket</option>
                    {screenshotFixtures.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sc-ticket-selector">
                  <label htmlFor="ticket-2" className="sc-ticket-label">Second flight ticket</label>
                  <select
                    id="ticket-2"
                    value={selectedTicket2}
                    onChange={(e) => setSelectedTicket2(e.target.value)}
                    className="sc-ticket-select"
                    disabled={itineraryInputMode === 'sample-screenshot'}
                  >
                    <option value="">Select an unbooked flight-ticket</option>
                    {screenshotFixtures.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {extractionLoading && (
              <div className="sc-minimax-loading" role="status" aria-live="polite">
                <span className="sc-minimax-loading__spinner" aria-hidden="true" />
                {MINIMAX_EXTRACTION_LOADING}
              </div>
            )}

            {extractionError && !extractionLoading && (
              <div className="sc-banner sc-banner--error" role="alert">
                {extractionError}
              </div>
            )}

            {showMiniMaxProvenance && (
              <div className="sc-extraction-summary" aria-label="Extracted itinerary summary">
                <MiniMaxProvenanceTag />
                <p className="sc-extraction-summary__route">
                  {firstLeg.origin} → {firstLeg.destination}
                  {' · '}
                  {secondLeg.origin} → {secondLeg.destination}
                </p>
              </div>
            )}

            {/* ── Itinerary review (boarding-pass cards) ── */}
            {!isEditing ? (
              <>
                <div className="sc-boarding-passes">
                  <div className="sc-boarding-pass-card">
                    <span className="sc-boarding-pass-card__label">First flight</span>
                    <span className="sc-boarding-pass-card__route">
                      <Icon name="airplane" />
                      {firstLeg.origin} → {firstLeg.destination}
                    </span>
                    <span className="sc-boarding-pass-card__detail">
                      {firstLeg.airline} · {firstLeg.flightNumber}
                    </span>
                    <span className="sc-boarding-pass-card__time">
                      {firstLeg.departureTime} → {firstLeg.arrivalTime}
                    </span>
                  </div>
                  <div className="sc-boarding-pass-card">
                    <span className="sc-boarding-pass-card__label">Second flight</span>
                    <span className="sc-boarding-pass-card__route">
                      <Icon name="airplane" />
                      {secondLeg.origin} → {secondLeg.destination}
                    </span>
                    <span className="sc-boarding-pass-card__detail">
                      {secondLeg.airline} · {secondLeg.flightNumber}
                    </span>
                    <span className="sc-boarding-pass-card__time">
                      {secondLeg.departureTime} → {secondLeg.arrivalTime}
                    </span>
                  </div>
                </div>
                <p className="sc-connection-note">
                  Connection at {firstLeg.destination} · {extraction.connectionDurationMinutes} min
                </p>

                {correctionNotes.length > 0 && (
                  <details className="sc-corrections-details">
                    <summary>Corrections recorded ({correctionNotes.length})</summary>
                    <ul>
                      {correctionNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="sc-screen__actions">
                  <button
                    className="sc-btn sc-btn--secondary"
                    onClick={() => setIsEditing(true)}
                    type="button"
                  >
                    Edit itinerary
                  </button>
                  <button
                    className="sc-btn sc-btn--primary sc-btn--large"
                    onClick={handleCheckMyTrip}
                    type="button"
                    disabled={confirmTransitionInFlight}
                    aria-busy={confirmTransitionInFlight}
                  >
                    {confirmTransitionInFlight
                      ? 'Checking itinerary…'
                      : liveExtractionReviewed
                        ? 'Continue to alternatives'
                        : 'Check my itinerary'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sc-edit-form">
                  <fieldset className="sc-fieldset">
                    <legend>First flight</legend>
                    {([
                      ['origin', 'From'],
                      ['destination', 'To'],
                      ['flightNumber', 'Flight'],
                      ['departureTime', 'Depart'],
                      ['arrivalTime', 'Arrive'],
                    ] as const).map(([field, label]) => (
                      <div className="sc-field" key={field}>
                        <label htmlFor={`edit-first-${field}`}>{label}</label>
                        <input
                          id={`edit-first-${field}`}
                          type="text"
                          value={firstLeg[field]}
                          onChange={(e) => handleFieldChange('firstLeg', field, e.target.value)}
                        />
                      </div>
                    ))}
                  </fieldset>
                  <fieldset className="sc-fieldset">
                    <legend>Second flight</legend>
                    {([
                      ['origin', 'From'],
                      ['destination', 'To'],
                      ['flightNumber', 'Flight'],
                      ['departureTime', 'Depart'],
                      ['arrivalTime', 'Arrive'],
                    ] as const).map(([field, label]) => (
                      <div className="sc-field" key={field}>
                        <label htmlFor={`edit-second-${field}`}>{label}</label>
                        <input
                          id={`edit-second-${field}`}
                          type="text"
                          value={secondLeg[field]}
                          onChange={(e) => handleFieldChange('secondLeg', field, e.target.value)}
                        />
                      </div>
                    ))}
                  </fieldset>
                </div>
                <div className="sc-screen__actions">
                  <button
                    className="sc-btn sc-btn--secondary"
                    onClick={() => setIsEditing(false)}
                    type="button"
                  >
                    Done editing
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ═══ Screen 3 — Answer / options (risk summary + recommendation + decision) ═══ */}
        {step === 'options' && (
          <section className="sc-screen sc-screen--options" aria-label="Your options">
            <h2 className="sc-screen__title">
              {riskScoreOutOf100 !== null
                ? `Your connection has a ${riskScoreOutOf100}/100 risk of failing you${riskProvenanceQualifier}.`
                : 'Your connection is at risk'}
            </h2>

            {riskScoreOutOf100 !== null && alternativesCount > 0 && (
              <p className="sc-options-alternatives-lead">
                {alternativesCount} single-ticket alternative
                {alternativesCount === 1 ? '' : 's'} that remove this risk.
              </p>
            )}

            {extractionError && !extractionLoading && (
              <div className="sc-banner sc-banner--error" role="alert">
                {extractionError}
              </div>
            )}

            {showMiniMaxProvenance && confirmedItinerary && (
              <div className="sc-extraction-summary" aria-label="Extracted itinerary summary">
                <MiniMaxProvenanceTag />
                <p className="sc-extraction-summary__route">
                  {confirmedItinerary.firstLeg.origin} → {confirmedItinerary.firstLeg.destination}
                  {' · '}
                  {confirmedItinerary.secondLeg.origin} → {confirmedItinerary.secondLeg.destination}
                </p>
              </div>
            )}

            {/* ── Status banner ── */}
            {searchLoading && (
              <div className="sc-banner sc-banner--loading" role="status">
                Checking live alternatives…
              </div>
            )}
            {searchError && !searchLoading && (
              <div className="sc-banner sc-banner--error" role="alert">
                <strong>Live alternatives are unavailable.</strong>{' '}
                {searchError}
                <button
                  className="sc-btn sc-btn--small sc-btn--secondary"
                  onClick={handleRetrySearch}
                  type="button"
                  style={{ marginLeft: '0.5rem' }}
                >
                  Retry
                </button>
              </div>
            )}
            {!searchLoading && !searchError && alternativesResult && alternativesResult.searchStatus === 'completed' && isLive && verifyResult && verifyResult.status === 'success' && (
              <div className="sc-banner sc-banner--success" role="status">
                Itinerary checked. Alternatives verified for comparison.
              </div>
            )}
            {!searchLoading && !searchError && alternativesResult && alternativesResult.searchStatus === 'completed' && isLive && !verifyResult && (
              <div className="sc-banner sc-banner--success" role="status">
                Itinerary checked. Live alternatives ready for review.
              </div>
            )}
            {!isLive && !searchLoading && alternativesResult && alternativesResult.searchStatus === 'completed' && (
              <div className="sc-banner sc-banner--success" role="status">
                Itinerary checked. Local alternatives are ready.
              </div>
            )}

            {/* ── Recommended option (from recovery plan) ── */}
            {recommendedPlan && recommendedPlan.replacementFirstLeg && (
              <div
                className={`sc-recommended-option ${decision === 'switch' ? 'sc-recommended-option--selected' : ''}`}
                role="button"
                aria-pressed={decision === 'switch'}
              >
                <div className="sc-recommended-header">
                  <span className="sc-recommended-badge">Recommended</span>
                  {decision === 'switch' && (
                    <span className="sc-selected-indicator" aria-label="Selected">✓ Selected</span>
                  )}
                </div>
                <h3 className="sc-recommended-route">
                  {recommendedPlan.replacementFirstLeg.routeSummary}
                </h3>
                <dl className="sc-recommended-details">
                  <div><dt>Type</dt><dd>{recommendedPlan.replacementFirstLeg.connectionType ?? '—'}</dd></div>
                  {recommendedPlan.onwardOption && (
                    <div><dt>Onward</dt><dd>{recommendedPlan.onwardOption.routeSummary}</dd></div>
                  )}
                  {recommendedPlan.replacementFirstLeg.priceDisplay && (
                    <div><dt>Price</dt><dd>{recommendedPlan.replacementFirstLeg.priceDisplay}</dd></div>
                  )}
                </dl>
                {recommendedPlan.tradeoffs
                  && recommendedPlan.tradeoffs.arrivalImpactMinutes !== null && (
                  <p className="sc-recommended-tradeoff">
                    {`Arrival impact: ${recommendedPlan.tradeoffs.arrivalImpactMinutes} min vs original`}
                  </p>
                )}
                {decision !== 'switch' && decision !== 'keep' && (
                  <button
                    className="sc-btn sc-btn--primary"
                    onClick={() => setDecision('switch')}
                    type="button"
                  >
                    Switch to this plan
                  </button>
                )}
              </div>
            )}

            <details className="sc-risk-detail">
              <summary>See why this is risky</summary>
              <div className="sc-risk-detail__body">
                {recoveryAnimationData && (
                  <RecoveryPlanAnimation
                    data={recoveryAnimationData}
                    executionMode={recoveryExecutionMode}
                  />
                )}

                <details
                  className="sc-how-calculated"
                  open={showHowCalculated}
                  onToggle={(e) => setShowHowCalculated((e.target as HTMLDetailsElement).open)}
                >
                  <summary>How this was calculated</summary>
                  <div className="sc-how-calculated__body">
                    {howCalculated && (
                      <>
                        {recoveryAnimationData && (
                          <p data-testid="rpa-how-provenance">{recoveryAnimationData.provenanceLabel}</p>
                        )}
                        <p className="sc-how-calculated__risk-band">
                          <Icon
                            name="warning"
                            className={
                              howCalculated.riskBand === 'medium'
                                ? 'sc-icon--risk-medium'
                                : undefined
                            }
                          />
                          Risk band: <strong>{howCalculated.riskBand}</strong>
                        </p>
                        <p className="sc-disclaimer">{howCalculated.heuristicDisclaimer}</p>
                        <p className="sc-explanation">{howCalculated.failureCascadeExplanation}</p>
                        <p className="sc-meta-small">
                          Dataset: {howCalculated.datasetVersion}
                          {howCalculated.latencyMs !== undefined && ` · Latency: ${howCalculated.latencyMs}ms`}
                        </p>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </details>

            <h3 className="sc-options-section-title">Verified unbooked previews</h3>

            {/* ── Per-leg unbooked ticket previews (read-only, up to 5 per leg) ── */}
            {isLive && (
              <div className="sc-unbooked-preview-sections">
                <UnbookedTicketPreviewLegSection section={firstLegPreviews} />
                <UnbookedTicketPreviewLegSection section={secondLegPreviews} />
                {previewsLoading && (
                  <p className="sc-unbooked-preview-leg__status" role="status">
                    Verifying unbooked previews sequentially…
                  </p>
                )}
              </div>
            )}

            {/* ── Live alternatives list ── */}
            {isLive && alternativesResult && alternativesResult.searchStatus === 'completed' && (
              <LiveAlternativesList
                alternatives={alternatives}
                selectedOfferId={selectedOfferId}
                verifyResult={verifyResult}
                verifyLoading={verifyLoading}
                decision={decision}
                onVerifyAndSelectPlan={handleVerifyOffer}
              />
            )}

            {/* ── Atlas Sandbox write-rehearsal panel (scaffolding only) ──
                Mounted only on the options screen after a successful Verify.
                The component hides itself unless every gate passes
                (compile flag, live mode, runtime capabilities, successful
                Verify with a booking identifier, explicit user opt-in),
                and renders only disabled write controls. */}
            {isLive && verifyResult && (
              <SandboxOrderPanel
                key={`sandbox-panel-${sandboxPanelKey}`}
                bookingId={verifyResult.bookingId}
                travelers={verifyResult.travelers}
                offerId={selectedOfferId}
                verifyStatus={verifyResult.status}
              />
            )}

            {/* ── Offline alternatives list ── */}
            {!isLive && !showAllAlternatives && remainingAlternatives.length > 0 && (
              <button
                className="sc-btn sc-btn--secondary"
                onClick={() => setShowAllAlternatives(true)}
                type="button"
              >
                See more options ({remainingAlternatives.length})
              </button>
            )}

            {!isLive && showAllAlternatives && remainingAlternatives.length > 0 && (
              <div className="sc-more-options">
                <h3 className="sc-more-options__title">Other options</h3>
                {remainingAlternatives.map((alt) => (
                  <div key={alt.offerReference} className="sc-alt-card">
                    <h4>{alt.routeSummary}</h4>
                    <p>{alt.connectionType} · {alt.departureTime}–{alt.arrivalTime}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Source label — derived from provenance, not DATA_MODE ── */}
            <p className="sc-source-note">
              {alternativesResult && alternativesResult.searchStatus === 'completed'
                && alternativesResult.evidenceSource === 'atlas-sandbox'
                && alternativesResult.executed === true
                && alternativesResult.fallbackUsed === false
                ? 'Source: Atlas Sandbox · live'
                : alternativesResult && alternativesResult.searchStatus === 'completed'
                  ? 'Source: Local fixture'
                  : searchLoading
                    ? 'Checking current alternatives…'
                    : searchError
                      ? 'Live alternatives unavailable'
                      : 'Source: Offline fallback'}
            </p>

            {/* ── Decision section ── */}
            <div className="sc-decision-section">
              <h3 className="sc-decision-section__title">Your choice</h3>
              <div className="sc-decision-actions">
                <button
                  className={`sc-btn sc-btn--large ${decision === 'keep' ? 'sc-btn--primary' : 'sc-btn--secondary'}`}
                  onClick={() => setDecision(decision === 'keep' ? null : 'keep')}
                  type="button"
                  aria-pressed={decision === 'keep'}
                >
                  {decision === 'keep' ? '✓ Keep current itinerary' : 'Keep current itinerary'}
                </button>
                {decision !== 'switch' && recommendedPlan && (
                  <button
                    className={`sc-btn sc-btn--large sc-btn--secondary`}
                    onClick={() => setDecision('switch')}
                    type="button"
                    aria-pressed={false}
                  >
                    Switch to this plan
                  </button>
                )}
              </div>

              {decision && (
                <div className="sc-decision-confirm">
                  <p className="sc-decision-status">
                    {decision === 'switch' ? 'Switch selected' : 'Keeping current itinerary'}
                  </p>
                  <p className="sc-safety-sentence">
                    No booking action is taken. No booking, payment, reservation, or order is created. Search is read-only.
                  </p>
                  <button
                    className="sc-btn sc-btn--primary"
                    onClick={() => setStep('done')}
                    type="button"
                  >
                    {decision === 'switch' ? 'Submit switch request' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ Screen 5 — Done ═══ */}
        {step === 'done' && (
          <section className="sc-screen sc-screen--done" aria-label="Complete">
            <div className="sc-screen__inner">
              <div className="sc-done-icon" aria-hidden="true">✓</div>
              <h2 className="sc-screen__title">
                {decision === 'switch' ? 'Switch selected' : 'Itinerary kept'}
              </h2>
              <p className="sc-done-message">
                {decision === 'switch'
                  ? 'You chose to switch to the recommended option.'
                  : 'You chose to keep your current flights.'}
              </p>
              <p className="sc-done-status">
                Request submitted — awaiting verified supplier outcome
              </p>
              <p className="sc-safety-sentence">
                No booking, payment, reservation, or order is created.
              </p>

              <details className="sc-how-calculated">
                <summary>Technical details</summary>
                <div className="sc-how-calculated__body">
                  <dl className="sc-meta-list">
                    <dt>noOrderCreated:</dt><dd>true</dd>
                    <dt>decision:</dt><dd>{decision ?? 'none'}</dd>
                  </dl>
                </div>
              </details>

              <button
                className="sc-btn sc-btn--primary sc-btn--large"
                onClick={handleRestart}
                type="button"
              >
                Check another trip
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="sc-footer">
        <p>StitchCheck — No booking, payment, reservation, or order created.</p>
      </footer>
    </div>
  );
}

/* ── NarrationBar inline (lightweight, avoids import cycle) ── */
function NarrationBar({
  mode,
  currentText,
}: {
  mode: string;
  currentText: string;
}) {
  if (mode === 'off') return null;
  return (
    <div className={`sc-narration-bar sc-narration-bar--${mode}`} aria-label="Narration">
      {currentText && <p className="sc-narration-bar__caption">{currentText}</p>}
    </div>
  );
}
