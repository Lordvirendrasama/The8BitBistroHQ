import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBusinessDate,
  getKolkataDateParts,
  formatDateDDMMYYYY,
  isBusinessToday
} from '../utils';
import {
  resolveItemCategory,
  runDataReconciliation,
  computeTransparentHealthScore,
  generateDeterministicCeoActions,
  computeUnifiedOwnerPulseData,
  KPI_DICTIONARY
} from '../metrics-layer';
import type { Bill, Expense, Station, Employee, Shift, Member, FixedBill, FoodItem, RawMaterial } from '../types';

describe('Metrics Layer & Date Boundary Unit Tests', () => {
  it('correctly handles Asia/Kolkata date boundaries and 5:00 AM rollover', () => {
    // 2026-10-26 04:30 AM IST (which is 2026-10-25 23:00 UTC) -> belongs to business day 2026-10-25
    const earlyMorningUtc = new Date(Date.UTC(2026, 9, 25, 23, 0, 0));
    assert.equal(getBusinessDate(earlyMorningUtc), '2026-10-25');

    // 2026-10-26 05:01 AM IST (which is 2026-10-25 23:31 UTC) -> belongs to business day 2026-10-26
    const postRolloverUtc = new Date(Date.UTC(2026, 9, 25, 23, 31, 0));
    assert.equal(getBusinessDate(postRolloverUtc), '2026-10-26');

    // String date YYYY-MM-DD preserves exact date when ignoreOffset is true
    assert.equal(getBusinessDate('2026-10-26', true), '2026-10-26');
    assert.equal(formatDateDDMMYYYY('2026-10-26'), '26/10/2026');
  });

  it('accurately resolves item categories to the 8 canonical categories', () => {
    assert.equal(resolveItemCategory({ name: 'Iced Americano' }), 'Coffee');
    assert.equal(resolveItemCategory({ name: 'Belgian Chocolate Waffle' }), 'Desserts');
    assert.equal(resolveItemCategory({ name: 'Extra 1 Hour Pass' }), 'Gaming');
    assert.equal(resolveItemCategory({ name: 'Catan Board Game' }), 'Board Games');
    assert.equal(resolveItemCategory({ name: 'Silver Tier Membership' }), 'Memberships');
    assert.equal(resolveItemCategory({ name: 'Zomato Delivery Box' }), 'Delivery');
    assert.equal(resolveItemCategory({ name: 'Red Bull Energy Can' }), 'Retail');
    assert.equal(resolveItemCategory({ name: 'Peri Peri Crispy Burger' }), 'Food');
  });

  it('audits and detects discrepancies in bills and duplicate records', () => {
    const mockBills: Bill[] = [
      {
        id: 'bill-1',
        stationId: 'st-1',
        stationName: 'PS5 - Station 1',
        initialPackagePrice: 300,
        foodSubtotal: 200,
        discount: 50,
        totalAmount: 450, // 300 + 200 - 50 = 450 (reconciles perfectly)
        timestamp: '2026-10-26T06:00:00.000Z',
        paymentMethod: 'cash',
        members: [{ id: 'mem-1', name: 'Rohan', avatarUrl: '' }],
        items: [{ itemId: 'f-1', name: 'Cold Coffee', price: 200, quantity: 1 }],
      },
      {
        id: 'bill-2',
        stationId: 'st-2',
        stationName: 'PS5 - Station 2',
        initialPackagePrice: 200,
        foodSubtotal: 100,
        discount: 0,
        totalAmount: 350, // Discrepancy! 200 + 100 - 0 = 300 != 350
        timestamp: '2026-10-26T07:00:00.000Z',
        paymentMethod: 'upi',
        members: [{ id: 'mem-2', name: 'Aditya', avatarUrl: '' }],
        items: [{ itemId: 'f-2', name: 'French Fries', price: 100, quantity: 1 }],
      },
      // Duplicate of bill-1
      {
        id: 'bill-1',
        stationId: 'st-1',
        stationName: 'PS5 - Station 1',
        initialPackagePrice: 300,
        foodSubtotal: 200,
        discount: 50,
        totalAmount: 450,
        timestamp: '2026-10-26T06:00:00.000Z',
        paymentMethod: 'cash',
        members: [{ id: 'mem-1', name: 'Rohan', avatarUrl: '' }],
        items: [{ itemId: 'f-1', name: 'Cold Coffee', price: 200, quantity: 1 }],
      },
    ];

    const audit = runDataReconciliation(mockBills);
    assert.equal(audit.totalBillsAudited, 3);
    assert.equal(audit.reconciledSalesTotal, 1250);
    assert.equal(audit.duplicateRecords.length, 1);
    assert.equal(audit.duplicateRecords[0].billId, 'bill-1');
    assert.equal(audit.unmatchedTransactions.length, 1);
    assert.equal(audit.unmatchedTransactions[0].billId, 'bill-2');
    assert.equal(audit.isFullyReconciled, false);
  });

  it('handles missing data separately from genuine zero without fabricating health score', () => {
    // When no records exist for the day
    const emptyScore = computeTransparentHealthScore({
      revToday: 0,
      revYesterday: 0,
      revTarget: 3000,
      profitToday: 0,
      customersToday: 0,
      avgBillToday: 0,
      gamingOccupancyToday: 0,
      activeStaffCount: 0,
      totalBillsToday: 0,
    });

    assert.equal(emptyScore.totalScore, 0);
    assert.equal(emptyScore.isDataSufficient, false);
    assert.ok(emptyScore.explanation.includes('No transactions recorded'));

    // When valid records exist
    const activeScore = computeTransparentHealthScore({
      revToday: 4500,
      revYesterday: 3000,
      revTarget: 3000,
      profitToday: 2500,
      customersToday: 20,
      avgBillToday: 380,
      gamingOccupancyToday: 65,
      activeStaffCount: 2,
      totalBillsToday: 12,
    });

    assert.ok(activeScore.totalScore > 70);
    assert.equal(activeScore.isDataSufficient, true);
  });

  it('distinguishes Best Seller by Volume vs Best Seller by Revenue', () => {
    const mockBills: Bill[] = [
      {
        id: 'bill-10',
        stationId: 'st-1',
        stationName: 'PS5 - 1',
        initialPackagePrice: 0,
        foodSubtotal: 1000,
        discount: 0,
        totalAmount: 1000,
        timestamp: '2026-10-26T12:00:00.000Z',
        paymentMethod: 'cash',
        members: [{ id: 'm-1', name: 'John', avatarUrl: '' }],
        items: [
          // 10 units sold @ ₹50 = ₹500 (Volume leader)
          { itemId: 'item-chips', name: 'Potato Chips', price: 50, quantity: 10 },
          // 1 unit sold @ ₹500 = ₹500
          { itemId: 'item-platter', name: 'Mega Gaming Platter', price: 500, quantity: 1 },
        ],
      },
      {
        id: 'bill-11',
        stationId: 'st-2',
        stationName: 'PS5 - 2',
        initialPackagePrice: 0,
        foodSubtotal: 800,
        discount: 0,
        totalAmount: 800,
        timestamp: '2026-10-26T14:00:00.000Z',
        paymentMethod: 'upi',
        members: [{ id: 'm-2', name: 'Sarah', avatarUrl: '' }],
        items: [
          // 2 more units @ ₹500 = ₹1000 total revenue (Revenue leader: ₹1,500 total)
          { itemId: 'item-platter', name: 'Mega Gaming Platter', price: 500, quantity: 2 },
        ],
      },
    ];

    const data = computeUnifiedOwnerPulseData(
      mockBills,
      [],
      [{ id: 'st-1', name: 'PS5 - 1', type: 'ps5', status: 'available', startTime: null, endTime: null, packageName: null, members: [] }],
      [],
      [],
      [],
      [],
      null,
      null,
      [],
      [],
      '2026-10-26'
    );

    assert.equal(data.cafeIntelligence.bestSellerVolume?.name, 'Potato Chips');
    assert.equal(data.cafeIntelligence.bestSellerVolume?.count, 10);
    assert.equal(data.cafeIntelligence.bestSellerRevenue?.name, 'Mega Gaming Platter');
    assert.equal(data.cafeIntelligence.bestSellerRevenue?.revenue, 1500);
    assert.equal(data.cafeIntelligence.top5RevenueProducts[0].name, 'Mega Gaming Platter');
  });

  it('triggers deterministic CEO Action recommendations with documented calculations', () => {
    const actions = generateDeterministicCeoActions({
      revToday: 1500,
      revYesterday: 2000,
      revTarget: 3000,
      gamingOccupancyToday: 35,
      idleHoursTotal: 12,
      potentialGamingHours: 20,
      foodAttachmentRatePct: 15,
      coffeeAttachmentRatePct: 10,
      pendingBillsCount: 2,
      customersToday: 8,
      customersYesterday: 12,
      lowStockItemsCount: 3,
      reportingDateStr: '26/10/2026',
    });

    assert.ok(actions.length >= 4);
    const occupancyAction = actions.find((a) => a.id === 'action-boost-gaming-occupancy');
    assert.ok(occupancyAction);
    assert.ok(occupancyAction.expectedImpact.includes('incremental revenue'));
    assert.ok(occupancyAction.impactCalculationFormula.length > 0);

    const pendingAction = actions.find((a) => a.id === 'action-audit-pending-bills');
    assert.ok(pendingAction);
    assert.equal(pendingAction.priority, 'High');
  });

  it('contains documentation for all headline KPIs in the dictionary', () => {
    const requiredKpis = ['revenueToday', 'profitToday', 'customersToday', 'averageBill', 'gamingOccupancy', 'healthScore'];
    for (const kpi of requiredKpis) {
      assert.ok(KPI_DICTIONARY[kpi], `KPI ${kpi} must exist in dictionary`);
      assert.ok(KPI_DICTIONARY[kpi].source.length > 0);
      assert.ok(KPI_DICTIONARY[kpi].calculationMethod.length > 0);
      assert.ok(KPI_DICTIONARY[kpi].timeRange.length > 0);
    }
  });
});
