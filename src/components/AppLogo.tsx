import React from 'react';

interface AppLogoProps {
  isDarkMode: boolean;
  className?: string;
  size?: number | string;
  showTitle?: boolean;
}

/**
 * AppLogo renders the official bite-marked musical note logo.
 * - In Dark Mode: White silhouette with iconic bite on top-right beam (matching *12a)
 * - In Light Mode: Black silhouette with iconic bite on top-right beam (matching *g08)
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  isDarkMode,
  className = 'w-7 h-7',
  size,
  showTitle = false,
}) => {
  const fillColor = isDarkMode ? '#ffffff' : '#111111';
  const maskId = isDarkMode ? 'appLogoBiteDark' : 'appLogoBiteLight';
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        id="app-logo-container"
        style={style}
        className={`flex-shrink-0 flex items-center justify-center rounded transition-transform hover:scale-105 duration-150 ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1000 1000"
          className="w-full h-full object-contain"
          aria-label="App Logo - Music Note with Bite"
          role="img"
        >
          <defs>
            <mask id={maskId}>
              {/* Full canvas white reveals everything */}
              <rect width="1000" height="1000" fill="white" />
              {/* Triangular mask cutting away upper-right outer corner */}
              <polygon points="580,100 850,100 850,400 748,348 585,212" fill="black" />
              {/* 3 Concave teeth bite marks */}
              <circle cx="615" cy="245" r="34" fill="black" />
              <circle cx="666" cy="296" r="34" fill="black" />
              <circle cx="722" cy="346" r="34" fill="black" />
            </mask>
          </defs>

          <g mask={`url(#${maskId})`} fill={fillColor}>
            {/* Left note circular head */}
            <circle cx="290" cy="665" r="140" />

            {/* Right note circular head */}
            <circle cx="625" cy="665" r="140" />

            {/* Left stem */}
            <rect x="365" y="295" width="65" height="370" />

            {/* Right stem */}
            <rect x="683" y="190" width="65" height="475" />

            {/* Slanted Connecting Beam */}
            <polygon points="365,305 425,238 748,190 748,358 683,375 430,455 365,470" />

            {/* Top-left smooth corner fillet */}
            <path d="M 365 315 C 365 260 390 242 425 238 L 425 315 Z" />
          </g>
        </svg>
      </div>

      {showTitle && (
        <div className="min-w-0 flex-1">
          <h1 className="text-xs font-semibold tracking-tight truncate">
            W.&apos;s Simple Media Tools
          </h1>
        </div>
      )}
    </div>
  );
};
