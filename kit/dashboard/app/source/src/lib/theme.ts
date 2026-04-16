// Theme configuration — customize branding, colors, and content per deployment
// Override by setting environment variables or editing this file during onboarding

export const theme = {
  // Branding
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Executive Dashboard",
  orgName: process.env.NEXT_PUBLIC_ORG_NAME || "My Organization",
  
  // Colors
  primary: process.env.NEXT_PUBLIC_COLOR_PRIMARY || "#B675F5",     // Lavender — sidebar active, accents
  accent: process.env.NEXT_PUBLIC_COLOR_ACCENT || "#07BEB8",       // Teal — CTAs, highlights, numbers
  
  // Timezone for display formatting
  timezone: process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York",

  // North Star content (shown on home page)
  mission: process.env.NEXT_PUBLIC_MISSION || "We help leaders operate in their zone of genius by providing world-class executive support.",
  
  values: [
    { emoji: "🎯", label: "Proactive, not reactive" },
    { emoji: "🔒", label: "Discretion is absolute" },
    { emoji: "⚡", label: "Execute relentlessly" },
    { emoji: "🧠", label: "Anticipate, don't wait" },
  ],

  vision: [
    { horizon: "Now", text: "AI-powered EA support for every executive" },
    { horizon: "Next", text: "Multi-agent teams that scale with the business" },
    { horizon: "Future", text: "The operating system for executive productivity" },
  ],
} as const;

// Helper to generate rgba from hex
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
