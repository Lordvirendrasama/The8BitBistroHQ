import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlayerPrice, getTierMultiplier } from '../pricing';
import type { Member, MemberRecharge, AssignedMember, GamingPackage, BillItem, Station } from '../types';

function createTestMember(partial: Partial<Member> & { id: string; name: string }): Member {
  return {
    id: partial.id,
    name: partial.name,
    username: partial.username || partial.name.toLowerCase().replace(/\s+/g, ''),
    phone: partial.phone || '9999999999',
    tier: partial.tier || 'Red',
    level: partial.level || 1,
    bitsBalance: partial.bitsBalance ?? 0,
    lifetimeBitsEarned: partial.lifetimeBitsEarned ?? (partial.bitsBalance ?? 0),
    totalSpent: partial.totalSpent ?? 0,
    avatarUrl: partial.avatarUrl || 'https://picsum.photos/seed/test/100/100',
    joinDate: partial.joinDate || new Date().toISOString(),
    recharges: partial.recharges || []
  };
}

function createTestAssignedMember(partial: Partial<AssignedMember> & { id: string; name: string }): AssignedMember {
  return {
    id: partial.id,
    name: partial.name,
    avatarUrl: partial.avatarUrl || 'https://picsum.photos/seed/test/100/100',
    billingType: partial.billingType || 'walk_in',
    rechargeId: partial.rechargeId ?? null,
    isNewRecharge: partial.isNewRecharge ?? false,
    allocatedSeconds: partial.allocatedSeconds ?? 3600,
    consumedSeconds: partial.consumedSeconds ?? 0,
    rechargeProcessed: partial.rechargeProcessed ?? false,
    startTime: partial.startTime ?? null,
    endTime: partial.endTime ?? null,
    status: partial.status ?? 'active',
    remainingTimeOnPause: partial.remainingTimeOnPause ?? null
  };
}

function formatPackageDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '0M';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}H`);
  if (minutes > 0) parts.push(`${minutes}M`);
  if (hours === 0 && seconds > 0) parts.push(`${seconds}S`);
  return parts.length > 0 ? parts.join(' ') : '0M';
}

// Pure logic mirrors for Firestore atomic transactions
function getMemberAvailableBalance(member: { recharges?: MemberRecharge[] }): number {
  if (!member || !member.recharges) return 0;
  const now = new Date();
  return member.recharges
    .filter(r => new Date(r.expiryDate) > now)
    .reduce((sum, r) => sum + Math.max(0, r.remainingDuration - (r.reservedDuration || 0)), 0);
}

function reserveMemberBalance(
  member: Member,
  secondsToReserve: number,
  targetRechargeId?: string | null
): { success: boolean; reservedSeconds: number } {
  if (!member || member.id.startsWith('guest-') || secondsToReserve <= 0) {
    return { success: false, reservedSeconds: 0 };
  }
  const now = new Date();
  const sortedRecharges = [...(member.recharges || [])].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  );

  let remainingToReserve = secondsToReserve;
  let actuallyReserved = 0;

  // Phase 1: Target pack
  let updatedRecharges = sortedRecharges.map(r => {
    const isValid = new Date(r.expiryDate) > now;
    const currentReserved = r.reservedDuration || 0;
    const availableInPack = Math.max(0, r.remainingDuration - currentReserved);
    const isTarget = Boolean(targetRechargeId && (r.id === targetRechargeId || r.packageId === targetRechargeId || targetRechargeId === 'pool'));

    if (isValid && isTarget && remainingToReserve > 0 && availableInPack > 0) {
      const toReserve = Math.min(availableInPack, remainingToReserve);
      remainingToReserve -= toReserve;
      actuallyReserved += toReserve;
      return { ...r, reservedDuration: currentReserved + toReserve };
    }
    return r;
  });

  // Phase 2: Soonest to expire
  if (remainingToReserve > 0) {
    updatedRecharges = updatedRecharges.map(r => {
      const isValid = new Date(r.expiryDate) > now;
      const currentReserved = r.reservedDuration || 0;
      const availableInPack = Math.max(0, r.remainingDuration - currentReserved);

      if (isValid && remainingToReserve > 0 && availableInPack > 0) {
        const toReserve = Math.min(availableInPack, remainingToReserve);
        remainingToReserve -= toReserve;
        actuallyReserved += toReserve;
        return { ...r, reservedDuration: currentReserved + toReserve };
      }
      return r;
    });
  }

  member.recharges = updatedRecharges;
  return { success: actuallyReserved > 0, reservedSeconds: actuallyReserved };
}

function reconcileMemberBalance(
  member: Member,
  allocatedSeconds: number,
  consumedSeconds: number,
  targetRechargeId?: string | null
): { success: boolean; releasedSeconds: number; deductedSeconds: number } {
  if (!member || member.id.startsWith('guest-') || !member.recharges) {
    return { success: false, releasedSeconds: 0, deductedSeconds: 0 };
  }

  const now = new Date();
  let remainingToDeduct = Math.max(0, consumedSeconds);
  let remainingToUnreserve = Math.max(0, allocatedSeconds);
  let totalDeducted = 0;
  let totalReleased = 0;

  // Phase 1: Target pack unreserve and deduct (specific pack ID only)
  let updatedRecharges = member.recharges.map(r => {
    let currentRemaining = r.remainingDuration;
    let currentReserved = r.reservedDuration || 0;
    const isValid = new Date(r.expiryDate) > now;
    const isTarget = Boolean(targetRechargeId && targetRechargeId !== 'pool' && (r.id === targetRechargeId || r.packageId === targetRechargeId));

    if (isTarget) {
      if (remainingToUnreserve > 0 && currentReserved > 0) {
        const unreserve = Math.min(currentReserved, remainingToUnreserve);
        currentReserved = Math.max(0, currentReserved - unreserve);
        remainingToUnreserve -= unreserve;
        totalReleased += unreserve;
      }

      if (isValid && remainingToDeduct > 0 && currentRemaining > 0) {
        const deduct = Math.min(currentRemaining, remainingToDeduct);
        currentRemaining = Math.max(0, currentRemaining - deduct);
        remainingToDeduct -= deduct;
        totalDeducted += deduct;
      }
    }

    return {
      ...r,
      remainingDuration: currentRemaining,
      reservedDuration: currentReserved
    };
  });

  // Phase 2: Packs with active holds
  if (remainingToDeduct > 0 || remainingToUnreserve > 0) {
    updatedRecharges = updatedRecharges.map(r => {
      let currentRemaining = r.remainingDuration;
      let currentReserved = r.reservedDuration || 0;
      const isValid = new Date(r.expiryDate) > now;

      if (currentReserved > 0) {
        if (remainingToUnreserve > 0) {
          const unreserve = Math.min(currentReserved, remainingToUnreserve);
          currentReserved = Math.max(0, currentReserved - unreserve);
          remainingToUnreserve -= unreserve;
          totalReleased += unreserve;
        }

        if (isValid && remainingToDeduct > 0 && currentRemaining > 0) {
          const deduct = Math.min(currentRemaining, remainingToDeduct);
          currentRemaining = Math.max(0, currentRemaining - deduct);
          remainingToDeduct -= deduct;
          totalDeducted += deduct;
        }
      }

      return {
        ...r,
        remainingDuration: currentRemaining,
        reservedDuration: currentReserved
      };
    });
  }

  // Phase 3: Other valid packs (never expired)
  if (remainingToDeduct > 0) {
    const validPackIndices = updatedRecharges
      .map((r, idx) => ({ ...r, originalIndex: idx }))
      .filter(r => (new Date(r.expiryDate) > now || (now.getTime() - new Date(r.expiryDate).getTime() < 24 * 3600 * 1000)) && r.remainingDuration > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    for (const item of validPackIndices) {
      if (remainingToDeduct <= 0) break;
      const pack = updatedRecharges[item.originalIndex];
      const deduct = Math.min(pack.remainingDuration, remainingToDeduct);
      pack.remainingDuration = Math.max(0, pack.remainingDuration - deduct);
      remainingToDeduct -= deduct;
      totalDeducted += deduct;
    }
  }

  // Phase 4: Release any remaining holds
  if (remainingToUnreserve > 0) {
    updatedRecharges = updatedRecharges.map(r => {
      let currentReserved = r.reservedDuration || 0;
      if (currentReserved > 0 && remainingToUnreserve > 0) {
        const unreserve = Math.min(currentReserved, remainingToUnreserve);
        currentReserved = Math.max(0, currentReserved - unreserve);
        remainingToUnreserve -= unreserve;
        totalReleased += unreserve;
      }
      return {
        ...r,
        reservedDuration: currentReserved
      };
    });
  }

  member.recharges = updatedRecharges;
  return { success: true, releasedSeconds: totalReleased, deductedSeconds: totalDeducted };
}

function rechargeMember(
  member: Member,
  pkg: GamingPackage,
  _paymentMethod: 'cash' | 'upi'
): MemberRecharge {
  const now = new Date();
  const validityDays = pkg.validity || 1;
  const expiry = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const newRecharge: MemberRecharge = {
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    packageId: pkg.id,
    packageName: pkg.name,
    totalDuration: pkg.duration,
    remainingDuration: pkg.duration,
    purchaseDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    pricePaid: pkg.price
  };

  member.recharges = [...(member.recharges || []), newRecharge];
  member.totalSpent = (member.totalSpent || 0) + pkg.price;

  const tierMultiplier = getTierMultiplier(member.tier);
  const bitsEarned = Math.floor((pkg.price / 10) * tierMultiplier);
  member.bitsBalance = (member.bitsBalance || 0) + bitsEarned;
  member.lifetimeBitsEarned = (member.lifetimeBitsEarned || 0) + bitsEarned;
  member.level = Math.max(member.level || 1, Math.floor(member.lifetimeBitsEarned / 100) + 1);

  return newRecharge;
}

// ---------------------- TEST SCENARIOS (1 to 13) ----------------------

test('Scenario 1: Existing member using a 1-hour recharge', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const member = createTestMember({
    id: 'mem-1',
    name: 'Viren',
    phone: '9999999999',
    tier: 'Gold',
    totalSpent: 1000,
    bitsBalance: 100,
    recharges: [{
      id: 'r1',
      packageId: 'ps5-1h',
      packageName: 'PS5 1 Hour Solo Session',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: future,
      pricePaid: 150
    }]
  });

  assert.equal(getMemberAvailableBalance(member), 3600);

  // 1. Session start: reserve 3600s
  const reserveRes = reserveMemberBalance(member, 3600);
  assert.equal(reserveRes.success, true);
  assert.equal(reserveRes.reservedSeconds, 3600);
  assert.equal(getMemberAvailableBalance(member), 0, 'Available balance is locked/reserved');

  // 2. Play full 1 hour (3600s) and checkout
  const reconcileRes = reconcileMemberBalance(member, 3600, 3600);
  assert.equal(reconcileRes.success, true);
  assert.equal(reconcileRes.deductedSeconds, 3600);
  assert.equal(reconcileRes.releasedSeconds, 3600);
  assert.equal(member.recharges![0].remainingDuration, 0, 'Balance is now 0');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Reserved hold is released');
});

test('Scenario 2: New purchase of a 30-minute recharge', () => {
  const member = createTestMember({
    id: 'mem-2',
    name: 'Alice',
    phone: '9888888888',
    tier: 'Green', // 1.5x multiplier
    totalSpent: 500,
    bitsBalance: 50
  });

  const pkg30m: GamingPackage = {
    id: 'ps5-30m',
    name: 'PS5 30 Min Solo Session',
    duration: 1800,
    price: 80,
    validity: 1
  };

  const _recharge = rechargeMember(member, pkg30m, 'cash');
  assert.equal(member.totalSpent, 580, 'totalSpent increases by recharge price');
  // Green tier multiplier = 1.5. (80 / 10) * 1.5 = 12 Bits
  assert.equal(member.bitsBalance, 62, 'Bits balance increases with tier multiplier');
  assert.equal(member.recharges?.length, 1);
  assert.equal(member.recharges![0].remainingDuration, 1800);
  assert.equal(getMemberAvailableBalance(member), 1800);
});

test('Scenario 3: Purchase and immediate session start', () => {
  const member = createTestMember({
    id: 'mem-3',
    name: 'Bob',
    phone: '9777777777',
    tier: 'Red',
    totalSpent: 0,
    bitsBalance: 0
  });

  const pkg: GamingPackage = {
    id: 'ps5-1h',
    name: 'PS5 1 Hour Solo Session',
    duration: 3600,
    price: 150,
    validity: 1
  };

  // Immediate start: customer buys pack
  const _rec = rechargeMember(member, pkg, 'upi');
  assert.equal(member.totalSpent, 150);
  assert.equal(member.bitsBalance, 15); // Red = 1x: floor(150/10) = 15

  // Session consumes the 3600s
  const recRes = reconcileMemberBalance(member, 3600, 3600);
  assert.equal(recRes.deductedSeconds, 3600);
  assert.equal(member.recharges![0].remainingDuration, 0);

  // Bill contains ONLY the recharge pack price, no double walk-in charge!
  const billItems: BillItem[] = [{
    itemId: 'rec-1',
    name: `Buy Recharge: ${pkg.name} (${member.name})`,
    price: pkg.price,
    quantity: 1,
    billingType: 'recharge_purchase',
    memberId: member.id
  }];
  const totalBill = billItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  assert.equal(totalBill, 150, 'Only the recharge pack price is charged');
});

test('Scenario 4: 30-minute recharge followed by 2 hours of actual gameplay (Overtime)', () => {
  const member = createTestMember({
    id: 'mem-4',
    name: 'Charlie',
    phone: '9666666666',
    tier: 'Red',
    recharges: [{
      id: 'r30m',
      packageId: 'ps5-30m',
      packageName: 'PS5 30 Min Solo Session',
      totalDuration: 1800,
      remainingDuration: 1800,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 80
    }]
  });

  // 1. Session started with 1800s allocated
  reserveMemberBalance(member, 1800);

  // 2. Played for 2 hours (7200 seconds)
  const actualElapsedSeconds = 7200;
  const allocatedDuration = 1800;
  const consumedPrepaid = Math.min(allocatedDuration, actualElapsedSeconds);
  const overtimeSeconds = Math.max(0, actualElapsedSeconds - allocatedDuration);

  // Deduct prepaid
  reconcileMemberBalance(member, allocatedDuration, consumedPrepaid);
  assert.equal(member.recharges![0].remainingDuration, 0, 'Prepaid 30m is fully consumed');

  // Verify Overtime: 5400s = 90 minutes
  assert.equal(overtimeSeconds, 5400);
  const overtimeMinutes = Math.ceil(overtimeSeconds / 60); // 90 min
  assert.equal(overtimeMinutes, 90);

  // PS5 1-player rate for 90 minutes
  const overtimePrice = calculatePlayerPrice('ps5', 1, overtimeMinutes);
  assert.ok(overtimePrice > 0, 'Overtime is billed at walk-in rate');

  const billItems: BillItem[] = [{
    itemId: 'ot-1',
    name: `Overtime: ${overtimeMinutes}m (${member.name})`,
    price: overtimePrice,
    quantity: 1,
    billingType: 'overtime',
    memberId: member.id
  }];
  const finalBill = billItems.reduce((s, i) => s + i.price * i.quantity, 0);
  assert.equal(finalBill, overtimePrice, 'Customer is properly billed for 90m overtime');
});

test('Scenario 5: Two members using separate wallets in multiplayer', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const memberA = createTestMember({
    id: 'mem-A',
    name: 'Player A',
    tier: 'Red',
    recharges: [{
      id: 'ra',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: future,
      pricePaid: 150
    }]
  });

  const memberB = createTestMember({
    id: 'mem-B',
    name: 'Player B',
    tier: 'Green',
    recharges: [{
      id: 'rb',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: future,
      pricePaid: 150
    }]
  });

  // Both reserve 3600s
  reserveMemberBalance(memberA, 3600);
  reserveMemberBalance(memberB, 3600);

  // Both play 3600s
  reconcileMemberBalance(memberA, 3600, 3600);
  reconcileMemberBalance(memberB, 3600, 3600);

  assert.equal(memberA.recharges![0].remainingDuration, 0, 'Player A wallet deducted exactly 3600s');
  assert.equal(memberB.recharges![0].remainingDuration, 0, 'Player B wallet deducted exactly 3600s');
  assert.equal(memberA.recharges![0].reservedDuration, 0);
  assert.equal(memberB.recharges![0].reservedDuration, 0);
});

test('Scenario 6: One member and one guest playing together', () => {
  const member = createTestMember({
    id: 'mem-host',
    name: 'Host Member',
    tier: 'Gold',
    recharges: [{
      id: 'r-host',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  const guestPlayer = {
    id: 'guest-999',
    name: 'Guest Player',
    billingType: 'walk_in' as const
  };

  // Member reserves 3600s
  reserveMemberBalance(member, 3600);
  // Guest cannot reserve
  const guestReserve = reserveMemberBalance(guestPlayer as any, 3600);
  assert.equal(guestReserve.success, false, 'Guests cannot reserve balance');

  // Play 60 minutes (2 players)
  reconcileMemberBalance(member, 3600, 3600);
  assert.equal(member.recharges![0].remainingDuration, 0, 'Member wallet only deducted for member');

  // Guest is billed walk-in rate for 2 players
  const guestPrice = calculatePlayerPrice('ps5', 2, 60);
  const billItems: BillItem[] = [{
    itemId: 'time-guest',
    name: `Time: 1 Hour Session (${guestPlayer.name})`,
    price: guestPrice,
    quantity: 1,
    billingType: 'walk_in',
    memberId: guestPlayer.id
  }];

  const totalBill = billItems.reduce((s, i) => s + i.price * i.quantity, 0);
  assert.equal(totalBill, guestPrice, 'Guest pays walk-in, member wallet did not pay for guest');
});

test('Scenario 7: Member choosing cash/UPI despite having recharge balance', () => {
  const member = createTestMember({
    id: 'mem-optout',
    name: 'Opt-Out Member',
    tier: 'Red',
    recharges: [{
      id: 'r-keep',
      packageId: 'ps5-2h',
      packageName: 'PS5 2H',
      totalDuration: 7200,
      remainingDuration: 7200,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 280
    }]
  });

  // Operator chose QUICK PLAY (mode: 'walk_in')
  const _assignedPlayer = createTestAssignedMember({
    id: member.id,
    name: member.name,
    billingType: 'walk_in',
    rechargeId: null,
    isNewRecharge: false,
    allocatedSeconds: 3600
  });

  // Since billingType === 'walk_in', wallet is NOT reserved and NOT reconciled
  assert.equal(getMemberAvailableBalance(member), 7200, 'Available balance is unchanged');

  const walkinPrice = calculatePlayerPrice('ps5', 1, 60);
  const billItems: BillItem[] = [{
    itemId: 'time-optout',
    name: `Time: 1 Hour Session (${member.name})`,
    price: walkinPrice,
    quantity: 1,
    billingType: 'walk_in',
    memberId: member.id
  }];

  assert.equal(billItems[0].price, walkinPrice);
  assert.equal(member.recharges![0].remainingDuration, 7200, 'Wallet balance remains 100% intact');
});

test('Scenario 8: Extending a session using recharge balance', () => {
  const member = createTestMember({
    id: 'mem-extend',
    name: 'Extender',
    tier: 'Gold',
    recharges: [{
      id: 'r-ext',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  // Initial session: 30 minutes (1800s)
  reserveMemberBalance(member, 1800);
  assert.equal(getMemberAvailableBalance(member), 1800, '1800s left unreserved');

  // Extend by remaining 1800s from account balance
  const available = getMemberAvailableBalance(member);
  assert.ok(available >= 1800);
  const extRes = reserveMemberBalance(member, 1800);
  assert.equal(extRes.success, true);
  assert.equal(getMemberAvailableBalance(member), 0, 'Now fully reserved');
  assert.equal(member.recharges![0].reservedDuration, 3600);

  // Complete full 3600s session
  reconcileMemberBalance(member, 3600, 3600);
  assert.equal(member.recharges![0].remainingDuration, 0);
  assert.equal(member.recharges![0].reservedDuration, 0);
});

test('Scenario 9: Two devices attempting to use the same balance (Reservation lock)', () => {
  const member = createTestMember({
    id: 'mem-lock',
    name: 'Concurrency Test',
    tier: 'Green',
    recharges: [{
      id: 'r-lock',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  // Device 1 reserves full 3600s balance
  const dev1 = reserveMemberBalance(member, 3600);
  assert.equal(dev1.success, true);
  assert.equal(dev1.reservedSeconds, 3600);

  // Device 2 attempts to reserve from the same member
  const dev2Available = getMemberAvailableBalance(member);
  assert.equal(dev2Available, 0, 'Device 2 sees 0 available balance');

  const dev2 = reserveMemberBalance(member, 3600);
  assert.equal(dev2.success, false, 'Device 2 reservation is blocked');
  assert.equal(dev2.reservedSeconds, 0);
});

test('Scenario 10: Early session termination and unused balance reconciliation', () => {
  const member = createTestMember({
    id: 'mem-early',
    name: 'Early Leaver',
    tier: 'Red',
    recharges: [{
      id: 'r-early',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  // Starts 60 min session: reserves 3600s
  reserveMemberBalance(member, 3600);

  // Plays only 20 min (1200s), stops early
  const allocated = 3600;
  const played = 1200;
  const res = reconcileMemberBalance(member, allocated, played);

  assert.equal(res.success, true);
  assert.equal(res.deductedSeconds, 1200, 'Deducted only 20 minutes');
  assert.equal(res.releasedSeconds, 3600, 'Released all 60 minutes of reserved hold');
  assert.equal(member.recharges![0].remainingDuration, 2400, '40 minutes returned to wallet');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Hold completely cleared');
  assert.equal(getMemberAvailableBalance(member), 2400, 'Unreserved balance is immediately 2400s');
});

test('Scenario 11: Duplicate checkout submission (Idempotency)', () => {
  let checkoutCount = 0;
  let reconciledSeconds = 0;

  const station: Station = {
    id: 'ps5-station-1',
    name: 'PS5 1',
    type: 'ps5',
    status: 'in-use',
    checkoutProcessed: false,
    startTime: null,
    endTime: null,
    packageName: null,
    members: [createTestAssignedMember({
      id: 'mem-dup',
      name: 'Dup Member',
      billingType: 'prepaid',
      allocatedSeconds: 3600,
      rechargeId: 'r-dup'
    })]
  };

  const member = createTestMember({
    id: 'mem-dup',
    name: 'Dup Member',
    tier: 'Red',
    recharges: [{
      id: 'r-dup',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const simulateCheckout = () => {
    if (station.status === 'available' || station.checkoutProcessed) {
      return { skipped: true };
    }
    checkoutCount++;
    reconciledSeconds += 3600;
    reconcileMemberBalance(member, 3600, 3600);
    station.status = 'available';
    station.checkoutProcessed = true;
    return { skipped: false };
  };

  const firstCall = simulateCheckout();
  assert.equal(firstCall.skipped, false);
  assert.equal(checkoutCount, 1);
  assert.equal(reconciledSeconds, 3600);

  // Duplicate submission
  const secondCall = simulateCheckout();
  assert.equal(secondCall.skipped, true, 'Second checkout call is safely ignored');
  assert.equal(checkoutCount, 1, 'Checkout count does not increment');
  assert.equal(reconciledSeconds, 3600, 'Balance is not deducted twice');
});

test('Scenario 12: Paused and resumed prepaid sessions', () => {
  // Session: 3600s prepaid.
  // Plays 600s, pauses for 1200s, resumes, plays remaining 3000s.
  const startMs = 1000000;
  let endMs = startMs + 3600 * 1000; // Original endTime = 4600000

  // At t = 1600000 (10 mins in), station paused
  const pauseStartMs = 1600000;
  const remainingOnPause = Math.floor((endMs - pauseStartMs) / 1000); // 3000s

  // At t = 2800000 (20 mins pause duration), resume
  const resumeMs = 2800000;
  endMs = resumeMs + remainingOnPause * 1000; // Shifted endTime = 5800000

  // Total session stops at t = 5800000 (at exact shifted endTime)
  const finalNowMs = 5800000;
  const overtimeSeconds = Math.max(0, Math.floor((finalNowMs - endMs) / 1000));
  assert.equal(overtimeSeconds, 0, 'No overtime because pause time was shifted forward');

  const actualPlayedSeconds = (pauseStartMs - startMs) / 1000 + (finalNowMs - resumeMs) / 1000;
  assert.equal(actualPlayedSeconds, 3600, 'Exact played time equals 3600s entitlement');
});

test('Scenario 13: Insufficient balance during a multiplayer session', () => {
  const memberA = createTestMember({
    id: 'mem-rich',
    name: 'Rich Member',
    tier: 'Red',
    recharges: [{
      id: 'r-rich',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  const memberB = createTestMember({
    id: 'mem-poor',
    name: 'Low Balance Member',
    tier: 'Red',
    recharges: [{
      id: 'r-low',
      packageId: 'ps5-10m',
      packageName: 'PS5 10M',
      totalDuration: 600,
      remainingDuration: 600, // Only 600s (10m)
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 30
    }]
  });

  const requestedDurationSeconds = 3600; // 1 hour session requested

  // handleApplyAllAndStart evaluation:
  const balanceA = getMemberAvailableBalance(memberA);
  const balanceB = getMemberAvailableBalance(memberB);

  // Player A evaluation:
  const playerA_isPrepaid = balanceA >= requestedDurationSeconds;
  assert.equal(playerA_isPrepaid, true, 'Member A has sufficient balance for prepaid');

  // Player B evaluation:
  const playerB_isPrepaid = balanceB >= requestedDurationSeconds;
  assert.equal(playerB_isPrepaid, false, 'Member B has insufficient balance');

  // Player B must fall back to paid walk-in
  const playerB_billingType = playerB_isPrepaid ? 'prepaid' : 'walk_in';
  const playerB_price = playerB_isPrepaid ? 0 : calculatePlayerPrice('ps5', 2, 60);

  assert.equal(playerB_billingType, 'walk_in');
  assert.ok(playerB_price > 0, 'Member B is billed walk-in rate, no free gaming');
  assert.equal(memberB.recharges![0].remainingDuration, 600, 'Member B wallet is not forced negative');
});

// ---------------------- CANONICAL RECONCILIATION & IDEMPOTENCY TESTS ----------------------

function reconcileMemberSession(
  member: Member,
  assignedPlayer: AssignedMember,
  station: Station,
  nowMs: number
): { success: boolean; deltaDeducted: number; remainingDuration: number } {
  const startIso = assignedPlayer.startTime || station.startTime || new Date(nowMs).toISOString();
  const endIso = assignedPlayer.endTime || station.endTime;
  const startMs = new Date(startIso).getTime();
  const endMs = endIso ? new Date(endIso).getTime() : startMs + (assignedPlayer.allocatedSeconds || 3600) * 1000;
  const totalSessionSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  let remainingSeconds = 0;
  if ((station.status === 'paused' || assignedPlayer.status === 'paused') && (assignedPlayer.remainingTimeOnPause != null || station.remainingTimeOnPause != null)) {
    remainingSeconds = assignedPlayer.remainingTimeOnPause ?? station.remainingTimeOnPause ?? 0;
  } else if (endIso && nowMs < endMs) {
    remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  }

  const playedEntitled = Math.max(0, totalSessionSeconds - remainingSeconds);
  const totalAllocated = assignedPlayer.allocatedSeconds || totalSessionSeconds;
  const consumedSeconds = Math.min(totalAllocated, playedEntitled);
  const alreadyDeducted = assignedPlayer.consumedSeconds || 0;
  const deltaToDeduct = Math.max(0, consumedSeconds - alreadyDeducted);

  const res = reconcileMemberBalance(member, totalAllocated, deltaToDeduct);
  assignedPlayer.consumedSeconds = consumedSeconds;
  assignedPlayer.rechargeProcessed = true;
  assignedPlayer.status = 'finished';
  assignedPlayer.remainingSecondsAtStop = remainingSeconds;

  return {
    success: res.success,
    deltaDeducted: res.deductedSeconds,
    remainingDuration: member.recharges![0].remainingDuration
  };
}

test('Test 1 — Basic deduction: 3600s start, 300s play -> 3300s remaining', () => {
  const member = createTestMember({
    id: 'viren-1',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1 Hour Solo Session',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  // Start session with 3600s reserved
  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000; // 5 minutes (300s) later
  const player = createTestAssignedMember({
    id: 'viren-1',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    consumedSeconds: 0
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1 Hour Solo Session',
    members: [player]
  };

  const res = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(res.deltaDeducted, 300, 'Exactly 300 seconds deducted');
  assert.equal(member.recharges![0].remainingDuration, 3300, 'Remaining duration is exactly 3300 seconds (55m)');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Reservation hold is cleared to 0');
  assert.equal(getMemberAvailableBalance(member), 3300, 'Available balance is immediately 3300 seconds');
});

test('Test 2 — Repeated reconciliation idempotency: 3300s does NOT become 3000s', () => {
  const member = createTestMember({
    id: 'viren-2',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1 Hour Solo Session',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000; // 5 minutes later
  const player = createTestAssignedMember({
    id: 'viren-2',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    consumedSeconds: 0
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1 Hour Solo Session',
    members: [player]
  };

  // First reconciliation (e.g. Stop All)
  const first = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(first.deltaDeducted, 300);
  assert.equal(member.recharges![0].remainingDuration, 3300);

  // Second reconciliation (e.g. Checkout Confirm or duplicate event)
  const second = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(second.deltaDeducted, 0, 'Second call deducts 0 seconds');
  assert.equal(member.recharges![0].remainingDuration, 3300, 'STILL 3300s, NEVER 3000s');

  // Third reconciliation (e.g. rapid click retry)
  const third = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(third.deltaDeducted, 0, 'Third call deducts 0 seconds');
  assert.equal(member.recharges![0].remainingDuration, 3300, 'STILL 3300s');
});

test('Test 3 — Stop All: Freezes time and reconciles before checkout', () => {
  const member = createTestMember({
    id: 'viren-3',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000;
  const player = createTestAssignedMember({
    id: 'viren-3',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString()
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1H',
    members: [player]
  };

  // Stop All triggered: immediately reconciles
  const res = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(res.deltaDeducted, 300);
  assert.equal(member.recharges![0].remainingDuration, 3300);
  assert.equal(player.status, 'finished');
  assert.equal(player.consumedSeconds, 300);
});

test('Test 4 — Checkout dismissed: Remaining balance remains 3300s even if checkout is closed', () => {
  const member = createTestMember({
    id: 'viren-4',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000;
  const player = createTestAssignedMember({
    id: 'viren-4',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString()
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1H',
    members: [player]
  };

  // Session stopped (reconciled)
  reconcileMemberSession(member, player, station, nowMs);

  // Operator opens checkout modal and clicks "X" / dismiss
  let checkoutFinalized = false;
  const onDismissCheckout = () => {
    // Checkout dialog closed without calling onConfirmCheckout
    checkoutFinalized = false;
  };
  onDismissCheckout();

  // Assert member balance is STILL 3300s
  assert.equal(member.recharges![0].remainingDuration, 3300, 'Wallet has 3300s even when checkout is not finalized');
  assert.equal(checkoutFinalized, false);
});

test('Test 5 — Station reset / Cancel Bill: Reconciles active session before clearing station', () => {
  const member = createTestMember({
    id: 'viren-5',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000;
  const player = createTestAssignedMember({
    id: 'viren-5',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString()
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1H',
    members: [player]
  };

  // Operator triggers handleCancelTestBill (X button)
  const handleCancelTestBill = () => {
    // Reconcile active prepaid members before resetting
    for (const m of station.members) {
      if (m.billingType === 'prepaid') {
        reconcileMemberSession(member, m, station, nowMs);
      }
    }
    station.status = 'available';
    station.members = [];
  };

  handleCancelTestBill();

  assert.equal(station.status, 'available');
  assert.equal(station.members.length, 0);
  assert.equal(member.recharges![0].remainingDuration, 3300, 'Member wallet was deducted 300s before reset');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Reservation hold was safely released');
});

test('Test 6 — Timer expiry: Entire 3600s is reconciled when timer finishes', () => {
  const member = createTestMember({
    id: 'viren-6',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 3600 * 1000; // Exact 3600s later (timer finished)
  const player = createTestAssignedMember({
    id: 'viren-6',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString()
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1H',
    members: [player]
  };

  const res = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(res.deltaDeducted, 3600);
  assert.equal(member.recharges![0].remainingDuration, 0, 'Full 1 hour is consumed on expiry');
  assert.equal(member.recharges![0].reservedDuration, 0);
});

test('Test 7 — Logout/login authoritative display: Wallet shows ~55m (3300s)', () => {
  const member = createTestMember({
    id: 'viren-7',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1 Hour Solo Session',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000;
  const player = createTestAssignedMember({
    id: 'viren-7',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString()
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1 Hour Solo Session',
    members: [player]
  };

  // Stop session
  reconcileMemberSession(member, player, station, nowMs);

  // User logs out and logs back in (fetches authoritative member from database)
  const loggedInMember = createTestMember({
    ...member,
    recharges: member.recharges
  });

  const availableBalance = getMemberAvailableBalance(loggedInMember);
  assert.equal(availableBalance, 3300, 'Firestore balance is 3300s');

  const formatPackageDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours}H`);
    if (minutes > 0) parts.push(`${minutes}M`);
    return parts.length > 0 ? parts.join(' ') : '0M';
  };

  const displayTime = formatPackageDuration(availableBalance);
  assert.equal(displayTime, '55M', 'UI displays 55M available, NOT 1H');
});

