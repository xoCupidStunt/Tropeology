export const TAGLINES = [
  'Tracking your unhinged reading habits.',
  'We know what you did last chapter.',
  "Your red flags called, they're in chapter 12.",
  'Somebody has to keep track of your book boyfriends.',
  'Judging your taste in fictional men since 2026.',
  'The receipts for your reading problem.',
  'Go ahead, skip to the spicy chapters.',
  'There’s a trope for your reading habits, it’s called "Why Choose".',
  'Your reading habits, exposed but organized.',
  'Enemies to Lovers is a lifestyle, not a trope.',
  'Track your book before the emotional damage sets in.',
];

export function randomTagline() {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}
