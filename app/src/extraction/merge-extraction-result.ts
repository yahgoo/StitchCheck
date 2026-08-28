import type { ExtractionResult, FlightLeg } from '../../../core/domain';

/** Provider payloads may use `date` (OpenRouter schema) instead of `departureDate` (UI). */
type ProviderLeg = Partial<FlightLeg> & {
  date?: string | null;
  airline?: string | null;
  flightNumber?: string | null;
};

function mapProviderLeg(leg: ProviderLeg | null | undefined): FlightLeg | null {
  if (leg == null) return null;
  const departureDate = (leg.departureDate || leg.date || '').trim();
  return {
    origin: leg.origin ?? '',
    destination: leg.destination ?? '',
    departureDate,
    airline: leg.airline ?? '',
    flightNumber: leg.flightNumber ?? '',
    departureTime: leg.departureTime ?? '',
    arrivalTime: leg.arrivalTime ?? '',
  };
}

/** Preserve prior legs when live extraction returns null/disabled legs. */
export function mergeExtractionResult(
  prev: ExtractionResult,
  incoming: Partial<ExtractionResult>,
): ExtractionResult {
  const mappedFirst = mapProviderLeg(incoming.firstLeg as ProviderLeg | null | undefined);
  const mappedSecond = mapProviderLeg(incoming.secondLeg as ProviderLeg | null | undefined);
  // #region agent log
  fetch('http://127.0.0.1:7403/ingest/aac4d69a-d129-4aeb-abd0-e30af84b4350',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c1bf5'},body:JSON.stringify({sessionId:'9c1bf5',runId:'post-fix',hypothesisId:'B',location:'merge-extraction-result.ts:mapProviderLeg',message:'merge date→departureDate',data:{incomingFirstHasDate:Boolean((incoming.firstLeg as ProviderLeg | undefined)?.date),incomingFirstHasDepartureDate:Boolean(incoming.firstLeg?.departureDate),mappedFirstDepartureDate:mappedFirst?.departureDate || null,mappedFirstOrigin:mappedFirst?.origin || null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return {
    ...prev,
    ...incoming,
    firstLeg: mappedFirst ?? prev.firstLeg,
    secondLeg: mappedSecond ?? prev.secondLeg,
  };
}
