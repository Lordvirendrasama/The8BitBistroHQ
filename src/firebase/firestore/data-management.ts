'use client';
import { getFirestore, collection, getDocs, writeBatch, doc, query, where, orderBy, limit } from 'firebase/firestore';
import type { Member, LogEntry, Bill, Expense } from '@/lib/types';
import { getSettings, updateSettings } from './settings';

// Helper function to escape CSV fields
const escapeCsvField = (field: any): string => {
  if (field === null || field === undefined) {
    return '';
  }
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

// Simple CSV parser
const parseCsvRow = (row: string): string[] => {
    const result: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
            if (inQuotes && row[i + 1] === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField);
    return result;
};

export const getCsvTemplate = (): string => {
  const headers = [
    'id', 'name', 'username', 'phone', 'email', 'tier',
    'level', 'xp', 'points', 'totalSpent', 'avatarUrl', 'joinDate', 'cycle'
  ];
  return headers.map(escapeCsvField).join(',');
}

export interface ExportFilters {
    cycle?: string;
    startDate?: string;
    endDate?: string;
}

export interface CycleMetadata {
    name: string;
    start: string | null;
    end: string | null;
}

/**
 * Scans core collections to find all unique cycle tags and their respective date ranges.
 */
export const getAvailableCycles = async (): Promise<CycleMetadata[]> => {
    const db = getFirestore();
    const cycleMap: Record<string, { start: number, end: number }> = {};
    
    const collectionsToCheck = [
        { name: 'bills', dateField: 'timestamp' },
        { name: 'logs', dateField: 'timestamp' },
        { name: 'expenses', dateField: 'timestamp' }
    ];
    
    try {
        for (const collInfo of collectionsToCheck) {
            const snapshot = await getDocs(collection(db, collInfo.name));
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const cycle = data.cycle;
                const dateVal = data[collInfo.dateField];
                
                if (cycle && dateVal) {
                    const time = new Date(dateVal).getTime();
                    if (!cycleMap[cycle]) {
                        cycleMap[cycle] = { start: time, end: time };
                    } else {
                        if (time < cycleMap[cycle].start) cycleMap[cycle].start = time;
                        if (time > cycleMap[cycle].end) cycleMap[cycle].end = time;
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error fetching unique cycles:", error);
    }
    
    return Object.entries(cycleMap)
        .map(([name, range]) => ({
            name,
            start: new Date(range.start).toISOString(),
            end: new Date(range.end).toISOString()
        }))
        .sort((a, b) => (b.start || '').localeCompare(a.start || '')); 
};

/**
 * Seals the current data period by tagging all untagged records with the oldName, then starts a new cycle.
 */
export const sealAndStartNewCycle = async (oldName: string, newName: string) => {
    const db = getFirestore();
    const now = new Date().toISOString();
    const settings = await getSettings();
    
    await retroactivelyTagData(oldName, undefined, now, true);

    await updateSettings({
        activeCycle: newName,
        cycleStartDate: now,
        lastCycleStartDate: settings.cycleStartDate || undefined
    });

    return true;
};

export const exportAllData = async (filters?: ExportFilters): Promise<string> => {
  const db = getFirestore();
  let csvContent = `BISTRO APP BACKUP EXPORT\n`;
  csvContent += `Generated on: ${new Date().toLocaleString()}\n`;
  if (filters?.cycle) csvContent += `Filter Cycle: ${filters.cycle}\n`;
  if (filters?.startDate) csvContent += `Window Start: ${filters.startDate}\n`;
  if (filters?.endDate) csvContent += `Window End: ${filters.endDate}\n`;
  csvContent += '\n';

  const applyFilters = (data: any[], dateField: string) => {
    return data.filter(item => {
        if (filters?.cycle && item.cycle !== filters.cycle) return false;
        const itemDateVal = item[dateField];
        if (!itemDateVal) {
            return !(filters?.startDate || filters?.endDate);
        }
        const itemIso = new Date(itemDateVal).getTime();
        if (filters?.startDate) {
            const startIso = new Date(filters.startDate).getTime();
            if (itemIso < startIso) return false;
        }
        if (filters?.endDate) {
            const endIso = new Date(filters.endDate).getTime();
            if (itemIso > endIso) return false;
        }
        return true;
    }).sort((a, b) => new Date(a[dateField]).getTime() - new Date(b[dateField]).getTime());
  };

  const membersSnapshot = await getDocs(collection(db, 'members'));
  let members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
  members = applyFilters(members, 'joinDate');
  
  const memberHeaders = ['id', 'name', 'username', 'phone', 'email', 'tier', 'level', 'xp', 'points', 'totalSpent', 'joinDate', 'cycle'];
  csvContent += '--- 1. MEMBERS LIST ---\n' + memberHeaders.join(',') + '\n';
  members.forEach(item => {
    const row = memberHeaders.map(h => escapeCsvField((item as any)[h]));
    csvContent += row.join(',') + '\n';
  });
  csvContent += '\n';

  const billsSnapshot = await getDocs(collection(db, 'bills'));
  let bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
  bills = applyFilters(bills, 'timestamp');
  
  const billHeaders = [
    'id', 'timestamp', 'stationName', 'packageName', 'totalAmount', 
    'foodSubtotal', 'initialPackagePrice', 'discount', 
    'paymentMethod', 'cashAmount', 'upiAmount', 'members', 'cycle'
  ];
  csvContent += '--- 2. SALES & ORDERS ---\n' + billHeaders.join(',') + '\n';
  bills.forEach(item => {
    const memberNames = (item.members || []).map(m => m.name).join('; ');
    const row = [
        item.id,
        item.timestamp,
        item.stationName,
        item.packageName || 'N/A',
        item.totalAmount,
        item.foodSubtotal,
        item.initialPackagePrice,
        item.discount,
        item.paymentMethod,
        item.cashAmount || 0,
        item.upiAmount || 0,
        memberNames,
        item.cycle || 'N/A'
    ].map(escapeCsvField);
    csvContent += row.join(',') + '\n';
  });
  csvContent += '\n';

  const expensesSnapshot = await getDocs(collection(db, 'expenses'));
  let expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  expenses = applyFilters(expenses, 'timestamp');
  
  const expHeaders = ['id', 'timestamp', 'amount', 'description', 'addedBy', 'cycle'];
  csvContent += '--- 3. EXPENSES ---\n' + expHeaders.join(',') + '\n';
  expenses.forEach(item => {
    const row = [
        item.id,
        item.timestamp,
        item.amount,
        item.description,
        item.addedBy?.displayName || 'Unknown',
        item.cycle || 'N/A'
    ].map(escapeCsvField);
    csvContent += row.join(',') + '\n';
  });
  csvContent += '\n';

  const logsSnapshot = await getDocs(collection(db, 'logs'));
  let logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
  logs = applyFilters(logs, 'timestamp');
  
  const logHeaders = ['id', 'timestamp', 'type', 'user', 'description', 'cycle'];
  csvContent += '--- 4. AUDIT LOGS ---\n' + logHeaders.join(',') + '\n';
  logs.forEach(item => {
    const cleanDesc = (item.description || '').replace(/<[^>]*>?/gm, '');
    const row = [
        item.id,
        item.timestamp,
        item.type,
        item.user?.displayName || 'System',
        cleanDesc,
        item.cycle || 'N/A'
    ].map(escapeCsvField);
    csvContent += row.join(',') + '\n';
  });

  return csvContent;
};

/**
 * Generates a unified accounting ledger combining revenue and expenses.
 */
export const exportAccountingLedger = async (filters?: ExportFilters): Promise<string> => {
  const db = getFirestore();
  
  const billsSnapshot = await getDocs(collection(db, 'bills'));
  const bills = billsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
  
  const expensesSnapshot = await getDocs(collection(db, 'expenses'));
  const expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));

  const applyFilters = (data: any[], dateField: string) => {
    return data.filter(item => {
        if (filters?.cycle && item.cycle !== filters.cycle) return false;
        const itemDateVal = item[dateField];
        if (!itemDateVal) return !(filters?.startDate || filters?.endDate);
        const itemIso = new Date(itemDateVal).getTime();
        if (filters?.startDate && itemIso < new Date(filters.startDate).getTime()) return false;
        if (filters?.endDate && itemIso > new Date(filters.endDate).getTime()) return false;
        return true;
    });
  };

  const filteredBills = applyFilters(bills, 'timestamp');
  const filteredExpenses = applyFilters(expenses, 'timestamp');

  let csvContent = `BISTRO FINANCIAL ACCOUNTING LEDGER\n`;
  csvContent += `Generated: ${new Date().toLocaleString()}\n`;
  if (filters?.cycle) csvContent += `Operational Phase: ${filters.cycle}\n`;
  csvContent += '\n';

  // --- SECTION 1: CONSOLIDATED CHRONOLOGICAL LEDGER ---
  const ledgerEntries: any[] = [];
  
  filteredBills.forEach(b => {
    ledgerEntries.push({
        date: b.timestamp,
        type: 'INCOME',
        category: b.packageName || 'Walk-in Order',
        description: `Order at ${b.stationName} (${(b.members || []).map(m => m.name).join(', ')})`,
        amount: b.totalAmount,
        method: b.paymentMethod.toUpperCase(),
        cycle: b.cycle
    });
  });

  filteredExpenses.forEach(e => {
    ledgerEntries.push({
        date: e.timestamp,
        type: 'EXPENSE',
        category: 'Operating Cost',
        description: e.description,
        amount: e.amount,
        method: 'CASH/OUTGOING',
        cycle: e.cycle
    });
  });

  ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const ledgerHeaders = ['Date', 'Type', 'Category', 'Description', 'Income (+)', 'Expense (-)', 'Method', 'Cycle'];
  csvContent += '--- 1. GENERAL LEDGER ---\n' + ledgerHeaders.join(',') + '\n';
  
  let totalIncome = 0;
  let totalExpense = 0;

  ledgerEntries.forEach(entry => {
    const income = entry.type === 'INCOME' ? entry.amount : 0;
    const expense = entry.type === 'EXPENSE' ? entry.amount : 0;
    totalIncome += income;
    totalExpense += expense;

    const row = [
        new Date(entry.date).toLocaleString(),
        entry.type,
        entry.category,
        entry.description,
        income || '',
        expense || '',
        entry.method,
        entry.cycle || 'N/A'
    ].map(escapeCsvField);
    csvContent += row.join(',') + '\n';
  });

  csvContent += `\nTOTALS,,,TOTAL REVENUE,${totalIncome},TOTAL EXPENSE,${totalExpense}\n`;
  csvContent += `NET POSITION,,,,${totalIncome - totalExpense}\n\n`;

  // --- SECTION 2: DAILY PROFIT/LOSS SUMMARY ---
  const dailyMap: Record<string, { income: number, expense: number }> = {};
  ledgerEntries.forEach(entry => {
    const day = new Date(entry.date).toLocaleDateString();
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    if (entry.type === 'INCOME') dailyMap[day].income += entry.amount;
    else dailyMap[day].expense += entry.amount;
  });

  const dailyHeaders = ['Date', 'Revenue', 'Expenses', 'Net Profit'];
  csvContent += '--- 2. DAILY PERFORMANCE SUMMARY ---\n' + dailyHeaders.join(',') + '\n';
  Object.entries(dailyMap).forEach(([date, data]) => {
    const row = [date, data.income, data.expense, data.income - data.expense].map(escapeCsvField);
    csvContent += row.join(',') + '\n';
  });

  return csvContent;
};

export const exportGoogleContacts = async (): Promise<string> => {
  const db = getFirestore();
  const membersSnapshot = await getDocs(collection(db, 'members'));
  const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

  const headers = [
    'Name', 'Given Name', 'Family Name', 'Nickname', 
    'E-mail 1 - Type', 'E-mail 1 - Value', 
    'Phone 1 - Type', 'Phone 1 - Value',
    'Notes'
  ];

  let csvContent = headers.map(escapeCsvField).join(',') + '\n';

  members.forEach(member => {
    if (!member.phone && !member.email) return;

    const nameParts = member.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    const suffix = 'The 8 Bit Bistro Member';
    const modifiedLastName = lastName ? `${lastName} ${suffix}` : suffix;
    const fullNameWithSuffix = `${firstName} ${modifiedLastName}`.trim();

    const row = [
      fullNameWithSuffix,
      firstName,
      modifiedLastName,
      member.username,
      member.email ? 'Personal' : '',
      member.email || '',
      member.phone ? 'Mobile' : '',
      member.phone || '',
      `Bistro Level: ${member.level}, Total Spent: ₹${member.totalSpent}`
    ].map(escapeCsvField);

    csvContent += row.join(',') + '\n';
  });

  return csvContent;
};

export const retroactivelyTagData = async (cycleName: string, startDate?: string, endDate?: string, forceTagAllBeforeEnd: boolean = false): Promise<number> => {
    const db = getFirestore();
    const batchSize = 400; 
    let count = 0;

    const collections = [
        { name: 'members', dateField: 'joinDate' },
        { name: 'bills', dateField: 'timestamp' },
        { name: 'expenses', dateField: 'timestamp' },
        { name: 'logs', dateField: 'timestamp' }
    ];

    for (const collInfo of collections) {
        const snapshot = await getDocs(collection(db, collInfo.name));
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const snap of snapshot.docs) {
            const data = snap.data();
            const dateVal = data[collInfo.dateField];
            
            let shouldTag = true;
            if (dateVal) {
                const itemTime = new Date(dateVal).getTime();
                if (startDate && itemTime < new Date(startDate).getTime()) shouldTag = false;
                if (endDate && itemTime > new Date(endDate).getTime()) shouldTag = false;
            } else if (startDate || (endDate && !forceTagAllBeforeEnd)) {
                shouldTag = false;
            }

            if (shouldTag) {
                batch.update(snap.ref, { cycle: cycleName });
                count++;
                batchCount++;
                
                if (batchCount >= batchSize) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }
        }
        if (batchCount > 0) await batch.commit();
    }
    
    return count;
};

export const importDataFromCsv = async (csvContent: string): Promise<{ success: boolean; message: string; count: number; }> => {
    const db = getFirestore();
    const batchSize = 400;
    let count = 0;
    try {
        const rows = csvContent.split('\n').filter(row => row.trim() !== '');
        const headerRow = rows.shift();
        if (!headerRow) return { success: false, message: 'CSV is empty.', count: 0 };
        const headers = parseCsvRow(headerRow.trim());
        
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const row of rows) {
            const values = parseCsvRow(row.trim());
            const memberData: any = {};
            headers.forEach((header, index) => { memberData[header] = values[index] || null; });
            const { id, ...memberFields } = memberData;
            if (!id) continue;
            memberFields.level = parseInt(memberFields.level, 10) || 1;
            memberFields.xp = parseInt(memberFields.xp, 10) || 0;
            memberFields.points = parseInt(memberFields.points, 10) || 0;
            memberFields.totalSpent = parseFloat(memberFields.totalSpent) || 0;
            
            batch.set(doc(db, 'members', id), memberFields);
            count++;
            batchCount++;

            if (batchCount >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }
        if (batchCount > 0) await batch.commit();
        return { success: true, message: `Imported ${count} members.`, count };
    } catch (error: any) {
        return { success: false, message: error.message, count: 0 };
    }
};

export const deleteAllData = async (): Promise<void> => {
    const db = getFirestore();
    const collections = ['members', 'rewards', 'logs', 'bills', 'expenses', 'debts', 'shifts', 'adminNotifications', 'announcements'];
    for (const name of collections) {
        const snapshot = await getDocs(collection(db, name));
        let batch = writeBatch(db);
        let batchCount = 0;
        for (const docSnap of snapshot.docs) {
            batch.delete(docSnap.ref);
            batchCount++;
            if (batchCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }
        if (batchCount > 0) await batch.commit();
    }
};
