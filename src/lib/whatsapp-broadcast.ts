import type { Member, MemberTier } from '@/lib/types';
import { sanitizePhoneNumber } from '@/lib/whatsapp';

export interface CampaignTemplate {
  id: string;
  title: string;
  category: 'gaming' | 'food' | 'tournament' | 'tier' | 'reengage';
  badge: string;
  headline: string;
  bodyText: string;
  highlightOffer: string;
  validUntil: string;
  terms: string;
}

export const PRESET_CAMPAIGNS: CampaignTemplate[] = [
  {
    id: 'ps5-happy-hours',
    title: 'PS5 Happy Hours (50% Off)',
    category: 'gaming',
    badge: 'GAMING SPECIAL',
    headline: 'PLAYSTATION 5 HAPPY HOURS!',
    bodyText: 'Level up your week with our exclusive gaming deal! Grab 50% OFF on all 1-Hour & 2-Hour PS5 passes.',
    highlightOffer: 'Flat 50% OFF on PS5 Sessions between 12:00 PM - 5:00 PM',
    validUntil: 'Valid Monday to Thursday',
    terms: 'Valid on single & group console bookings.'
  },
  {
    id: 'coffee-fries-bogo',
    title: 'Cold Coffee & Fries BOGO Combo',
    category: 'food',
    badge: 'CAFE BOGO DEAL',
    headline: 'BUY 1 GET 1 ON COLD COFFEE & FRIES!',
    bodyText: 'Fuel your gaming streak with our handcrafted brews and crispy golden fries.',
    highlightOffer: 'Buy Any Cold Coffee / Shake & Get Loaded Fries at 50% OFF!',
    validUntil: 'Valid All Week',
    terms: 'Dine-in only at The 8 Bit Bistro HQ.'
  },
  {
    id: 'weekend-fifa-tourney',
    title: 'Weekend FIFA & Tekken Tournament',
    category: 'tournament',
    badge: 'TOURNAMENT ALERT',
    headline: 'WEEKEND ESPORTS SHOWDOWN!',
    bodyText: 'Think you have what it takes? Compete in our EA FC / Tekken 8 Championship and win cash prizes & free gaming hours!',
    highlightOffer: 'Prize Pool: ₹5,000 + 10 Free Gaming Hours!',
    validUntil: 'This Sunday at 4:00 PM',
    terms: 'Limited to 32 players. Pre-registration mandatory.'
  },
  {
    id: 'gold-tier-perks',
    title: 'VIP Member Perks & Free Hours',
    category: 'tier',
    badge: 'VIP PERKS',
    headline: 'EXCLUSIVE MEMBER REWARDS ARE LIVE!',
    bodyText: 'As our valued member, you have unlocked 1 FREE Bonus Gaming Hour and 20% discount on all cafe orders this week!',
    highlightOffer: '1 Free Hour + 20% Off Cafe Orders',
    validUntil: 'Valid for next 7 Days',
    terms: 'Show this message at the counter during check-in.'
  },
  {
    id: 'reengage-gamers',
    title: 'We Miss You! ₹100 Free Credit',
    category: 'reengage',
    badge: 'WE MISS YOU',
    headline: 'WE HAVENT SEEN YOU AT THE BISTRO!',
    bodyText: 'Your favorite station is waiting for you! Drop by this week and claim flat ₹100 gaming credit on your next session.',
    highlightOffer: 'Flat ₹100 OFF on any gaming pack above ₹200',
    validUntil: 'Valid this weekend',
    terms: 'Applicable once per member.'
  }
];

/**
 * Formats a clean, highly compatible promotional WhatsApp text for a specific member.
 */
export function formatBroadcastMessage(
  template: {
    headline: string;
    bodyText: string;
    highlightOffer: string;
    validUntil?: string;
    terms?: string;
  },
  memberName?: string
): string {
  const greeting = memberName ? `Hey *${memberName}*! 🎮` : `Hey Gamer! 🎮`;

  let msg = `====================================\n`;
  msg += `        *THE 8 BIT BISTRO HQ*\n`;
  msg += `====================================\n`;
  msg += `${greeting}\n\n`;
  msg += `🔥 *${template.headline.toUpperCase()}*\n\n`;
  msg += `${template.bodyText}\n\n`;
  msg += `------------------------------------\n`;
  msg += `⭐ *OFFER:* ${template.highlightOffer}\n`;
  if (template.validUntil) {
    msg += `⏳ *VALIDITY:* ${template.validUntil}\n`;
  }
  if (template.terms) {
    msg += `📝 *NOTE:* ${template.terms}\n`;
  }
  msg += `------------------------------------\n\n`;
  msg += `📍 *Visit Us:* The 8 Bit Bistro HQ\n`;
  msg += `📞 *Reserve / Inquiries:* +91 8830325714\n`;
  msg += `====================================\n`;
  msg += `_Reply STOP to opt-out of offers._`;

  return msg;
}

/**
 * Generates an individualized WhatsApp link for broadcasting.
 */
export function generateBroadcastLink(
  phone: string,
  message: string
): string {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
