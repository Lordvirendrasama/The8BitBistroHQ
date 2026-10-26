import {
  Bill,
  Expense,
  Station,
  Employee,
  Shift,
  Member,
  FixedBill,
  LiabilityState,
  Settings,
  FoodItem,
  RawMaterial
} from './types';
import {
  computeUnifiedOwnerPulseData,
  StatusLevel,
  StatusColor,
  InsightPriority,
  MetricComparison,
  CeoActionRecommendation,
  DataReconciliationReport,
  CategoryRevenueItem,
  RevenueIntelligenceData,
  CustomerIntelligenceData,
  GamingIntelligenceData,
  CafeIntelligenceData,
  EmployeeIntelScorecard,
  FinancialIntelligenceData,
  OperationalHealthData,
  HealthScoreBreakdown,
  PeriodBenchmarks,
  OwnerBriefData,
  OwnerPulseDataPackage,
  ProductContributionItem,
  MetricDefinition,
  KPI_DICTIONARY,
  getElapsedOperatingHoursKolkata,
  parseBusinessDateToKolkataNoon,
  formatHourTo12H
} from './metrics-layer';

export type {
  StatusLevel,
  StatusColor,
  InsightPriority,
  MetricComparison,
  CeoActionRecommendation,
  DataReconciliationReport,
  CategoryRevenueItem,
  RevenueIntelligenceData,
  CustomerIntelligenceData,
  GamingIntelligenceData,
  CafeIntelligenceData,
  EmployeeIntelScorecard,
  FinancialIntelligenceData,
  OperationalHealthData,
  HealthScoreBreakdown,
  PeriodBenchmarks,
  OwnerBriefData,
  OwnerPulseDataPackage,
  ProductContributionItem,
  MetricDefinition
};

export {
  KPI_DICTIONARY,
  getElapsedOperatingHoursKolkata,
  parseBusinessDateToKolkataNoon,
  formatHourTo12H
};

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

/**
 * Main Deterministic Pulse Analytics Processing Engine using ONLY Real Data
 * Backward compatible entry point for Owner Pulse
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
  targetDate?: Date | string,
  foodItems: FoodItem[] = [],
  rawMaterials: RawMaterial[] = [],
  selectedPhase: string = 'all_cycles'
) {
  const unifiedData = computeUnifiedOwnerPulseData(
    bills,
    expenses,
    stations,
    employees,
    shifts,
    members,
    fixedBills,
    liabilityState,
    appSettings,
    foodItems,
    rawMaterials,
    targetDate,
    selectedPhase
  );

  // Map actionCentre recommendations to backward-compatible ruleInsights for existing component
  const ruleInsights: RuleInsight[] = unifiedData.actionCentre.map((a) => {
    let mappedStatus: RuleInsight['status'] = 'Monitor';
    if (a.severity === 'Critical') mappedStatus = 'Action Needed';
    else if (a.severity === 'Warning') mappedStatus = 'Declining';
    else if (a.severity === 'Opportunity') mappedStatus = 'Growing';
    else if (a.severity === 'Informational') mappedStatus = 'Celebration';

    return {
      id: a.id,
      category: (a.category === 'Staff' ? 'Employee' : a.category === 'Operations' ? 'Operational' : a.category) as RuleInsight['category'],
      status: mappedStatus,
      color: a.color,
      priority: a.priority,
      title: a.title,
      message: `${a.reason} Suggested Action: ${a.suggestedAction} [Impact: ${a.expectedImpact}]`,
      actionUrl: a.actionUrl,
      actionText: a.actionText,
    };
  });

  return {
    ...unifiedData,
    ruleInsights,
  };
}

export function parseBusinessDateStrToNoonDate(dateStr: string): Date {
  return parseBusinessDateToKolkataNoon(dateStr);
}

export function getElapsedOperatingHours(date: Date): number {
  return getElapsedOperatingHoursKolkata(date);
}
