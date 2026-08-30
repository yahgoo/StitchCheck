/** Traveler-facing city names for demo IATA codes. Unknown codes stay as the code. */
const CITY_BY_IATA: Record<string, string> = {
  SIN: 'Singapore',
  DPS: 'Denpasar',
  CGK: 'Jakarta',
  KUL: 'Kuala Lumpur',
  BKK: 'Bangkok',
  HAN: 'Hanoi',
};

export function connectionCityName(airportCode: string | undefined | null): string {
  const code = (airportCode || '').trim().toUpperCase();
  if (!code) return 'your connecting airport';
  return CITY_BY_IATA[code] ?? code;
}

export function tightConnectionHeadline(
  connectionMinutes: number | null | undefined,
  connectionAirport: string | undefined | null,
): string {
  if (connectionMinutes == null || Number.isNaN(connectionMinutes) || connectionMinutes <= 0) {
    return 'Your connection may be too tight';
  }
  const city = connectionCityName(connectionAirport);
  return `Your ${connectionMinutes}-minute connection in ${city} is tight.`;
}

export const TIGHT_CONNECTION_REASON =
  'If your first flight is delayed, you may miss your connection.';
