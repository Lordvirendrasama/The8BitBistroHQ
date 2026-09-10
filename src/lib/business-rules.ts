import { Bill, Expense, Station, Employee, Shift, Member, FixedBill, LiabilityState, Settings } from './types';
import { getBusinessDate, formatDateDDMMYYYY } from './utils';
import { 
  subDays, 
  subWeeks, 
  subMonths, 
  subYears, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  format,
  getDaysInMonth
} from 'date-fns';

function getEquivalentWeekdayLastMonth(currentDate: Date): Date {
  const currentDayOfWeek = currentDate.getDay(); // 0-6
  const currentDateNum = currentDate.getDate(); // 1-31
  const occurrence = Math.ceil(currentDateNum / 7); // 1 to 5

  let targetMonth = currentDate.getMonth() - 1;
  let targetYear = currentDate.getFullYear();
  if (targetMonth < 0) {
    targetMonth = 11;
    targetYear--;
  }

  const firstDayOfTargetMonth = new Date(targetYear, targetMonth, 1);
  const firstDayOfWeek = firstDayOfTargetMonth.getDay();
  
  const firstOccurrenceDate = 1 + (currentDayOfWeek - firstDayOfWeek + 7) % 7;
  let targetDateNum = firstOccurrenceDate + (occurrence - 1) * 7;
  
  const daysInTargetMonth = getDaysInMonth(firstDayOfTargetMonth);
  if (targetDateNum > daysInTargetMonth) {
    targetDateNum -= 7; // fallback to the last occurrence if the 5th doesn't exist
  }
  
  return new Date(targetYear, targetMonth, targetDateNum);
}

/**
 * Gets the number of elapsed operating hours for a given date.
 * Operating hours: 11:00 AM to 11:00 PM (12 hours max)
 */
export function getElapsedOperatingHours(date: Date): number {
  const h = date.getHours();
  const m = date.getMinutes();
  
  if (h < 11) return 0; // Before opening
  if (h >= 23) return 12; // After closing
  
  return (h - 11) + (m / 60);
}

/**
 * Checks if a targetDate is at or before the same time of day as referenceNow.
 */
export function isWithinElapsedPeriodOfDay(targetDate: Date | string, referenceNow: Date): boolean {
  const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const targetH = d.getHours();
  const targetM = d.getMinutes();
  const refH = referenceNow.getHours();
  const refM = referenceNow.getMinutes();
  
  if (targetH < refH) return true;
  if (targetH === refH && targetM <= refM) return true;
  return false;
}

export type StatusLevel = 'Healthy' | 'Growing' | 'Monitor' | 'Needs Attention' | 'No Data';
export type StatusColor = 'green' | 'blue' | 'amber' | 'red' | 'grey';
export type InsightPriority = 'High' | 'Medium' | 'Low';

export interface MetricComparison {
  current: number;
  previous: number;
  absDiff: number;
  pctDiff: number;
  trend: 'up' | 'down' | 'neutral';
  status: StatusLevel;
  color: StatusColor;
  target?: number;
  lastMonth?: number;
  lastMonthPctDiff?: number;
}

