import type { ExtractionResult, FlightLeg } from '../../../core/domain';

/** Provider payloads may use `date` (OpenRouter schema) instead of `departureDate` (UI). */
type ProviderLeg = Partial<FlightLeg> & {
  date?: string | null;
  airline?: string | null;
  carrier?: string | null;
  flightNumber?: string | null;
};

function mapProviderLeg(leg: ProviderLeg | null | undefined): FlightLeg | null {
  if (leg == null) return null;
  const departureDate = (leg.departureDate || leg.date || '').trim();
  return {
    origin: leg.origin ?? '',
    destination: leg.destination ?? '',
    departureDate,
    airline: (leg.airline || leg.carrier || '').trim(),
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
  return {
    ...prev,
    ...incoming,
    firstLeg: mappedFirst ?? prev.firstLeg,
    secondLeg: mappedSecond ?? prev.secondLeg,
  };
}
