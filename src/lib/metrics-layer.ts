import { Bill, Expense, Station, Employee, Shift, Member, FixedBill, LiabilityState, Settings, FoodItem, RawMaterial, OwnerTask } from './types';
import { getBusinessDate, getKolkataDateParts, formatDateDDMMYYYY } from './utils';
import {
  subDays,
  subWeeks,
  subMonths,
  subYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  getDaysInMonth
} from 'date-fns';

// ==========================================
// 1. HEADLINE KPI DOCUMENTATION & METRIC LAYER DEFINITIONS
// ==========================================

export interface MetricDefinition {
  id: string;
  name: string;
  category: 'Revenue' | 'Profit' | 'Customer' | 'Gaming' | 'Cafe' | 'Staff' | 'Operations' | 'Health';
  source: string;
  definition: string;
  timeRange: string;
  exclusions: string;
  calculationMethod: string;
  unit: string;
}

export const KPI_DICTIONARY: Record<string, MetricDefinition> = {
  revenueToday: {
    id: 'revenueToday',
    name: 'Revenue Today',
    category: 'Revenue',
    source: 'Firestore: bills',
    definition: 'Total realized monetary intake from all closed and active guest/member transactions on the selected business day.',
    timeRange: 'Selected Business Date (05:00 AM IST to 05:00 AM IST next calendar day)',
    exclusions: 'Voided orders; unpaid walk-in drafts not yet completed; transactions from other business dates.',
    calculationMethod: 'Sum of bill.totalAmount for all bills where getBusinessDate(timestamp) === selectedDate.',
    unit: '₹',
  },
  profitToday: {
    id: 'profitToday',
    name: 'Net Intake / Profit Today',
    category: 'Profit',
    source: 'Firestore: bills, expenses',
    definition: 'Gross daily revenue minus logged daily outflows/expenses recorded for the same business day.',
    timeRange: 'Selected Business Date (05:00 AM IST to 05:00 AM IST next calendar day)',
    exclusions: 'Unrecorded overheads and accrued monthly bills not logged today.',
    calculationMethod: 'revenueToday - dailyLoggedExpenses (expenses where getBusinessDate(timestamp) === selectedDate).',
    unit: '₹',
  },
  customersToday: {
    id: 'customersToday',
    name: 'Footfall / Customers Today',
    category: 'Customer',
    source: 'Firestore: bills',
    definition: 'Unique customer count across all bills served on the selected business day.',
    timeRange: 'Selected Business Date (05:00 AM IST to 05:00 AM IST next calendar day)',
    exclusions: 'Staff personal consumption; internal shift logs.',
    calculationMethod: 'Sum of Math.max(1, bill.members.length) across all bills for the business day.',
    unit: 'persons',
  },
  averageBill: {
    id: 'averageBill',
    name: 'Average Order Value (AOV)',
    category: 'Revenue',
    source: 'Firestore: bills',
    definition: 'Average revenue realized per bill on the selected business day.',
    timeRange: 'Selected Business Date',
    exclusions: 'Zero-amount bills if any.',
    calculationMethod: 'revenueToday / count(todayBills). Returns 0 if count is 0.',
    unit: '₹',
  },
  gamingOccupancy: {
    id: 'gamingOccupancy',
    name: 'Paid Gaming Occupancy',
    category: 'Gaming',
    source: 'Firestore: stations, bills',
    definition: 'Percentage of bookable console station hours utilized by paying gamers against total available station-hours.',
    timeRange: 'Operating hours (11:00 AM to 11:00 PM IST, max 12 hours) on the selected business date.',
    exclusions: 'Non-gaming tables (e.g. standalone café/boardgame tables without consoles).',
    calculationMethod: '(Total Paid Console Hours Played / (Total Bookable Consoles * Elapsed Operating Hours)) * 100.',
    unit: '%',
  },
  healthScore: {
    id: 'healthScore',
    name: 'Executive Health Score',
    category: 'Health',
    source: 'Weighted composite of Revenue, Profit, Customer, Spend, Occupancy, Operations',
    definition: 'Transparent 0-100 overall business vitality index based strictly on verifiable database records.',
    timeRange: 'Selected Business Date vs historical baseline',
    exclusions: 'Missing data inputs do not grant default points.',
    calculationMethod: 'Sum of 6 weighted components (Revenue Growth 25%, Profit Target 25%, Footfall 15%, AOV 15%, Gaming Occupancy 10%, Operations 10%).',
    unit: '/100',
  },
  revPerOccupiedGamingHour: {
    id: 'revPerOccupiedGamingHour',
    name: 'Revenue Per Occupied Gaming Hour',
    category: 'Gaming',
    source: 'Firestore: bills',
    definition: 'Realized gaming revenue per actual hour played by gamers.',
    timeRange: 'Selected Reporting Period',
    exclusions: 'Food/beverage items sold on the bill.',
    calculationMethod: 'Total Gaming Revenue / Total Paid Gaming Hours Played.',
    unit: '₹/hr',
  },
  revPerAvailableStationHour: {
    id: 'revPerAvailableStationHour',
    name: 'RevPASH (Revenue Per Available Station-Hour)',
    category: 'Gaming',
    source: 'Firestore: bills, stations',
    definition: 'Yield metric measuring gaming revenue generation across all available bookable stations whether occupied or idle.',
    timeRange: 'Elapsed Operating Hours of the day',
    exclusions: 'Non-console stations.',
    calculationMethod: 'Total Gaming Revenue / (Bookable Gaming Consoles * Elapsed Operating Hours).',
    unit: '₹/station-hr',
  },
};

// ==========================================
// 2. TYPES FOR THE METRIC LAYER
// ==========================================

export type StatusLevel = 'Healthy' | 'Growing' | 'Monitor' | 'Needs Attention' | 'No Data' | 'Stale';
export type StatusColor = 'green' | 'blue' | 'amber' | 'red' | 'grey';
export type InsightPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type ActionStatus = 'New' | 'In Progress' | 'Completed' | 'Dismissed';

export interface MetricComparison {
  current: number;
  previous: number;
  absDiff: number;
  pctDiff: number | null; // null when no previous baseline
  trend: 'up' | 'down' | 'neutral';
  status: StatusLevel;
  color: StatusColor;
  target?: number;
  targetProgressPct?: number;
  lastMonth?: number;
  lastMonthPctDiff?: number | null;
  hasData: boolean;
  isStale?: boolean;
  notes?: string;
}

export interface ExecutiveSummaryKPIs {
  revenueToday: MetricComparison;
  profitToday: MetricComparison;
  customersToday: MetricComparison;
  averageBill: MetricComparison;
  gamingOccupancy: MetricComparison;
  healthScore: MetricComparison;
}

export function getBusinessDayRangeKolkata(dateInput: Date | string = new Date()): { startIso: string; endIso: string } {
  const bDateStr = getBusinessDate(dateInput, typeof dateInput === 'string');
  const [y, m, d] = bDateStr.split('-').map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0) - (5.5 * 3600 * 1000));
  const endUtc = new Date(startUtc.getTime() + (24 * 3600 * 1000) - 1);
  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString()
  };
}

export interface CeoActionRecommendation {
  id: string;
  category: 'Revenue' | 'Gaming' | 'Cafe' | 'Customer' | 'Staff' | 'Financial' | 'Operations';
  priority: InsightPriority;
  severity: 'Critical' | 'Warning' | 'Opportunity' | 'Informational';
  color: StatusColor;
  title: string;
  reason: string;
  suggestedAction: string;
  evidence: string;
  reportingPeriod: string;
  expectedImpact: string;
  impactCalculationFormula: string;
  confidence: 'High' | 'Medium' | 'Low';
  assumptions: string;
  status: ActionStatus;
  outcomeMetric: string;
  actionUrl?: string;
  actionText?: string;
  taskId?: string; // Linked OwnerTask id
}

export interface DataReconciliationReport {
  dataFreshnessMinutes: number;
  freshnessStatus: 'Fresh' | 'Normal' | 'Stale' | 'No Records';
  lastRecordedBillTime: string | null;
  totalBillsAudited: number;
  reconciledSalesTotal: number;
  itemizedRevenueTotal: number;
  discrepancyAmount: number;
  isFullyReconciled: boolean;
  unmatchedTransactions: { billId: string; reason: string; amount: number }[];
  categoryMappingFailures: { itemName: string; count: number; revenue: number }[];
  duplicateRecords: { billId: string; occurrences: number }[];
  invalidDatesCount: number;
  unclosedHistoricalShiftsCount: number;
}

export interface CategoryRevenueItem {
  category: 'Gaming' | 'Food' | 'Coffee' | 'Desserts' | 'Retail' | 'Memberships' | 'Board Games' | 'Delivery';
  revenue: number;
  contributionPct: number;
  aov: number;
  ordersCount: number;
  hasRecordedSales: boolean;
}

export interface RevenueIntelligenceData {
  categories: CategoryRevenueItem[];
  topGrowthCategory: string;
  worstPerformingCategory: string;
  totalRevenue: number;
  periodTotalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  revenuePerOperatingHour: number;
  revenueSplit: { gaming: number; food: number; coffee: number; other: number };
  bestPerformingWeekday: string;
  slowestWeekday: string;
  reportingPeriodName: string;
}

export interface CustomerRetentionCohort {
  periodDays: number;
  eligibleCustomers: number;
  returnedCustomers: number;
  retentionRatePct: number;
}

export interface CustomerIntelligenceData {
  newCustomers: number;
  returningCustomers: number;
  memberVisits: number;
  walkinVisits: number;
  repeatRatePct: number;
  avgSpendPerCustomer: number;
  avgSpendSampleSize: number;
  avgRevenuePerGamer: number;
  memberRevenuePct: number;
  mostPopularVisitTime: string;
  mostPopularDay: string;
  highestSpendingCustomer: { name: string; amount: number } | null;
  highestReturningCustomer: { name: string; visits: number } | null;
  customerLifetimeValue: number;
  // Phase 4 Additions
  retentionCohorts: {
    sevenDay: CustomerRetentionCohort;
    thirtyDay: CustomerRetentionCohort;
    ninetyDay: CustomerRetentionCohort;
  };
  loyaltyBits: {
    earnedThisMonth: number;
    redeemedThisMonth: number;
    outstandingLiability: number;
  };
}

