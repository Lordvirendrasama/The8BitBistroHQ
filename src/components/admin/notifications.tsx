
'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { AdminNotification } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { X, FileWarning, Bell, Receipt, Trash2, StickyNote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dismissAdminNotification } from '@/firebase/firestore/notifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function AdminNotifications() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const notificationsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'adminNotifications'), where('isRead', '==', false));
  }, [db]);

  const { data: unsortedNotifications, loading } = useCollection<AdminNotification>(notificationsQuery);

  const notifications = useMemo(() => {
    if (!unsortedNotifications) {
      return [];
    }
    return unsortedNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [unsortedNotifications]);


  const handleDismiss = async (notificationId: string) => {
    await dismissAdminNotification(notificationId);
    toast({
      title: 'Notification Dismissed',
    });
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
        case 'BILL_DELETED':
            return { icon: <Trash2 className="h-4 w-4" />, title: 'Bill Wipe Alert', color: 'text-destructive' };
        case 'BILL_MODIFIED':
            return { icon: <Receipt className="h-4 w-4" />, title: 'Bill Edit Audit', color: 'text-amber-600 dark:text-amber-400' };
        case 'STAFF_NOTE':
            return { icon: <StickyNote className="h-4 w-4" />, title: 'Staff Briefing', color: 'text-blue-600 dark:text-blue-400' };
        default:
            return { icon: <FileWarning className="h-4 w-4" />, title: 'Incomplete Shift', color: 'text-amber-600 dark:text-amber-400' };
    }
  }

  // SECURITY: Only show to Viren (Owner)
  if (user?.username !== 'Viren') {
    return null;
  }

  if (loading || !notifications || notifications.length === 0) {
    return null;
  }

  return (
    <Popover>
        <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
                <Badge variant="destructive" className="absolute -right-2 -top-2 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                    {notifications.length}
                </Badge>
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0">
            <div className="p-4 border-b">
                 <h4 className="font-medium leading-none flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Security Alerts</h4>
            </div>
            <div className="space-y-0 max-h-[400px] overflow-y-auto">
                {notifications.map((notification) => {
                    const styles = getNotificationStyles(notification.type);
                    return (
                        <Card key={notification.id} className="shadow-none rounded-none border-x-0 border-t-0 border-b">
                            <CardHeader className="p-4 space-y-1">
                                <CardTitle className={cn("text-xs font-black uppercase tracking-widest flex items-center gap-2", styles.color)}>
                                    {styles.icon}
                                    {styles.title}
                                </CardTitle>
                                <CardDescription className="text-sm font-medium text-foreground leading-relaxed pt-1" dangerouslySetInnerHTML={{ __html: notification.message }} />
                                <p className="text-[10px] text-muted-foreground font-bold uppercase pt-1">
                                    {new Date(notification.timestamp).toLocaleString()}
                                </p>
                            </CardHeader>
                            <CardFooter className="p-2 pt-0">
                                <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest h-8" onClick={() => handleDismiss(notification.id)}>
                                    <X className="mr-2 h-3.5 w-3.5" />
                                    Acknowledge
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </PopoverContent>
    </Popover>
  );
}
