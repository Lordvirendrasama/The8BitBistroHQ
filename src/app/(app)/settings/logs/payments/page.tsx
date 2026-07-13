'use client';
import { LogTable } from '@/components/logs/log-table';

export default function SettingsPaymentLogsPage() {
  return (
    <LogTable
      title="Payment & Billing Events"
      description="Audit trail for all station checkouts and transactions."
      logTypes={['BILL_PAID', 'BILL_UPDATED', 'BILL_DELETED']}
    />
  );
}
