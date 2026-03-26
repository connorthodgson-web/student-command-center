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

  ap_french_language: {
    key: "ap_french_language",
    officialName: "AP French Language and Culture",
    description:
      "Advanced French course building proficiency across the three communication modes in authentic cultural contexts.",
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
      "Cultural comparison",
      "Formal email and argumentative essay writing",
    ],
    studyPatterns: [
      "Daily French audio/podcast listening",
      "Timed presentational writing practice",
      "Conversation simulation with prompts",
    ],
    examStructure:
      "3 hours; Section I: 30 MC reading + 35 MC listening; Section II: email reply, argumentative essay, conversation simulation, cultural comparison.",
  },

  ap_latin: {
    key: "ap_latin",
    officialName: "AP Latin",
    description:
      "Reads and analyzes selections from Vergil's Aeneid and Caesar's Gallic War in the original Latin.",
    units: [
      "Vergil's Aeneid (Books 1, 2, 4, 6, 8, 12 — selected passages)",
      "Caesar's Gallic War (Books 1, 6, 7 — selected passages)",
      "Latin Syntax and Grammar",
      "Literary Analysis and Translation",
      "Contextual Reading",
    ],
    keySkills: [
      "Translating Latin prose and poetry accurately",
      "Scansion of dactylic hexameter",
      "Identifying stylistic and literary devices",
      "Comparing texts and historical context",
      "Sight reading unseen Latin passages",
    ],
    studyPatterns: [
      "Daily translation practice from core texts",
      "Vocabulary and grammar review by unit",
      "Timed sight-translation exercises",
    ],
    examStructure:
      "3 hours; Section I: 50 MC (multiple-choice on Latin passages); Section II: 5 FRQs (translation, analysis, synthesis, comparison).",
  },

  ap_european_history: {
    key: "ap_european_history",
    officialName: "AP European History",
    description:
      "Covers European history from 1450 to the present emphasizing historical thinking, causation, and argumentation.",
    units: [
      "Renaissance and Exploration (c. 1450–1648)",
      "Age of Reformation",
      "Absolutism and Constitutionalism (c. 1648–1815)",
      "Scientific Revolution and Enlightenment",
      "French Revolution and Napoleon",
      "Industrialization and Its Effects (c. 1815–1914)",
      "19th-Century Political and Cultural Movements",
      "Global Conflict (c. 1914–Present)",
      "Cold War and Contemporary Europe",
    ],
    keySkills: [
      "DBQ essay writing with document sourcing",
      "LEQ argumentation and thesis development",
      "Causation and continuity/change analysis",
      "Short-answer contextualization",
      "Primary source analysis",
    ],
    studyPatterns: [
      "Period review with key terms and themes",
      "DBQ practice with HAPP sourcing",
      "LEQ outline and timed writing",
    ],
    examStructure:
      "3 hours 15 min; Section I: 55 MC + 3 SAQs; Section II: 1 DBQ + 1 LEQ.",
  },

  ap_human_geography: {
    key: "ap_human_geography",
    officialName: "AP Human Geography",
    description:
      "Introduces the methods and content of human geography, analyzing patterns of human activity across space and place.",
    units: [
      "Thinking Geographically",
      "Population and Migration Patterns and Processes",
      "Cultural Patterns and Processes",
      "Political Patterns and Processes",
      "Agriculture and Rural Land-Use Patterns",
      "Cities and Urban Land-Use Patterns",
      "Industrial and Economic Development Patterns",
    ],
    keySkills: [
      "Applying geographic models (von Thünen, Burgess, Christaller)",
      "Interpreting maps, data, and images",
      "Spatial analysis and scale",
      "Connecting concepts to real-world examples",
      "Free-response writing with evidence",
    ],
    studyPatterns: [
      "Concept and vocabulary review by unit",
      "Map and data interpretation practice",
      "FRQ practice with real-world application",
    ],
    examStructure:
      "2 hours 15 min; Section I: 60 MC; Section II: 3 FRQs.",
  },

  ap_psychology: {
    key: "ap_psychology",
    officialName: "AP Psychology",
    description:
      "Introduces the systematic study of human behavior and mental processes, covering major theories and research methods.",
    units: [
      "History and Approaches",
      "Research Methods and Statistics",
      "Biological Bases of Behavior",
      "Sensation and Perception",
      "States of Consciousness",
      "Learning",
      "Cognition (Memory, Thinking, Language)",
      "Developmental Psychology",
      "Motivation, Emotion, and Personality",
      "Testing and Individual Differences",
      "Abnormal Psychology",
      "Treatment of Psychological Disorders",
      "Social Psychology",
    ],
    keySkills: [
      "Applying psychological concepts to scenarios",
      "Understanding experimental design and research ethics",
      "Identifying major theorists and their contributions",
      "Free-response with concept definition and application",
      "Statistical interpretation (normal distribution, correlation)",
    ],
    studyPatterns: [
      "Vocabulary flashcards per unit",
      "Applying concepts to novel everyday scenarios",
      "Timed FRQ practice (define-apply format)",
    ],
    examStructure:
      "2 hours; Section I: 100 MC; Section II: 2 FRQs.",
  },

  ap_us_government: {
    key: "ap_us_government",
    officialName: "AP United States Government and Politics",
    description:
      "Examines the structure, functions, and processes of U.S. government and the role of citizens in the political system.",
    units: [
      "Foundations of American Democracy",
      "Interactions Among Branches of Government",
      "Civil Liberties and Civil Rights",
      "American Political Ideologies and Beliefs",
      "Political Participation",
    ],
    keySkills: [
      "Analyzing the Constitution and required foundational documents",
      "Evaluating Supreme Court cases (required cases list)",
      "Comparing political institutions and processes",
      "Argument essay writing with evidence",
      "Data and visual analysis (SCOTUS comparison FRQ)",
    ],
    studyPatterns: [
      "Required Supreme Court case review with holdings",
      "Required document analysis (Constitution, Federalist Papers, etc.)",
      "Argument FRQ timed writing",
    ],
    examStructure:
      "3 hours 15 min; Section I: 55 MC; Section II: 4 FRQs (concept application, quantitative analysis, SCOTUS comparison, argument essay).",
  },

  ap_comparative_government: {
    key: "ap_comparative_government",
    officialName: "AP Comparative Government and Politics",
    description:
      "Compares the political systems of six countries: China, Iran, Mexico, Nigeria, Russia, and the United Kingdom.",
    units: [
      "Political Systems, Regimes, and Governments",
      "United Kingdom",
      "Russia",
      "China",
      "Iran",
      "Mexico",
      "Nigeria",
    ],
    keySkills: [
      "Comparing political institutions across countries",
      "Analyzing regime types (democratic, authoritarian, hybrid)",
      "Country-specific political knowledge",
      "FRQ argument writing with cross-country evidence",
      "Quantitative data interpretation",
    ],
    studyPatterns: [
      "Country-by-country profile review",
      "Comparative tables (institutions, elections, civil society)",
      "FRQ practice with cross-country comparisons",
    ],
    examStructure:
      "3 hours; Section I: 55 MC; Section II: 4 FRQs (conceptual analysis, country context, comparative, argument).",
  },

  ap_macroeconomics: {
    key: "ap_macroeconomics",
    officialName: "AP Macroeconomics",
    description:
      "Studies economy-wide phenomena including national income, inflation, unemployment, monetary policy, and international trade.",
    units: [
      "Basic Economic Concepts",
      "Economic Indicators and the Business Cycle",
      "National Income and Price Determination (AD-AS)",
      "Financial Sector (Money, Banking, Federal Reserve)",
      "Long-Run Consequences of Stabilization Policies",
      "Open Economy — International Trade and Finance",
    ],
    keySkills: [
      "Drawing and shifting AD-AS, money market, and loanable funds graphs",
      "Applying fiscal and monetary policy to scenarios",
      "Interpreting economic indicators (CPI, GDP, unemployment)",
      "Analyzing exchange rates and balance of payments",
      "FRQ graph drawing and labeling",
    ],
    studyPatterns: [
      "Graph practice (draw, label, shift, explain)",
      "Policy scenario walkthroughs",
      "FRQ timed writing with graph support",
    ],
    examStructure:
      "2 hours 10 min; Section I: 60 MC; Section II: 3 FRQs (1 long + 2 short).",
  },

  ap_microeconomics: {
    key: "ap_microeconomics",
    officialName: "AP Microeconomics",
    description:
      "Studies individual decision-making by consumers and firms, market structures, and resource allocation.",
    units: [
      "Basic Economic Concepts (scarcity, opportunity cost, PPC)",
      "Supply and Demand",
      "Production, Cost, and the Perfect Competition Model",
      "Imperfect Competition (Monopoly, Oligopoly, Monopolistic Competition)",
      "Factor Markets",
      "Market Failure and the Role of Government",
    ],
    keySkills: [
      "Supply and demand graph analysis",
      "Cost curve interpretation (MC, ATC, AVC)",
      "Profit maximization (MR = MC rule)",
      "Deadweight loss and efficiency analysis",
      "FRQ graph drawing and policy explanation",
    ],
    studyPatterns: [
      "Graph drawing from scratch (supply/demand, cost curves)",
      "Market structure comparison tables",
      "FRQ practice with labeled graphs",
    ],
    examStructure:
      "2 hours 10 min; Section I: 60 MC; Section II: 3 FRQs (1 long + 2 short).",
  },

  ap_environmental_science: {
    key: "ap_environmental_science",
    officialName: "AP Environmental Science",
    description:
      "Interdisciplinary science exploring Earth's natural systems, human impacts on the environment, and solutions to environmental problems.",
    units: [
      "The Living World: Ecosystems",
      "The Living World: Biodiversity",
      "Populations",
      "Earth Systems and Resources",
      "Land and Water Use",
      "Energy Resources and Consumption",
      "Atmospheric Pollution",
      "Aquatic and Terrestrial Pollution",
      "Global Change",
    ],
    keySkills: [
      "Identifying environmental problems and their causes",
      "Evaluating proposed solutions with trade-offs",
      "Interpreting environmental data and graphs",
      "Applying scientific and mathematical reasoning",
      "Free-response writing with evidence-based claims",
    ],
    studyPatterns: [
      "Unit concept maps linking causes and effects",
      "Current events connections to course content",
      "FRQ practice with data interpretation",
    ],
    examStructure:
      "2 hours 40 min; Section I: 80 MC; Section II: 3 FRQs.",
  },

  ap_physics_2: {
    key: "ap_physics_2",
    officialName: "AP Physics 2: Algebra-Based",
    description:
      "Second-year algebra-based physics covering fluids, thermodynamics, electricity, magnetism, optics, and modern physics.",
    units: [
      "Fluids",
      "Thermodynamics",
      "Electric Force, Field, and Potential",
      "Electric Circuits",
      "Magnetism and Electromagnetic Induction",
      "Geometric and Physical Optics",
      "Quantum, Atomic, and Nuclear Physics",
    ],
    keySkills: [
      "Algebraic problem solving in new contexts",
      "Explaining phenomena with written justification",
      "Experimental design and data interpretation",
      "Connecting concepts across units",
      "Graphical analysis",
    ],
    studyPatterns: [
      "Concept-first problem-solving approach",
      "Written explanation practice for FRQs",
      "Lab-based data analysis exercises",
    ],
    examStructure:
      "3 hours; Section I: 50 MC (some multi-select); Section II: 4 FRQs including experimental design.",
  },

  ap_physics_c_mechanics: {
    key: "ap_physics_c_mechanics",
    officialName: "AP Physics C: Mechanics",
    description:
      "Calculus-based mechanics covering kinematics, Newton's laws, energy, momentum, rotation, oscillation, and gravitation.",
    units: [
      "Kinematics",
      "Newton's Laws of Motion",
      "Work, Energy, and Power",
      "Systems of Particles and Linear Momentum",
      "Rotation",
      "Oscillations",
      "Gravitation",
    ],
    keySkills: [
      "Applying calculus to motion (derivatives and integrals)",
      "Free-body diagram analysis",
      "Setting up and solving differential equations",
      "Rotational dynamics and angular momentum",
      "Energy methods in problem solving",
    ],
    studyPatterns: [
      "Derivation practice alongside problem sets",
      "FRQ writing with full mathematical justification",
      "Calculator-based check on algebraic results",
    ],
    examStructure:
      "1 hour 30 min; Section I: 35 MC; Section II: 3 FRQs (calculus required).",
  },

  ap_physics_c_em: {
    key: "ap_physics_c_em",
    officialName: "AP Physics C: Electricity and Magnetism",
    description:
      "Calculus-based electromagnetism covering electric fields, Gauss's Law, circuits, magnetic fields, and Maxwell's equations.",
    units: [
      "Electrostatics (Coulomb's Law, Electric Field, Gauss's Law)",
      "Conductors, Capacitors, Dielectrics",
      "Electric Circuits (Kirchhoff's Laws, RC circuits)",
      "Magnetic Fields (Biot-Savart, Ampere's Law)",
      "Electromagnetism (Faraday's Law, Inductance)",
    ],
    keySkills: [
      "Applying Gauss's Law and Ampere's Law with integration",
      "Solving RC and RL circuit differential equations",
      "Using Faraday's Law for induced EMF",
      "Vector field analysis",
      "FRQ justification with calculus",
    ],
    studyPatterns: [
      "Law-by-law mastery with derivations",
      "Circuit diagram analysis and problem sets",
      "FRQ practice with full calculus derivation",
    ],
    examStructure:
      "1 hour 30 min; Section I: 35 MC; Section II: 3 FRQs (calculus required).",
  },

  ap_computer_science_principles: {
    key: "ap_computer_science_principles",
    officialName: "AP Computer Science Principles",
    description:
      "Broad introduction to computer science concepts: algorithms, data, the internet, cybersecurity, and societal impacts — no specific language required.",
    units: [
      "Creative Development",
      "Data",
      "Algorithms and Programming",
      "Computer Systems and Networks",
      "Impact of Computing",
    ],
    keySkills: [
      "Designing and evaluating algorithms",
      "Analyzing data representation and compression",
      "Understanding how the internet works",
      "Identifying benefits and harms of computing innovations",
      "Written response explaining computational artifacts",
    ],
    studyPatterns: [
      "Create task: design and document a program",
      "Practice written response explanations",
      "Review key vocabulary (abstraction, iteration, binary, etc.)",
    ],
    examStructure:
      "2 hours; Section I: 70 MC; also includes a Create Performance Task (submitted before exam, 30% of score).",
  },

  ap_art_history: {
    key: "ap_art_history",
    officialName: "AP Art History",
    description:
      "Surveys global art and architecture from prehistoric times to the present, emphasizing formal analysis and cultural context.",
    units: [
      "Global Prehistory",
      "Ancient Mediterranean",
      "Early Europe and Colonial Americas",
      "Later Europe and Americas",
      "Indigenous Americas",
      "Africa",
      "West and Central Asia",
      "South, East, and Southeast Asia",
      "Pacific",
      "Global Contemporary",
    ],
    keySkills: [
      "Formal visual analysis (line, color, space, composition)",
      "Contextualizing art historically and culturally",
      "Comparing works across cultures and periods",
      "Writing evidence-based analytical essays",
      "Identifying required 250 works",
    ],
    studyPatterns: [
      "Flashcard review of required works (artist, date, medium, significance)",
      "Timed visual analysis writing",
      "Cross-cultural comparison practice",
    ],
    examStructure:
      "3 hours; Section I: 80 MC; Section II: 6 FRQs (visual analysis, contextual analysis, comparison, and longer essays).",
  },

  ap_music_theory: {
    key: "ap_music_theory",
    officialName: "AP Music Theory",
    description:
      "Develops musicianship through the study of notation, harmony, voice leading, form, and ear training.",
    units: [
      "Music Fundamentals (notation, scales, intervals, rhythm)",
      "Harmony and Voice Leading",
      "Diatonic Chords and Progressions",
      "Chromatic Harmony (secondary dominants, modulation)",
      "Musical Form and Analysis",
      "Counterpoint",
      "Sight-Singing and Dictation",
    ],
    keySkills: [
      "Writing four-part SATB voice leading",
      "Harmonic analysis with Roman numerals",
      "Sight-singing melodies at sight",
      "Melodic and harmonic dictation",
      "Score analysis for form and style",
    ],
    studyPatterns: [
      "Daily sight-singing and ear training practice",
      "Four-part writing exercises with error checking",
      "Timed harmonic analysis of short excerpts",
    ],
    examStructure:
      "3 hours; Section I: 75 MC (listening and theory); Section II: 7 FRQs (part-writing, figured bass, melody harmonization, analysis, sight-singing, dictation).",
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
