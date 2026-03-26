/**
 * AP course auto-detection helper.
 * Matches a class name against known AP course patterns and returns
 * the course key and detection status. Matching is forgiving and
 * handles common abbreviations (AP Lang, APUSH, AP Calc AB, etc.).
 */

export interface ApDetectionResult {
  isApCourse: boolean;
  apCourseKey: string | null;
}

type ApPattern = {
  key: string;
  patterns: RegExp[];
};

/**
 * Pattern list ordered from most-specific to least-specific.
 * Each entry lists multiple regex patterns that can match the course.
 * Matching is case-insensitive (applied via the `i` flag).
 */
const AP_PATTERNS: ApPattern[] = [
  // ── Calculus BC before AB so "BC" doesn't fall through to AB ──
  {
    key: "ap_calculus_bc",
    patterns: [
      /ap\s*calc(?:ulus)?\s*bc\b/i,
    ],
  },
  {
    key: "ap_calculus_ab",
    patterns: [
      /ap\s*calc(?:ulus)?\s*ab\b/i,
      // "AP Calc" with no suffix → default to AB (the more common intro course)
      /^ap\s*calc(?:ulus)?$/i,
    ],
  },
  // ── English ──
  {
    key: "ap_english_language",
    patterns: [
      /ap\s*(?:english\s*)?lang(?:uage)?(?:\s*(?:and|&)\s*comp(?:osition)?)?/i,
      /ap\s*lang\b/i,
    ],
  },
  {
    key: "ap_english_literature",
    patterns: [
      /ap\s*(?:english\s*)?lit(?:erature)?(?:\s*(?:and|&)\s*comp(?:osition)?)?/i,
      /ap\s*lit\b/i,
    ],
  },
  // ── History ──
  {
    key: "ap_us_history",
    patterns: [
      /\bapush\b/i,
      /ap\s*u\.?s\.?\s*hist(?:ory)?/i,
      /ap\s*united\s*states\s*hist(?:ory)?/i,
      /ap\s*american\s*hist(?:ory)?/i,
    ],
  },
  {
    key: "ap_world_history",
    patterns: [
      /ap\s*world(?:\s*hist(?:ory)?)?(?:\s*:\s*modern)?/i,
    ],
  },
  // ── Science ──
  {
    key: "ap_biology",
    patterns: [
      /ap\s*bio(?:logy)?/i,
    ],
  },
  {
    key: "ap_chemistry",
    patterns: [
      /ap\s*chem(?:istry)?/i,
    ],
  },
  {
    key: "ap_physics_1",
    patterns: [
      /ap\s*physics\s*1\b/i,
      /ap\s*physics\s*(?:one|i)\b/i,
      // Generic "AP Physics" with no suffix defaults to Physics 1
      /^ap\s*physics$/i,
    ],
  },
  // ── Math / Stats ──
  {
    key: "ap_statistics",
    patterns: [
      /ap\s*stat(?:istics)?/i,
      /ap\s*stats\b/i,
    ],
  },
  // ── CS ──
  {
    key: "ap_computer_science_a",
    patterns: [
      /ap\s*(?:comp(?:uter)?\s*)?(?:sci(?:ence)?\s*)?a\b/i,
      /ap\s*cs\s*a\b/i,
      /\bapcsa\b/i,
      /ap\s*comp(?:uter)?\s*sci(?:ence)?(?:\s*a)?/i,
    ],
  },
  // ── Languages ──
  {
    key: "ap_spanish_language",
    patterns: [
      /ap\s*spanish(?:\s*lang(?:uage)?(?:\s*(?:and|&)\s*culture)?)?/i,
    ],
  },
  {
    key: "ap_french_language",
    patterns: [
      /ap\s*french(?:\s*lang(?:uage)?(?:\s*(?:and|&)\s*culture)?)?/i,
    ],
  },
  {
    key: "ap_latin",
    patterns: [
      /ap\s*latin\b/i,
    ],
  },
  // ── History (additional) ──
  {
    key: "ap_european_history",
    patterns: [
      /ap\s*(?:european|euro)\s*hist(?:ory)?/i,
      /\bapeh\b/i,
    ],
  },
  // ── Social Sciences ──
  {
    key: "ap_human_geography",
    patterns: [
      /ap\s*human\s*geo(?:graphy)?/i,
      /\baphug\b/i,
    ],
  },
  {
    key: "ap_psychology",
    patterns: [
      /ap\s*psych(?:ology)?/i,
    ],
  },
  // ── Government — comparative before generic so "AP Comp Gov" is caught first ──
  {
    key: "ap_comparative_government",
    patterns: [
      /ap\s*comp(?:arative)\s*gov(?:ernment)?(?:\s*(?:and|&)\s*politics?)?/i,
      /ap\s*comp\s*gov\b/i,
    ],
  },
  {
    key: "ap_us_government",
    patterns: [
      /ap\s*(?:u\.?s\.?\s*)?gov(?:ernment)?(?:\s*(?:and|&)\s*politics?)?/i,
      /\bapgov\b/i,
    ],
  },
  // ── Economics ──
  {
    key: "ap_macroeconomics",
    patterns: [
      /ap\s*macro(?:economics?)?/i,
      /ap\s*macro\b/i,
    ],
  },
  {
    key: "ap_microeconomics",
    patterns: [
      /ap\s*micro(?:economics?)?/i,
      /ap\s*micro\b/i,
    ],
  },
  // ── Environmental Science ──
  {
    key: "ap_environmental_science",
    patterns: [
      /ap\s*env(?:ironmental)?\s*sci(?:ence)?/i,
      /\bapes\b/i,
    ],
  },
  // ── Physics (additional) — E&M before bare "Physics C" so it gets matched first ──
  {
    key: "ap_physics_2",
    patterns: [
      /ap\s*physics\s*2\b/i,
      /ap\s*physics\s*(?:two|ii)\b/i,
    ],
  },
  {
    key: "ap_physics_c_em",
    patterns: [
      /ap\s*physics\s*c[\s:,]+(?:e(?:lectricity)?(?:\s*(?:and|&)\s*)?m(?:agnetism)?|e\s*&\s*m\b|em\b)/i,
      /ap\s*physics\s*c[\s:,]+e\.?m\.?\b/i,
    ],
  },
  {
    key: "ap_physics_c_mechanics",
    patterns: [
      /ap\s*physics\s*c[\s:,]+mech(?:anics)?/i,
      // Bare "AP Physics C" with no qualifier defaults to Mechanics
      /ap\s*physics\s*c\b/i,
    ],
  },
  // ── CS Principles ──
  {
    key: "ap_computer_science_principles",
    patterns: [
      /ap\s*(?:comp(?:uter)?\s*)?sci(?:ence)?\s*principles?\b/i,
      /ap\s*csp\b/i,
      /\bapcsp\b/i,
    ],
  },
  // ── Arts ──
  {
    key: "ap_art_history",
    patterns: [
      /ap\s*art\s*hist(?:ory)?/i,
    ],
  },
  {
    key: "ap_music_theory",
    patterns: [
      /ap\s*music\s*theory/i,
    ],
  },
];

/**
 * Detect whether a class name matches a known AP course.
 * Returns isApCourse=true and the matching apCourseKey, or
 * isApCourse=false and apCourseKey=null if no match is found.
 */
export function detectApCourse(className: string): ApDetectionResult {
  const trimmed = className.trim();

  for (const { key, patterns } of AP_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return { isApCourse: true, apCourseKey: key };
      }
    }
  }

  // Generic "AP ..." fallback — recognizes it's an AP course but no specific template
  if (/^\s*ap\s+\w/i.test(trimmed)) {
    return { isApCourse: true, apCourseKey: null };
  }

  return { isApCourse: false, apCourseKey: null };
}