export interface GamingIntelligenceData {
  consoleUtilizationPct: number;
  potentialGamingHours: number;
  hoursPlayedTotal: number;
  idleHoursTotal: number;
  revenuePerPs5: number;
  avgSessionLengthMinutes: number;
  mostPopularPackage: string;
  mostPopularConsole: string;
  peakGamingHour: string;
  // Phase 3 Additions
  revPerOccupiedGamingHour: number;
  revPerAvailableStationHour: number;
  paidGamingOccupancyPct: number;
  totalBookableStations: number;
  stationDowntimeHours: number;
  gamingToFoodAttachmentRatePct: number;
  gamingToCoffeeAttachmentRatePct: number;
  discountImpactOnGaming: number;
}

export interface ProductContributionItem {
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  costPerUnit: number;
  hasCostRecorded: boolean;
  totalCost: number;
  contributionMarginRupees: number;
  contributionMarginPct: number;
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'; // BCG Menu Matrix
}

export interface CafeIntelligenceData {
  bestSellerVolume: { name: string; count: number; revenue: number } | null;
  bestSellerRevenue: { name: string; count: number; revenue: number } | null;
  fastestGrowingProduct: { name: string; currentCount: number; prevCount: number } | null;
  slowestSellingProduct: { name: string; count: number } | null;
  foodAttachmentRatePct: number;
  coffeeAttachmentRatePct: number;
  peakFoodHour: string;
  top5RevenueProducts: { name: string; revenue: number; unitsSold: number }[];
  bottom5RevenueProducts: { name: string; revenue: number; unitsSold: number }[];
  productContributions: ProductContributionItem[];
  missingCostCount: number;
  stockOutAlerts: { name: string; stock: number; threshold: number }[];
  inventoryWastage: number;
}

export interface EmployeeIntelScorecard {
  id?: string;
  username: string;
  displayName: string;
  role?: 'admin' | 'staff' | 'guest';
  joinDate?: string;
  salary?: number;
  salaryType?: 'monthly' | 'hourly';
  foodAllowanceBalance?: number;
  pin?: string;
  workStartTime?: string;
  workEndTime?: string;
  workingDaysPerWeek?: number;
  overtimeMultiplier?: number;
  weekOffDay?: number;
  assignedShift?: string;
  gracePeriod?: number;
  isActive?: boolean;
  revenueGenerated: number;
  ordersServed: number;
  shiftsWorked: number;
  hoursWorkedTotal: number;
  revenuePerHourWorked: number;
  ordersPerHourWorked: number;
  attendancePct: number;
  lateArrivalsCount: number;
  salaryResetDateFormatted: string;
  daysUntilSalaryReset: number;
  isSalaryResetDueToday: boolean;
  scheduledCycleKey: string;
  isPaidThisCycle: boolean;
  employeeRaw?: Employee;
}

export interface FinancialIntelligenceData {
  revenue: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  fixedExpensesDaily: number;
  variableExpensesDaily: number;
  rentCostDaily: number;
  loanCostDaily: number;
  expensesByCategory: Record<string, number>;
  breakevenProgressPct: number;
  monthlyGoalProgressPct: number;
  survivalTargetDaily: number;
  revenueNeededToday: number;
  projectedEomRevenue: number;
  projectedEomProfit: number;
  cashFlowForecast: {
    projectedInflowNext7Days: number;
    upcomingObligationsNext7Days: number;
    netProjectedPositionNext7Days: number;
  };
}

export interface OperationalHealthData {
  pendingOrdersCount: number;
  openGamingSessionsCount: number;
  totalStationsCount: number;
  bookableGamingStationsCount: number;
  activeStaffCount: number;
  unclosedOldShiftsCount: number;
}

export interface HealthScoreBreakdown {
  totalScore: number; // 0 to 100
  revenueGrowthScore: number; // max 25
  profitGrowthScore: number; // max 25
  footfallScore: number; // max 15
  averageSpendScore: number; // max 15
  occupancyScore: number; // max 10
  operationsScore: number; // max 10
  isDataSufficient: boolean;
  explanation: string;
  scoringRules: { label: string; score: number; max: number; description: string }[];
}

export interface PeriodBenchmarks {
  todayVsYesterday: { current: number; previous: number; pct: number | null; baselineAvailable: boolean };
  todayVsSameWeekdayLastWeek: { current: number; previous: number; pct: number | null; baselineAvailable: boolean };
  thisWeekVsLastWeek: { current: number; previous: number; pct: number | null; baselineAvailable: boolean };
  thisMonthVsLastMonth: { current: number; previous: number; pct: number | null; baselineAvailable: boolean };
  thisMonthVsSameMonthLastYear: { current: number; previous: number; pct: number | null; baselineAvailable: boolean };
  last30DaysTrend: number[];
  lifetimeBest: { date: string; amount: number; remainingToBeat: number };
  lifetimeWorst: { date: string; amount: number };
}

export interface OwnerBriefData {
  revenuePctChange: number | null;
  footfallPctChange: number | null;
  avgSpendDifference: number;
  highestRoiProduct: string;
  idleHoursThisMonth: number;
  totalPossibleHoursThisMonth: number;
  bestWeekdayTarget: number;
  bestWeekdayDate: string;
  bestWeekdayRemaining: number;
  bestWeekdayName: string;
  recommendedPriority: string;
}

export interface OwnerPulseDataPackage {
  todayStr: string;
  selectedDate: string;
  selectedPhase: string;
  ownerBrief: OwnerBriefData;
  healthBreakdown: HealthScoreBreakdown;
  executiveSummary: {
    revenueToday: MetricComparison;
    profitToday: MetricComparison;
    customersToday: MetricComparison;
    averageBill: MetricComparison;
    gamingOccupancy: MetricComparison;
    healthScore: MetricComparison;
  };
  periodBenchmarks: PeriodBenchmarks;
  revenueIntelligence: RevenueIntelligenceData;
  customerIntelligence: CustomerIntelligenceData;
  gamingIntelligence: GamingIntelligenceData;
  cafeIntelligence: CafeIntelligenceData;
  employeeIntelList: EmployeeIntelScorecard[];
  financialIntelligence: FinancialIntelligenceData;
  operationalHealth: OperationalHealthData;
  actionCentre: CeoActionRecommendation[];
  reconciliationReport: DataReconciliationReport;
  metricDictionary: Record<string, MetricDefinition>;
}

// ==========================================
// 3. TIMEZONE-SAFE HELPERS (ASIA/KOLKATA)
// ==========================================

export function parseBusinessDateToKolkataNoon(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return new Date();
  const [y, m, d] = parts;
  // 12:00 PM IST is 06:30 AM UTC
  return new Date(Date.UTC(y, m - 1, d, 6, 30, 0));
}

export function getElapsedOperatingHoursKolkata(referenceDate: Date = new Date()): number {
  const parts = getKolkataDateParts(referenceDate);
  const h = parts.hours;
  const m = parts.minutes;

  // Bistro Operating hours: 11:00 AM to 11:00 PM IST (12 hours)
  if (h < 11) return 0;
  if (h >= 23) return 12;
  return (h - 11) + (m / 60);
}

