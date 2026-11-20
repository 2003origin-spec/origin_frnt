import type { Subject } from '@/features/landing-demo/demo';

/** One book on the landing page's book stack. Chapter names are real NCERT chapter titles. */
export type Book = {
  cover: string;
  title: string;
  /** Printed on the spine. */
  spine: string;
  /** Spine and back-cover colour, taken from the cover. */
  color: string;
  subject: Subject;
  chapters: string[];
  /** The page the cover opens to: one short worked question from one of the chapters. */
  worked: { chapter: string; question: string; steps: string[]; answer: string };
};

export const BOOKS: Book[] = [
  {
    cover: '/landing/books/Physics-class-11-part-1.webp',
    title: 'NCERT Physics, Class 11',
    spine: 'PHYSICS · XI',
    color: '#3b4f6b',
    subject: 'physics',
    chapters: ['Units and Measurement', 'Motion in a Straight Line', 'Laws of Motion', 'Gravitation', 'Thermodynamics'],
    worked: {
      chapter: 'Laws of Motion',
      question: 'A 10 N force pushes a 2 kg block on a smooth floor. What is its acceleration?',
      steps: ['Newton’s second law: F = ma.', 'So a = F / m = 10 / 2.'],
      answer: 'a = 5 m/s²',
    },
  },
  {
    cover: '/landing/books/Chemistry-class-11-part-1.webp',
    title: 'NCERT Chemistry, Class 11',
    spine: 'CHEMISTRY · XI',
    color: '#1f6b3a',
    subject: 'chemistry',
    chapters: ['Structure of Atom', 'Chemical Bonding and Molecular Structure', 'Thermodynamics', 'Equilibrium', 'Hydrocarbons'],
    worked: {
      chapter: 'Structure of Atom',
      question: 'How many electrons can the shell n = 3 hold?',
      steps: ['A shell holds at most 2n² electrons.', 'For n = 3: 2 × 3² = 2 × 9.'],
      answer: '18 electrons',
    },
  },
  {
    cover: '/landing/books/Mathematics-class-11.webp',
    title: 'NCERT Mathematics, Class 11',
    spine: 'MATHEMATICS · XI',
    color: '#1d5fa8',
    subject: 'maths',
    chapters: ['Sets', 'Trigonometric Functions', 'Complex Numbers and Quadratic Equations', 'Permutations and Combinations', 'Limits and Derivatives'],
    worked: {
      chapter: 'Permutations and Combinations',
      question: 'In how many ways can 5 students sit in a row of 5 chairs?',
      steps: ['The first chair has 5 choices, the next 4, then 3, 2, 1.', 'So the count is 5! = 5 × 4 × 3 × 2 × 1.'],
      answer: '120 ways',
    },
  },
  {
    cover: '/landing/books/Biology-class-11.webp',
    title: 'NCERT Biology, Class 11',
    spine: 'BIOLOGY · XI',
    color: '#7a6233',
    subject: 'biology',
    chapters: ['The Living World', 'Cell: The Unit of Life', 'Photosynthesis in Higher Plants', 'Body Fluids and Circulation', 'Excretory Products and their Elimination'],
    worked: {
      chapter: 'Cell: The Unit of Life',
      question: 'Which organelle makes most of the cell’s ATP, and how?',
      steps: ['Aerobic respiration finishes in the mitochondria.', 'The Krebs cycle and the electron transport chain there make most of the ATP.'],
      answer: 'The mitochondrion',
    },
  },
  {
    cover: '/landing/books/Physics-class-12-part-1.webp',
    title: 'NCERT Physics, Class 12',
    spine: 'PHYSICS · XII',
    color: '#b8323a',
    subject: 'physics',
    chapters: ['Electric Charges and Fields', 'Current Electricity', 'Ray Optics and Optical Instruments', 'Dual Nature of Radiation and Matter', 'Semiconductor Electronics'],
    worked: {
      chapter: 'Current Electricity',
      question: 'Two 6 Ω resistors are joined in parallel. What is the total resistance?',
      steps: ['In parallel: 1/R = 1/R₁ + 1/R₂.', '1/R = 1/6 + 1/6 = 1/3.'],
      answer: 'R = 3 Ω',
    },
  },
  {
    cover: '/landing/books/Biology-class-12.webp',
    title: 'NCERT Biology, Class 12',
    spine: 'BIOLOGY · XII',
    color: '#13897f',
    subject: 'biology',
    chapters: ['Sexual Reproduction in Flowering Plants', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Biotechnology: Principles and Processes'],
    worked: {
      chapter: 'Principles of Inheritance and Variation',
      question: 'Tall (Tt) × Tall (Tt). What ratio of tall to dwarf plants appears?',
      steps: ['The gametes are T and t from each parent.', 'Offspring: TT : Tt : tt = 1 : 2 : 1, and T is dominant.'],
      answer: '3 tall : 1 dwarf',
    },
  },
];

export const SUBJECT_LABEL: Record<Subject, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  maths: 'Maths',
  biology: 'Biology',
};

/**
 * The pile's order after a book is taken out or put back. `order` lists book indexes from the
 * bottom of the pile to the top. Taking a book removes it; putting it back puts it on top.
 */
export function takeFromPile(order: number[], book: number): number[] {
  return order.filter((i) => i !== book);
}

export function putOnTop(order: number[], book: number): number[] {
  return [...takeFromPile(order, book), book];
}
