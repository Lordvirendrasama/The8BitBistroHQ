
export type MemberTier = 'Red' | 'Green' | 'Gold';

export interface MemberRecharge {
  id: string;
  packageId: string;
  packageName: string;
  totalDuration: number; // in seconds
  remainingDuration: number; // in seconds
  purchaseDate: string;
  expiryDate: string;
  pricePaid: number;
}

export interface Member {
  id: string;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  tier: MemberTier;
  level: number;
  xp: number;
  points: number;
  totalSpent: number;
  avatarUrl: string;
  joinDate: string;
  pendingAmount?: number;
  cycle?: string; // Data Cycle tag
  recharges?: MemberRecharge[];
}

export interface Reward {
  id:string;
  name:string;
  levelRequired: number;
  pointsCost: number;
  description: string;
  limitOnePerUser?: boolean;
}

export type RewardFormData = Omit<Reward, 'id'>;

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  price: number;
}

export type FoodItemFormData = Omit<FoodItem, 'id'>;

export interface Category {
  id: string;
  name: string;
}

export type CategoryFormData = Omit<Category, 'id'>;

export interface GamingPackage {
  id: string;
  name: string;
  duration: number; // in seconds
  price: number;
  validity: number; // in days
  startTime?: string; // "HH:mm" format
  endTime?: string; // "HH:mm" format
  availableDays?: string[]; // e.g., ['Mon', 'Tue']
  isAddTimePackage?: boolean;
  isRechargePack?: boolean;
  playerCapacity?: number; // 1 or 2
  isPriorityOffer?: boolean;
  isBoardGamePass?: boolean;
}

export type GamingPackageFormData = Omit<GamingPackage, 'id'>;

export interface Settings {
  xpPerRupee: number;
  xpPerLevel: number;
  maxLevels: number;
  pointsPerLevelUp: number;
  activeCycle: string; // The currently active data cycle
  cycleStartDate?: string; // When the current cycle officially began
  lastCycleStartDate?: string; // When the previous cycle began (for "Last Cycle to Now" logic)
}

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  xpGained: number;
  billId?: string;
  cycle?: string;
}

export interface ClaimedReward {
    id: string;
    rewardId: string;
    rewardName: string;
    date: string;
    pointsCost: number;
    cycle?: string;
}

export type LogEntryType = 
    | 'MEMBER_JOINED' 
    | 'XP_GAINED' 
    | 'REWARD_CLAIMED'
    | 'USER_LOGIN'
    | 'SHIFT_START'
    | 'SHIFT_END'
    | 'BREAK_START'
    | 'BREAK_END'
    | 'TASK_COMPLETED'
    | 'INCOMPLETE_SHIFT_LOGOUT'
    | 'BILL_PAID'
    | 'BILL_UPDATED'
    | 'BILL_DELETED'
    | 'EXPENSE_ADDED'
    | 'EXPENSE_DELETED'
    | 'DEBT_RECORDED'
    | 'DEBT_CLEARED'
    | 'OWNER_TASK_CREATED'
    | 'OWNER_TASK_COMPLETED'
    | 'OWNER_TASK_REORDERED'
    | 'SETTINGS_UPDATED'
    | 'DATA_ACTION'
    | 'DATA_BACKFILLED'
    | 'UI_ACTION'
    | 'MEMBER_RECHARGED'
    | 'RECHARGE_USED';


export interface LogEntry {
  id: string;
  type: LogEntryType;
  description: string;
  timestamp: string; // ISO 8601 string
  memberId?: string;
  details?: Record<string, any>;
  user?: {
    uid: string;
    displayName: string | null;
  };
  cycle?: string;
}

export interface PendingXpClaim {
    id: string;
    memberId: string;
    memberName: string;
    amount: number;
    baseXp: number;
    tierMultiplier: number;
    xpToGrant: number;
    timestamp: string; // ISO 8601 string
    status: 'pending';
}