export function formatHourTo12H(hr: number | string): string {
  const h = typeof hr === 'string' ? parseInt(hr, 10) : hr;
  if (isNaN(h)) return 'N/A';
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

// ==========================================
// 4. CANONICAL CATEGORY RESOLVER
// ==========================================

export function resolveItemCategory(
  item: { name: string; price?: number; quantity?: number },
  foodItemsMap?: Map<string, FoodItem>
): CategoryRevenueItem['category'] {
  const rawName = item.name || '';
  const nameLwr = rawName.toLowerCase().trim();

  // 1. Try finding in foodItems database catalogue
  if (foodItemsMap) {
    const knownItem = foodItemsMap.get(nameLwr) || foodItemsMap.get(rawName);
    if (knownItem && knownItem.category) {
      const catLwr = knownItem.category.toLowerCase();
      if (catLwr.includes('coffee') || catLwr.includes('beverage') || catLwr.includes('tea') || catLwr.includes('latte')) {
        return 'Coffee';
      }
      if (catLwr.includes('dessert') || catLwr.includes('waffle') || catLwr.includes('brownie') || catLwr.includes('ice cream')) {
        return 'Desserts';
      }
      if (catLwr.includes('snack') || catLwr.includes('quick bite') || catLwr.includes('retail') || catLwr.includes('can')) {
        return 'Retail';
      }
      if (catLwr.includes('food') || catLwr.includes('main') || catLwr.includes('burger') || catLwr.includes('pizza') || catLwr.includes('fries') || catLwr.includes('sandwich') || catLwr.includes('maggie') || catLwr.includes('pasta')) {
        return 'Food';
      }
    }
  }

  // 2. Deterministic keyword matching rules
  if (
    nameLwr.includes('coffee') ||
    nameLwr.includes('latte') ||
    nameLwr.includes('cappuccino') ||
    nameLwr.includes('espresso') ||
    nameLwr.includes('americano') ||
    nameLwr.includes('mocha') ||
    nameLwr.includes('cold brew') ||
    nameLwr.includes('frappe') ||
    nameLwr.includes('tea') ||
    nameLwr.includes('chai')
  ) {
    return 'Coffee';
  }

  if (
    nameLwr.includes('waffle') ||
    nameLwr.includes('brownie') ||
    nameLwr.includes('cake') ||
    nameLwr.includes('dessert') ||
    nameLwr.includes('ice cream') ||
    nameLwr.includes('sundae') ||
    nameLwr.includes('cookie')
  ) {
    return 'Desserts';
  }

  if (
    nameLwr.includes('time:') ||
    nameLwr.includes('recharge') ||
    nameLwr.includes('pass') ||
    nameLwr.includes('gaming') ||
    nameLwr.includes('ps5') ||
    nameLwr.includes('ps4') ||
    nameLwr.includes('hour') ||
    nameLwr.includes('controller')
  ) {
    return 'Gaming';
  }

  if (nameLwr.includes('board game') || nameLwr.includes('boardgame') || nameLwr.includes('catan') || nameLwr.includes('chess')) {
    return 'Board Games';
  }

  if (nameLwr.includes('membership') || nameLwr.includes('tier') || nameLwr.includes('subscription')) {
    return 'Memberships';
  }

  if (nameLwr.includes('delivery') || nameLwr.includes('zomato') || nameLwr.includes('swiggy') || nameLwr.includes('packaging charge')) {
    return 'Delivery';
  }

  if (
    nameLwr.includes('snack') ||
    nameLwr.includes('can') ||
    nameLwr.includes('chips') ||
    nameLwr.includes('red bull') ||
    nameLwr.includes('monster') ||
    nameLwr.includes('water bottle') ||
    nameLwr.includes('coke') ||
    nameLwr.includes('pepsi')
  ) {
    return 'Retail';
  }

  return 'Food';
}

// ==========================================
// 5. DATA RECONCILIATION & QUALITY AUDITOR
// ==========================================

export function runDataReconciliation(
  bills: Bill[],
  foodItemsMap?: Map<string, FoodItem>
): DataReconciliationReport {
  let reconciledSalesTotal = 0;
  let itemizedRevenueTotal = 0;
  let invalidDatesCount = 0;
  let latestTimestampMs = 0;

  const seenBillIds = new Map<string, number>();
  const unmatchedTransactions: DataReconciliationReport['unmatchedTransactions'] = [];
  const categoryFailuresMap = new Map<string, { count: number; rev: number }>();

  bills.forEach((bill) => {
    // Audit bill ID duplicates
    const idCount = (seenBillIds.get(bill.id) || 0) + 1;
    seenBillIds.set(bill.id, idCount);

    // Audit timestamps
    if (!bill.timestamp) {
      invalidDatesCount++;
    } else {
      const ms = new Date(bill.timestamp).getTime();
      if (isNaN(ms)) {
        invalidDatesCount++;
      } else if (ms > latestTimestampMs) {
        latestTimestampMs = ms;
      }
    }

    const billTotal = bill.totalAmount || 0;
    reconciledSalesTotal += billTotal;

    // Check itemized components
    let billItemsSum = (bill.initialPackagePrice || 0);
    bill.items?.forEach((item) => {
      const itemRev = (item.price || 0) * (item.quantity || 1);
      billItemsSum += itemRev;

      // Track unmapped/ambiguous items
      const cat = resolveItemCategory(item, foodItemsMap);
      if (!cat) {
        const cur = categoryFailuresMap.get(item.name) || { count: 0, rev: 0 };
        categoryFailuresMap.set(item.name, { count: cur.count + (item.quantity || 1), rev: cur.rev + itemRev });
      }
    });

    const netCalculated = billItemsSum - (bill.discount || 0);
    itemizedRevenueTotal += netCalculated;

    // Discrepancy tolerance: 2 rupees for rounding
    if (Math.abs(billTotal - netCalculated) > 2) {
      unmatchedTransactions.push({
        billId: bill.id,
        reason: `Total (₹${billTotal}) does not match initial package + items - discount (₹${netCalculated}). Diff: ₹${billTotal - netCalculated}`,
        amount: Math.abs(billTotal - netCalculated),
      });
    }
  });

  const duplicateRecords: DataReconciliationReport['duplicateRecords'] = [];
  seenBillIds.forEach((occurrences, billId) => {
    if (occurrences > 1) {
      duplicateRecords.push({ billId, occurrences });
    }
  });

  const categoryMappingFailures: DataReconciliationReport['categoryMappingFailures'] = [];
  categoryFailuresMap.forEach((val, itemName) => {
    categoryMappingFailures.push({ itemName, count: val.count, revenue: val.rev });
  });

  const discrepancyAmount = Math.abs(reconciledSalesTotal - itemizedRevenueTotal);
  const nowMs = Date.now();
  const dataFreshnessMinutes = latestTimestampMs > 0 ? Math.max(0, Math.round((nowMs - latestTimestampMs) / (1000 * 60))) : 99999;

  let freshnessStatus: DataReconciliationReport['freshnessStatus'] = 'No Records';
  if (latestTimestampMs > 0) {
    if (dataFreshnessMinutes <= 120) freshnessStatus = 'Fresh';
    else if (dataFreshnessMinutes <= 720) freshnessStatus = 'Normal';
    else freshnessStatus = 'Stale';
  }

  return {
    dataFreshnessMinutes,
    freshnessStatus,
    lastRecordedBillTime: latestTimestampMs > 0 ? new Date(latestTimestampMs).toISOString() : null,
    totalBillsAudited: bills.length,
    reconciledSalesTotal: Math.round(reconciledSalesTotal),
    itemizedRevenueTotal: Math.round(itemizedRevenueTotal),
    discrepancyAmount: Math.round(discrepancyAmount),
    isFullyReconciled: discrepancyAmount <= 5 && duplicateRecords.length === 0,
    unmatchedTransactions,
    categoryMappingFailures,
    duplicateRecords,
    invalidDatesCount,
    unclosedHistoricalShiftsCount: 0,
  };
}

// ==========================================
// 6. HEALTH SCORE COMPUTATION (TRANSPARENT & REAL-DATA ONLY)
// ==========================================

export function computeTransparentHealthScore(params: {
  revToday: number;
  revYesterday: number;
  revTarget: number;
  profitToday: number;
  customersToday: number;
  avgBillToday: number;
  gamingOccupancyToday: number;
  activeStaffCount: number;
  totalBillsToday: number;
}): HealthScoreBreakdown {
  const {
    revToday,
    revYesterday,
    revTarget,
    profitToday,
    customersToday,
    avgBillToday,
    gamingOccupancyToday,
    activeStaffCount,
    totalBillsToday,
  } = params;

  const isDataSufficient = totalBillsToday > 0 || revToday > 0;

  if (!isDataSufficient) {
    return {
      totalScore: 0,
      revenueGrowthScore: 0,
      profitGrowthScore: 0,
      footfallScore: 0,
      averageSpendScore: 0,
      occupancyScore: 0,
      operationsScore: 0,
      isDataSufficient: false,
      explanation: 'No transactions recorded for the selected business date yet. Health score cannot be evaluated without live or historical activity.',
      scoringRules: [
        { label: 'Revenue Velocity', score: 0, max: 25, description: 'Requires daily revenue transactions' },
        { label: 'Profit & Target Achievement', score: 0, max: 25, description: 'Requires revenue vs survival target comparison' },
        { label: 'Customer Footfall', score: 0, max: 15, description: 'Requires recorded customer visits' },
        { label: 'Average Order Value', score: 0, max: 15, description: 'Requires bill intake' },
        { label: 'Gaming Station Occupancy', score: 0, max: 10, description: 'Requires active or logged console sessions' },
        { label: 'Operational Readiness', score: 0, max: 10, description: 'Requires logged active staff' },
      ],
    };
  }

  // 1. Revenue Velocity (Max 25 points)
  let revenueGrowthScore = 0;
  if (revToday > 0) {
    revenueGrowthScore += 10; // Baseline for active revenue
    if (revYesterday > 0 && revToday >= revYesterday) {
      revenueGrowthScore += 8; // Exceeding yesterday
    } else if (revYesterday === 0) {
      revenueGrowthScore += 5;
    }
    if (revTarget > 0 && revToday >= revTarget) {
      revenueGrowthScore += 7; // Met daily target
    } else if (revTarget > 0 && revToday >= revTarget * 0.7) {
      revenueGrowthScore += 4;
    }
  }

  // 2. Profit Growth Score (Max 25 points)
  let profitGrowthScore = 0;
  if (profitToday > 0) {
    profitGrowthScore += 15;
    if (profitToday >= 2000) profitGrowthScore += 10;
    else if (profitToday >= 1000) profitGrowthScore += 5;
  } else if (profitToday === 0 && revToday > 0) {
    profitGrowthScore += 8; // Break-even
  }

  // 3. Footfall Score (Max 15 points - based on 25 customer benchmark)
  const footfallScore = Math.min(15, Math.round((customersToday / 25) * 15));

  // 4. Average Spend Score (Max 15 points - based on ₹350 benchmark)
  const averageSpendScore = Math.min(15, Math.round((avgBillToday / 350) * 15));

  // 5. Occupancy Score (Max 10 points - based on 70% benchmark)
  const occupancyScore = Math.min(10, Math.round((gamingOccupancyToday / 70) * 10));

  // 6. Operations Score (Max 10 points)
  let operationsScore = 0;
  if (activeStaffCount >= 1) operationsScore += 5;
  if (totalBillsToday > 0) operationsScore += 5;

  const totalScore = Math.min(100, Math.max(0, revenueGrowthScore + profitGrowthScore + footfallScore + averageSpendScore + occupancyScore + operationsScore));

  const explanation = `Score evaluated from live business data: Revenue intake contributed ${revenueGrowthScore}/25, Profitability ${profitGrowthScore}/25, Footfall ${footfallScore}/15, AOV ${averageSpendScore}/15, Gaming Occupancy ${occupancyScore}/10, and Operations ${operationsScore}/10.`;

  return {
    totalScore,
    revenueGrowthScore,
    profitGrowthScore,
    footfallScore,
    averageSpendScore,
    occupancyScore,
    operationsScore,
    isDataSufficient: true,
    explanation,
    scoringRules: [
      { label: 'Revenue Velocity', score: revenueGrowthScore, max: 25, description: `₹${revToday.toLocaleString()} recorded today (vs target ₹${revTarget.toLocaleString()})` },
      { label: 'Profit & Target Achievement', score: profitGrowthScore, max: 25, description: `Net intake ₹${profitToday.toLocaleString()}` },
      { label: 'Customer Footfall', score: footfallScore, max: 15, description: `${customersToday} customers served today` },
      { label: 'Average Order Value', score: averageSpendScore, max: 15, description: `₹${avgBillToday} avg bill vs ₹350 target` },
      { label: 'Gaming Station Occupancy', score: occupancyScore, max: 10, description: `${gamingOccupancyToday}% console occupancy` },
      { label: 'Operational Readiness', score: operationsScore, max: 10, description: `${activeStaffCount} staff active` },
    ],
  };
}

// ==========================================
// 7. DETERMINISTIC CEO ACTION CENTRE RULES ENGINE
// ==========================================

export function generateDeterministicCeoActions(params: {
  revToday: number;
  revYesterday: number;
  revTarget: number;
  gamingOccupancyToday: number;
  idleHoursTotal: number;
  potentialGamingHours: number;
  foodAttachmentRatePct: number;
  coffeeAttachmentRatePct: number;
  pendingBillsCount: number;
  customersToday: number;
  customersYesterday: number;
  lowStockItemsCount: number;
  reportingDateStr: string;
}): CeoActionRecommendation[] {
  const {
    revToday,
    revYesterday,
    revTarget,
    gamingOccupancyToday,
    idleHoursTotal,
    potentialGamingHours,
    foodAttachmentRatePct,
    coffeeAttachmentRatePct,
    pendingBillsCount,
    customersToday,
    customersYesterday,
    lowStockItemsCount,
    reportingDateStr,
  } = params;

  const actions: CeoActionRecommendation[] = [];

  // Rule 1: Low Gaming Occupancy with High Idle Capacity
  if (potentialGamingHours >= 6 && gamingOccupancyToday < 50) {
    const recoverableHours = Math.round(idleHoursTotal * 0.4);
    const expectedImpact = recoverableHours * 150; // ₹150/hr average console intake
    actions.push({
      id: 'action-boost-gaming-occupancy',
      category: 'Gaming',
      priority: 'High',
      severity: 'Warning',
      color: 'amber',
      title: 'Monetize Off-Peak Gaming Capacity',
      reason: `Gaming console occupancy is at ${gamingOccupancyToday}%, with ${idleHoursTotal} idle console station-hours available.`,
      suggestedAction: 'Activate a 2-Hour Off-Peak Gaming Flash Pass (e.g. ₹299 combo) for walk-ins between 2 PM and 6 PM.',
      evidence: `Live console utilization is ${gamingOccupancyToday}% against target baseline 70%. Total idle hours: ${idleHoursTotal} hrs.`,
      reportingPeriod: reportingDateStr,
      expectedImpact: `+₹${expectedImpact.toLocaleString()} potential incremental revenue`,
      impactCalculationFormula: `${recoverableHours} estimated converted hours * ₹150 avg hourly controller rate`,
      confidence: 'High',
      assumptions: 'Assuming 40% of available idle capacity can be captured through a targeted afternoon pass.',
      status: 'New',
      outcomeMetric: 'Gaming Occupancy %',
      actionUrl: '/dashboard',
      actionText: 'Manage Gaming Passes',
    });
  }

  // Rule 2: Low F&B Attachment Rate to Gamers
  if (foodAttachmentRatePct < 30) {
    actions.push({
      id: 'action-improve-fb-attachment',
      category: 'Cafe',
      priority: 'Medium',
      severity: 'Opportunity',
      color: 'blue',
      title: 'Drive Café Upsell on Gaming Check-in',
      reason: `Food attachment rate is only ${foodAttachmentRatePct}%, indicating most gamers play without ordering snacks or refreshments.`,
      suggestedAction: 'Instruct staff to prompt every gaming group with the Gamer Fuel Combo (Fries + Cold Brew at 15% bundle discount).',
      evidence: `Only ${foodAttachmentRatePct}% of gaming sessions ordered food items on ${reportingDateStr}.`,
      reportingPeriod: reportingDateStr,
      expectedImpact: `+₹180 Average Order Value boost per gaming bill`,
      impactCalculationFormula: `Estimated 60% of gaming bills adding an average ₹300 combo with 60% margin = ₹180 AOV increase`,
      confidence: 'Medium',
      assumptions: 'Gamer footfall responds positively to verbal staff recommendation upon station assignment.',
      status: 'New',
      outcomeMetric: 'Food Attachment Rate %',
      actionUrl: '/settings',
      actionText: 'View Menu & Combos',
    });
  }

  // Rule 3: Daily Survival Target Deficit
  if (revTarget > 0 && revToday < revTarget) {
    const deficit = revTarget - revToday;
    actions.push({
      id: 'action-close-daily-deficit',
      category: 'Revenue',
      priority: 'Critical',
      severity: 'Critical',
      color: 'red',
      title: 'Close Daily Survival Gap',
      reason: `Current revenue (₹${revToday.toLocaleString()}) trails daily survival threshold of ₹${revTarget.toLocaleString()} by ₹${deficit.toLocaleString()}.`,
      suggestedAction: 'Push high-margin coffee/dessert upsells and offer extended gaming passes before shift close.',
      evidence: `Daily fixed overhead allocation requires ₹${revTarget.toLocaleString()}; realized is ₹${revToday.toLocaleString()}.`,
      reportingPeriod: reportingDateStr,
      expectedImpact: `₹${deficit.toLocaleString()} to reach operational break-even today`,
      impactCalculationFormula: `Deficit = Survival Target (₹${revTarget}) - Revenue (₹${revToday})`,
      confidence: 'High',
      assumptions: 'Fixed daily burden (rent + loan + base labor) must be amortized daily.',
      status: 'New',
      outcomeMetric: 'Daily Revenue ₹',
      actionUrl: '/financials',
      actionText: 'Review Financial Burden',
    });
  }

  // Rule 4: Unpaid / Pending Orders Risk
  if (pendingBillsCount > 0) {
    actions.push({
      id: 'action-audit-pending-bills',
      category: 'Operations',
      priority: 'High',
      severity: 'Critical',
      color: 'red',
      title: 'Resolve Unsettled Pending Bills',
      reason: `${pendingBillsCount} order(s) remain in pending settlement status, risking revenue leakage or forgotten payments.`,
      suggestedAction: 'Review open bills on the dashboard immediately and reconcile with staff shift payments.',
      evidence: `${pendingBillsCount} bill(s) marked with paymentMethod === "pending".`,
      reportingPeriod: reportingDateStr,
      expectedImpact: `Prevent 100% loss on unsettled bills`,
      impactCalculationFormula: `Uncollected revenue recovered immediately upon payment method resolution.`,
      confidence: 'High',
      assumptions: 'Customers are still present or contact information is logged on the bill.',
      status: 'New',
      outcomeMetric: 'Pending Bills Count',
      actionUrl: '/dashboard',
      actionText: 'View Open Orders',
    });
  }

  // Rule 5: Raw Material / Inventory Low Stock
  if (lowStockItemsCount > 0) {
    actions.push({
      id: 'action-reorder-low-stock',
      category: 'Cafe',
      priority: 'Medium',
      severity: 'Warning',
      color: 'amber',
      title: 'Replenish Low Stock Raw Materials',
      reason: `${lowStockItemsCount} menu or raw material item(s) have fallen below their safety buffer thresholds.`,
      suggestedAction: 'Create purchase request for low stock items to prevent menu stock-outs during peak weekend shifts.',
      evidence: `${lowStockItemsCount} items currently marked at or below lowStockThreshold.`,
      reportingPeriod: reportingDateStr,
      expectedImpact: 'Eliminate stock-out revenue losses on top café sellers',
      impactCalculationFormula: 'Avoided stock-out lost orders estimated at 5-10 orders per item per day.',
      confidence: 'High',
      assumptions: 'Suppliers can fulfill orders within standard 24-48 hour lead times.',
      status: 'New',
      outcomeMetric: 'Stock-out Incidents',
      actionUrl: '/settings',
      actionText: 'Open Raw Materials Hub',
    });
  }

  return actions;
}

// ==========================================
// 8. MASTER COMPUTATION FUNCTION
// ==========================================

export function computeUnifiedOwnerPulseData(
  bills: Bill[],
  expenses: Expense[],
  stations: Station[],
  employees: Employee[],
  shifts: Shift[],
  members: Member[],
  fixedBills: FixedBill[],
  liabilityState: LiabilityState | null,
  appSettings: Settings | null,
  foodItems: FoodItem[] = [],
  rawMaterials: RawMaterial[] = [],
  targetDate?: Date | string,
  selectedPhase: string = 'all_cycles'
): OwnerPulseDataPackage {
  // 1. Establish Canonical Reporting Date in Asia/Kolkata
  const todayStr = targetDate ? getBusinessDate(targetDate, true) : getBusinessDate(new Date());
  const refDate = parseBusinessDateToKolkataNoon(todayStr);

  // 2. Pre-filter by phase/cycle if requested
  const phaseBills = selectedPhase === 'all_cycles' ? bills : bills.filter((b) => b.cycle === selectedPhase);
  const phaseExpenses = selectedPhase === 'all_cycles' ? expenses : expenses.filter((e) => e.cycle === selectedPhase);

  // Index food items for instant category resolution
  const foodItemsMap = new Map<string, FoodItem>();
  foodItems.forEach((f) => {
    foodItemsMap.set(f.name.toLowerCase().trim(), f);
  });

  // Group bills by business date
  const billsByDate = new Map<string, Bill[]>();
  phaseBills.forEach((b) => {
    if (!b.timestamp) return;
    const bDate = getBusinessDate(b.timestamp);
    const arr = billsByDate.get(bDate) || [];
    arr.push(b);
    billsByDate.set(bDate, arr);
  });

  // Group expenses by business date
  const expensesByDate = new Map<string, Expense[]>();
  phaseExpenses.forEach((e) => {
    if (!e.timestamp) return;
    const eDate = getBusinessDate(e.timestamp);
    const arr = expensesByDate.get(eDate) || [];
    arr.push(e);
    expensesByDate.set(eDate, arr);
  });

  const dailyTotal = (dateStr: string) => {
    return (billsByDate.get(dateStr) || []).reduce((s, b) => s + (b.totalAmount || 0), 0);
  };

  const dailyBillsList = (dateStr: string) => {
    return billsByDate.get(dateStr) || [];
  };

  const dailyExpenseTotal = (dateStr: string) => {
    return (expensesByDate.get(dateStr) || []).reduce((s, e) => s + (e.amount || 0), 0);
  };

  // Helper date calculations based on Business Dates in Asia/Kolkata
  const yesterdayStr = getBusinessDate(subDays(refDate, 1), true);
  const sameWeekdayLastWeekStr = getBusinessDate(subWeeks(refDate, 1), true);

  // Today metrics
  const todayBills = dailyBillsList(todayStr);
  const revToday = dailyTotal(todayStr);
  const expToday = dailyExpenseTotal(todayStr);
  const profitToday = revToday - expToday;
  const customersToday = todayBills.reduce((s, b) => s + Math.max(1, b.members?.length || 1), 0);
  const avgBillToday = todayBills.length > 0 ? Math.round(revToday / todayBills.length) : 0;

  // Yesterday metrics
  const yesterdayBills = dailyBillsList(yesterdayStr);
  const revYesterday = dailyTotal(yesterdayStr);
  const expYesterday = dailyExpenseTotal(yesterdayStr);
  const profitYesterday = revYesterday - expYesterday;
  const customersYesterday = yesterdayBills.reduce((s, b) => s + Math.max(1, b.members?.length || 1), 0);
  const avgBillYesterday = yesterdayBills.length > 0 ? Math.round(revYesterday / yesterdayBills.length) : 0;

  // Station counts: Distinguish gaming consoles (PS5, PS4, Retrogaming) vs boardgame tables
  const bookableGamingStations = stations.filter((s) => s.type === 'ps5' || s.type === 'ps4' || s.type === 'retrogaming');
  const totalBookableStations = Math.max(1, bookableGamingStations.length > 0 ? bookableGamingStations.length : stations.length);
  const ps5Stations = stations.filter((s) => s.type === 'ps5');
  const totalPs5Count = Math.max(1, ps5Stations.length);

  const elapsedHours = getElapsedOperatingHoursKolkata(refDate);

  // Yesterday gaming occupancy
  let yesterdayGamingMinutes = 0;
  yesterdayBills.forEach((b) => {
    if (b.stationName) {
      if (b.packageName && b.packageName.toLowerCase().includes('hour')) {
        const hours = parseInt(b.packageName, 10) || 1;
        yesterdayGamingMinutes += hours * 60;
      } else {
        yesterdayGamingMinutes += 60;
      }
    }
  });
  const yesterdayGamingHours = Math.round(yesterdayGamingMinutes / 60);
  const potentialGamingHoursYesterday = 12 * totalBookableStations;
  const gamingOccupancyYesterday = potentialGamingHoursYesterday > 0
    ? Math.min(100, Math.round((yesterdayGamingHours / potentialGamingHoursYesterday) * 100))
    : 0;

  // Today gaming session calculations
  let todayGamingMinutes = 0;
  let totalGamingSessions = 0;
  const packageCounts: Record<string, number> = {};
  const consoleCounts: Record<string, number> = {};

  todayBills.forEach((b) => {
    if (b.stationName) {
      consoleCounts[b.stationName] = (consoleCounts[b.stationName] || 0) + 1;
      totalGamingSessions++;
      if (b.packageName && b.packageName.toLowerCase().includes('hour')) {
        const hours = parseInt(b.packageName, 10) || 1;
        todayGamingMinutes += hours * 60;
      } else {
        todayGamingMinutes += 60;
      }
    }
    if (b.packageName) {
      packageCounts[b.packageName] = (packageCounts[b.packageName] || 0) + 1;
    }
  });

  const hoursPlayedToday = Math.round(todayGamingMinutes / 60);
  const potentialGamingHoursToday = Math.round(elapsedHours * totalBookableStations);
  const idleHoursToday = Math.max(0, potentialGamingHoursToday - hoursPlayedToday);

  const inUseStations = stations.filter((s) => s.status === 'in-use' || s.status === 'finishing').length;
  const gamingOccupancyToday = potentialGamingHoursToday > 0
    ? Math.min(100, Math.round((hoursPlayedToday / potentialGamingHoursToday) * 100))
    : (stations.length > 0 ? Math.round((inUseStations / stations.length) * 100) : 0);

  // Survival target calculation
  let survivalTargetDaily = 3000;
  let rentDaily = 1667;
  let loanDaily = 0;
  if (liabilityState) {
    rentDaily = Math.round((liabilityState.monthlyRent || 50000) / 30);
    loanDaily = Math.round(((liabilityState.loanBalance || 0) * 0.0075) / 30);
    survivalTargetDaily = Math.round(rentDaily + loanDaily + 1000);
  }

  // Active staff: Filter strictly for active shifts within last 16 hours to eliminate historical ghost shifts
  const sixteenHoursAgoMs = Date.now() - (16 * 60 * 60 * 1000);
  const trulyActiveShifts = shifts.filter((s) => {
    if (s.status === 'active' || !s.endTime) {
      if (!s.startTime) return false;
      const startMs = new Date(s.startTime).getTime();
      return startMs >= sixteenHoursAgoMs;
    }
    return false;
  });
  const unclosedOldShiftsCount = shifts.filter((s) => (s.status === 'active' || !s.endTime) && s.startTime && new Date(s.startTime).getTime() < sixteenHoursAgoMs).length;
  const activeStaffCount = trulyActiveShifts.length;

  // 1. Health Score
  const healthBreakdown = computeTransparentHealthScore({
    revToday,
    revYesterday,
    revTarget: survivalTargetDaily,
    profitToday,
    customersToday,
    avgBillToday,
    gamingOccupancyToday,
    activeStaffCount,
    totalBillsToday: todayBills.length,
  });

  // 2. Metric Builder helper
  const buildMetric = (
    current: number,
    previous: number,
    target?: number,
    lastMonth?: number
  ): MetricComparison => {
    const hasData = current > 0 || previous > 0;
    const absDiff = current - previous;
    const pctDiff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? null : 0);
    const trend = absDiff > 0 ? 'up' : absDiff < 0 ? 'down' : 'neutral';

    let status: StatusLevel = 'Healthy';
    let color: StatusColor = 'green';

    if (!hasData) {
      status = 'No Data';
      color = 'grey';
    } else if (pctDiff !== null && pctDiff > 10) {
      status = 'Growing';
      color = 'blue';
    } else if (pctDiff !== null && pctDiff < -15) {
      status = 'Needs Attention';
      color = 'red';
    } else if (pctDiff !== null && pctDiff < 0) {
      status = 'Monitor';
      color = 'amber';
    }

    const lastMonthPctDiff = lastMonth !== undefined
      ? (lastMonth > 0 ? Math.round(((current - lastMonth) / lastMonth) * 100) : (current > 0 ? null : 0))
      : undefined;

    const targetProgressPct = target && target > 0 ? Math.min(100, Math.round((current / target) * 100)) : undefined;

    return {
      current,
      previous,
      absDiff,
      pctDiff,
      trend,
      status,
      color,
      target,
      targetProgressPct,
      lastMonth,
      lastMonthPctDiff,
      hasData,
    };
  };

  const executiveSummary = {
    revenueToday: buildMetric(revToday, revYesterday, survivalTargetDaily),
    profitToday: buildMetric(profitToday, profitYesterday),
    customersToday: buildMetric(customersToday, customersYesterday, 25),
    averageBill: buildMetric(avgBillToday, avgBillYesterday, 350),
    gamingOccupancy: buildMetric(gamingOccupancyToday, gamingOccupancyYesterday, 70),
    healthScore: buildMetric(healthBreakdown.totalScore, 70, 85),
  };

  // 3. Multi-Period Benchmarks
  const revSameWeekdayLastWk = dailyTotal(sameWeekdayLastWeekStr);

  const startThisWkNoon = startOfWeek(refDate, { weekStartsOn: 1 });
  const startLastWkNoon = startOfWeek(subWeeks(refDate, 1), { weekStartsOn: 1 });
  const sameWeekdayLastWkNoon = subWeeks(refDate, 1);

  let thisWkRev = 0;
  let curr = new Date(startThisWkNoon);
  while (curr <= refDate) {
    thisWkRev += dailyTotal(getBusinessDate(curr, true));
    curr = subDays(curr, -1);
  }

  let lastWkRev = 0;
  curr = new Date(startLastWkNoon);
  while (curr <= sameWeekdayLastWkNoon) {
    lastWkRev += dailyTotal(getBusinessDate(curr, true));
    curr = subDays(curr, -1);
  }

  const startThisMoNoon = startOfMonth(refDate);
  const startLastMoNoon = startOfMonth(subMonths(refDate, 1));
  const sameDayLastMoNoon = subMonths(refDate, 1);

  let thisMoRev = 0;
  curr = new Date(startThisMoNoon);
  while (curr <= refDate) {
    thisMoRev += dailyTotal(getBusinessDate(curr, true));
    curr = subDays(curr, -1);
  }

  let lastMoElapsedRev = 0;
  curr = new Date(startLastMoNoon);
  while (curr <= sameDayLastMoNoon) {
    lastMoElapsedRev += dailyTotal(getBusinessDate(curr, true));
    curr = subDays(curr, -1);
  }

  const startSameMoLastYrNoon = startOfMonth(subYears(refDate, 1));
  const endSameMoLastYrNoon = endOfMonth(subYears(refDate, 1));
  let sameMoLastYrRev = 0;
  curr = new Date(startSameMoLastYrNoon);
  while (curr <= endSameMoLastYrNoon) {
    sameMoLastYrRev += dailyTotal(getBusinessDate(curr, true));
    curr = subDays(curr, -1);
  }

  const last30DaysTrend: number[] = [];
  let lifetimeBestRaw = { date: todayStr, amount: 0 };
  let lifetimeWorst = { date: todayStr, amount: Infinity };

  for (let i = 29; i >= 0; i--) {
    const dStr = getBusinessDate(subDays(refDate, i), true);
    const val = dailyTotal(dStr);
    last30DaysTrend.push(val);
  }

  billsByDate.forEach((dayBills, dStr) => {
    const sum = dayBills.reduce((s, b) => s + b.totalAmount, 0);
    if (sum > lifetimeBestRaw.amount) lifetimeBestRaw = { date: formatDateDDMMYYYY(dStr), amount: sum };
    if (sum < lifetimeWorst.amount && sum > 0) lifetimeWorst = { date: formatDateDDMMYYYY(dStr), amount: sum };
  });

  if (lifetimeWorst.amount === Infinity) lifetimeWorst = { date: formatDateDDMMYYYY(todayStr), amount: 0 };
  if (lifetimeBestRaw.amount === 0) lifetimeBestRaw = { date: formatDateDDMMYYYY(todayStr), amount: 0 };

  const lifetimeBest = {
    date: lifetimeBestRaw.date,
    amount: lifetimeBestRaw.amount,
    remainingToBeat: Math.max(0, lifetimeBestRaw.amount + 1 - revToday),
  };

  const periodBenchmarks: PeriodBenchmarks = {
    todayVsYesterday: {
      current: revToday,
      previous: revYesterday,
      pct: revYesterday > 0 ? Math.round(((revToday - revYesterday) / revYesterday) * 100) : (revToday > 0 ? null : 0),
      baselineAvailable: revYesterday > 0,
    },
    todayVsSameWeekdayLastWeek: {
      current: revToday,
      previous: revSameWeekdayLastWk,
      pct: revSameWeekdayLastWk > 0 ? Math.round(((revToday - revSameWeekdayLastWk) / revSameWeekdayLastWk) * 100) : (revToday > 0 ? null : 0),
      baselineAvailable: revSameWeekdayLastWk > 0,
    },
    thisWeekVsLastWeek: {
      current: thisWkRev,
      previous: lastWkRev,
      pct: lastWkRev > 0 ? Math.round(((thisWkRev - lastWkRev) / lastWkRev) * 100) : (thisWkRev > 0 ? null : 0),
      baselineAvailable: lastWkRev > 0,
    },
    thisMonthVsLastMonth: {
      current: thisMoRev,
      previous: lastMoElapsedRev,
      pct: lastMoElapsedRev > 0 ? Math.round(((thisMoRev - lastMoElapsedRev) / lastMoElapsedRev) * 100) : (thisMoRev > 0 ? null : 0),
      baselineAvailable: lastMoElapsedRev > 0,
    },
    thisMonthVsSameMonthLastYear: {
      current: thisMoRev,
      previous: sameMoLastYrRev,
      pct: sameMoLastYrRev > 0 ? Math.round(((thisMoRev - sameMoLastYrRev) / sameMoLastYrRev) * 100) : (thisMoRev > 0 ? null : 0),
      baselineAvailable: sameMoLastYrRev > 0,
    },
    last30DaysTrend,
    lifetimeBest,
    lifetimeWorst,
  };

  // 4. Category Revenue Breakdown
  // Compute across both today and selected period to eliminate "Category revenue showing zero despite recorded sales"
  const targetBillsForCategories = todayBills.length > 0 ? todayBills : phaseBills;
  const isPeriodFallback = todayBills.length === 0 && phaseBills.length > 0;

  const categoryRevMap: Record<CategoryRevenueItem['category'], { rev: number; count: number }> = {
    Gaming: { rev: 0, count: 0 },
    Food: { rev: 0, count: 0 },
    Coffee: { rev: 0, count: 0 },
    Desserts: { rev: 0, count: 0 },
    Retail: { rev: 0, count: 0 },
    Memberships: { rev: 0, count: 0 },
    'Board Games': { rev: 0, count: 0 },
    Delivery: { rev: 0, count: 0 },
  };

  targetBillsForCategories.forEach((bill) => {
    if (bill.initialPackagePrice > 0) {
      categoryRevMap.Gaming.rev += bill.initialPackagePrice;
      categoryRevMap.Gaming.count += 1;
    }

    bill.items?.forEach((item) => {
      const cat = resolveItemCategory(item, foodItemsMap);
      const itemRev = (item.price || 0) * (item.quantity || 1);
      categoryRevMap[cat].rev += itemRev;
      categoryRevMap[cat].count += (item.quantity || 1);
    });
  });

  const totalCategoryRev = Math.max(1, Object.values(categoryRevMap).reduce((s, c) => s + c.rev, 0));

  const categories: CategoryRevenueItem[] = Object.entries(categoryRevMap).map(([catName, val]) => {
    const category = catName as CategoryRevenueItem['category'];
    const contributionPct = Math.round((val.rev / totalCategoryRev) * 100);
    const aov = val.count > 0 ? Math.round(val.rev / val.count) : 0;
    return {
      category,
      revenue: Math.round(val.rev),
      contributionPct,
      aov,
      ordersCount: val.count,
      hasRecordedSales: val.rev > 0,
    };
  });

  const sortedCatByRev = [...categories].sort((a, b) => b.revenue - a.revenue);
  const topGrowthCategory = sortedCatByRev[0]?.category || 'Gaming';
  const worstPerformingCategory = sortedCatByRev[sortedCatByRev.length - 1]?.category || 'Delivery';

  const revenueSplit = {
    gaming: categoryRevMap.Gaming.rev,
    food: categoryRevMap.Food.rev + categoryRevMap.Desserts.rev,
    coffee: categoryRevMap.Coffee.rev,
    other: categoryRevMap.Retail.rev + categoryRevMap.Memberships.rev + categoryRevMap['Board Games'].rev + categoryRevMap.Delivery.rev,
  };

  const revenuePerOperatingHour = elapsedHours > 0 ? Math.round(revToday / elapsedHours) : 0;

  // Weekday performance
  const weekdayTotals: Record<string, { total: number; count: number }> = {};
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  WEEKDAYS.forEach((w) => {
    weekdayTotals[w] = { total: 0, count: 0 };
  });

  billsByDate.forEach((dayBills, dStr) => {
    const noonD = parseBusinessDateToKolkataNoon(dStr);
    const dayOfWeek = WEEKDAYS[noonD.getUTCDay()];
    const sum = dayBills.reduce((s, b) => s + b.totalAmount, 0);
    weekdayTotals[dayOfWeek].total += sum;
    weekdayTotals[dayOfWeek].count += 1;
  });

  const sortedWeekdays = Object.entries(weekdayTotals).sort((a, b) => {
    const avgA = a[1].count > 0 ? a[1].total / a[1].count : 0;
    const avgB = b[1].count > 0 ? b[1].total / b[1].count : 0;
    return avgB - avgA;
  });

  const bestPerformingWeekday = sortedWeekdays[0]?.[0] || 'Saturday';
  const slowestWeekday = sortedWeekdays[sortedWeekdays.length - 1]?.[0] || 'Monday';

  const totalPeriodRevenue = phaseBills.reduce((s, b) => s + (b.totalAmount || 0), 0);

  const revenueIntelligence: RevenueIntelligenceData = {
    categories,
    topGrowthCategory,
    worstPerformingCategory,
    totalRevenue: revToday,
    periodTotalRevenue: totalPeriodRevenue,
    totalExpenses: expToday,
    totalProfit: profitToday,
    revenuePerOperatingHour,
    revenueSplit,
    bestPerformingWeekday,
    slowestWeekday,
    reportingPeriodName: isPeriodFallback ? `${selectedPhase} (Historical)` : `Business Day: ${todayStr}`,
  };

  // 5. Customer Intelligence Data
  const memberIdsSet = new Set(members.map((m) => m.id));
  let newCustCount = 0;
  let returningCustCount = 0;
  let memberVisits = 0;
  let walkinVisits = 0;
  let gamingGamersCount = 0;
  let memberRev = 0;

  todayBills.forEach((b) => {
    let billMemberCount = 0;
    let billGuestCount = 0;

    if (b.members && b.members.length > 0) {
      b.members.forEach((m) => {
        const isGuest = !m.id || m.id.startsWith('guest') || (m.name && m.name.toLowerCase().includes('guest')) || !memberIdsSet.has(m.id);
        if (isGuest) {
          billGuestCount++;
        } else {
          billMemberCount++;
        }
      });
    } else {
      billGuestCount = 1;
    }

    memberVisits += billMemberCount;
    returningCustCount += billMemberCount;
    walkinVisits += billGuestCount;
    newCustCount += billGuestCount;

    if (b.initialPackagePrice && b.initialPackagePrice > 0) {
      gamingGamersCount += (billMemberCount + billGuestCount);
    }

    const totalBillCusts = billMemberCount + billGuestCount;
    if (totalBillCusts > 0) {
      memberRev += b.totalAmount * (billMemberCount / totalBillCusts);
    }
  });

  const totalCusts = newCustCount + returningCustCount;
  const repeatRatePct = totalCusts > 0 ? Math.round((returningCustCount / totalCusts) * 100) : 0;
  const avgSpendPerCustomer = totalCusts > 0 ? Math.round(revToday / totalCusts) : 0;
  const memberRevenuePct = revToday > 0 ? Math.round((memberRev / revToday) * 100) : 0;
  const avgRevenuePerGamer = gamingGamersCount > 0 ? Math.round(categoryRevMap.Gaming.rev / gamingGamersCount) : 0;

  const totalMemberSpentSum = members.reduce((s, m) => s + (m.totalSpent || 0), 0);
  const customerLifetimeValue = members.length > 0 ? Math.round(totalMemberSpentSum / members.length) : 0;

  // Visit Habits
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<string, number> = {};
  phaseBills.forEach((b) => {
    if (!b.timestamp) return;
    const parts = getKolkataDateParts(b.timestamp);
    hourCounts[parts.hours] = (hourCounts[parts.hours] || 0) + 1;
    const day = WEEKDAYS[new Date(b.timestamp).getDay()];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const peakHr = sortedHours[0] ? formatHourTo12H(sortedHours[0][0]) : 'N/A';
  const peakDay = sortedDays[0] ? sortedDays[0][0] : 'N/A';

  const sortedMembersBySpend = [...members].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  const highestSpendingCustomer = sortedMembersBySpend[0]
    ? { name: sortedMembersBySpend[0].name, amount: sortedMembersBySpend[0].totalSpent || 0 }
    : null;

  // Retention Cohorts (7d, 30d, 90d)
  const computeRetentionCohort = (days: number): CustomerRetentionCohort => {
    const cutoffDate = subDays(refDate, days);
    const eligibleMembers = members.filter((m) => m.joinDate && new Date(m.joinDate) <= cutoffDate);
    const returnedCount = eligibleMembers.filter((m) => (m.recharges?.length || 0) > 1 || (m.totalSpent || 0) > 500).length;
    const retentionRatePct = eligibleMembers.length > 0 ? Math.round((returnedCount / eligibleMembers.length) * 100) : 0;
    return {
      periodDays: days,
      eligibleCustomers: eligibleMembers.length,
      returnedCustomers: returnedCount,
      retentionRatePct,
    };
  };

  const loyaltyBitsOutstanding = members.reduce((s, m) => s + (m.bitsBalance || 0), 0);

  const customerIntelligence: CustomerIntelligenceData = {
    newCustomers: newCustCount,
    returningCustomers: returningCustCount,
    memberVisits,
    walkinVisits,
    repeatRatePct,
    avgSpendPerCustomer,
    avgSpendSampleSize: totalCusts,
    avgRevenuePerGamer,
    memberRevenuePct,
    mostPopularVisitTime: peakHr,
    mostPopularDay: peakDay,
    highestSpendingCustomer,
    highestReturningCustomer: sortedMembersBySpend[0] ? { name: sortedMembersBySpend[0].name, visits: sortedMembersBySpend[0].recharges?.length || 1 } : null,
    customerLifetimeValue,
    retentionCohorts: {
      sevenDay: computeRetentionCohort(7),
      thirtyDay: computeRetentionCohort(30),
      ninetyDay: computeRetentionCohort(90),
    },
    loyaltyBits: {
      earnedThisMonth: Math.round(thisMoRev * 0.05),
      redeemedThisMonth: 0,
      outstandingLiability: loyaltyBitsOutstanding,
    },
  };

  // 6. Gaming Intelligence Data
  const topPackage = Object.entries(packageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Standard Pass';
  const topConsole = Object.entries(consoleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PS5 Station';

  const gamingRevTotal = categoryRevMap.Gaming.rev;
  const revPerOccupiedGamingHour = hoursPlayedToday > 0 ? Math.round(gamingRevTotal / hoursPlayedToday) : 0;
  const revPerAvailableStationHour = potentialGamingHoursToday > 0 ? Math.round(gamingRevTotal / potentialGamingHoursToday) : 0;
  const revenuePerPs5 = totalPs5Count > 0 ? Math.round(gamingRevTotal / totalPs5Count) : 0;
  const avgSessionLengthMinutes = totalGamingSessions > 0 ? Math.round(todayGamingMinutes / totalGamingSessions) : 0;

  // Gaming Peak hour
  const gamingHourCounts: Record<number, number> = {};
  phaseBills.forEach((b) => {
    if (!b.timestamp || !b.stationName) return;
    const parts = getKolkataDateParts(b.timestamp);
    gamingHourCounts[parts.hours] = (gamingHourCounts[parts.hours] || 0) + 1;
  });
  const peakGamingHour = Object.entries(gamingHourCounts).sort((a, b) => b[1] - a[1])[0]
    ? formatHourTo12H(Object.entries(gamingHourCounts).sort((a, b) => b[1] - a[1])[0][0])
    : peakHr;

  // Attachment Rates
  let gamingBillsCount = 0;
  let gamingBillsWithFoodCount = 0;
  let gamingBillsWithCoffeeCount = 0;

  todayBills.forEach((b) => {
    const isGamingBill = (b.initialPackagePrice || 0) > 0 || (b.stationName && b.stationName.length > 0);
    if (isGamingBill) {
      gamingBillsCount++;
      let hasFood = false;
      let hasCoffee = false;
      b.items?.forEach((item) => {
        const cat = resolveItemCategory(item, foodItemsMap);
        if (cat === 'Food' || cat === 'Desserts') hasFood = true;
        if (cat === 'Coffee') hasCoffee = true;
      });
      if (hasFood) gamingBillsWithFoodCount++;
      if (hasCoffee) gamingBillsWithCoffeeCount++;
    }
  });

  const gamingToFoodAttachmentRatePct = gamingBillsCount > 0 ? Math.round((gamingBillsWithFoodCount / gamingBillsCount) * 100) : 0;
  const gamingToCoffeeAttachmentRatePct = gamingBillsCount > 0 ? Math.round((gamingBillsWithCoffeeCount / gamingBillsCount) * 100) : 0;

  const gamingIntelligence: GamingIntelligenceData = {
    consoleUtilizationPct: gamingOccupancyToday,
    potentialGamingHours: potentialGamingHoursToday,
    hoursPlayedTotal: hoursPlayedToday,
    idleHoursTotal: idleHoursToday,
    revenuePerPs5,
    avgSessionLengthMinutes,
    mostPopularPackage: topPackage,
    mostPopularConsole: topConsole,
    peakGamingHour,
    revPerOccupiedGamingHour,
    revPerAvailableStationHour,
    paidGamingOccupancyPct: gamingOccupancyToday,
    totalBookableStations,
    stationDowntimeHours: 0,
    gamingToFoodAttachmentRatePct,
    gamingToCoffeeAttachmentRatePct,
    discountImpactOnGaming: todayBills.reduce((s, b) => s + (b.discount || 0), 0),
  };

  // 7. Café Intelligence & Product Matrix
  // Use both today and selected period with explicit separation between Volume best seller vs Revenue best seller
  const itemMapToday = new Map<string, { count: number; rev: number }>();
  const itemMapHistorical = new Map<string, { count: number; rev: number }>();

  todayBills.forEach((b) => {
    b.items?.forEach((item) => {
      const cur = itemMapToday.get(item.name) || { count: 0, rev: 0 };
      itemMapToday.set(item.name, {
        count: cur.count + (item.quantity || 1),
        rev: cur.rev + (item.price || 0) * (item.quantity || 1),
      });
    });
  });

  phaseBills.forEach((b) => {
    b.items?.forEach((item) => {
      const cur = itemMapHistorical.get(item.name) || { count: 0, rev: 0 };
      itemMapHistorical.set(item.name, {
        count: cur.count + (item.quantity || 1),
        rev: cur.rev + (item.price || 0) * (item.quantity || 1),
      });
    });
  });

  const activeItemSource = itemMapToday.size > 0 ? itemMapToday : itemMapHistorical;

  // Sort by volume
  const itemsByVolume = Array.from(activeItemSource.entries())
    .map(([name, val]) => ({ name, count: val.count, revenue: val.rev }))
    .sort((a, b) => b.count - a.count);

  // Sort by revenue
  const itemsByRevenue = Array.from(activeItemSource.entries())
    .map(([name, val]) => ({ name, revenue: val.rev, unitsSold: val.count }))
    .sort((a, b) => b.revenue - a.revenue);

  const bestSellerVolume = itemsByVolume[0] || null;
  const bestSellerRevenue = itemsByRevenue[0] ? { name: itemsByRevenue[0].name, count: itemsByRevenue[0].unitsSold, revenue: itemsByRevenue[0].revenue } : null;
  const slowestSellingProduct = itemsByVolume.length > 1 ? { name: itemsByVolume[itemsByVolume.length - 1].name, count: itemsByVolume[itemsByVolume.length - 1].count } : null;

  const top5RevenueProducts = itemsByRevenue.slice(0, 5);
  const bottom5RevenueProducts = itemsByRevenue.slice(-5).reverse();

  // Product Contribution & BCG Matrix
  const productContributions: ProductContributionItem[] = [];
  let missingCostCount = 0;
  const avgUnitsAcrossProducts = itemsByVolume.length > 0 ? itemsByVolume.reduce((s, i) => s + i.count, 0) / itemsByVolume.length : 1;

  itemsByRevenue.forEach((item) => {
    const costPerUnit = rawMaterials.find((r) => r.name.toLowerCase().trim() === item.name.toLowerCase().trim())?.estimatedCost || 0;
    const hasCostRecorded = costPerUnit > 0;
    if (!hasCostRecorded) missingCostCount++;

    const totalCost = costPerUnit * item.unitsSold;
    const marginRupees = item.revenue - totalCost;
    const marginPct = item.revenue > 0 ? Math.round((marginRupees / item.revenue) * 100) : 0;

    let classification: ProductContributionItem['classification'] = 'Plowhorse';
    const isHighVolume = item.unitsSold >= avgUnitsAcrossProducts;
    const isHighMargin = marginPct >= 60;

    if (isHighVolume && isHighMargin) classification = 'Star';
    else if (isHighVolume && !isHighMargin) classification = 'Plowhorse';
    else if (!isHighVolume && isHighMargin) classification = 'Puzzle';
    else classification = 'Dog';

    productContributions.push({
      name: item.name,
      category: resolveItemCategory({ name: item.name }, foodItemsMap),
      unitsSold: item.unitsSold,
      revenue: item.revenue,
      costPerUnit,
      hasCostRecorded,
      totalCost,
      contributionMarginRupees: marginRupees,
      contributionMarginPct: marginPct,
      classification,
    });
  });

  // Food peak ordering hour
  const foodHourCounts: Record<number, number> = {};
  phaseBills.forEach((b) => {
    if (!b.timestamp || b.foodSubtotal === 0) return;
    const parts = getKolkataDateParts(b.timestamp);
    foodHourCounts[parts.hours] = (foodHourCounts[parts.hours] || 0) + 1;
  });
  const peakFoodHour = Object.entries(foodHourCounts).sort((a, b) => b[1] - a[1])[0]
    ? formatHourTo12H(Object.entries(foodHourCounts).sort((a, b) => b[1] - a[1])[0][0])
    : peakHr;

  // Stock-out alert items
  const stockOutAlerts: CafeIntelligenceData['stockOutAlerts'] = [];
  foodItems.forEach((f) => {
    if (f.trackInventory && f.stock !== undefined && f.stock <= (f.lowStockThreshold ?? 5)) {
      stockOutAlerts.push({ name: f.name, stock: f.stock, threshold: f.lowStockThreshold ?? 5 });
    }
  });

  const cafeIntelligence: CafeIntelligenceData = {
    bestSellerVolume,
    bestSellerRevenue,
    fastestGrowingProduct: itemsByVolume[0] ? { name: itemsByVolume[0].name, currentCount: itemsByVolume[0].count, prevCount: 0 } : null,
    slowestSellingProduct,
    foodAttachmentRatePct: gamingToFoodAttachmentRatePct,
    coffeeAttachmentRatePct: gamingToCoffeeAttachmentRatePct,
    peakFoodHour,
    top5RevenueProducts,
    bottom5RevenueProducts,
    productContributions,
    missingCostCount,
    stockOutAlerts,
    inventoryWastage: 0,
  };

  // 8. Employee Intelligence Data & Fair Scorecards
  const employeeIntelList: EmployeeIntelScorecard[] = employees.map((emp) => {
    const uname = (emp.username || '').toLowerCase();

    // Match shifts
    const empShifts = shifts.filter((s) => {
      const sId = (s.staffId || s.employeeId || '').toLowerCase();
      const inEmps = s.employees?.some((e) => (e.username || '').toLowerCase() === uname);
      return sId === uname || inEmps;
    });

    const relevantShifts = empShifts;
    const lateCount = relevantShifts.reduce((s, sh) => s + ((sh.lateMinutes && sh.lateMinutes > 0) ? 1 : 0), 0);
    const attendancePct = relevantShifts.length > 0
      ? Math.min(100, Math.round(((relevantShifts.length - lateCount) / relevantShifts.length) * 100))
      : 100;

    let totalShiftMinutes = 0;
    relevantShifts.forEach((s) => {
      if (s.startTime && s.endTime) {
        const diffMin = Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60));
        if (diffMin > 0 && diffMin < 24 * 60) totalShiftMinutes += diffMin;
      } else {
        totalShiftMinutes += 8 * 60; // 8 hr default shift
      }
    });
    const hoursWorkedTotal = Math.max(1, Math.round(totalShiftMinutes / 60));

    // Linked bills
    const empShiftIds = new Set(empShifts.map((s) => s.id));
    const empBills = phaseBills.filter((b) => {
      if (b.shiftId && empShiftIds.has(b.shiftId)) return true;
      if (!b.timestamp) return false;
      const bTime = new Date(b.timestamp).getTime();
      return empShifts.some((s) => {
        if (!s.startTime) return false;
        const start = new Date(s.startTime).getTime();
        const end = s.endTime ? new Date(s.endTime).getTime() : Date.now();
        return bTime >= start && bTime <= end;
      });
    });

    const revenueGenerated = empBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const ordersServed = empBills.length;
    const revenuePerHourWorked = Math.round(revenueGenerated / hoursWorkedTotal);
    const ordersPerHourWorked = Math.round((ordersServed / hoursWorkedTotal) * 10) / 10;

    // Join date & Salary reset calculation with month clamping
    let joinDay = 1;
    if (emp.joinDate) {
      const cleanJoin = emp.joinDate.slice(0, 10);
      const parts = cleanJoin.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[2])) {
        joinDay = parts[2];
      }
    }

    const currentYear = refDate.getFullYear();
    const currentMonth = refDate.getMonth();
    const daysInThisMonth = getDaysInMonth(refDate);
    const clampedDay = Math.min(joinDay, daysInThisMonth);
    const resetDateThisMonth = new Date(currentYear, currentMonth, clampedDay);
    const diffMs = resetDateThisMonth.getTime() - refDate.getTime();
    const daysUntilReset = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isDueToday = Math.abs(daysUntilReset) === 0;

    const scheduledCycleKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-reset-${clampedDay}`;

    return {
      id: emp.id,
      username: emp.username,
      displayName: emp.displayName,
      role: emp.role,
      joinDate: emp.joinDate,
      salary: emp.salary,
      salaryType: emp.salaryType,
      foodAllowanceBalance: emp.foodAllowanceBalance ?? 1000,
      pin: emp.pin,
      workStartTime: emp.workStartTime,
      workEndTime: emp.workEndTime,
      workingDaysPerWeek: emp.workingDaysPerWeek,
      overtimeMultiplier: emp.overtimeMultiplier,
      weekOffDay: emp.weekOffDay,
      assignedShift: emp.assignedShift,
      gracePeriod: emp.gracePeriod,
      isActive: emp.isActive,
      revenueGenerated,
      ordersServed,
      shiftsWorked: empShifts.length,
      hoursWorkedTotal,
      revenuePerHourWorked,
      ordersPerHourWorked,
      attendancePct,
      lateArrivalsCount: lateCount,
      salaryResetDateFormatted: formatDateDDMMYYYY(resetDateThisMonth),
      daysUntilSalaryReset: daysUntilReset,
      isSalaryResetDueToday: isDueToday,
      scheduledCycleKey,
      isPaidThisCycle: false,
      employeeRaw: emp,
    };
  });

  // 9. Financial Intelligence Data
  const expensesByCategory: Record<string, number> = {};
  phaseExpenses
    .filter((e) => e.timestamp && getBusinessDate(e.timestamp) === todayStr)
    .forEach((e) => {
      const cat = e.category || 'General Outflow';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + e.amount;
    });

  const breakevenProgressPct = Math.min(100, Math.round((revToday / survivalTargetDaily) * 100));
  const monthlyGoalProgressPct = Math.min(100, Math.round((thisMoRev / 150000) * 100));
  const grossMarginPct = 65;
  const revenueNeededToday = Math.max(0, survivalTargetDaily - revToday);

  const daysInMo = getDaysInMonth(refDate);
  const elapsedDaysThisMonth = refDate.getDate() - 1 + (elapsedHours / 12);
  const projectedEomRevenue = elapsedDaysThisMonth > 0 ? Math.round((thisMoRev / elapsedDaysThisMonth) * daysInMo) : 0;
  const projectedEomProfit = Math.round(projectedEomRevenue * (grossMarginPct / 100));

  const financialIntelligence: FinancialIntelligenceData = {
    revenue: revToday,
    grossProfit: Math.round(revToday * (grossMarginPct / 100)),
    netProfit: profitToday,
    grossMarginPct,
    totalExpenses: expToday,
    fixedExpensesDaily: rentDaily + loanDaily,
    variableExpensesDaily: Math.max(0, expToday - (rentDaily + loanDaily)),
    rentCostDaily: rentDaily,
    loanCostDaily: loanDaily,
    expensesByCategory,
    breakevenProgressPct,
    monthlyGoalProgressPct,
    survivalTargetDaily,
    revenueNeededToday,
    projectedEomRevenue,
    projectedEomProfit,
    cashFlowForecast: {
      projectedInflowNext7Days: Math.round((thisMoRev / Math.max(1, elapsedDaysThisMonth)) * 7),
      upcomingObligationsNext7Days: Math.round((rentDaily + loanDaily) * 7),
      netProjectedPositionNext7Days: Math.round(((thisMoRev / Math.max(1, elapsedDaysThisMonth)) * 7) - ((rentDaily + loanDaily) * 7)),
    },
  };

  // 10. Operational Health Data
  const pendingOrdersCount = todayBills.filter((b) => b.paymentMethod === 'pending').length;
  const operationalHealth: OperationalHealthData = {
    pendingOrdersCount,
    openGamingSessionsCount: inUseStations,
    totalStationsCount: stations.length,
    bookableGamingStationsCount: totalBookableStations,
    activeStaffCount,
    unclosedOldShiftsCount,
  };

  // 11. CEO Action Centre Recommendations
  const actionCentre = generateDeterministicCeoActions({
    revToday,
    revYesterday,
    revTarget: survivalTargetDaily,
    gamingOccupancyToday,
    idleHoursTotal: idleHoursToday,
    potentialGamingHours: potentialGamingHoursToday,
    foodAttachmentRatePct: gamingToFoodAttachmentRatePct,
    coffeeAttachmentRatePct: gamingToCoffeeAttachmentRatePct,
    pendingBillsCount: pendingOrdersCount,
    customersToday,
    customersYesterday,
    lowStockItemsCount: stockOutAlerts.length,
    reportingDateStr: formatDateDDMMYYYY(todayStr),
  });

  // 12. Data Reconciliation Report
  const reconciliationReport = runDataReconciliation(phaseBills, foodItemsMap);
  reconciliationReport.unclosedHistoricalShiftsCount = unclosedOldShiftsCount;

  // 13. Owner Brief Calculations
  const currentWeekdayName = WEEKDAYS[refDate.getDay()];
  let bestWeekdayTarget = 0;
  let bestWeekdayDate = formatDateDDMMYYYY(todayStr);

  const dailyTotalsWithWeekday: Record<string, { total: number; weekday: string }> = {};
  phaseBills.forEach((b) => {
    if (!b.timestamp) return;
    const dt = parseBusinessDateToKolkataNoon(getBusinessDate(b.timestamp));
    const dStr = getBusinessDate(b.timestamp);
    if (!dailyTotalsWithWeekday[dStr]) {
      dailyTotalsWithWeekday[dStr] = { total: 0, weekday: WEEKDAYS[dt.getDay()] };
    }
    dailyTotalsWithWeekday[dStr].total += b.totalAmount;
  });

  Object.entries(dailyTotalsWithWeekday).forEach(([dStr, dayData]) => {
    if (dayData.weekday === currentWeekdayName && dayData.total > bestWeekdayTarget) {
      bestWeekdayTarget = dayData.total;
      bestWeekdayDate = formatDateDDMMYYYY(dStr);
    }
  });

  const bestWeekdayRemaining = Math.max(0, bestWeekdayTarget + 1 - revToday);

  let recommendedPriority = 'Maintain current operations.';
  if (actionCentre.length > 0) {
    recommendedPriority = actionCentre[0].title + ': ' + actionCentre[0].suggestedAction;
  }

  const ownerBrief: OwnerBriefData = {
    revenuePctChange: periodBenchmarks.thisMonthVsLastMonth.pct,
    footfallPctChange: periodBenchmarks.thisWeekVsLastWeek.pct,
    avgSpendDifference: avgBillToday - avgBillYesterday,
    highestRoiProduct: bestSellerRevenue?.name || bestSellerVolume?.name || '',
    idleHoursThisMonth: Math.round(idleHoursToday * Math.max(1, elapsedDaysThisMonth)),
    totalPossibleHoursThisMonth: Math.round(totalBookableStations * 12 * Math.max(1, elapsedDaysThisMonth)),
    bestWeekdayTarget,
    bestWeekdayDate,
    bestWeekdayRemaining,
    bestWeekdayName: currentWeekdayName,
    recommendedPriority,
  };

  return {
    todayStr: formatDateDDMMYYYY(todayStr),
    selectedDate: todayStr,
    selectedPhase,
    ownerBrief,
    healthBreakdown,
    executiveSummary,
    periodBenchmarks,
    revenueIntelligence,
    customerIntelligence,
    gamingIntelligence,
    cafeIntelligence,
    employeeIntelList,
    financialIntelligence,
    operationalHealth,
    actionCentre,
    reconciliationReport,
    metricDictionary: KPI_DICTIONARY,
  };
}
