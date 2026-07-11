'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  UserX, 
  ShieldAlert, 
  Loader2, 
  Calendar, 
  Banknote, 
  ShoppingBag, 
  ChevronDown, 
  ChevronUp, 
  IndianRupee,
  Utensils
} from 'lucide-react';
import { format } from 'date-fns';
import type { Employee, StaffOrder } from '@/lib/types';

export default function ExEmployeesPage() {
  const { db } = useFirebase();
  const { user, loading: authLoading } = useAuth();

  // 1. Fetch all employees in database
  const employeesQuery = useMemo(() => (!db ? null : collection(db, 'employees')), [db]);
  const { data: allEmployees, loading: employeesLoading } = useCollection<Employee>(employeesQuery);

  // 2. Fetch all staff orders
  const staffOrdersQuery = useMemo(() => (!db ? null : collection(db, 'staffOrders')), [db]);
  const { data: staffOrders, loading: ordersLoading } = useCollection<StaffOrder>(staffOrdersQuery);

  // Expanded states for order history accordion
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  const toggleExpand = (username: string) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  // Compile ex-employees list
  const exEmployees = useMemo(() => {
    if (!allEmployees || !staffOrders) return [];

    // Active usernames list to filter out active employees from virtual list
    const activeUsernames = new Set(
      allEmployees
        .filter(e => e.isActive !== false)
        .map(e => e.username.toLowerCase())
    );

    // Direct inactive/deactivated employees from DB
    const directEx = allEmployees.filter(e => e.isActive === false);
    const directExUsernames = new Set(directEx.map(e => e.username.toLowerCase()));

    // Virtual ex-employees (who have orders but don't exist in DB anymore or are not active)
    const virtualExMap = new Map<string, { username: string; displayName: string }>();
    staffOrders.forEach(order => {
      const usernameLower = order.employeeUsername.toLowerCase();
      if (!activeUsernames.has(usernameLower) && !directExUsernames.has(usernameLower)) {
        virtualExMap.set(usernameLower, {
          username: order.employeeUsername,
          displayName: order.employeeDisplayName
        });
      }
    });

    const combined = [
      ...directEx.map(e => ({
        id: e.id,
        username: e.username,
        displayName: e.displayName,
        role: e.role,
        salary: e.salary,
        salaryType: e.salaryType,
        joinDate: e.joinDate,
        foodAllowanceBalance: e.foodAllowanceBalance,
        isVirtual: false
      })),
      ...Array.from(virtualExMap.values()).map(v => ({
        username: v.username,
        displayName: v.displayName,
        role: 'staff',
        roleCustom: 'Deleted Profile',
        salary: 0,
        salaryType: 'hourly',
        joinDate: undefined,
        foodAllowanceBalance: 0,
        isVirtual: true
      }))
    ];

    return combined.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allEmployees, staffOrders]);

  // Handle Loading States
  if (authLoading) {
    return (
      <div className="p-12 text-center font-bold uppercase animate-pulse flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Authenticating Console...
      </div>
    );
  }

  // Security Check: Only Viren (Owner)
  if (!user || user.username !== 'Viren') {
    return (
      <Card className="border-2 border-destructive/20 bg-destructive/5 mx-auto max-w-2xl mt-12 overflow-hidden">
        <CardHeader className="p-6 text-center flex flex-col items-center gap-4">
          <div className="p-4 bg-destructive/10 rounded-full text-destructive">
            <ShieldAlert className="h-12 w-12" />
          </div>
          <CardTitle className="font-headline text-3xl tracking-wider text-destructive">ACCESS DENIED</CardTitle>
          <CardDescription className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Only Viren holds authorization to view operator archival intelligence.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (employeesLoading || ordersLoading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center gap-4 font-bold uppercase tracking-widest opacity-60">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        Decrypting workforce registry archives...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-body">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-destructive/10 rounded-xl text-destructive border border-destructive/20">
          <UserX className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-headline text-2xl tracking-wide uppercase">Archived Operators</h2>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Historical logs and staff meal spending audits for former employees.
          </p>
        </div>
      </div>

      {exEmployees.length === 0 ? (
        <Card className="border-2 border-dashed p-12 text-center opacity-40">
          <UserX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="font-headline text-sm tracking-widest uppercase">No Archives Available</p>
          <p className="text-xs font-bold uppercase text-muted-foreground mt-1">
            No deactivated or retired operator profiles detected in registry.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {exEmployees.map((emp) => {
            // Find orders for this ex-employee
            const orders = (staffOrders || [])
              .filter(o => o.employeeUsername.toLowerCase() === emp.username.toLowerCase())
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const isExpanded = !!expandedEmployees[emp.username];

            return (
              <Card key={emp.username} className="border-2 border-foreground/5 bg-card/30 backdrop-blur-xl overflow-hidden rounded-2xl">
                <CardHeader className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-foreground/5 bg-muted/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-muted/50 rounded-xl border-2 border-foreground/10 flex items-center justify-center shrink-0">
                      <UserX className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-lg uppercase leading-none">{emp.displayName}</h3>
                        {emp.isVirtual ? (
                          <Badge variant="destructive" className="h-4 text-[8px] font-black uppercase tracking-wider bg-red-950/40 text-red-400 border-red-500/20">Deleted Profile</Badge>
                        ) : (
                          <Badge variant="secondary" className="h-4 text-[8px] font-black uppercase tracking-wider bg-orange-950/40 text-orange-400 border-orange-500/20">Deactivated</Badge>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">@{emp.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="text-left md:text-right">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Total Meal Spend</span>
                      <span className="font-mono font-black text-xl text-emerald-500 flex items-center leading-none mt-1">
                        <IndianRupee className="h-4 w-4 shrink-0 text-emerald-600" />
                        {totalSpent.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-6">
                  {/* Personnel Data Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3.5 bg-muted/20 border rounded-xl flex flex-col justify-center">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Operator Role</span>
                      <span className="font-bold text-xs uppercase text-foreground/80 mt-1">{emp.role || 'staff'}</span>
                    </div>

                    <div className="p-3.5 bg-muted/20 border rounded-xl flex flex-col justify-center">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Banknote className="h-3 w-3 text-emerald-600" /> Compensation
                      </span>
                      <span className="font-bold font-mono text-xs text-foreground/80 mt-1">
                        {emp.isVirtual || !emp.salary ? 'N/A' : `₹${emp.salary.toLocaleString()} / ${emp.salaryType}`}
                      </span>
                    </div>

                    <div className="p-3.5 bg-muted/20 border rounded-xl flex flex-col justify-center">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-indigo-500" /> Enlistment Date
                      </span>
                      <span className="font-bold text-xs text-foreground/80 mt-1">
                        {emp.joinDate ? format(new Date(emp.joinDate), 'yyyy-MM-dd') : 'N/A'}
                      </span>
                    </div>

                    <div className="p-3.5 bg-muted/20 border rounded-xl flex flex-col justify-center">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Final Meal Quota</span>
                      <span className="font-bold font-mono text-xs text-foreground/80 mt-1">
                        ₹{(emp.foodAllowanceBalance ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Accompanying orders log */}
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      onClick={() => toggleExpand(emp.username)}
                      className="w-full h-11 border-2 font-black uppercase text-[10px] tracking-widest flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                        Staff Food History ({orders.length} orders)
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {isExpanded && (
                      <div className="space-y-4 pt-2 border-t animate-in fade-in slide-in-from-top-1 duration-200">
                        {orders.length === 0 ? (
                          <div className="py-6 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                            No meal order transactions recorded.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {orders.map((order) => (
                              <div key={order.id} className="p-4 bg-muted/15 border border-foreground/5 rounded-xl space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-foreground/70">
                                      {format(new Date(order.timestamp), 'MMM dd, yyyy - hh:mm a')}
                                    </span>
                                    <Badge variant="outline" className="w-fit text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/20">
                                      {order.cycle}
                                    </Badge>
                                  </div>
                                  <span className="font-mono font-black text-sm text-emerald-500 flex items-center">
                                    Total: ₹{order.totalAmount}
                                  </span>
                                </div>

                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="h-8 font-black uppercase text-[8px] tracking-wider">Item Taken</TableHead>
                                      <TableHead className="h-8 font-black uppercase text-[8px] tracking-wider text-right">Quantity</TableHead>
                                      <TableHead className="h-8 font-black uppercase text-[8px] tracking-wider text-right">Unit Price</TableHead>
                                      <TableHead className="h-8 font-black uppercase text-[8px] tracking-wider text-right">Subtotal</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {order.items.map((item, idx) => (
                                      <TableRow key={idx} className="hover:bg-transparent border-b/5 border-b">
                                        <TableCell className="py-2.5 font-bold text-xs uppercase flex items-center gap-1.5 text-foreground/80">
                                          <Utensils className="h-3 w-3 text-muted-foreground" />
                                          {item.name}
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right font-mono text-xs text-foreground/85">{item.quantity}</TableCell>
                                        <TableCell className="py-2.5 text-right font-mono text-xs text-foreground/85">₹{item.price}</TableCell>
                                        <TableCell className="py-2.5 text-right font-mono font-bold text-xs text-foreground">₹{item.price * item.quantity}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
