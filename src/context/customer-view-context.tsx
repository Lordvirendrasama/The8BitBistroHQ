
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CustomerViewContextType {
  isCustomerView: boolean;
  toggleCustomerView: () => void;
}

const CustomerViewContext = createContext<CustomerViewContextType>({
  isCustomerView: false,
  toggleCustomerView: () => {},
});

export function CustomerViewProvider({ children }: { children: ReactNode }) {
  const [isCustomerView, setIsCustomerView] = useState(false);

  const toggleCustomerView = () => setIsCustomerView(prev => !prev);

  return (
    <CustomerViewContext.Provider value={{ isCustomerView, toggleCustomerView }}>
      {children}
    </CustomerViewContext.Provider>
  );
}

export function useCustomerView() {
  return useContext(CustomerViewContext);
}
