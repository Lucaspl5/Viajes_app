export const C = {
  // Backgrounds
  paper: "#F5F4F1", paperDark: "#ECEAE4",
  // Text
  ink: "#0E1726", inkSoft: "#64748B",
  // Brand blues — deeper, richer midnight
  navy: "#0B1930", navyMid: "#142644",
  // Accents — vivid & saturated
  teal: "#00C48C",       // electric emerald-teal
  gold: "#F59E0B",       // vivid amber
  goldLight: "#FCD34D",  // bright yellow-gold
  red: "#F43F5E",        // vivid rose-red
  coral: "#FB7185",      // soft coral
  sky: "#38BDF8",        // sky blue
  green: "#10B981",      // emerald
  purple: "#8B5CF6",     // violet accent
  // Borders
  line: "#E2DDD6",
} as const;

export const F = {
  display: "var(--font-display), Georgia, serif",
  mono: "var(--font-mono), 'Courier New', monospace",
  body: "var(--font-body), system-ui, sans-serif",
} as const;

export const inputStyle: React.CSSProperties = {
  border: `1px solid ${C.line}`, borderRadius: 5, padding: "9px 11px",
  fontSize: 14, fontFamily: F.body, color: C.ink, background: "#FCFAF4", width: "100%",
};
