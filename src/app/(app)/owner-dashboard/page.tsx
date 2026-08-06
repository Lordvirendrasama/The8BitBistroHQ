'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import type { Station, Bill, Expense, Employee, Shift, LiabilityState, FixedBill, Settings, Member } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Crown, Filter, Globe, RefreshCw, LayoutDashboard, Sparkles, PieChart, Users, Gamepad2, Utensils, Wallet, Activity, ShieldCheck, Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AppUpdatesDropdown } from '@/components/owner/app-updates-dropdown';
import { getAvailableCycles, type CycleMetadata } from '@/firebase/firestore/data-management';
import { computeOwnerPulseData } from '@/lib/business-rules';
import { getBusinessDate, formatDateDDMMYYYY } from '@/lib/utils';

// 10 Core Modules
import { OwnerPulseExecutiveSummary } from '@/components/owner-pulse/owner-pulse-executive-summary';
import { OwnerPulseRulesInsights } from '@/components/owner-pulse/owner-pulse-rules-insights';
import { OwnerPulseGrowthCentre } from '@/components/owner-pulse/owner-pulse-growth-centre';
import { OwnerPulseRevenueIntel } from '@/components/owner-pulse/owner-pulse-revenue-intel';
import { OwnerPulseCustomerIntel } from '@/components/owner-pulse/owner-pulse-customer-intel';
import { OwnerPulseGamingIntel } from '@/components/owner-pulse/owner-pulse-gaming-intel';
import { OwnerPulseCafeIntel } from '@/components/owner-pulse/owner-pulse-cafe-intel';
import { OwnerPulseEmployeeIntel } from '@/components/owner-pulse/owner-pulse-employee-intel';
import { OwnerPulseFinancialIntel } from '@/components/owner-pulse/owner-pulse-financial-intel';
import { OwnerPulseOperationalHealth } from '@/components/owner-pulse/owner-pulse-operational-health';

