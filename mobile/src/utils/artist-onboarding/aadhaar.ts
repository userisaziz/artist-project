// Same rule as backend app/utils/aadhaar.py (keep them in lockstep): 12 digits, first digit 2–9,
// last digit a Verhoeff check digit. Use generated numbers only: 234123412346 passes, 234123412347 fails.

// Verhoeff tables: multiplication (dihedral group D5) and permutation, as published by Verhoeff (1969).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** `digits` must already be stripped of spaces (the Identity screen keeps digits only). */
export function isValidAadhaar(digits: string): boolean {
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let check = 0;
  [...digits].reverse().forEach((d, i) => { check = D[check][P[i % 8][Number(d)]]; });
  return check === 0;
}

/** "234123412346" → "2341 2341 2346"; partial input groups the same way ("23412" → "2341 2"). */
export function formatAadhaar(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
