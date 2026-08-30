/** Decorative welcome-screen hero. Colors follow existing tokens; not used for logic. */

import './LuggageAirplaneHero.css';

const FLIGHT_PATH =
  'M 36 92 C 36 22 164 22 164 92 C 164 148 36 148 36 92';

export function LuggageAirplaneHero() {
  return (
    <div className="sc-luggage-hero" aria-hidden="true">
      <svg
        className="sc-luggage-hero__art"
        viewBox="0 0 200 168"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <path
          className="sc-luggage-hero__flight-path"
          d={FLIGHT_PATH}
          stroke="#533afd"
          strokeWidth="2"
          strokeDasharray="5 6"
          strokeLinecap="round"
        />

        <g className="sc-luggage-hero__case">
          <path
            d="M88 48h24a4 4 0 0 1 4 4v8H84v-8a4 4 0 0 1 4-4Z"
            stroke="#1a1a2e"
            strokeWidth="3"
            fill="none"
          />
          <rect x="93" y="44" width="4" height="8" rx="1.5" fill="#1a1a2e" />
          <rect x="103" y="44" width="4" height="8" rx="1.5" fill="#1a1a2e" />

          <rect x="70" y="60" width="60" height="52" rx="12" fill="#533afd" />
          <rect x="74" y="64" width="52" height="44" rx="9" fill="#4528e0" opacity="0.35" />
          <rect x="96" y="68" width="8" height="36" rx="2" fill="#fff" opacity="0.22" />

          <path
            d="M100 76c6.5 1.6 10 3.4 10 6.2 0 6.4-4.2 9.6-10 13.3-5.8-3.7-10-6.9-10-13.3 0-2.8 3.5-4.6 10-6.2Z"
            fill="#1a1a2e"
          />

          <g className="sc-luggage-hero__wheel sc-luggage-hero__wheel--left">
            <circle cx="84" cy="118" r="7.5" fill="#1a1a2e" />
            <circle cx="84" cy="118" r="3" fill="#f5f5f5" />
          </g>
          <g className="sc-luggage-hero__wheel sc-luggage-hero__wheel--right">
            <circle cx="116" cy="118" r="7.5" fill="#1a1a2e" />
            <circle cx="116" cy="118" r="3" fill="#f5f5f5" />
          </g>
        </g>

        <g className="sc-luggage-hero__badge">
          <circle cx="138" cy="122" r="13" fill="#16a34a" />
          <circle cx="138" cy="122" r="13" stroke="#fff" strokeWidth="2" />
          <path
            d="M132 122.2 136.2 126.5 145 117.5"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <svg
        className="sc-luggage-hero__plane"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
      >
        <path
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
          fill="#1a1a2e"
        />
      </svg>
    </div>
  );
}