export default function OwnerDashboardPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();

  const [selectedPhase, setSelectedPhase] = useState<string>('Launch Live');
  const [selectedDate, setSelectedDate] = useState<string>(() => getBusinessDate(new Date()));
  const [availableCycles, setAvailableCycles] = useState<CycleMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');

  // ONLY Viren can view Owner Pulse
  useEffect(() => {
    if (user && user.username !== 'Viren') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    getAvailableCycles().then(setAvailableCycles);
  }, []);

  // Firestore Data Subscriptions
  const stationsQuery = useMemo(() => (!db ? null : collection(db, 'stations')), [db]);
  const { data: stations } = useCollection<Station>(stationsQuery);

  const billsQuery = useMemo(() => (!db ? null : collection(db, 'bills')), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const expensesQuery = useMemo(() => (!db ? null : collection(db, 'expenses')), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const employeesQuery = useMemo(
    () => (!db ? null : query(collection(db, 'employees'), where('isActive', '==', true))),
    [db]
  );
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const shiftsQuery = useMemo(() => (!db ? null : query(collection(db, 'shifts'), where('endTime', '==', null))), [db]);
  const { data: activeShifts } = useCollection<Shift>(shiftsQuery);

  const fixedBillsQuery = useMemo(() => (!db ? null : collection(db, 'fixedBills')), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const membersQuery = useMemo(() => (!db ? null : collection(db, 'members')), [db]);
  const { data: members } = useCollection<Member>(membersQuery);

  const [liabilityState, setLiabilityState] = useState<LiabilityState | null>(null);
  const [appSettings, setAppSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsubLiab = onSnapshot(doc(db, 'liabilities', 'main_liability_state'), (snap) => {
      if (snap.exists()) setLiabilityState(snap.data() as LiabilityState);
    });
    const unsubSett = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) setAppSettings(snap.data() as Settings);
    });
    return () => {
      unsubLiab();
      unsubSett();
    };
  }, [db]);

  // Compute Owner Pulse Data Deterministically
  const pulseData = useMemo(() => {
    if (!bills || !expenses || !stations || !employees || !members || !fixedBills) return null;

    // Filter by phase if selected
    const phaseBills = selectedPhase === 'all_cycles' ? bills : bills.filter((b) => b.cycle === selectedPhase);
    const phaseExpenses = selectedPhase === 'all_cycles' ? expenses : expenses.filter((e) => e.cycle === selectedPhase);

    return computeOwnerPulseData(
      phaseBills,
      phaseExpenses,
      stations,
      employees,
      activeShifts || [],
      members,
      fixedBills,
      liabilityState,
      appSettings,
      selectedDate
    );
  }, [bills, expenses, stations, employees, activeShifts, members, fixedBills, liabilityState, appSettings, selectedPhase, selectedDate]);

  if (!pulseData) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4 text-center font-body">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-headline text-sm uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
          Computing Owner Pulse Command Center...
        </p>
      </div>
    );
  }

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    if (id === 'all') return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-body">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-4">
            <h1 className="font-pixel text-2xl md:text-3xl text-foreground flex items-center gap-3">
              <Crown className="h-8 w-8 text-primary fill-primary/20" />
              OWNER PULSE
            </h1>
            <AppUpdatesDropdown />
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-xs pl-1">
            CEO BUSINESS COMMAND CENTER &bull; {pulseData.todayStr}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Target Date Picker Control displaying DD/MM/YYYY */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 border-2 border-primary/30 bg-background font-mono text-xs font-bold uppercase gap-2 px-3.5 hover:border-primary shadow-sm"
                >
                  <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                  <span>{formatDateDDMMYYYY(selectedDate)}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={new Date(selectedDate)}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(getBusinessDate(date, true));
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {selectedDate !== getBusinessDate(new Date()) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedDate(getBusinessDate(new Date()))}
                className="h-10 text-[10px] font-bold uppercase px-2.5 text-primary hover:bg-primary/10 border border-primary/20 rounded-lg gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset Today
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger className="h-10 w-[200px] border-2 font-bold uppercase text-xs tracking-tight bg-background">
                <Filter className="mr-2 h-3.5 w-3.5 text-primary" />
                <SelectValue placeholder="All Cycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_cycles" className="font-bold uppercase text-xs">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3 w-3" /> Global History
                  </span>
                </SelectItem>
                {availableCycles.map((c) => (
                  <SelectItem key={c.name} value={c.name} className="font-bold uppercase text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* QUICK SECTION COMMAND BAR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40 text-xs font-bold uppercase no-scrollbar">
        <Button
          size="sm"
          variant={activeTab === 'all' ? 'default' : 'outline'}
          onClick={() => scrollToSection('all')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> All Overview
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'exec-summary' ? 'default' : 'outline'}
          onClick={() => scrollToSection('exec-summary')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Crown className="h-3.5 w-3.5" /> Executive Summary
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'growth' ? 'default' : 'outline'}
          onClick={() => scrollToSection('growth')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" /> Growth Centre
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'revenue' ? 'default' : 'outline'}
          onClick={() => scrollToSection('revenue')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <PieChart className="h-3.5 w-3.5" /> Revenue Intel
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'customer' ? 'default' : 'outline'}
          onClick={() => scrollToSection('customer')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Users className="h-3.5 w-3.5" /> Customer Intel
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'gaming' ? 'default' : 'outline'}
          onClick={() => scrollToSection('gaming')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Gamepad2 className="h-3.5 w-3.5" /> Gaming Intel
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'cafe' ? 'default' : 'outline'}
          onClick={() => scrollToSection('cafe')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Utensils className="h-3.5 w-3.5" /> Café Intel
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'employee' ? 'default' : 'outline'}
          onClick={() => scrollToSection('employee')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Staff Intel
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'financial' ? 'default' : 'outline'}
          onClick={() => scrollToSection('financial')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Wallet className="h-3.5 w-3.5" /> Financial P&L
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'operational' ? 'default' : 'outline'}
          onClick={() => scrollToSection('operational')}
          className="h-8 text-xs font-bold gap-1.5 shrink-0"
        >
          <Activity className="h-3.5 w-3.5" /> Operations
        </Button>
      </div>

      {/* 1. EXECUTIVE SUMMARY & HEALTH SCORE BANNER */}
      <section id="exec-summary">
        <OwnerPulseExecutiveSummary
          kpis={pulseData.executiveSummary}
          healthBreakdown={pulseData.healthBreakdown}
          todayStr={pulseData.todayStr}
        />
      </section>

      {/* 2. RULE-BASED INSIGHTS ALERTS */}
      <section id="insights">
        <OwnerPulseRulesInsights insights={pulseData.ruleInsights} />
      </section>

      {/* 3. GROWTH CENTRE */}
      <section id="growth">
        <OwnerPulseGrowthCentre benchmarks={pulseData.periodBenchmarks} />
      </section>

      {/* 4. REVENUE INTELLIGENCE */}
      <section id="revenue">
        <OwnerPulseRevenueIntel data={pulseData.revenueIntelligence} />
      </section>

      {/* 5. CUSTOMER INTELLIGENCE */}
      <section id="customer">
        <OwnerPulseCustomerIntel data={pulseData.customerIntelligence} />
      </section>

      {/* 6. GAMING INTELLIGENCE */}
      <section id="gaming">
        <OwnerPulseGamingIntel data={pulseData.gamingIntelligence} />
      </section>

      {/* 7. CAFE INTELLIGENCE */}
      <section id="cafe">
        <OwnerPulseCafeIntel data={pulseData.cafeIntelligence} />
      </section>

      {/* 8. EMPLOYEE INTELLIGENCE */}
      <section id="employee">
        <OwnerPulseEmployeeIntel employees={pulseData.employeeIntelList} />
      </section>

      {/* 9. FINANCIAL INTELLIGENCE */}
      <section id="financial">
        <OwnerPulseFinancialIntel data={pulseData.financialIntelligence} />
      </section>

      {/* 10. OPERATIONAL HEALTH */}
      <section id="operational">
        <OwnerPulseOperationalHealth data={pulseData.operationalHealth} />
      </section>
    </div>
  );
}
