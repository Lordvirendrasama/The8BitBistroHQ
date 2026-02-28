import type { Reward, Settings } from './types';

export const rewards: Reward[] = [
  // This data is now managed in Firestore. 
  // This file is kept for type reference and initial structure,
  // but the live data comes from the database.
];

export const settings: Settings = {
  xpPerRupee: 1,
  xpPerLevel: 1000,
  maxLevels: 10,
  pointsPerLevelUp: 100,
};
