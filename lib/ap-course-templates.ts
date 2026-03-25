/**
 * Built-in AP course knowledge packs.
 * Each entry is compact structured data to help the assistant understand
 * what a class covers without overwhelming the prompt.
 */

export interface ApCourseTemplate {
  /** Unique key, snake_case. Must match keys in AP_COURSE_TEMPLATES. */
  key: string;
  /** Official College Board course name */
  officialName: string;
  /** 1–2 sentence description */
  description: string;
  /** Major units / topic areas */
  units: string[];
  /** Core skills emphasized throughout the course */
  keySkills: string[];
  /** Common assignment and study patterns */
  studyPatterns: string[];
  /** Exam format summary (1–2 sentences) */
  examStructure: string;
}

export const AP_COURSE_TEMPLATES: Record<string, ApCourseTemplate> = {
  ap_calculus_ab: {
    key: "ap_calculus_ab",
    officialName: "AP Calculus AB",
    description:
      "Covers limits, derivatives, and integrals — equivalent to a first-semester college calculus course.",
    units: [
      "Limits and Continuity",
      "Differentiation: Definition and Fundamental Properties",
      "Differentiation: Composite, Implicit, and Inverse Functions",
      "Contextual Applications of Differentiation",
      "Analytical Applications of Differentiation",
      "Integration and Accumulation of Change",
      "Differential Equations",
      "Applications of Integration",
    ],
    keySkills: [
      "Setting up and evaluating limits",
      "Applying derivative rules (chain, product, quotient)",
      "Solving related rates and optimization problems",
      "Computing definite and indefinite integrals",
      "Interpreting graphs analytically",
    ],
    studyPatterns: [
      "Daily problem sets on current unit topic",
      "Timed free-response practice (FRQs) near exam",
      "Calculator vs. no-calculator section practice",
    ],
    examStructure:
      "3 hours 15 min; Section I: 45 MC (no calc) + 15 MC (calc); Section II: 2 FRQ (calc) + 4 FRQ (no calc).",
  },

  ap_calculus_bc: {
    key: "ap_calculus_bc",
    officialName: "AP Calculus BC",
    description:
      "Extends AB content with series, polar/parametric functions, and more integration techniques — equivalent to first- and second-semester college calculus.",
    units: [
      "Limits and Continuity",
      "Differentiation",
      "Contextual Applications of Differentiation",
      "Analytical Applications of Differentiation",
      "Integration and Accumulation of Change",
      "Differential Equations",
      "Applications of Integration",
      "Series (Taylor, Maclaurin, convergence tests)",
      "Parametric Equations, Polar Coordinates, and Vector-Valued Functions",
    ],
    keySkills: [
      "All AB skills plus series convergence/divergence",
      "Taylor and Maclaurin series expansion",
      "Parametric and polar integration",
      "L'Hôpital's Rule and improper integrals",
    ],
    studyPatterns: [
      "Separate AB and BC content review tracks",
      "FRQ timed practice with self-scoring",
      "Series convergence drill sheets",
    ],
    examStructure:
      "Same format as AB; includes BC-only topics. Students can earn an AB sub-score alongside the BC score.",
  },

  ap_english_language: {
    key: "ap_english_language",
    officialName: "AP English Language and Composition",
    description:
      "Focuses on rhetoric, argumentation, and analytical writing using nonfiction texts.",
    units: [
      "Rhetorical Situation",
      "Claims and Evidence",
      "Reasoning and Organization",
      "Style and Tone",
      "Argument Analysis",
      "Synthesis Writing",
    ],
    keySkills: [
      "Analyzing rhetorical appeals (ethos, pathos, logos)",
      "Writing evidence-based arguments",
      "Synthesis of multiple sources into a coherent essay",
      "Close reading of nonfiction prose",
      "Identifying and explaining rhetorical strategies",
    ],
    studyPatterns: [
      "Weekly timed essays (synthesis, rhetorical analysis, argument)",
      "Daily reading of nonfiction/opinion pieces",
      "Feedback cycles on in-class writing drafts",
    ],
    examStructure:
      "3 hours 15 min; Section I: 45 MC questions on reading passages; Section II: 3 FRQs (synthesis, rhetorical analysis, argument).",
  },

  ap_english_literature: {
    key: "ap_english_literature",
    officialName: "AP English Literature and Composition",
    description:
      "Focuses on close reading and analysis of fiction, poetry, and drama across literary periods.",
    units: [
      "Short Fiction",
      "Poetry",
      "Longer Fiction and Drama",
      "Character and Perspective",
      "Setting and Context",
      "Structure, Form, and Narrative",
      "Literary Argumentation",
    ],
    keySkills: [
      "Close textual analysis",
      "Identifying literary devices and their effects",
      "Writing thesis-driven literary essays",
      "Comparing texts across genres and periods",
      "Poetry explication",
    ],
    studyPatterns: [
      "Annotation of primary texts during reading",
      "Timed essay writing on unseen passages",
      "Novel/play study guides and discussion",
    ],
    examStructure:
      "3 hours; Section I: 55 MC on prose/poetry passages; Section II: 3 FRQs (poetry analysis, prose analysis, literary argument).",
  },

  ap_us_history: {
    key: "ap_us_history",
    officialName: "AP United States History",
    description:
      "Covers U.S. history from 1491 to the present with emphasis on historical thinking and argumentation.",
    units: [
      "Period 1: 1491–1607 (Pre-Columbian and Contact)",
      "Period 2: 1607–1754 (Colonial America)",
      "Period 3: 1754–1800 (Revolution and Founding)",
      "Period 4: 1800–1848 (Early Republic)",
      "Period 5: 1844–1877 (Civil War Era)",
      "Period 6: 1865–1898 (Industrialization)",
      "Period 7: 1890–1945 (Progressive Era through WWII)",
      "Period 8: 1945–1980 (Cold War and Social Change)",
      "Period 9: 1980–Present (Contemporary America)",
    ],
    keySkills: [
      "Causation and continuity/change over time (CCOT)",
      "Document-based question (DBQ) essay writing",
      "Long essay question (LEQ) argumentation",
      "Source analysis using HAPP (Historical Situation, Audience, Purpose, Point of View)",
      "Contextualization and corroboration",
    ],
    studyPatterns: [
      "Period review with concept outlines",
      "DBQ practice with document sourcing",
      "LEQ timed writing with thesis focus",
    ],
    examStructure:
      "3 hours 15 min; Section I: 55 MC + 3 SAQs; Section II: 1 DBQ + 1 LEQ.",
  },

  ap_world_history: {
    key: "ap_world_history",
    officialName: "AP World History: Modern",
    description:
      "Covers global history from 1200 CE to the present with focus on cross-cultural interactions and historical thinking.",
    units: [
      "Unit 1: The Global Tapestry (1200–1450)",
      "Unit 2: Networks of Exchange (1200–1450)",
      "Unit 3: Land-Based Empires (1450–1750)",
      "Unit 4: Transoceanic Interconnections (1450–1750)",
      "Unit 5: Revolutions (1750–1900)",
      "Unit 6: Consequences of Industrialization (1750–1900)",
      "Unit 7: Global Conflict (1900–Present)",
      "Unit 8: Cold War and Decolonization (1900–Present)",
      "Unit 9: Globalization (1900–Present)",
    ],
    keySkills: [
      "Cross-cultural comparison",
      "DBQ and LEQ essay writing",
      "Causation and continuity/change analysis",
      "Contextualization and sourcing primary documents",
    ],
    studyPatterns: [
      "Unit concept outlines and key terms",
      "DBQ practice with HAPP sourcing",
      "Comparative essay planning",
    ],
    examStructure:
      "3 hours 15 min; Section I: 55 MC + 3 SAQs; Section II: 1 DBQ + 1 LEQ.",
  },

  ap_biology: {
    key: "ap_biology",
    officialName: "AP Biology",
    description:
      "College-level introductory biology covering evolution, cellular processes, genetics, and ecology.",
    units: [
      "Chemistry of Life",
      "Cell Structure and Function",
      "Cellular Energetics (Photosynthesis and Cellular Respiration)",
      "Cell Communication and Cell Cycle",
      "Heredity",
      "Gene Expression and Regulation",
      "Natural Selection and Evolution",
      "Ecology",
    ],
    keySkills: [
      "Designing and analyzing experiments",
      "Interpreting data and graphs",
      "Applying biological concepts to novel scenarios",
      "Mathematical analysis (Hardy-Weinberg, Chi-square)",
      "Connecting structure to function",
    ],
    studyPatterns: [
      "Concept maps per unit",
      "Lab reports and data analysis practice",
      "Grid-in and free-response question practice",
    ],
    examStructure:
      "3 hours; Section I: 60 MC; Section II: 6 FRQs (2 long, 4 short).",
  },

  ap_chemistry: {
    key: "ap_chemistry",
    officialName: "AP Chemistry",
    description:
      "College-level general chemistry covering atomic structure, bonding, kinetics, equilibrium, and electrochemistry.",
    units: [
      "Atomic Structure and Properties",
      "Molecular and Ionic Compound Structure and Properties",
      "Intermolecular Forces and Properties",
      "Chemical Reactions",
      "Kinetics",
      "Thermodynamics",
      "Equilibrium",
      "Acids and Bases",
      "Electrochemistry",
    ],
    keySkills: [
      "Stoichiometry and unit analysis",
      "Interpreting particulate diagrams",
      "Writing and balancing equations",
      "ICE table equilibrium calculations",
      "Lab technique and data analysis",
    ],
    studyPatterns: [
      "Practice problems after each unit",
      "Lab write-ups and error analysis",
      "Timed FRQ practice with formula sheet",
    ],
    examStructure:
      "3 hours 15 min; Section I: 60 MC; Section II: 7 FRQs (3 long, 4 short); formula/periodic table sheet provided.",
  },

  ap_physics_1: {
    key: "ap_physics_1",
    officialName: "AP Physics 1: Algebra-Based",
    description:
      "Algebra-based introductory physics covering mechanics, waves, and circuits without calculus.",
    units: [
      "Kinematics",
      "Dynamics (Newton's Laws)",
      "Circular Motion and Gravitation",
      "Energy",
      "Momentum",
      "Simple Harmonic Motion",
      "Torque and Rotational Motion",
      "Electric Charge and Electric Force",
      "DC Circuits",
      "Mechanical Waves and Sound",
    ],
    keySkills: [
      "Free-body diagrams",
      "Algebraic problem solving",
      "Explaining reasoning in written responses",
      "Experimental design and data interpretation",
      "Graphical analysis",
    ],
    studyPatterns: [
      "Daily problem sets by topic",
      "Lab report writing",
      "Practice explaining solutions in words (FRQ writing)",
    ],
    examStructure:
      "3 hours; Section I: 50 MC (some multi-select); Section II: 5 FRQs including experimental design.",
  },

  ap_statistics: {
    key: "ap_statistics",
    officialName: "AP Statistics",
    description:
      "Introduces statistical reasoning: data collection, probability, inference, and interpretation.",
    units: [
      "Exploring One-Variable Data",
      "Exploring Two-Variable Data",
      "Collecting Data (Sampling and Experiments)",
      "Probability, Random Variables, and Probability Distributions",
      "Sampling Distributions",
      "Inference for Categorical Data: Proportions",
      "Inference for Quantitative Data: Means",
      "Inference for Categorical Data: Chi-Square",
      "Inference for Quantitative Data: Slopes",
    ],
    keySkills: [
      "Identifying and describing distributions",
      "Designing experiments and studies",
      "Calculating and interpreting confidence intervals",
      "Conducting hypothesis tests",
      "Communicating statistical conclusions in context",
    ],
    studyPatterns: [
      "Practice interpreting output from calculator or software",
      "FRQ writing with context-specific conclusions",
      "Investigative task (long FRQ) practice",
    ],
    examStructure:
      "3 hours; Section I: 40 MC; Section II: 5 short FRQs + 1 investigative task.",
  },

  ap_computer_science_a: {
    key: "ap_computer_science_a",
    officialName: "AP Computer Science A",
    description:
      "Java-based introductory computer science covering object-oriented programming, data structures, and algorithms.",
    units: [
      "Primitive Types",
      "Using Objects",
      "Boolean Expressions and if Statements",
      "Iteration",
      "Writing Classes",
      "Array",
      "ArrayList",
      "2D Array",
      "Inheritance",
      "Recursion",
    ],
    keySkills: [
      "Writing and tracing Java code",
      "Designing classes with encapsulation",
      "Using loops and conditionals",
      "Array and ArrayList manipulation",
      "Understanding inheritance hierarchies",
    ],
    studyPatterns: [
      "Daily coding exercises in Java",
      "Free-response code-writing practice",
      "Tracing code output on paper for exam prep",
    ],
    examStructure:
      "3 hours; Section I: 40 MC; Section II: 4 FRQs (write/modify Java code, no IDE).",
  },

  ap_spanish_language: {
    key: "ap_spanish_language",
    officialName: "AP Spanish Language and Culture",
    description:
      "Advanced Spanish course developing proficiency across reading, writing, listening, and speaking in cultural contexts.",
    units: [
      "Families and Communities",
      "Science and Technology",
      "Beauty and Aesthetics",
      "Personal and Public Identities",
      "Contemporary Life",
      "Global Challenges",
    ],
    keySkills: [
      "Interpersonal and presentational speaking",
      "Interpersonal and presentational writing",
      "Audio and text source analysis",
      "Cultural comparison and synthesis",
      "Formal email and essay writing",
    ],
    studyPatterns: [
      "Daily audio listening for comprehension",
      "Timed formal writing (presentational)",
      "Speaking practice with simulated conversation",
    ],
    examStructure:
      "3 hours; Section I: 30 MC reading + 35 MC listening; Section II: email reply, argumentative essay, conversation simulation, cultural comparison.",
  },
};

/** Returns the AP course template for a given key, or null if not found. */
export function getApTemplate(key: string | null | undefined): ApCourseTemplate | null {
  if (!key) return null;
  return AP_COURSE_TEMPLATES[key] ?? null;
}

/**
 * Formats AP template data as a compact string for the assistant system prompt.
 * Keeps it short to avoid prompt bloat.
 */
export function formatApTemplateForPrompt(template: ApCourseTemplate): string {
  const topUnits = template.units.slice(0, 5).join(", ");
  const skills = template.keySkills.slice(0, 3).join("; ");
  return [
    `Course type: ${template.officialName}`,
    `Topics: ${topUnits}${template.units.length > 5 ? ", ..." : ""}`,
    `Key skills: ${skills}`,
    `Exam: ${template.examStructure}`,
  ].join("\n");
}