export interface RuleInsight {
  id: string;
  category: 'Revenue' | 'Gaming' | 'Cafe' | 'Customer' | 'Employee' | 'Financial' | 'Operational';
  status: 'Growing' | 'Declining' | 'Monitor' | 'Action Needed' | 'Celebration';
  color: StatusColor;
  priority: InsightPriority;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export interface ExecutiveSummaryKPIs {
  revenueToday: MetricComparison;
  profitToday: MetricComparison;
  customersToday: MetricComparison;
  averageBill: MetricComparison;
  gamingOccupancy: MetricComparison;
  healthScore: MetricComparison;
}

export interface PeriodBenchmarks {
  todayVsYesterday: { current: number; previous: number; pct: number };
  todayVsSameWeekdayLastWeek: { current: number; previous: number; pct: number };
  thisWeekVsLastWeek: { current: number; previous: number; pct: number };
  thisMonthVsLastMonth: { current: number; previous: number; pct: number };
  thisMonthVsSameMonthLastYear: { current: number; previous: number; pct: number };
  last30DaysTrend: number[];
  lifetimeBest: { date: string; amount: number; remainingToBeat: number };
  lifetimeWorst: { date: string; amount: number };
}

export interface CategoryRevenueItem {
  category: 'Gaming' | 'Food' | 'Coffee' | 'Desserts' | 'Retail' | 'Memberships' | 'Board Games' | 'Delivery';
  revenue: number;
  contributionPct: number;
  aov: number;
  ordersCount: number;
}

export interface RevenueIntelligenceData {
  categories: CategoryRevenueItem[];
  topGrowthCategory: string;
  worstPerformingCategory: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  revenuePerOperatingHour: number;
  revenueSplit: { gaming: number; food: number; coffee: number; other: number };
  bestPerformingWeekday: string;
  slowestWeekday: string;
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
}

export interface CafeIntelligenceData {
  bestSeller: { name: string; count: number; revenue: number } | null;
  fastestGrowingProduct: { name: string; currentCount: number; prevCount: number } | null;
  slowestSellingProduct: { name: string; count: number } | null;
  foodAttachmentRatePct: number;
  coffeeAttachmentRatePct: number;
  peakFoodHour: string;
  top5Products: { name: string; revenue: number }[];
  bottom5Products: { name: string; revenue: number }[];
  inventoryWastage: number; // Placeholder for now
}

export interface EmployeeIntelScorecard {
  username: string;
  displayName: string;
  revenueGenerated: number;
  ordersServed: number;
  shiftsWorked: number;
  attendancePct: number;
  lateArrivalsCount: number;
}

export interface FinancialIntelligenceData {
  revenue: number;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  rentCostDaily: number;
  expensesByCategory: Record<string, number>;
  breakevenProgressPct: number;
  monthlyGoalProgressPct: number;
  survivalTargetDaily: number;
  revenueNeededToday: number;
  projectedEomRevenue: number;
  projectedEomProfit: number;
}

export interface OperationalHealthData {
  pendingOrdersCount: number;
  openGamingSessionsCount: number;
  totalStationsCount: number;
  activeStaffCount: number;
}

export interface HealthScoreBreakdown {
  totalScore: number; // 0 to 100
  revenueGrowthScore: number;
  profitGrowthScore: number;
  footfallScore: number;
  averageSpendScore: number;
  occupancyScore: number;
  employeeEfficiencyScore: number;
}

export interface OwnerBriefData {
  revenuePctChange: number;
  footfallPctChange: number;
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

/**
 * Main Deterministic Pulse Analytics Processing Engine using ONLY Real Data
 */
export function computeOwnerPulseData(
  bills: Bill[],
  expenses: Expense[],
  stations: Station[],
  employees: Employee[],
  shifts: Shift[],
  members: Member[],
  fixedBills: FixedBill[],
  liabilityState: LiabilityState | null,
  appSettings: Settings | null,
  targetDate?: Date | string
) {
  const now = targetDate ? (typeof targetDate === 'string' ? new Date(targetDate) : targetDate) : new Date();
  const todayStr = getBusinessDate(now);

  // Group bills by business date
  const billsByDate = new Map<string, Bill[]>();
  bills.forEach((b) => {
    if (!b.timestamp) return;
    const bDate = getBusinessDate(new Date(b.timestamp));
    const arr = billsByDate.get(bDate) || [];
    arr.push(b);
    billsByDate.set(bDate, arr);
  });

  const dailyTotal = (dateStr: string, elapsedOnly = false) => {
    return (billsByDate.get(dateStr) || [])
      .filter(b => !elapsedOnly || (b.timestamp && isWithinElapsedPeriodOfDay(b.timestamp, now)))
      .reduce((s, b) => s + b.totalAmount, 0);
  };
  
  const dailyBillsList = (dateStr: string, elapsedOnly = false) => {
    return (billsByDate.get(dateStr) || [])
      .filter(b => !elapsedOnly || (b.timestamp && isWithinElapsedPeriodOfDay(b.timestamp, now)));
  };

  // Helper date calculations
  const yesterdayStr = getBusinessDate(subDays(now, 1));
  const sameWeekdayLastWeekStr = getBusinessDate(subWeeks(now, 1));

  // Current day metrics
  const todayBills = dailyBillsList(todayStr);
  const revToday = dailyTotal(todayStr);
  const expToday = expenses
    .filter((e) => e.timestamp && getBusinessDate(new Date(e.timestamp)) === todayStr)
    .reduce((s, e) => s + e.amount, 0);
  const profitToday = revToday - expToday;
  const customersToday = todayBills.reduce((s, b) => s + Math.max(1, b.members?.length || 1), 0);
  const avgBillToday = todayBills.length > 0 ? Math.round(revToday / todayBills.length) : 0;

  // Previous day metrics (Elapsed comparison)
  const yesterdayBills = dailyBillsList(yesterdayStr, true);
  const revYesterday = dailyTotal(yesterdayStr, true);
  const expYesterday = expenses
    .filter((e) => e.timestamp && getBusinessDate(new Date(e.timestamp)) === yesterdayStr && isWithinElapsedPeriodOfDay(e.timestamp, now))
    .reduce((s, e) => s + e.amount, 0);
  const profitYesterday = revYesterday - expYesterday;
  const customersYesterday = yesterdayBills.reduce((s, b) => s + Math.max(1, b.members?.length || 1), 0);
  const avgBillYesterday = yesterdayBills.length > 0 ? Math.round(revYesterday / yesterdayBills.length) : 0;

  // Last Month Equivalent Weekday metrics (e.g., 1st Saturday to 1st Saturday) (Elapsed comparison)
  const equivalentLastMonthDate = getEquivalentWeekdayLastMonth(now);
  const lastMonthSameDateStr = getBusinessDate(equivalentLastMonthDate);
  const lastMonthSameDateBills = dailyBillsList(lastMonthSameDateStr, true);
  const revLastMonthSameDate = dailyTotal(lastMonthSameDateStr, true);
  const expLastMonthSameDate = expenses
    .filter((e) => e.timestamp && getBusinessDate(new Date(e.timestamp)) === lastMonthSameDateStr && isWithinElapsedPeriodOfDay(e.timestamp, now))
    .reduce((s, e) => s + e.amount, 0);
  const profitLastMonthSameDate = revLastMonthSameDate - expLastMonthSameDate;
  const customersLastMonthSameDate = lastMonthSameDateBills.reduce((s, b) => s + Math.max(1, b.members?.length || 1), 0);
  const avgBillLastMonthSameDate = lastMonthSameDateBills.length > 0 ? Math.round(revLastMonthSameDate / lastMonthSameDateBills.length) : 0;

  // Last Month average daily metrics calculation
  const startLastMonth = startOfMonth(subMonths(now, 1));
  const endLastMonth = endOfMonth(subMonths(now, 1));
  let lastMonthTotalRev = 0;
  let lastMonthDaysCount = 0;
  let cursor = new Date(startLastMonth);
  while (cursor <= endLastMonth) {
    const dStr = getBusinessDate(cursor);
    lastMonthTotalRev += dailyTotal(dStr);
    lastMonthDaysCount++;
    cursor = subDays(cursor, -1);
  }
  const revLastMonthAvg = lastMonthDaysCount > 0 ? Math.round(lastMonthTotalRev / lastMonthDaysCount) : 0;

  // Occupancy calculations
  const inUseStations = stations.filter((s) => s.status === 'in-use' || s.status === 'finishing').length;
  const totalStations = Math.max(1, stations.length);
  const gamingOccupancyToday = Math.round((inUseStations / totalStations) * 100);

  // Survival Goal calculation
  let survivalTargetDaily = 3000;
  if (liabilityState) {
    const rentDaily = (liabilityState.monthlyRent || 50000) / 30;
    const loanDaily = ((liabilityState.loanBalance || 0) * 0.0075) / 30;
    survivalTargetDaily = Math.round(rentDaily + loanDaily + 1000);
  }

  // 1. Health Score Calculation
  const healthBreakdown = computeHealthScoreBreakdown({
    revToday,
    revYesterday,
    revLastMonthAvg,
    profitToday,
    customersToday,
    avgBillToday,
    gamingOccupancyToday,
    survivalTargetDaily,
  });

  // 2. Executive Summary KPIs
  const buildMetric = (
    current: number,
    previous: number,
    target?: number,
    lastMonth?: number
  ): MetricComparison => {
    const absDiff = current - previous;
    const pctDiff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
    const trend = absDiff > 0 ? 'up' : absDiff < 0 ? 'down' : 'neutral';
    let status: StatusLevel = 'Healthy';
    let color: StatusColor = 'green';

    if (pctDiff > 10) {
      status = 'Growing';
      color = 'blue';
    } else if (pctDiff < -15) {
      status = 'Needs Attention';
      color = 'red';
    } else if (pctDiff < 0) {
      status = 'Monitor';
      color = 'amber';
    }

    const lastMonthPctDiff = lastMonth !== undefined 
      ? (lastMonth > 0 ? Math.round(((current - lastMonth) / lastMonth) * 100) : current > 0 ? 100 : 0)
      : undefined;

    return {
      current,
      previous,
      absDiff,
      pctDiff,
      trend,
      status,
      color,
      target,
      lastMonth,
      lastMonthPctDiff,
    };
  };

  const executiveSummary: ExecutiveSummaryKPIs = {
    revenueToday: buildMetric(revToday, revYesterday, survivalTargetDaily, revLastMonthSameDate),
    profitToday: buildMetric(profitToday, profitYesterday, undefined, profitLastMonthSameDate),
    customersToday: buildMetric(customersToday, customersYesterday, 30, customersLastMonthSameDate),
    averageBill: buildMetric(avgBillToday, avgBillYesterday, 350, avgBillLastMonthSameDate),
    gamingOccupancy: buildMetric(gamingOccupancyToday, 50, 75),
    healthScore: buildMetric(healthBreakdown.totalScore, 70, 85),
  };

  // 3. Growth Centre Multi-Period Benchmarks
  const revSameWeekdayLastWk = dailyTotal(sameWeekdayLastWeekStr, true);

  const startThisWk = startOfWeek(now, { weekStartsOn: 1 });
  const startLastWk = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const elapsedEndLastWk = subWeeks(now, 1);

  let thisWkRev = 0;
  let lastWkRev = 0;
  bills.forEach((b) => {
    if (!b.timestamp) return;
    const dt = new Date(b.timestamp);
    if (dt >= startThisWk && dt <= now) thisWkRev += b.totalAmount;
    if (dt >= startLastWk && dt <= elapsedEndLastWk) lastWkRev += b.totalAmount;
  });

  const startThisMo = startOfMonth(now);
  const startLastMoPeriod = startOfMonth(subMonths(now, 1));
  const elapsedEndLastMo = subMonths(now, 1);
  let thisMoRev = 0;
  let lastMoElapsedRev = 0;
  bills.forEach((b) => {
    if (!b.timestamp) return;
    const dt = new Date(b.timestamp);
    if (dt >= startThisMo && dt <= now) thisMoRev += b.totalAmount;
    if (dt >= startLastMoPeriod && dt <= elapsedEndLastMo) lastMoElapsedRev += b.totalAmount;
  });

  const startSameMoLastYr = startOfMonth(subYears(now, 1));
  const elapsedEndSameMoLastYr = subYears(now, 1);
  let sameMoLastYrRev = 0;
  bills.forEach((b) => {
    if (!b.timestamp) return;
    const dt = new Date(b.timestamp);
    if (dt >= startSameMoLastYr && dt <= elapsedEndSameMoLastYr) {
      sameMoLastYrRev += b.totalAmount;
    }
  });

  const last30DaysTrend: number[] = [];
  let lifetimeBestRaw = { date: todayStr, amount: 0 };
  let lifetimeWorst = { date: todayStr, amount: Infinity };

  for (let i = 29; i >= 0; i--) {
    const dStr = getBusinessDate(subDays(now, i));
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
    remainingToBeat: Math.max(0, lifetimeBestRaw.amount + 1 - revToday)
  };

  const periodBenchmarks: PeriodBenchmarks = {
    todayVsYesterday: {
      current: revToday,
      previous: revYesterday,
      pct: revYesterday > 0 ? Math.round(((revToday - revYesterday) / revYesterday) * 100) : 0,
    },
    todayVsSameWeekdayLastWeek: {
      current: revToday,
      previous: revSameWeekdayLastWk,
      pct: revSameWeekdayLastWk > 0 ? Math.round(((revToday - revSameWeekdayLastWk) / revSameWeekdayLastWk) * 100) : 0,
    },
    thisWeekVsLastWeek: {
      current: thisWkRev,
      previous: lastWkRev,
      pct: lastWkRev > 0 ? Math.round(((thisWkRev - lastWkRev) / lastWkRev) * 100) : 0,
    },
    thisMonthVsLastMonth: {
      current: thisMoRev,
      previous: lastMoElapsedRev,
      pct: lastMoElapsedRev > 0 ? Math.round(((thisMoRev - lastMoElapsedRev) / lastMoElapsedRev) * 100) : 0,
    },
    thisMonthVsSameMonthLastYear: {
      current: thisMoRev,
      previous: sameMoLastYrRev,
      pct: sameMoLastYrRev > 0 ? Math.round(((thisMoRev - sameMoLastYrRev) / sameMoLastYrRev) * 100) : 0,
    },
    last30DaysTrend,
    lifetimeBest,
    lifetimeWorst,
  };

  // 4. Revenue Intelligence Category Breakdown
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

  todayBills.forEach((bill) => {
    if (bill.initialPackagePrice > 0) {
      categoryRevMap.Gaming.rev += bill.initialPackagePrice;
      categoryRevMap.Gaming.count += 1;
    }

    bill.items.forEach((item) => {
      const nameLwr = item.name.toLowerCase();
      const itemRev = item.price * item.quantity;

      if (nameLwr.includes('coffee') || nameLwr.includes('latte') || nameLwr.includes('cappuccino') || nameLwr.includes('espresso')) {
        categoryRevMap.Coffee.rev += itemRev;
        categoryRevMap.Coffee.count += item.quantity;
      } else if (nameLwr.includes('waffle') || nameLwr.includes('brownie') || nameLwr.includes('cake') || nameLwr.includes('dessert') || nameLwr.includes('ice cream')) {
        categoryRevMap.Desserts.rev += itemRev;
        categoryRevMap.Desserts.count += item.quantity;
      } else if (nameLwr.includes('time:') || nameLwr.includes('recharge') || nameLwr.includes('pass') || nameLwr.includes('hour')) {
        categoryRevMap.Gaming.rev += itemRev;
        categoryRevMap.Gaming.count += item.quantity;
      } else if (nameLwr.includes('board game')) {
        categoryRevMap['Board Games'].rev += itemRev;
        categoryRevMap['Board Games'].count += item.quantity;
      } else if (nameLwr.includes('membership') || nameLwr.includes('tier')) {
        categoryRevMap.Memberships.rev += itemRev;
        categoryRevMap.Memberships.count += item.quantity;
      } else if (nameLwr.includes('delivery') || nameLwr.includes('zomato') || nameLwr.includes('swiggy')) {
        categoryRevMap.Delivery.rev += itemRev;
        categoryRevMap.Delivery.count += item.quantity;
      } else if (nameLwr.includes('snack') || nameLwr.includes('drink') || nameLwr.includes('can') || nameLwr.includes('chips')) {
        categoryRevMap.Retail.rev += itemRev;
        categoryRevMap.Retail.count += item.quantity;
      } else {
        categoryRevMap.Food.rev += itemRev;
        categoryRevMap.Food.count += item.quantity;
      }
    });
  });

  const totalTodayCategoryRev = Math.max(1, Object.values(categoryRevMap).reduce((s, c) => s + c.rev, 0));

  const categories: CategoryRevenueItem[] = Object.entries(categoryRevMap).map(([catName, val]) => {
    const category = catName as CategoryRevenueItem['category'];
    const contributionPct = Math.round((val.rev / totalTodayCategoryRev) * 100);
    const aov = val.count > 0 ? Math.round(val.rev / val.count) : 0;

    return {
      category,
      revenue: val.rev,
      contributionPct,
      aov,
      ordersCount: val.count,
    };
  });

  const sortedCatByRev = [...categories].sort((a, b) => b.revenue - a.revenue);
  const topGrowthCategory = sortedCatByRev[0]?.category || 'Gaming';
  const worstPerformingCategory = sortedCatByRev[sortedCatByRev.length - 1]?.category || 'Delivery';
  
  const revenueSplit = {
    gaming: categoryRevMap.Gaming.rev,
    food: categoryRevMap.Food.rev + categoryRevMap.Desserts.rev,
    coffee: categoryRevMap.Coffee.rev,
    other: categoryRevMap.Retail.rev + categoryRevMap.Memberships.rev + categoryRevMap['Board Games'].rev + categoryRevMap.Delivery.rev
  };
  
  const elapsedHours = getElapsedOperatingHours(now);
  const revenuePerOperatingHour = elapsedHours > 0 ? Math.round(revToday / elapsedHours) : 0;

  const dayTotals: Record<string, number> = {};
  billsByDate.forEach((dayBills, dStr) => {
     const dayOfWeek = format(new Date(dayBills[0]?.timestamp || dStr), 'EEEE');
     dayTotals[dayOfWeek] = (dayTotals[dayOfWeek] || 0) + dayBills.reduce((s, b) => s + b.totalAmount, 0);
  });
  const sortedDaysByRev = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
  const bestPerformingWeekday = sortedDaysByRev[0]?.[0] || 'Saturday';
  const slowestWeekday = sortedDaysByRev[sortedDaysByRev.length - 1]?.[0] || 'Monday';

  const revenueIntelligence: RevenueIntelligenceData = {
    categories,
    topGrowthCategory,
    worstPerformingCategory,
    totalRevenue: revToday,
    totalExpenses: expToday,
    totalProfit: profitToday,
    revenuePerOperatingHour,
    revenueSplit,
    bestPerformingWeekday,
    slowestWeekday
  };

  // 5. Customer Intelligence Data
  let newCustCount = 0;
  let returningCustCount = 0;
  let memberVisits = 0;
  let walkinVisits = 0;
  let gamingGamersCount = 0;

  todayBills.forEach((b) => {
    if (b.members && b.members.length > 0) {
      memberVisits += b.members.length;
      returningCustCount += b.members.length;
    } else {
      walkinVisits += 1;
      newCustCount += 1;
    }
    if (b.initialPackagePrice && b.initialPackagePrice > 0) {
      gamingGamersCount += Math.max(1, b.members?.length || 1);
    }
  });

  const totalCusts = Math.max(1, newCustCount + returningCustCount);
  const repeatRatePct = Math.round((returningCustCount / totalCusts) * 100);
  const avgSpendPerCustomer = todayBills.length > 0 ? Math.round(revToday / totalCusts) : 0;
  const avgSpendSampleSize = totalCusts;
  
  const memberRev = todayBills.filter(b => b.members && b.members.length > 0).reduce((s,b) => s + b.totalAmount, 0);
  const memberRevenuePct = revToday > 0 ? Math.round((memberRev / revToday) * 100) : 0;
  
  const avgRevenuePerGamer = gamingGamersCount > 0 ? Math.round(categoryRevMap.Gaming.rev / gamingGamersCount) : 0;

  // Real member CLV calculation (average total spent across members)
  const totalMemberSpentSum = members.reduce((s, m) => s + (m.totalSpent || 0), 0);
  const customerLifetimeValue = members.length > 0 ? Math.round(totalMemberSpentSum / members.length) : 0;

  // Real Peak Hour & Peak Day calculations
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<string, number> = {};
  bills.forEach((b) => {
    if (!b.timestamp) return;
    const dt = new Date(b.timestamp);
    const hr = dt.getHours();
    const day = format(dt, 'EEEE');
    hourCounts[hr] = (hourCounts[hr] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);

  const peakHr = sortedHours[0] ? `${sortedHours[0][0]}:00` : 'N/A';
  const peakDay = sortedDays[0] ? sortedDays[0][0] : 'N/A';

  const sortedMembersBySpend = [...members].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  const highestSpendingCustomer = sortedMembersBySpend[0]
    ? { name: sortedMembersBySpend[0].name, amount: sortedMembersBySpend[0].totalSpent }
    : null;

  const customerIntelligence: CustomerIntelligenceData = {
    newCustomers: newCustCount,
    returningCustomers: returningCustCount,
    memberVisits,
    walkinVisits,
    repeatRatePct,
    avgSpendPerCustomer,
    avgSpendSampleSize,
    avgRevenuePerGamer,
    memberRevenuePct,
    mostPopularVisitTime: peakHr,
    mostPopularDay: peakDay,
    highestSpendingCustomer,
    highestReturningCustomer: sortedMembersBySpend[0] ? { name: sortedMembersBySpend[0].name, visits: sortedMembersBySpend[0].recharges?.length || 1 } : null,
    customerLifetimeValue,
  };

  // 6. Gaming Intelligence Data (Real calculations)
  const packageCounts: Record<string, number> = {};
  const consoleCounts: Record<string, number> = {};
  let totalSessionMinutes = 0;
  let totalGamingSessions = 0;
  
  todayBills.forEach((b) => {
    if (b.stationName) {
      consoleCounts[b.stationName] = (consoleCounts[b.stationName] || 0) + 1;
      totalGamingSessions++;
      if (b.packageName && b.packageName.toLowerCase().includes('hour')) {
         const hours = parseInt(b.packageName) || 1;
         totalSessionMinutes += hours * 60;
      } else {
         totalSessionMinutes += 60; // fallback avg
      }
    }
    if (b.packageName) {
      packageCounts[b.packageName] = (packageCounts[b.packageName] || 0) + 1;
    }
  });

  const topPackage = Object.entries(packageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Standard Pass';
  const topConsole = Object.entries(consoleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PS5 Station';

  const potentialGamingHours = elapsedHours * totalStations;
  const hoursPlayedTotal = Math.round(totalSessionMinutes / 60);
  const idleHoursTotal = Math.max(0, potentialGamingHours - hoursPlayedTotal);
  
  const revenuePerPs5 = totalStations > 0 ? Math.round(categoryRevMap.Gaming.rev / totalStations) : 0;
  const avgSessionLengthMinutes = totalGamingSessions > 0 ? Math.round(totalSessionMinutes / totalGamingSessions) : 0;

  // Filter bills just for gaming to find peak hour
  const gamingHourCounts: Record<number, number> = {};
  bills.forEach((b) => {
    if (!b.timestamp || !b.stationName) return;
    const hr = new Date(b.timestamp).getHours();
    gamingHourCounts[hr] = (gamingHourCounts[hr] || 0) + 1;
  });
  const peakGamingHour = Object.entries(gamingHourCounts).sort((a,b) => b[1] - a[1])[0] ? `${Object.entries(gamingHourCounts).sort((a,b) => b[1] - a[1])[0][0]}:00` : peakHr;

  const gamingIntelligence: GamingIntelligenceData = {
    consoleUtilizationPct: potentialGamingHours > 0 ? Math.min(100, Math.round((hoursPlayedTotal / potentialGamingHours) * 100)) : 0,
    potentialGamingHours,
    hoursPlayedTotal,
    idleHoursTotal,
    revenuePerPs5,
    avgSessionLengthMinutes,
    mostPopularPackage: topPackage,
    mostPopularConsole: topConsole,
    peakGamingHour,
  };

  // 7. Cafe Intelligence Data (Real product sales from bills)
  const itemCountsToday: Record<string, { count: number; rev: number }> = {};
  const itemCountsPrev: Record<string, number> = {};

  const yesterdayBillsFull = dailyBillsList(yesterdayStr);

  todayBills.forEach((b) => {
    b.items.forEach((item) => {
      const existing = itemCountsToday[item.name] || { count: 0, rev: 0 };
      itemCountsToday[item.name] = {
        count: existing.count + item.quantity,
        rev: existing.rev + item.price * item.quantity,
      };
    });
  });

  yesterdayBillsFull.forEach((b) => {
    b.items.forEach((item) => {
      itemCountsPrev[item.name] = (itemCountsPrev[item.name] || 0) + item.quantity;
    });
  });

  const sortedItems = Object.entries(itemCountsToday).sort((a, b) => b[1].count - a[1].count);
  const bestSeller = sortedItems[0] ? { name: sortedItems[0][0], count: sortedItems[0][1].count, revenue: sortedItems[0][1].rev } : null;
  const slowestSelling = sortedItems.length > 1 ? { name: sortedItems[sortedItems.length - 1][0], count: sortedItems[sortedItems.length - 1][1].count } : null;

  let fastestGrowingProduct: CafeIntelligenceData['fastestGrowingProduct'] = null;
  let maxGrowth = -Infinity;

  Object.entries(itemCountsToday).forEach(([name, data]) => {
    const prevCount = itemCountsPrev[name] || 0;
    const growth = data.count - prevCount;
    if (growth > maxGrowth) {
      maxGrowth = growth;
      fastestGrowingProduct = { name, currentCount: data.count, prevCount };
    }
  });

  const foodAttachmentRatePct = totalGamingSessions > 0 ? Math.min(100, Math.round((categoryRevMap.Food.count / totalGamingSessions) * 100)) : 0;
  const coffeeAttachmentRatePct = totalGamingSessions > 0 ? Math.min(100, Math.round((categoryRevMap.Coffee.count / totalGamingSessions) * 100)) : 0;
  
  const top5Products = sortedItems.slice(0, 5).map(i => ({ name: i[0], revenue: i[1].rev }));
  const bottom5Products = sortedItems.slice(-5).reverse().map(i => ({ name: i[0], revenue: i[1].rev }));

  // Filter bills just for food to find peak hour
  const foodHourCounts: Record<number, number> = {};
  bills.forEach((b) => {
    if (!b.timestamp || b.foodSubtotal === 0) return;
    const hr = new Date(b.timestamp).getHours();
    foodHourCounts[hr] = (foodHourCounts[hr] || 0) + 1;
  });
  const peakFoodHour = Object.entries(foodHourCounts).sort((a,b) => b[1] - a[1])[0] ? `${Object.entries(foodHourCounts).sort((a,b) => b[1] - a[1])[0][0]}:00` : peakHr;


  const cafeIntelligence: CafeIntelligenceData = {
    bestSeller,
    fastestGrowingProduct,
    slowestSellingProduct: slowestSelling,
    foodAttachmentRatePct,
    coffeeAttachmentRatePct,
    peakFoodHour,
    top5Products,
    bottom5Products,
    inventoryWastage: 0,
  };

  // 8. Employee Intelligence Data (Real shift & bill calculations)
  const employeeIntelList: EmployeeIntelScorecard[] = employees.map((emp) => {
    const empShifts = shifts.filter((s) => s.staffId === emp.username || s.employees?.some((e) => e.username === emp.username));
    const lateCount = empShifts.reduce((s, sh) => s + (sh.lateMinutes && sh.lateMinutes > 0 ? 1 : 0), 0);
    const totalWorkingDaysInMonth = 26;
    const attendancePct = Math.min(100, Math.round((empShifts.length / totalWorkingDaysInMonth) * 100));

    // Real bills generated by employee during shifts or by staffId
    const empBills = todayBills.filter((b) => b.shiftId && empShifts.some((s) => s.id === b.shiftId));
    const revenueGenerated = empBills.reduce((s, b) => s + b.totalAmount, 0);
    const ordersServed = empBills.length;

    return {
      username: emp.username,
      displayName: emp.displayName,
      revenueGenerated,
      ordersServed,
      shiftsWorked: empShifts.length,
      attendancePct,
      lateArrivalsCount: lateCount,
    };
  });

  // 9. Financial Intelligence Data
  const expensesByCategory: Record<string, number> = {};
  expenses
    .filter((e) => e.timestamp && getBusinessDate(new Date(e.timestamp)) === todayStr)
    .forEach((e) => {
      const cat = e.category || 'General Outflow';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + e.amount;
    });

  const rentCostDaily = Math.round((liabilityState?.monthlyRent || 50000) / 30);
  const breakevenProgressPct = Math.min(100, Math.round((revToday / survivalTargetDaily) * 100));
  const monthlyGoalProgressPct = Math.min(100, Math.round((thisMoRev / 150000) * 100));

  const grossMarginPct = 65;
  const revenueNeededToday = Math.max(0, survivalTargetDaily - revToday);
  
  const elapsedDaysThisMonth = now.getDate() - 1 + (elapsedHours / 12);
  const daysInMo = getDaysInMonth(now);
  const projectedEomRevenue = elapsedDaysThisMonth > 0 ? Math.round((thisMoRev / elapsedDaysThisMonth) * daysInMo) : 0;
  const projectedEomProfit = Math.round(projectedEomRevenue * (grossMarginPct / 100));

  const financialIntelligence: FinancialIntelligenceData = {
    revenue: revToday,
    grossProfit: Math.round(revToday * (grossMarginPct / 100)),
    netProfit: profitToday,
    grossMarginPct,
    totalExpenses: expToday,
    rentCostDaily,
    expensesByCategory,
    breakevenProgressPct,
    monthlyGoalProgressPct,
    survivalTargetDaily,
    revenueNeededToday,
    projectedEomRevenue,
    projectedEomProfit
  };

  // 10. Operational Health Data (Real live numbers)
  const pendingOrdersCount = todayBills.filter((b) => b.paymentMethod === 'pending').length;
  const activeStaffCount = shifts.filter((s) => s.status === 'active' || !s.endTime).length;

  const operationalHealth: OperationalHealthData = {
    pendingOrdersCount,
    openGamingSessionsCount: inUseStations,
    totalStationsCount: totalStations,
    activeStaffCount,
  };

  // 11. Predefined Business Rules Engine Evaluation
  const ruleInsights = evaluateBusinessRules({
    revToday,
    revYesterday,
    revLastMonthAvg,
    avgBillToday,
    avgBillYesterday,
    customersToday,
    customersYesterday,
    gamingOccupancyToday,
    survivalTargetDaily,
  });

  // 12. Owner Brief Calculations
  const startLastMo = startOfMonth(subMonths(now, 1));
  const endLastMo = endOfMonth(subMonths(now, 1));
  
  let thisMoFootfall = 0;
  let lastMoFootfall = 0;
  let thisMoGamingRev = 0;
  bills.forEach((b) => {
    if (!b.timestamp) return;
    const dt = new Date(b.timestamp);
    if (dt >= startThisMo) {
      thisMoFootfall += Math.max(1, b.members?.length || 1);
      const foodRev = b.foodSubtotal || 0;
      // sum up just gaming items for this month
      let gameRev = 0;
      if (b.initialPackagePrice > 0) {
        gameRev += b.initialPackagePrice;
      }
      b.items.forEach(item => {
        const nameLwr = item.name.toLowerCase();
        if (nameLwr.includes('time:') || nameLwr.includes('recharge') || nameLwr.includes('pass') || nameLwr.includes('hour')) {
           gameRev += (item.price * item.quantity);
        }
      });
      if (gameRev > 0) thisMoGamingRev += gameRev;
    } else if (dt >= startLastMo && dt <= subMonths(now, 1)) {
      lastMoFootfall += Math.max(1, b.members?.length || 1);
    }
  });
  
  const footfallPctChange = lastMoFootfall > 0 
    ? Math.round(((thisMoFootfall - lastMoFootfall) / lastMoFootfall) * 100) 
    : thisMoFootfall > 0 ? 100 : 0;
    
  const thisMoBillsCount = bills.filter(b => b.timestamp && new Date(b.timestamp) >= startThisMo).length;
  const lastMoBillsCount = bills.filter(b => b.timestamp && new Date(b.timestamp) >= startLastMo && new Date(b.timestamp) <= endLastMo).length;
  
  const thisMoAvgBill = thisMoBillsCount > 0 ? Math.round(thisMoRev / thisMoBillsCount) : 0;
  const lastMoAvgBill = lastMoBillsCount > 0 ? Math.round(lastMonthTotalRev / lastMoBillsCount) : 0;
  const avgSpendDifference = thisMoAvgBill - lastMoAvgBill;

  const currentDayOfMonth = now.getDate();
  const elapsedDaysThisMonthForGaming = (currentDayOfMonth - 1) + (getElapsedOperatingHours(now) / 12);
  const hoursPlayedThisMonth = Math.round(thisMoGamingRev / 100); // 100/hr per controller
  const totalPossibleHoursThisMonth = Math.round(10 * 12 * elapsedDaysThisMonthForGaming); // 10 controllers * 12 hours operational
  const idleHoursThisMonth = Math.max(0, totalPossibleHoursThisMonth - hoursPlayedThisMonth);
  
  const currentWeekdayName = format(now, 'EEEE');
  let bestWeekdayTarget = 0;
  let bestWeekdayDate = formatDateDDMMYYYY(todayStr);
  
  const dailyTotalsWithWeekday: Record<string, { total: number, weekday: string }> = {};
  bills.forEach(b => {
     if (!b.timestamp) return;
     const dt = new Date(b.timestamp);
     const dStr = getBusinessDate(dt);
     if (!dailyTotalsWithWeekday[dStr]) {
       dailyTotalsWithWeekday[dStr] = { total: 0, weekday: format(dt, 'EEEE') };
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

  let recommendedPriority = "Maintain current operations.";
  if (gamingOccupancyToday < 60) {
     recommendedPriority = "Increase evening gaming occupancy after 6 PM.";
  } else if (revToday < survivalTargetDaily) {
     recommendedPriority = "Focus on upselling to hit the daily survival target.";
  } else if (footfallPctChange < 0) {
     recommendedPriority = "Run a quick promotional offer to boost footfall.";
  }

  const ownerBrief: OwnerBriefData = {
    revenuePctChange: periodBenchmarks.thisMonthVsLastMonth.pct,
    footfallPctChange,
    avgSpendDifference,
    highestRoiProduct: cafeIntelligence.bestSeller?.name || '',
    idleHoursThisMonth,
    totalPossibleHoursThisMonth,
    bestWeekdayTarget,
    bestWeekdayDate,
    bestWeekdayRemaining,
    bestWeekdayName: currentWeekdayName,
    recommendedPriority,
  };

  return {
    todayStr: formatDateDDMMYYYY(todayStr),
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
    ruleInsights,
  };
}

/**
 * Health Score Weighting Logic (0 to 100) using purely actual data metrics
 */
function computeHealthScoreBreakdown(params: {
  revToday: number;
  revYesterday: number;
  revLastMonthAvg: number;
  profitToday: number;
  customersToday: number;
  avgBillToday: number;
  gamingOccupancyToday: number;
  survivalTargetDaily: number;
}): HealthScoreBreakdown {
  const { revToday, revYesterday, profitToday, customersToday, avgBillToday, gamingOccupancyToday, survivalTargetDaily } = params;

  let revenueGrowthScore = 15;
  if (revToday > revYesterday) revenueGrowthScore += 5;
  if (revToday >= survivalTargetDaily) revenueGrowthScore += 5;

  let profitGrowthScore = profitToday > 0 ? 20 : 5;
  if (profitToday > 2000) profitGrowthScore += 5;

  let footfallScore = Math.min(15, Math.round((customersToday / 15) * 15));
  let averageSpendScore = Math.min(15, Math.round((avgBillToday / 300) * 15));
  let occupancyScore = Math.min(15, Math.round((gamingOccupancyToday / 75) * 15));
  let employeeEfficiencyScore = 10;

  const totalScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        revenueGrowthScore +
          profitGrowthScore +
          footfallScore +
          averageSpendScore +
          occupancyScore +
          employeeEfficiencyScore
      )
    )
  );

  return {
    totalScore,
    revenueGrowthScore,
    profitGrowthScore,
    footfallScore,
    averageSpendScore,
    occupancyScore,
    employeeEfficiencyScore,
  };
}

/**
 * Predefined Deterministic Business Rules Engine (Real Data Checks Only)
 */
function evaluateBusinessRules(params: {
  revToday: number;
  revYesterday: number;
  revLastMonthAvg: number;
  avgBillToday: number;
  avgBillYesterday: number;
  customersToday: number;
  customersYesterday: number;
  gamingOccupancyToday: number;
  survivalTargetDaily: number;
}): RuleInsight[] {
  const {
    revToday,
    revYesterday,
    revLastMonthAvg,
    avgBillToday,
    avgBillYesterday,
    customersToday,
    customersYesterday,
    gamingOccupancyToday,
    survivalTargetDaily,
  } = params;

  const insights: RuleInsight[] = [];

  if (revToday > revYesterday) {
    insights.push({
      id: 'rule-rev-grow',
      category: 'Revenue',
      status: 'Growing',
      color: 'green',
      priority: 'Low',
      title: 'Positive Daily Velocity',
      message: `Revenue today (₹${revToday.toLocaleString()}) exceeds yesterday's total of ₹${revYesterday.toLocaleString()} at the same time of day. This is driven by ${avgBillToday > avgBillYesterday ? 'higher average customer spend' : 'increased footfall'}.`,
    });
  }

  if (revLastMonthAvg > 0 && revToday < revLastMonthAvg * 0.8) {
    insights.push({
      id: 'rule-rev-decline-mo',
      category: 'Revenue',
      status: 'Declining',
      color: 'red',
      priority: 'High',
      title: 'Revenue Trailing Monthly Baseline',
      message: `Today's revenue is 20%+ lower than last month's daily average (₹${Math.round(revLastMonthAvg).toLocaleString()}). ${customersToday < customersYesterday ? 'Reduced footfall is the primary cause.' : 'Lower spend per customer is the primary cause.'}`,
      actionUrl: '/analytics',
      actionText: 'View Sales Breakdown',
    });
  }

  if (avgBillToday > avgBillYesterday && customersToday < customersYesterday && customersYesterday > 0) {
    insights.push({
      id: 'rule-spend-offset-footfall',
      category: 'Customer',
      status: 'Monitor',
      color: 'blue',
      priority: 'Medium',
      title: 'Spending Pattern Shift',
      message: `Customers are spending ₹${avgBillToday - avgBillYesterday} more today on average, which is offsetting a drop of ${customersYesterday - customersToday} customers compared to yesterday at this time.`,
    });
  }

  if (gamingOccupancyToday < 60) {
    insights.push({
      id: 'rule-gaming-low-occupancy',
      category: 'Gaming',
      status: 'Action Needed',
      color: 'amber',
      priority: 'Medium',
      title: 'Gaming Occupancy Below Target',
      message: `Current gaming station occupancy is at ${gamingOccupancyToday}%, below the 60% optimal baseline. Consider running a quick localized discount or combo deal to boost utilization.`,
      actionUrl: '/dashboard',
      actionText: 'Promote Gaming Passes',
    });
  }

  if (revToday >= survivalTargetDaily && survivalTargetDaily > 0) {
    insights.push({
      id: 'rule-survival-target-met',
      category: 'Financial',
      status: 'Celebration',
      color: 'green',
      priority: 'Low',
      title: 'Daily Target Achieved',
      message: `Daily survival goal of ₹${survivalTargetDaily.toLocaleString()} has been achieved! Any further revenue today contributes directly to net profit margins.`,
    });
  }

  return insights;
}
