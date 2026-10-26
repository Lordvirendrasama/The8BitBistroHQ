'use client';

import React, { useState } from 'react';
import { DataReconciliationReport, MetricDefinition } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  FileSearch,
  HelpCircle,
  Copy,
  Layers,
  ArrowRight
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/utils';

interface ReconciliationViewProps {
  report: DataReconciliationReport;
  dictionary: Record<string, MetricDefinition>;
}

export function OwnerPulseReconciliationView({ report, dictionary }: ReconciliationViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'unmatched' | 'categories' | 'dictionary'>('overview');
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const getFreshnessBadge = (status: DataReconciliationReport['freshnessStatus']) => {
    switch (status) {
      case 'Fresh':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Fresh (&lt; 2h)</Badge>;
      case 'Normal':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Normal (&lt; 12h)</Badge>;
      case 'Stale':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Stale (&gt; 24h)</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">No Records</Badge>;
    }
  };

  const kpisList = Object.values(dictionary);

  return (
    <Card className="border-2 border-cyan-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-cyan-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-cyan-400" />
            Data Quality &amp; Financial Reconciliation Ledger
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Audit Trail, Freshness Diagnostics, Formula Verification &amp; Metric Lineage
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {report.isFullyReconciled ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-mono text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% RECONCILED
            </Badge>
          ) : (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1 font-mono text-xs">
              <AlertTriangle className="h-3.5 w-3.5" /> ₹{report.discrepancyAmount.toLocaleString()} DISCREPANCY
            </Badge>
          )}
          {getFreshnessBadge(report.freshnessStatus)}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* NAV PILLS */}
        <div className="flex items-center gap-2 border-b border-border/40 pb-3 overflow-x-auto text-xs font-bold uppercase no-scrollbar">
          <Button
            size="sm"
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
            className="h-8 gap-1.5"
          >
            <Database className="h-3.5 w-3.5" /> Quality Audit Overview
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'unmatched' ? 'default' : 'outline'}
            onClick={() => setActiveTab('unmatched')}
            className="h-8 gap-1.5"
          >
            <FileSearch className="h-3.5 w-3.5" /> Unmatched Bills ({report.unmatchedTransactions.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'categories' ? 'default' : 'outline'}
            onClick={() => setActiveTab('categories')}
            className="h-8 gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" /> Category Failures ({report.categoryMappingFailures.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'dictionary' ? 'default' : 'outline'}
            onClick={() => setActiveTab('dictionary')}
            className="h-8 gap-1.5"
          >
            <HelpCircle className="h-3.5 w-3.5" /> KPI Dictionary &amp; Lineage ({kpisList.length})
          </Button>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" /> Data Freshness
                </p>
                <p className="text-xl font-extrabold font-body text-foreground mt-1">
                  {report.dataFreshnessMinutes < 99999 ? `${report.dataFreshnessMinutes} min ago` : 'No Records'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  Last: {report.lastRecordedBillTime ? formatDateDDMMYYYY(report.lastRecordedBillTime) : 'None'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Bills Audited</p>
                <p className="text-xl font-extrabold font-body text-foreground mt-1">
                  {report.totalBillsAudited} <span className="text-xs font-normal opacity-60">transactions</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Duplicates: <strong className={report.duplicateRecords.length > 0 ? "text-destructive" : "text-emerald-400"}>{report.duplicateRecords.length}</strong>
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reconciled Sales</p>
                <p className="text-xl font-extrabold font-body text-emerald-400 mt-1">
                  ₹{report.reconciledSalesTotal.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Itemized Sum: ₹{report.itemizedRevenueTotal.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variance / Discrepancy</p>
                <p className={`text-xl font-extrabold font-body mt-1 ${report.discrepancyAmount === 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                  ₹{report.discrepancyAmount.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tolerance: &plusmn;₹2 rounding
                </p>
              </div>
            </div>

            {/* INTEGRITY STATUS SUMMARY */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-400" /> Database Health Checks
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                  <span className="text-muted-foreground">Duplicate Bill IDs:</span>
                  <Badge variant={report.duplicateRecords.length === 0 ? "outline" : "destructive"} className="text-xs">
                    {report.duplicateRecords.length} found
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                  <span className="text-muted-foreground">Invalid / Missing Timestamps:</span>
                  <Badge variant={report.invalidDatesCount === 0 ? "outline" : "destructive"} className="text-xs">
                    {report.invalidDatesCount} detected
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                  <span className="text-muted-foreground">Category Mapping Failures:</span>
                  <Badge variant={report.categoryMappingFailures.length === 0 ? "outline" : "secondary"} className="text-xs">
                    {report.categoryMappingFailures.length} items
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                  <span className="text-muted-foreground">Unclosed Old Shifts (&gt;16h):</span>
                  <Badge variant={report.unclosedHistoricalShiftsCount === 0 ? "outline" : "destructive"} className="text-xs">
                    {report.unclosedHistoricalShiftsCount} isolated
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. UNMATCHED TRANSACTIONS TAB */}
        {activeTab === 'unmatched' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Transactions Failing Mathematical Balance Checks
              </h4>
              <Badge variant="outline" className="text-xs font-mono">
                Formula: totalAmount === initialPackagePrice + foodSubtotal - discount
              </Badge>
            </div>
            {report.unmatchedTransactions.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-foreground">Zero Mathematical Discrepancies</p>
                <p className="text-xs text-muted-foreground">
                  All recorded bills balance perfectly with their respective items, packages, and discounts.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase">Bill ID</TableHead>
                      <TableHead className="text-xs font-bold uppercase">Discrepancy Details</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.unmatchedTransactions.map((tx, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs font-bold text-foreground">{tx.billId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.reason}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-destructive text-right">
                          ₹{tx.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* 3. CATEGORY MAPPING FAILURES TAB */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Items That Could Not Be Mapped to Canonical Categories
            </h4>
            {report.categoryMappingFailures.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-foreground">100% Item Category Coverage</p>
                <p className="text-xs text-muted-foreground">
                  All menu items successfully resolved to one of the 8 canonical business channels.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase">Item Name</TableHead>
                      <TableHead className="text-xs font-bold uppercase">Units Sold</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-right">Revenue Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.categoryMappingFailures.map((f, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-bold text-foreground">{f.itemName}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{f.count}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-right text-foreground">
                          ₹{f.revenue.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* 4. KPI DICTIONARY & LINEAGE TAB */}
        {activeTab === 'dictionary' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Metric Lineage &amp; Calculation Registry
              </h4>
              <Badge variant="outline" className="text-xs font-mono border-cyan-500/30 text-cyan-400">
                TIMEZONE: ASIA/KOLKATA (IST)
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kpisList.map((kpi) => (
                <div
                  key={kpi.id}
                  onClick={() => setSelectedKpi(selectedKpi === kpi.id ? null : kpi.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedKpi === kpi.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-border/60 bg-muted/10 hover:border-cyan-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 mr-2">{kpi.category}</span>
                      <h5 className="text-sm font-bold text-foreground mt-0.5">{kpi.name}</h5>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">{kpi.unit}</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{kpi.definition}</p>

                  <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-mono text-foreground font-bold">{kpi.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Window:</span>
                      <span className="text-foreground">{kpi.timeRange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Formula:</span>
                      <span className="font-mono text-cyan-400 truncate max-w-[240px]">{kpi.calculationMethod}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