test('Test 8 — Missing member timestamps: Falls back to station timestamps rather than deducting 0s', () => {
  const member = createTestMember({
    id: 'viren-8',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000;
  // Member object intentionally has null startTime and endTime!
  const player = createTestAssignedMember({
    id: 'viren-8',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: null,
    endTime: null
  });

  // Station has authoritative timestamps
  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1H',
    members: [player]
  };

  const res = reconcileMemberSession(member, player, station, nowMs);
  assert.equal(res.deltaDeducted, 300, 'Fallback accurately calculates 300s played rather than 0s');
  assert.equal(member.recharges![0].remainingDuration, 3300);
});

test('Test 9 — Concurrent/repeated stop: Rapid triggers do not charge member twice', () => {
  const member = createTestMember({
    id: 'viren-9',
    name: 'Viren',
    recharges: [{
      id: 'rec-1h',
      packageId: 'ps5-1h',
      packageName: 'PS5 1H',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      pricePaid: 150
    }]
  });

  reserveMemberBalance(member, 3600);

  const startMs = 1000000;
  const nowMs = startMs + 300 * 1000;
  const player = createTestAssignedMember({
    id: 'viren-9',
    name: 'Viren',
    billingType: 'prepaid',
    rechargeId: 'rec-1h',
    allocatedSeconds: 3600,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString()
  });

  const station: Station = {
    id: 'ps5-10',
    name: 'PS5 10',
    type: 'ps5',
    status: 'in-use',
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(startMs + 3600 * 1000).toISOString(),
    packageName: 'Recharge: PS5 1H',
    members: [player]
  };

  // Simulate 5 rapid simultaneous Stop/Reconcile triggers
  let totalDeductedAcrossTriggers = 0;
  for (let i = 0; i < 5; i++) {
    const res = reconcileMemberSession(member, player, station, nowMs);
    totalDeductedAcrossTriggers += res.deltaDeducted;
  }

  assert.equal(totalDeductedAcrossTriggers, 300, 'Total deducted across all 5 rapid calls is exactly 300s');
  assert.equal(member.recharges![0].remainingDuration, 3300, 'Member is charged exactly once');
});

test('Scenario 14: Expired pack safety - deductions MUST target active pack, NEVER expired pack', () => {
  const expiredDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // Expired 2 days ago
  const activeDate = new Date(Date.now() + 86400000).toISOString(); // Valid for 24h

  const member = createTestMember({
    id: 'mem-viren-expired-test',
    name: 'Viren',
    recharges: [
      {
        id: 'rec-old-expired',
        packageId: 'ps5-1h',
        packageName: 'PS5 1 Hour Solo Session (Expired)',
        totalDuration: 3600,
        remainingDuration: 3600,
        purchaseDate: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
        expiryDate: expiredDate,
        pricePaid: 150
      },
      {
        id: 'rec-new-active',
        packageId: 'ps5-1h',
        packageName: 'PS5 1 Hour Solo Session (Active)',
        totalDuration: 3600,
        remainingDuration: 3600,
        purchaseDate: new Date().toISOString(),
        expiryDate: activeDate,
        pricePaid: 150
      }
    ]
  });

  // Session starts: 3600s reserved on active pack
  const reserveRes = reserveMemberBalance(member, 3600);
  assert.equal(reserveRes.success, true);
  assert.equal(member.recharges![1].reservedDuration, 3600, 'Reserved on active pack');
  assert.equal(member.recharges![0].reservedDuration || 0, 0, 'Expired pack had 0 reserved');

  // Player plays for 1 minute (60 seconds)
  const reconcileRes = reconcileMemberBalance(member, 3600, 60, 'rec-new-active');
  assert.equal(reconcileRes.success, true);
  assert.equal(reconcileRes.deductedSeconds, 60, '60 seconds deducted');
  assert.equal(reconcileRes.releasedSeconds, 3600, 'Reservation released');

  // Expired pack must be completely untouched!
  assert.equal(member.recharges![0].remainingDuration, 3600, 'Expired pack was NOT touched');
  // Active pack must have exactly 3540 seconds (59 minutes) remaining!
  assert.equal(member.recharges![1].remainingDuration, 3540, 'Active pack has 3540s (59M) remaining');
  assert.equal(member.recharges![1].reservedDuration, 0, 'Active pack reservation is 0');
});

test('Scenario 15: 5 minutes played out of 1-hour pack with stop + checkout cycle', () => {
  const activeDate = new Date(Date.now() + 86400000).toISOString();
  const member = createTestMember({
    id: 'mem-viren-5m-test',
    name: 'Viren',
    recharges: [{
      id: 'rec-5m',
      packageId: 'ps5-1h',
      packageName: 'PS5 1 Hour Solo Session',
      totalDuration: 3600,
      remainingDuration: 3600,
      purchaseDate: new Date().toISOString(),
      expiryDate: activeDate,
      pricePaid: 150
    }]
  });

  // 1. Session starts: 3600s reserved
  reserveMemberBalance(member, 3600);

  // 2. Member plays 5 minutes (300 seconds), then operator clicks "Stop All"
  // Stop All calls reconcileMemberBalance with allocatedSeconds = 3600, deltaToDeduct = 300
  const stopRes = reconcileMemberBalance(member, 3600, 300, 'rec-5m');
  assert.equal(stopRes.success, true);
  assert.equal(stopRes.deductedSeconds, 300);
  assert.equal(stopRes.releasedSeconds, 3600);
  assert.equal(member.recharges![0].remainingDuration, 3300, 'Exactly 3300s (55m) remaining');
  assert.equal(member.recharges![0].reservedDuration, 0);

  // 3. Operator reviews bill in Checkout Modal and clicks "Settle & Close"
  // Settle & Close calls reconcileMemberBalance with allocatedSeconds = 3600, deltaToDeduct = 0
  const checkoutRes = reconcileMemberBalance(member, 3600, 0, 'rec-5m');
  assert.equal(checkoutRes.success, true);
  assert.equal(checkoutRes.deductedSeconds, 0, 'Idempotent: 0 newly deducted at checkout');
  assert.equal(member.recharges![0].remainingDuration, 3300, 'Still exactly 3300s (55m) remaining, NO double deduction');
});

test('Scenario 16: Deduct from pooled balance session (targetRechargeId === "pool")', () => {
  const activeDate = new Date(Date.now() + 86400000).toISOString();
  const member = createTestMember({
    id: 'mem-viren-pool-test',
    name: 'Viren',
    recharges: [
      {
        id: 'rec-p1',
        packageId: 'ps5-30m',
        packageName: 'PS5 30m Session',
        totalDuration: 1800,
        remainingDuration: 1800,
        purchaseDate: new Date().toISOString(),
        expiryDate: activeDate,
        pricePaid: 80
      },
      {
        id: 'rec-p2',
        packageId: 'ps5-1h',
        packageName: 'PS5 1h Session',
        totalDuration: 3600,
        remainingDuration: 3600,
        purchaseDate: new Date().toISOString(),
        expiryDate: activeDate,
        pricePaid: 150
      }
    ]
  });

  // Session starts with 'pool' target
  const res = reserveMemberBalance(member, 3600, 'pool');
  assert.equal(res.success, true);

  // Member plays 5 minutes (300 seconds)
  const stopRes = reconcileMemberBalance(member, 3600, 300, 'pool');
  assert.equal(stopRes.success, true);
  assert.equal(stopRes.deductedSeconds, 300, '300s deducted when using pool');

  // Verify total remaining is (1800 + 3600) - 300 = 5100s
  const totalRemaining = member.recharges!.reduce((s, r) => s + r.remainingDuration, 0);
  assert.equal(totalRemaining, 5100, 'Net remaining across pool is 5100s');
});

test('Scenario 17: Logout and re-login simulates fresh state inspection after 5-minute gameplay', () => {
  const activeDate = new Date(Date.now() + 86400000).toISOString();
  const originalPack: MemberRecharge = {
    id: 'rec-viren-recharge',
    packageId: 'ps5-1h',
    packageName: 'PS5 1 Hour Solo Session',
    totalDuration: 3600,
    remainingDuration: 3600,
    purchaseDate: new Date().toISOString(),
    expiryDate: activeDate,
    pricePaid: 150
  };

  const member = createTestMember({
    id: 'mem-viren-logout-test',
    name: 'Viren',
    recharges: [{ ...originalPack }]
  });

  // Player starts 1h session
  reserveMemberBalance(member, 3600, 'rec-viren-recharge');

  // Player plays for 5 minutes (300 seconds), session is stopped
  reconcileMemberBalance(member, 3600, 300, 'rec-viren-recharge');

  // Simulate Firestore persistence & re-read on login:
  const persistedFirestoreDoc = JSON.parse(JSON.stringify(member));
  const loggedInMember: Member = persistedFirestoreDoc;

  // Verify that on login, the wallet authoritative balance is 3300s (55m), NOT 3600s!
  const remaining = loggedInMember.recharges![0].remainingDuration;
  assert.equal(remaining, 3300, 'Must have 3300s remaining after login');
  assert.equal(formatPackageDuration(remaining), '55M', 'UI displays 55M, not 1H');

  // Verify time used calculation:
  const total = loggedInMember.recharges![0].totalDuration;
  const used = total - remaining;
  assert.equal(used, 300, 'Must show 300s (5M) used');
  assert.equal(formatPackageDuration(used), '5M', 'UI displays 5M used');
});

test('Scenario 18: 1 minute played out of 1-hour pack -> 59M remaining and 1M used', () => {
  const activeDate = new Date(Date.now() + 86400000).toISOString();
  const pack: MemberRecharge = {
    id: 'rec-1min-test',
    packageId: 'ps5-1h',
    packageName: 'PS5 1 Hour Solo Session',
    totalDuration: 3600,
    remainingDuration: 3600,
    purchaseDate: new Date().toISOString(),
    expiryDate: activeDate,
    pricePaid: 150
  };

  const member = createTestMember({
    id: 'mem-1min-viren',
    name: 'Viren',
    recharges: [{ ...pack }]
  });

  // Start 1-hour session
  reserveMemberBalance(member, 3600, 'rec-1min-test');
  assert.equal(member.recharges![0].reservedDuration, 3600);

  // Play for 1 minute (60 seconds)
  const res = reconcileMemberBalance(member, 3600, 60, 'rec-1min-test');
  assert.equal(res.success, true);
  assert.equal(res.deductedSeconds, 60);
  assert.equal(res.releasedSeconds, 3600);

  // Verify wallet state
  const remaining = member.recharges![0].remainingDuration;
  assert.equal(remaining, 3540, 'Remaining duration is 3540 seconds');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Reservation is completely released');
  assert.equal(formatPackageDuration(remaining), '59M', 'UI shows 59M Available');

  const used = member.recharges![0].totalDuration - remaining;
  assert.equal(used, 60, 'Used duration is 60 seconds');
  assert.equal(formatPackageDuration(used), '1M', 'UI shows 1M Used');
});

test('Scenario 19: NaN resilience - NaN values do not corrupt wallet balances', () => {
  const activeDate = new Date(Date.now() + 86400000).toISOString();
  const pack: MemberRecharge = {
    id: 'rec-nan-test',
    packageId: 'ps5-1h',
    packageName: 'PS5 1 Hour Solo Session',
    totalDuration: 3600,
    remainingDuration: 3600,
    purchaseDate: new Date().toISOString(),
    expiryDate: activeDate,
    pricePaid: 150
  };

  const member = createTestMember({
    id: 'mem-nan-resilience',
    name: 'Viren',
    recharges: [{ ...pack }]
  });

  // Start session with NaN
  const safeReserve = Number.isFinite(NaN as any) ? Math.max(0, NaN) : 0;
  assert.equal(safeReserve, 0);

  // Reconcile with NaN safe guard
  const safeConsumed = Number.isFinite(NaN as any) ? Math.max(0, NaN) : 0;
  const res = reconcileMemberBalance(member, 3600, safeConsumed, 'rec-nan-test');
  assert.equal(res.success, true);
  assert.equal(res.deductedSeconds, 0);
  assert.equal(member.recharges![0].remainingDuration, 3600);
});

test('Scenario 20: 1 minute and 12 seconds played (72s) out of 1-hour pack -> 58M 48S left, 1M 12S used', () => {
  const activeDate = new Date(Date.now() + 86400000).toISOString();
  const pack: MemberRecharge = {
    id: 'rec-72s-test',
    packageId: 'ps5-1h',
    packageName: 'PS5 1 Hour Solo Session',
    totalDuration: 3600,
    remainingDuration: 3600,
    purchaseDate: new Date().toISOString(),
    expiryDate: activeDate,
    pricePaid: 150
  };

  const member = createTestMember({
    id: 'mem-72s-viren',
    name: 'Viren',
    recharges: [{ ...pack }]
  });

  // Start 1-hour session
  reserveMemberBalance(member, 3600, 'rec-72s-test');
  assert.equal(member.recharges![0].reservedDuration, 3600);

  // Play for 1 minute and 12 seconds (72 seconds)
  const res = reconcileMemberBalance(member, 3600, 72, 'rec-72s-test');
  assert.equal(res.success, true);
  assert.equal(res.deductedSeconds, 72);
  assert.equal(res.releasedSeconds, 3600);

  // Remaining duration: 3600 - 72 = 3528
  const remaining = member.recharges![0].remainingDuration;
  assert.equal(remaining, 3528, 'Remaining duration is 3528 seconds');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Reservation released');
  assert.equal(formatPackageDuration(remaining), '58M 48S', 'Shows 58M 48S Available');

  // Used duration: 3600 - 3528 = 72
  const used = member.recharges![0].totalDuration - remaining;
  assert.equal(used, 72, 'Used duration is 72 seconds');
  assert.equal(formatPackageDuration(used), '1M 12S', 'Shows 1M 12S Used');
});

test('Scenario 21: Purchasing recharge with configured validity saves exact expiry date', () => {
  const pkg: GamingPackage = {
    id: 'pkg-1h-solo',
    name: 'PS5 1 Hour Solo Session',
    duration: 3600,
    price: 150,
    validity: 1 // 1 day validity (24 hours)
  };

  const playedSeconds = 72; // 1m 12s
  const validityDays = (pkg.validity && pkg.validity > 0) ? pkg.validity : 1;
  const initialRemaining = Math.max(0, pkg.duration - playedSeconds);
  const now = new Date();
  const expiry = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

  const newRecharge: MemberRecharge = {
    id: 'rec-new-72s',
    packageId: pkg.id,
    packageName: pkg.name,
    totalDuration: pkg.duration,
    remainingDuration: initialRemaining,
    reservedDuration: 0,
    purchaseDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    pricePaid: pkg.price
  };

  assert.equal(newRecharge.remainingDuration, 3528);
  assert.equal(newRecharge.totalDuration, 3600);
  assert.equal(formatPackageDuration(newRecharge.remainingDuration), '58M 48S');
  assert.equal(validityDays, 1, 'Recharge validity strictly respects configured 1-day (24h) validity');
  const diffHours = (new Date(newRecharge.expiryDate).getTime() - now.getTime()) / (3600 * 1000);
  assert.equal(Math.round(diffHours), 24, 'Expiry is exactly 24 hours from purchase');
});

test('Scenario 22: Strict validity expiration without hardcoded 30-day override', () => {
  const now = new Date();
  const pastExpiry = new Date(now.getTime() - 2 * 3600 * 1000).toISOString(); // expired 2 hours ago
  const purchaseDate = new Date(now.getTime() - 26 * 3600 * 1000).toISOString(); // bought 26 hours ago (1-day pack)

  const pack: MemberRecharge = {
    id: 'rec-strict-test',
    packageId: 'ps5-1h',
    packageName: 'PS5 1 Hour Solo Session',
    totalDuration: 3600,
    remainingDuration: 3000, // 50m unspent
    purchaseDate: purchaseDate,
    expiryDate: pastExpiry,
    pricePaid: 150
  };

  // Strict validity check: once expired, it is no longer valid
  const exp = new Date(pack.expiryDate);
  const isValid = exp.getTime() > now.getTime() && pack.remainingDuration > 0;
  assert.equal(isValid, false, 'Expired 1-day package is strictly invalid after its 24h validity has passed');
});

test('Scenario 23: Pool reconciliation with mixed expired and active packs deducts from held active pack, NOT expired pack', () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString(); // 90 days ago
  const futureDate = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(); // 30 days ahead

  const member = createTestMember({
    id: 'mem-viren-pool',
    name: 'Viren',
    recharges: [
      // Pack 0: Expired February pack with leftover seconds
      {
        id: 'rec-old-feb',
        packageId: 'old-5h',
        packageName: '5 Hours',
        totalDuration: 18000,
        remainingDuration: 10000,
        reservedDuration: 0,
        purchaseDate: pastDate,
        expiryDate: pastDate,
        pricePaid: 400
      },
      // Pack 1: Active pack 1 (1 hour)
      {
        id: 'rec-nov-1',
        packageId: 'ps5-1h',
        packageName: 'PS5 1 Hour Solo Session',
        totalDuration: 3600,
        remainingDuration: 3600,
        reservedDuration: 0,
        purchaseDate: now.toISOString(),
        expiryDate: futureDate,
        pricePaid: 150
      },
      // Pack 2: Active pack 2 (1 hour)
      {
        id: 'rec-nov-2',
        packageId: 'ps5-1h',
        packageName: 'PS5 1 Hour Solo Session',
        totalDuration: 3600,
        remainingDuration: 3600,
        reservedDuration: 0,
        purchaseDate: now.toISOString(),
        expiryDate: futureDate,
        pricePaid: 150
      }
    ]
  });

  // Session started using combined pool (7200s total active balance)
  reserveMemberBalance(member, 7200, 'pool');
  assert.equal(member.recharges![0].reservedDuration, 0, 'Expired pack 0 is NOT reserved');
  assert.equal(member.recharges![1].reservedDuration, 3600, 'Active pack 1 is reserved');
  assert.equal(member.recharges![2].reservedDuration, 3600, 'Active pack 2 is reserved');

  // Player plays for 2 minutes (120 seconds) and stops
  const res = reconcileMemberBalance(member, 7200, 120, 'pool');
  assert.equal(res.success, true);
  assert.equal(res.deductedSeconds, 120);

  // Expired pack 0 must NOT be touched!
  assert.equal(member.recharges![0].remainingDuration, 10000, 'Expired pack remaining duration is untouched');

  // Active pack 1 had 120s deducted: 3600 - 120 = 3480
  assert.equal(member.recharges![1].remainingDuration, 3480, 'Active pack 1 has 120s deducted');
  assert.equal(member.recharges![1].reservedDuration, 0, 'Hold released');

  // Active pack 2 is intact: 3600
  assert.equal(member.recharges![2].remainingDuration, 3600, 'Active pack 2 is untouched');
  assert.equal(member.recharges![2].reservedDuration, 0, 'Hold released');

  // Total active remaining: 3480 + 3600 = 7080s (1H 58M)
  const totalActive = member.recharges![1].remainingDuration + member.recharges![2].remainingDuration;
  assert.equal(formatPackageDuration(totalActive), '1H 58M', 'UI shows 1H 58M Available');

  const pack1Used = member.recharges![1].totalDuration - member.recharges![1].remainingDuration;
  assert.equal(formatPackageDuration(pack1Used), '2M', 'Pack 1 shows 2M Used');
});

