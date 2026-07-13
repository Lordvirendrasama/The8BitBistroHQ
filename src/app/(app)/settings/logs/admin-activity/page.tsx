'use client';
import { LogTable } from '@/components/logs/log-table';

export default function SettingsAdminActivityPage() {
  return (
    <LogTable
      title="User Login Activity"
      description="Log of all staff and admin logins to the portal."
      logTypes={['USER_LOGIN']}
    />
  );
}
