/**
 * Origin Notes — the standard folder skeleton (V1/NOTES_PLAN.md Appendix A).
 *
 * Chapter names and numbers follow the current (rationalised) NCERT books,
 * because that is what students follow chapter by chapter. Topics JEE Main /
 * NEET UG still test but NCERT removed get their own folder with no NCERT
 * number ("Exam only"). Checked against the NEET UG 2026 syllabus (NMC, Dec
 * 2025) and the JEE Main syllabus; re-check both before seeding prod.
 *
 * `bankChapters` are the EXACT chapter strings `ogcode_questions.chapter` uses
 * (the bank has no chapter table), taken from the repo snapshot
 * data/ogcode/ogcode_questions.json on 18/10/2026. Several differ from the
 * NCERT title ("Cell-The Unit of Life", "Vectors", "d and f Block Elements"),
 * and one chapter is stored under two spellings, so both are listed. Class 10
 * questions exist only in the prod bank, so those links are set by an admin
 * from the Library tab's chapter picker.
 *
 * Keys are stable ids for the importer: `c11`, `c11.physics`,
 * `c11.physics.motion-in-a-plane`. Never rename a key once notes use it.
 */

import { slugify } from "./rules";
import type { NotesExam, NotesSubject } from "./types";

export type NotesSyllabusChapter = {
  key: string;
  name: string;
  /** NCERT chapter number; null for exam-only folders. */
  ncertNumber: number | null;
  exams: NotesExam[];
  bankChapters: string[];
};

export type NotesSyllabusSubject = {
  key: string;
  subject: NotesSubject;
  name: string;
  chapters: NotesSyllabusChapter[];
};

export type NotesSyllabusClass = {
  key: string;
  classLevel: number;
  name: string;
  subjects: NotesSyllabusSubject[];
};

type ChapterSpec = {
  name: string;
  ncert: number | null;
  /** Bank chapter text when it differs from `name`; [] = no bank questions. */
  bank?: string[];
  exams?: NotesExam[];
};

const JN: NotesExam[] = ["jee", "neet"];
const J: NotesExam[] = ["jee"];
const N: NotesExam[] = ["neet"];
const B: NotesExam[] = ["boards"];

const SUBJECT_NAMES: Record<NotesSubject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Maths",
  biology: "Biology",
};

function subject(
  classLevel: number,
  subjectId: NotesSubject,
  defaultExams: NotesExam[],
  specs: ChapterSpec[],
  /** Class 10 has no bank links in the repo snapshot. */
  linkBank = true,
): NotesSyllabusSubject {
  const subjectKey = `c${classLevel}.${subjectId}`;
  return {
    key: subjectKey,
    subject: subjectId,
    name: SUBJECT_NAMES[subjectId],
    chapters: specs.map((spec) => ({
      key: `${subjectKey}.${slugify(spec.name)}`,
      name: spec.name,
      ncertNumber: spec.ncert,
      exams: spec.exams ?? defaultExams,
      bankChapters: spec.bank ?? (linkBank && spec.ncert !== null ? [spec.name] : []),
    })),
  };
}

