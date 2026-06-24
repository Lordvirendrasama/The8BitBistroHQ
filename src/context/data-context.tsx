'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy, DocumentData } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Station, Employee, Shift, GamingPackage, FoodItem } from '@/lib/types';

interface DataContextType {
  stations: Station[] | null;
  stationsLoading: boolean;
  employees: Employee[] | null;
  employeesLoading: boolean;
  activeShifts: Shift[] | null;
  activeShiftsLoading: boolean;
  gamingPackages: GamingPackage[] | null;
  gamingPackagesLoading: boolean;
  foodItems: FoodItem[] | null;
  foodItemsLoading: boolean;
}

const DataContext = createContext<DataContextType>({
  stations: null,
  stationsLoading: true,
  employees: null,
  employeesLoading: true,
  activeShifts: null,
  activeShiftsLoading: true,
  gamingPackages: null,
  gamingPackagesLoading: true,
  foodItems: null,
  foodItemsLoading: true,
});

export const useData = () => useContext(DataContext);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { db } = useFirebase();

  // Core global queries
  const stationsQuery = useMemo(() => (!db ? null : query(collection(db, 'stations'), orderBy('order'))), [db]);
  const employeesQuery = useMemo(() => (!db ? null : query(collection(db, 'employees'), where('isActive', '==', true))), [db]);
  const activeShiftsQuery = useMemo(() => (!db ? null : query(collection(db, 'shifts'), where('status', '==', 'active'))), [db]);
  const gamingPackagesQuery = useMemo(() => (!db ? null : collection(db, 'gamingPackages')), [db]);
  const foodItemsQuery = useMemo(() => (!db ? null : collection(db, 'foodItems')), [db]);

  // Execute snapshot listeners
  const { data: stations, loading: stationsLoading } = useCollection<Station>(stationsQuery);
  const { data: employees, loading: employeesLoading } = useCollection<Employee>(employeesQuery);
  const { data: activeShifts, loading: activeShiftsLoading } = useCollection<Shift>(activeShiftsQuery);
  const { data: gamingPackages, loading: gamingPackagesLoading } = useCollection<GamingPackage>(gamingPackagesQuery);
  const { data: foodItems, loading: foodItemsLoading } = useCollection<FoodItem>(foodItemsQuery);

  const value = useMemo(
    () => ({
      stations,
      stationsLoading,
      employees,
      employeesLoading,
      activeShifts,
      activeShiftsLoading,
      gamingPackages,
      gamingPackagesLoading,
      foodItems,
      foodItemsLoading,
    }),
    [
      stations,
      stationsLoading,
      employees,
      employeesLoading,
      activeShifts,
      activeShiftsLoading,
      gamingPackages,
      gamingPackagesLoading,
      foodItems,
      foodItemsLoading,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
