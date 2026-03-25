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
