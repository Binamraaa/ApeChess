// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Binamra Bhusal

import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Flame = (p: P) => (
  <Svg {...p}>
    <path
      d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.4a4.8 4.8 0 0 1-9.6 0c0-1.9.9-3.3 1.9-4.3.2 1.5 1 2.6 2.1 2.9-.6-3.2.1-6.4.8-9z"
      fill="currentColor"
    />
  </Svg>
);

export const Bolt = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2L13.5 2z" fill="currentColor" />
  </Svg>
);

export const Star = ({ filled = true, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const Lock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="2.2" />
  </Svg>
);

export const Close = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </Svg>
);

export const Bulb = (p: P) => (
  <Svg {...p}>
    <path
      d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V17h6v-1.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z"
      fill="currentColor"
    />
    <path d="M9.5 19.5h5M10.5 22h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const Speaker = ({ muted = false, ...p }: P & { muted?: boolean }) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" strokeLinejoin="round" />
    {muted ? (
      <path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    ) : (
      <path d="M15.5 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    )}
  </Svg>
);

export const Book = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="currentColor" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" fill="currentColor" opacity="0.55" />
    <path d="M9 7.5h6" stroke="var(--paper, #fff)" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const Cloud = (p: P) => (
  <Svg {...p}>
    <path d="M7 19a4.5 4.5 0 0 1-.9-8.9 6 6 0 0 1 11.5-1.4A5.2 5.2 0 0 1 17.5 19z" fill="currentColor" />
  </Svg>
);