export interface RecentRewardClaim {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatarUrl: string;
  rewardName: string;
  pointsCost: number;
  timestamp: string; // ISO 8601 string
}

export type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface AssignedMember {
  id: string;
  name: string;
  avatarUrl: string;
  rechargeId?: string | null; // Specific recharge being used
  packageId?: string | null; // Specific walk-in package being used
  isNewRecharge?: boolean; // Flag if they are buying a recharge pack at start
  startTime?: string | null;
  endTime?: string | null;
  remainingTimeOnPause?: number | null; // in seconds
  status?: 'active' | 'paused' | 'finished';
}

export interface BillItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  addedAt?: string;
}

export type PaymentMethod = 'cash' | 'upi' | 'split' | 'pending' | 'recharge';

export interface Bill {
  id: string;
  stationId: string;
  stationName: string;
  packageName?: string;
  members: AssignedMember[];
  items: BillItem[];
  initialPackagePrice: number;
  foodSubtotal: number;
  discount: number;
  totalAmount: number;
  timestamp: string;
  shiftId?: string;
  paymentMethod: PaymentMethod;
  cashAmount?: number;
  upiAmount?: number;
  cycle?: string;
  isRechargePurchase?: boolean;
}

export type StationStatus = 'available' | 'in-use' | 'paused';

export interface Station {
  id: string;
  name: string;
  type: 'ps5' | 'boardgame';
  status: StationStatus;
  startTime: string | null;
  endTime: string | null;
  pauseStartTime?: string | null;
  remainingTimeOnPause?: number | null;
  packageName: string | null;
  members: AssignedMember[];
  currentBill?: BillItem[];
  discount?: number;
}

export interface ShiftTask {
    name: string;
    completed: boolean;
    completedAt?: string;
    type: 'start-of-day' | 'end-of-day';
    completedBy?: {
        username: string;
        displayName: string;
    };
}

export interface ShiftBreak {
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
}

export interface Shift {
    id: string;
    date: string;
    staffId: string; // The username of the person who started the shift
    employees: {
        username: string;
        displayName: string;
    }[];
    startTime: string;
    endTime?: string;
    status: 'active' | 'completed' | 'recovered';
    tasks: ShiftTask[];
    breaks: ShiftBreak[];
    lateMinutes?: number;
    earlyLeaveMinutes?: number;
    overtimeMinutes?: number;
    workedOnWeeklyOff?: boolean;
    cashTotal?: number;
    upiTotal?: number;
    shiftExpenses?: number;
    cycle?: string;
}

export interface Task {
  id: string;
  name: string;
  type: 'start-of-day' | 'end-of-day';
}

export type TaskFormData = Omit<Task, 'id'>;

export type AdminNotificationType = 'INCOMPLETE_SHIFT' | 'BILL_MODIFIED' | 'BILL_DELETED' | 'STAFF_NOTE';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  message: string;
  timestamp: string;
  isRead: boolean;
  triggeredBy: {
    username: string;
    displayName: string;
    role: string;
  };
}

export interface AudioAnnouncement {
  id: string;
  text: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  timestamp: string;
  addedBy: {
    uid: string;
    displayName: string | null;
  };
  cycle?: string;
}

export interface Debt {
  id: string;
  type: 'receivable' | 'payable';
  contactName: string;
  contactPhone: string;
  memberId?: string;
  amount: number;
  originalAmount: number;
  description: string;
  timestamp: string;
  status: 'pending' | 'cleared';
  cycle?: string;
}

export interface OwnerTask {
  id: string;
  title: string;
  description: string;
  dueDateTime: string;
  status: 'pending' | 'completed';
  priority: 'low' | 'medium' | 'high';
  category: 'bill' | 'upgrade' | 'maintenance' | 'strategic';
  createdAt: string;
  isRecurring?: boolean;
  order: number;
  isSeparator?: boolean;
}

export type OwnerTaskFormData = Omit<OwnerTask, 'id' | 'createdAt' | 'status' | 'order'>;
