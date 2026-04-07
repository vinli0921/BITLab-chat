export const STUDY_ID = 'study-1' as const;
export const VARIANTS = ['control', 'sponsored-inline', 'sponsored-outside'] as const;
export type Variant = (typeof VARIANTS)[number];
