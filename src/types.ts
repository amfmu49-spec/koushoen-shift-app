export type ShiftType = '早出' | '日A' | '日B' | '日C' | '5夜S' | '／' | '休';

export interface CommitteeSchedule {
  name: string;
  scheduleType: 'dayOfMonth' | 'dayOfWeek' | 'none';
  dayOfMonth?: number; // 1-31
  weekIndex?: number; // 1-5 for Nth day of week
  dayOfWeek?: number; // 0 (Sun) - 6 (Sat)
}

export interface Staff {
  id: number;
  name: string;
  isRegular: boolean;
  canNightShift: boolean;
  maxConsecutive: number;
  notes: string;
  allowedShifts: ShiftType[];
  targetOffDays?: number;
  role?: string; // e.g., "介護長", "リーダー"
  committee?: CommitteeSchedule;
}

export interface DayInfo {
  day: number; // 1-31
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  isWeekend: boolean;
}

export type Schedule = {
  [staffId: number]: ShiftType;
};

// Monthly schedule is an array of Schedule objects (0-indexed, where index 0 corresponds to Day 1)
export type MonthSchedule = Schedule[];

export interface RuleCheckDetail {
  id: string;
  name: string;
  description: string;
  isHard: boolean;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface RuleSummary {
  passed: boolean;
  details: RuleCheckDetail[];
}