export const NOTES_SYLLABUS: readonly NotesSyllabusClass[] = [
  {
    key: "c10",
    classLevel: 10,
    name: "Class 10",
    subjects: [
      // NCERT Science is one book; its chapter numbers are kept so students can
      // find the chapter in the textbook.
      subject(10, "physics", B, [
        { name: "Light: Reflection and Refraction", ncert: 9 },
        { name: "The Human Eye and the Colourful World", ncert: 10 },
        { name: "Electricity", ncert: 11 },
        { name: "Magnetic Effects of Electric Current", ncert: 12 },
      ], false),
      subject(10, "chemistry", B, [
        { name: "Chemical Reactions and Equations", ncert: 1 },
        { name: "Acids, Bases and Salts", ncert: 2 },
        { name: "Metals and Non-metals", ncert: 3 },
        { name: "Carbon and its Compounds", ncert: 4 },
      ], false),
      subject(10, "mathematics", B, [
        { name: "Real Numbers", ncert: 1 },
        { name: "Polynomials", ncert: 2 },
        { name: "Pair of Linear Equations in Two Variables", ncert: 3 },
        { name: "Quadratic Equations", ncert: 4 },
        { name: "Arithmetic Progressions", ncert: 5 },
        { name: "Triangles", ncert: 6 },
        { name: "Coordinate Geometry", ncert: 7 },
        { name: "Introduction to Trigonometry", ncert: 8 },
        { name: "Some Applications of Trigonometry", ncert: 9 },
        { name: "Circles", ncert: 10 },
        { name: "Areas Related to Circles", ncert: 11 },
        { name: "Surface Areas and Volumes", ncert: 12 },
        { name: "Statistics", ncert: 13 },
        { name: "Probability", ncert: 14 },
      ], false),
      subject(10, "biology", B, [
        { name: "Life Processes", ncert: 5 },
        { name: "Control and Coordination", ncert: 6 },
        { name: "How do Organisms Reproduce?", ncert: 7 },
        { name: "Heredity", ncert: 8 },
        { name: "Our Environment", ncert: 13 },
      ], false),
    ],
  },
  {
    key: "c11",
    classLevel: 11,
    name: "Class 11",
    subjects: [
      subject(11, "physics", JN, [
        { name: "Units and Measurement", ncert: 1, bank: ["Units and Measurements"] },
        { name: "Motion in a Straight Line", ncert: 2 },
        { name: "Motion in a Plane", ncert: 3 },
        { name: "Laws of Motion", ncert: 4 },
        { name: "Work, Energy and Power", ncert: 5 },
        { name: "System of Particles and Rotational Motion", ncert: 6 },
        { name: "Gravitation", ncert: 7 },
        { name: "Mechanical Properties of Solids", ncert: 8 },
        { name: "Mechanical Properties of Fluids", ncert: 9 },
        { name: "Thermal Properties of Matter", ncert: 10 },
        { name: "Thermodynamics", ncert: 11 },
        { name: "Kinetic Theory", ncert: 12 },
        { name: "Oscillations", ncert: 13 },
        { name: "Waves", ncert: 14 },
      ]),
      subject(11, "chemistry", JN, [
        { name: "Some Basic Concepts of Chemistry", ncert: 1 },
        { name: "Structure of Atom", ncert: 2 },
        { name: "Classification of Elements and Periodicity in Properties", ncert: 3 },
        { name: "Chemical Bonding and Molecular Structure", ncert: 4 },
        { name: "Thermodynamics", ncert: 5 },
        { name: "Equilibrium", ncert: 6 },
        { name: "Redox Reactions", ncert: 7 },
        {
          name: "Organic Chemistry: Some Basic Principles and Techniques",
          ncert: 8,
          // The bank stores this chapter twice: with a real en dash, and with
          // the literal six characters "–" from a bad import.
          bank: [
            "Organic Chemistry – Some Basic Principles and Techniques",
            "Organic Chemistry \\u2013 Some Basic Principles and Techniques",
          ],
        },
        { name: "Hydrocarbons", ncert: 9 },
        { name: "p-Block Elements: Groups 13–14", ncert: null, bank: [] },
      ]),
      subject(11, "mathematics", J, [
        { name: "Sets", ncert: 1 },
        { name: "Relations and Functions", ncert: 2, bank: ["Relations & Functions"] },
        { name: "Trigonometric Functions", ncert: 3 },
        { name: "Complex Numbers and Quadratic Equations", ncert: 4 },
        { name: "Linear Inequalities", ncert: 5, exams: B },
        { name: "Permutations and Combinations", ncert: 6 },
        { name: "Binomial Theorem", ncert: 7 },
        { name: "Sequences and Series", ncert: 8, bank: ["Sequence and Series"] },
        { name: "Straight Lines", ncert: 9 },
        { name: "Conic Sections", ncert: 10 },
        { name: "Introduction to Three Dimensional Geometry", ncert: 11, bank: ["Introduction to Three-dimensional Geometry"] },
        { name: "Limits and Derivatives", ncert: 12 },
        { name: "Statistics", ncert: 13 },
        { name: "Probability", ncert: 14 },
      ]),
      subject(11, "biology", N, [
        { name: "The Living World", ncert: 1 },
        { name: "Biological Classification", ncert: 2 },
        { name: "Plant Kingdom", ncert: 3 },
        { name: "Animal Kingdom", ncert: 4 },
        { name: "Morphology of Flowering Plants", ncert: 5 },
        { name: "Anatomy of Flowering Plants", ncert: 6 },
        { name: "Structural Organisation in Animals", ncert: 7 },
        { name: "Cell: The Unit of Life", ncert: 8, bank: ["Cell-The Unit of Life"] },
        { name: "Biomolecules", ncert: 9 },
        { name: "Cell Cycle and Cell Division", ncert: 10 },
        { name: "Photosynthesis in Higher Plants", ncert: 11 },
        { name: "Respiration in Plants", ncert: 12 },
        { name: "Plant Growth and Development", ncert: 13, bank: ["Plant - Growth and Development"] },
        { name: "Breathing and Exchange of Gases", ncert: 14 },
        { name: "Body Fluids and Circulation", ncert: 15 },
        { name: "Excretory Products and their Elimination", ncert: 16 },
        { name: "Locomotion and Movement", ncert: 17 },
        { name: "Neural Control and Coordination", ncert: 18 },
        { name: "Chemical Coordination and Integration", ncert: 19 },
      ]),
    ],
  },
  {
    key: "c12",
    classLevel: 12,
    name: "Class 12",
    subjects: [
      subject(12, "physics", JN, [
        { name: "Electric Charges and Fields", ncert: 1 },
        { name: "Electrostatic Potential and Capacitance", ncert: 2 },
        { name: "Current Electricity", ncert: 3 },
        { name: "Moving Charges and Magnetism", ncert: 4 },
        { name: "Magnetism and Matter", ncert: 5 },
        { name: "Electromagnetic Induction", ncert: 6 },
        { name: "Alternating Current", ncert: 7 },
        { name: "Electromagnetic Waves", ncert: 8 },
        { name: "Ray Optics and Optical Instruments", ncert: 9 },
        { name: "Wave Optics", ncert: 10 },
        { name: "Dual Nature of Radiation and Matter", ncert: 11 },
        { name: "Atoms", ncert: 12 },
        { name: "Nuclei", ncert: 13 },
        { name: "Semiconductor Electronics", ncert: 14, bank: ["Semiconductor Electronics: Materials, Devices and Simple Circuits"] },
        { name: "Experimental Skills", ncert: null, bank: [] },
      ]),
      subject(12, "chemistry", JN, [
        { name: "Solutions", ncert: 1 },
        { name: "Electrochemistry", ncert: 2 },
        { name: "Chemical Kinetics", ncert: 3 },
        { name: "The d- and f-Block Elements", ncert: 4, bank: ["d and f Block Elements"] },
        { name: "Coordination Compounds", ncert: 5 },
        { name: "Haloalkanes and Haloarenes", ncert: 6 },
        { name: "Alcohols, Phenols and Ethers", ncert: 7 },
        { name: "Aldehydes, Ketones and Carboxylic Acids", ncert: 8 },
        { name: "Amines", ncert: 9 },
        { name: "Biomolecules", ncert: 10 },
        { name: "p-Block Elements: Groups 15–18", ncert: null, bank: [] },
        { name: "Principles Related to Practical Chemistry", ncert: null, bank: [] },
      ]),
      subject(12, "mathematics", J, [
        { name: "Relations and Functions", ncert: 1 },
        { name: "Inverse Trigonometric Functions", ncert: 2 },
        { name: "Matrices", ncert: 3 },
        { name: "Determinants", ncert: 4 },
        { name: "Continuity and Differentiability", ncert: 5 },
        { name: "Application of Derivatives", ncert: 6, bank: ["Applications of Derivatives"] },
        { name: "Integrals", ncert: 7 },
        { name: "Application of Integrals", ncert: 8, bank: ["Application of the Integrals"] },
        { name: "Differential Equations", ncert: 9 },
        { name: "Vector Algebra", ncert: 10, bank: ["Vectors"] },
        { name: "Three Dimensional Geometry", ncert: 11, bank: ["Three-dimensional Geometry"] },
        { name: "Linear Programming", ncert: 12, exams: B, bank: [] },
        { name: "Probability", ncert: 13 },
      ]),
      subject(12, "biology", N, [
        { name: "Sexual Reproduction in Flowering Plants", ncert: 1 },
        { name: "Human Reproduction", ncert: 2 },
        { name: "Reproductive Health", ncert: 3 },
        { name: "Principles of Inheritance and Variation", ncert: 4 },
        { name: "Molecular Basis of Inheritance", ncert: 5 },
        { name: "Evolution", ncert: 6 },
        { name: "Human Health and Disease", ncert: 7, bank: ["Human Health and Diseases"] },
        { name: "Microbes in Human Welfare", ncert: 8 },
        { name: "Biotechnology: Principles and Processes", ncert: 9, bank: ["Biotechnology - Principles and Processes"] },
        { name: "Biotechnology and its Applications", ncert: 10 },
        { name: "Organisms and Populations", ncert: 11 },
        { name: "Ecosystem", ncert: 12 },
        { name: "Biodiversity and Conservation", ncert: 13, bank: ["Biodiversity and its Conservation"] },
      ]),
    ],
  },
];

/** Every chapter with its class and subject, in skeleton order. */
export function listSyllabusChapters(): Array<
  NotesSyllabusChapter & { classLevel: number; subject: NotesSubject; subjectKey: string; classKey: string }
> {
  return NOTES_SYLLABUS.flatMap((cls) =>
    cls.subjects.flatMap((sub) =>
      sub.chapters.map((chapter) => ({
        ...chapter,
        classLevel: cls.classLevel,
        subject: sub.subject,
        subjectKey: sub.key,
        classKey: cls.key,
      })),
    ),
  );
}

/** "Ch 3 · Motion in a Plane" style label used in folder lists. */
export function chapterLabel(name: string, ncertNumber: number | null | undefined): string {
  return ncertNumber ? `Ch ${ncertNumber} · ${name}` : name;
}