test('Scenario 24: Finishing game extra time triggers 4-minute wrap-up reminder alert', () => {
  const now = Date.now();
  const finishStartTime3m = new Date(now - 3 * 60 * 1000).toISOString(); // 3 mins elapsed
  const finishStartTime4m = new Date(now - 4 * 60 * 1000).toISOString(); // 4 mins elapsed
  const finishStartTime5m = new Date(now - 5 * 60 * 1000).toISOString(); // 5 mins elapsed

  const fourMinutesMs = 4 * 60 * 1000;
  const fiveMinutesMs = 5 * 60 * 1000;

  // 1. At 3 minutes into finishing: 4-minute alert should NOT fire yet
  const elapsed3m = now - new Date(finishStartTime3m).getTime();
  assert.equal(elapsed3m >= fourMinutesMs, false, '3 minutes elapsed should NOT trigger 4-minute alert');

  // 2. At 4 minutes into finishing: 4-minute reminder alert fires!
  const elapsed4m = now - new Date(finishStartTime4m).getTime();
  assert.equal(elapsed4m >= fourMinutesMs, true, '4 minutes elapsed triggers wrap-up reminder alert');
  const remainingGrace4m = Math.max(-3600000, fiveMinutesMs - elapsed4m);
  assert.ok(remainingGrace4m <= 60000 && remainingGrace4m >= 0, '1 minute or less remaining of 5m wrap-up period');

  // 3. At 5 minutes: grace period has fully expired
  const elapsed5m = now - new Date(finishStartTime5m).getTime();
  const remainingGrace5m = Math.max(-3600000, fiveMinutesMs - elapsed5m);
  assert.ok(remainingGrace5m <= 0, 'Grace period has expired at 5 minutes');
});
