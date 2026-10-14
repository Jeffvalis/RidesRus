/**
 * RidesRus design tokens, lifted from the product designs (docs/design/flows):
 * warm cream surfaces, a Lagos-danfo yellow for primary actions, olive and lime
 * accents, blue for time/ETA, red only for full buses and emergencies.
 */
export const brand = {
  ink: '#1A1A1A',
  inkSoft: '#55524B',
  inkMuted: '#8A867D',
  cream: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EEE7',
  line: '#E7E2D8',
  yellow: '#FACC15',
  yellowSoft: '#FEF3C7',
  yellowInk: '#4D400E',
  olive: '#656214',
  oliveSoft: '#F4F1DC',
  lime: '#D9F99D',
  limeInk: '#3F6212',
  green: '#4D7C0F',
  blue: '#2F4FC9',
  blueSoft: '#E6EBFB',
  red: '#DC2626',
  redSoft: '#FDECEC',
  // Night palette for the driver console (glare-free after dark).
  night: '#0F1012',
  nightSurface: '#1A1C20',
  nightLine: '#2A2D33',
  nightInk: '#F2F0EA',
  nightInkMuted: '#9C9890',
} as const;

/** Map marker colours per seat band (PRD: white = empty, green = seats, red = full). */
export const bandColors = {
  EMPTY: { fill: '#FFFFFF', ink: brand.ink, ring: brand.ink, label: 'Empty' },
  AVAILABLE: { fill: brand.green, ink: '#FFFFFF', ring: '#FFFFFF', label: 'Seats' },
  FULL: { fill: brand.red, ink: '#FFFFFF', ring: '#FFFFFF', label: 'Full' },
} as const;
