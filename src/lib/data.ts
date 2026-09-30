import type { Reward, Settings } from './types';

export const rewards: Reward[] = [
  // This data is now managed in Firestore. 
  // This file is kept for type reference and initial structure,
  // but the live data comes from the database.
];

export const settings: Settings = {
  bitsPerRupeeRate: 0.1, // 1 Bit per ₹10 spent
  bitsPerLevel: 100,     // 100 Bits per level progression
  xpPerRupee: 1,
  xpPerLevel: 1000,
  pointsPerLevelUp: 100,
  activeCycle: 'Launch Live',
};
