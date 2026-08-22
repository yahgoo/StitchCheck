import { useState, useCallback, useEffect } from 'react';
import { SafetyNotice } from './components/SafetyNotice';
import { UploadPanel } from './components/UploadPanel';
import { ItineraryReview } from './components/ItineraryReview';
import { RiskPanel } from './components/RiskPanel';
import { AlternativesPanel } from './components/AlternativesPanel';
import { ComparisonView } from './components/ComparisonView';
import { DecisionPanel } from './components/DecisionPanel';
import { StatusBanner } from './components/StatusBanner';
import { NarrationBar } from './components/NarrationBar';
import { useNarration } from './components/useNarration';
import {
  getDefaultExtraction,
  getRiskFixture,
  getAlternativesFixture,
  getComparisonData,
  loadNosanaRiskResult,
} from './data/fixtures';
import type {
  AppStep,
  ExtractionResult,
  FlightLeg,
  RiskResult,
  SearchResult,
  ComparisonData,
  RiskScenario,
  AlternativesScenario,
  Decision,
} from './data/types';
import './App.css';

export default function App() {
  const [step, setStep] = useState<AppStep>('safety-notice');
  const [screenshotSelections, setScreenshotSelections] = useState<[string | null, string | null]>([null, null]);
  const [extraction, setExtraction] = useState<ExtractionResult>(getDefaultExtraction());
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [alternativesResult, setAlternativesResult] = useState<SearchResult | null>(null);
  const [comparisonData] = useState<ComparisonData>(getComparisonData());
  const [decision, setDecision] = useState<Decision>(null);
  const [decisionConfirmed, setDecisionConfirmed] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState<string[]>([]);
  const [riskScenario, setRiskScenario] = useState<RiskScenario>('success');
  const [altScenario, setAltScenario] = useState<AlternativesScenario>('success');
  const [originalExtraction] = useState<ExtractionResult>(getDefaultExtraction());

  /* ── Local browser narration (optional, off by default) ── */
  const narration = useNarration();

  /* Trigger narration caption when step changes */
  useEffect(() => {
    narration.speak(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleAcknowledgeSafety = useCallback(() => setStep('upload'), []);

  const handleScreenshotSelect = useCallback((slot: number, fixtureId: string) => {
    setScreenshotSelections((prev) => {
      const next: [string | null, string | null] = [...prev];
      next[slot] = fixtureId;
      return next;
    });
  }, []);

  const handleUploadContinue = useCallback(() => setStep('review'), []);

  const handleRestart = useCallback(() => {
    setStep('safety-notice');
    setScreenshotSelections([null, null]);
    setExtraction(getDefaultExtraction());
    setUserConfirmed(false);
    setRiskResult(null);
    setAlternativesResult(null);
    setDecision(null);
    setDecisionConfirmed(false);
    setCorrectionNotes([]);
    setRiskScenario('success');
    setAltScenario('success');
  }, []);

  const handleFieldChange = useCallback(
    (leg: 'firstLeg' | 'secondLeg', field: keyof FlightLeg, value: string) => {
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
    [correctionNotes, originalExtraction],
  );

  const handleConnectionDurationChange = useCallback(
    (value: number) => {
      setExtraction((prev) => ({ ...prev, connectionDurationMinutes: value }));
      const origVal = String(originalExtraction.connectionDurationMinutes);
      const notes = correctionNotes.filter((n) => !n.includes('connectionDurationMinutes'));
      if (String(value) !== origVal) {
        notes.push(`Changed connectionDurationMinutes: "${origVal}" → "${String(value)}"`);
      }
      setCorrectionNotes(notes);
    },
    [correctionNotes, originalExtraction],
  );

  const handleConfirm = useCallback(async () => {
    setUserConfirmed(true);
    setStep('confirmed');
    // Attempt to load a real Nosana result; fall back to local fixture
    const nosanaResult = await loadNosanaRiskResult();
    if (nosanaResult) {
      setRiskResult(nosanaResult);
    } else {
      setRiskResult(getRiskFixture(riskScenario));
    }
    setAlternativesResult(getAlternativesFixture(altScenario));
  }, [riskScenario, altScenario]);

  const handleRiskScenarioChange = useCallback((s: RiskScenario) => {
    setRiskScenario(s);
    setRiskResult(getRiskFixture(s));
  }, []);

  const handleAltScenarioChange = useCallback((s: AlternativesScenario) => {
    setAltScenario(s);
    setAlternativesResult(getAlternativesFixture(s));
  }, []);

  const handleConfirmDecision = useCallback(() => setDecisionConfirmed(true), []);

  return (
    <div className="sc-app">
      <header className="sc-header">
        <h1>StitchCheck</h1>
        <span className="sc-header__badge">Synthetic Demo — No Live Services</span>
      </header>

      <NarrationBar
        mode={narration.mode}
        status={narration.status}
        currentText={narration.currentText}
        isSupported={narration.isSupported}
        onModeChange={narration.setMode}
        onStop={narration.stop}
      />

      <main className="sc-main">
        {step === 'safety-notice' && (
          <SafetyNotice onAcknowledge={handleAcknowledgeSafety} />
        )}

        {step === 'upload' && (
          <UploadPanel
            selections={screenshotSelections}
            onSelect={handleScreenshotSelect}
            onContinue={handleUploadContinue}
            onRestart={handleRestart}
          />
        )}

        {step === 'review' && (
          <>
            <ItineraryReview
              extraction={extraction}
              onFieldChange={handleFieldChange}
              onConnectionDurationChange={handleConnectionDurationChange}
              onConfirm={handleConfirm}
              onCancel={() => setStep('upload')}
              confirmed={false}
              correctionNotes={correctionNotes}
            />

            <div className="sc-panels-grid">
              <RiskPanel
                enabled={false}
                riskResult={null}
                scenario={riskScenario}
                onScenarioChange={handleRiskScenarioChange}
              />
              <AlternativesPanel
                enabled={false}
                searchResult={null}
                scenario={altScenario}
                onScenarioChange={handleAltScenarioChange}
              />
            </div>
          </>
        )}

        {step === 'confirmed' && (
          <>
            <ItineraryReview
              extraction={extraction}
              onFieldChange={handleFieldChange}
              onConnectionDurationChange={handleConnectionDurationChange}
              onConfirm={handleConfirm}
              onCancel={() => setStep('upload')}
              confirmed={userConfirmed}
              correctionNotes={correctionNotes}
            />

            <StatusBanner
              type="success"
              message="Itinerary confirmed. No external service call was made. Downstream panels are now active with local synthetic placeholder data."
            />

            <div className="sc-panels-grid">
              <RiskPanel
                enabled={userConfirmed}
                riskResult={riskResult}
                scenario={riskScenario}
                onScenarioChange={handleRiskScenarioChange}
              />
              <AlternativesPanel
                enabled={userConfirmed}
                searchResult={alternativesResult}
                scenario={altScenario}
                onScenarioChange={handleAltScenarioChange}
              />
            </div>

            <ComparisonView comparison={comparisonData} riskResult={riskResult} />

            <DecisionPanel
              decision={decision}
              onDecision={setDecision}
              onConfirmDecision={handleConfirmDecision}
              onRestart={handleRestart}
              decisionConfirmed={decisionConfirmed}
            />
          </>
        )}
      </main>

      <footer className="sc-footer">
        <p>
          StitchCheck Synthetic Demo · No external calls · No booking, payment,
          or order created · All data is fictional and local
        </p>
      </footer>
    </div>
  );
}
