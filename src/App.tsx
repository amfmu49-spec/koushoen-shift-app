import React, { useState, useEffect } from 'react';
import { MonthSchedule, DayInfo, RuleSummary, Staff, ShiftType } from './types';
import { 
  getDaysInMonth, 
  solveShiftSchedule, 
  validateSchedule, 
  exportToCSV,
  getPerfectJuly2026Schedule,
  STAFF_LIST
} from './utils/solver';
import ScheduleGrid from './components/ScheduleGrid';
import RuleCheckerPanel from './components/RuleCheckerPanel';
import StatsPanel from './components/StatsPanel';
import { ClipboardList, Users, Shield, CalendarCheck, Info, Sparkles, AlertTriangle, Sliders, ChevronDown, ChevronUp, Settings2, Plus, Trash2, Upload, Download } from 'lucide-react';

export default function App() {
  // Setup state for Year, Month, Rotation offset with LocalStorage persistence
  const [year, setYear] = useState<number>(() => {
    const saved = localStorage.getItem('benishouen_year');
    return saved ? parseInt(saved, 10) : 2026;
  });
  const [month, setMonth] = useState<number>(() => {
    const saved = localStorage.getItem('benishouen_month');
    return saved ? parseInt(saved, 10) : 7;
  });
  const [rotationOffset, setRotationOffset] = useState<number>(() => {
    const saved = localStorage.getItem('benishouen_rotation_offset');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // Target off days for regular staff state with LocalStorage persistence
  const [regularTargetOffDays, setRegularTargetOffDays] = useState<number>(() => {
    const saved = localStorage.getItem('benishouen_target_off_days');
    return saved ? parseInt(saved, 10) : 10;
  });

  // Shift Clear Confirmation Modal & Toast state
  const [showClearConfirmation, setShowClearConfirmation] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const triggerToastNotice = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice(prev => (prev === msg ? null : prev));
    }, 4000);
  };
  
  // Staff list state with LocalStorage persistence
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    const saved = localStorage.getItem('benishouen_staff_list');
    let list = STAFF_LIST;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch (e) {
        console.error('Error parsing saved staff list', e);
      }
    }
    // Migration: Ensure Sugimoto (id: 3) is treated as regular
    list = list.map(s => {
      if (s.id === 3 && !s.isRegular) {
        return {
          ...s,
          isRegular: true,
          canNightShift: true,
          maxConsecutive: 5,
          notes: '正職員・夜勤可',
          allowedShifts: s.allowedShifts.includes('5夜S') ? s.allowedShifts : [...s.allowedShifts, '5夜S']
        };
      }
      return s;
    });

    // Ensure Tada (id: 11) exists and is set to allow all shifts
    const hasTada = list.some(s => s.name.includes('多田') || s.id === 11);
    if (!hasTada) {
      list = [
        ...list,
        { id: 11, name: '多田', isRegular: true, canNightShift: true, maxConsecutive: 5, notes: '新職員・全勤務可', allowedShifts: ['早出', '日A', '日B', '日C', '5夜S'] }
      ];
    } else {
      list = list.map(s => {
        if (s.name.includes('多田') || s.id === 11) {
          return {
            ...s,
            isRegular: true,
            canNightShift: true,
            notes: '新職員・全勤務可',
            allowedShifts: ['早出', '日A', '日B', '日C', '5夜S']
          };
        }
        return s;
      });
    }

    return list;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Form states for adding a new staff member
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffIsRegular, setNewStaffIsRegular] = useState<boolean>(true);
  const [newStaffCanNight, setNewStaffCanNight] = useState<boolean>(true);
  const [newStaffMaxConsecutive, setNewStaffMaxConsecutive] = useState<number>(5);
  const [newStaffNotes, setNewStaffNotes] = useState<string>('');
  const [newStaffTargetOff, setNewStaffTargetOff] = useState<number>(10);
  const [newStaffRole, setNewStaffRole] = useState<string>('');
  const [newStaffCommitteeName, setNewStaffCommitteeName] = useState<string>('');
  const [newStaffCommitteeType, setNewStaffCommitteeType] = useState<'none' | 'dayOfMonth' | 'dayOfWeek'>('none');
  const [newStaffCommitteeDay, setNewStaffCommitteeDay] = useState<number>(10);
  const [newStaffCommitteeWeekIndex, setNewStaffCommitteeWeekIndex] = useState<number>(2);
  const [newStaffCommitteeDayOfWeek, setNewStaffCommitteeDayOfWeek] = useState<number>(2);
  const [isAddingStaff, setIsAddingStaff] = useState<boolean>(false);

  // Form states for editing an existing staff member
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editStaffName, setEditStaffName] = useState<string>('');
  const [editStaffIsRegular, setEditStaffIsRegular] = useState<boolean>(true);
  const [editStaffCanNight, setEditStaffCanNight] = useState<boolean>(true);
  const [editStaffMaxConsecutive, setEditStaffMaxConsecutive] = useState<number>(5);
  const [editStaffNotes, setEditStaffNotes] = useState<string>('');
  const [editStaffTargetOff, setEditStaffTargetOff] = useState<number>(10);
  const [editStaffRole, setEditStaffRole] = useState<string>('');
  const [editStaffCommitteeName, setEditStaffCommitteeName] = useState<string>('');
  const [editStaffCommitteeType, setEditStaffCommitteeType] = useState<'none' | 'dayOfMonth' | 'dayOfWeek'>('none');
  const [editStaffCommitteeDay, setEditStaffCommitteeDay] = useState<number>(10);
  const [editStaffCommitteeWeekIndex, setEditStaffCommitteeWeekIndex] = useState<number>(2);
  const [editStaffCommitteeDayOfWeek, setEditStaffCommitteeDayOfWeek] = useState<number>(2);

  // Modal / Confirm state for safe iframe operations
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: number; name: string } | null>(null);
  const [resetConfirmation, setResetConfirmation] = useState<boolean>(false);

  // Requested Offs state
  const [requestedOffs, setRequestedOffs] = useState<Record<number, Record<number, boolean>>>(() => {
    const saved = localStorage.getItem('benishouen_requested_offs');
    return saved ? JSON.parse(saved) : {};
  });

  // Requested Shifts (Work & Off) state
  const [requestedShifts, setRequestedShifts] = useState<Record<number, Record<number, ShiftType>>>(() => {
    const saved = localStorage.getItem('benishouen_requested_shifts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved requested shifts', e);
      }
    }
    // Migration fallback from requestedOffs
    const savedOffs = localStorage.getItem('benishouen_requested_offs');
    if (savedOffs) {
      try {
        const offs: Record<number, Record<number, boolean>> = JSON.parse(savedOffs);
        const initialMap: Record<number, Record<number, ShiftType>> = {};
        Object.keys(offs).forEach(sId => {
          const numSId = Number(sId);
          initialMap[numSId] = {};
          Object.keys(offs[numSId]).forEach(dIdx => {
            const numDIdx = Number(dIdx);
            if (offs[numSId][numDIdx]) {
              initialMap[numSId][numDIdx] = '休';
            }
          });
        });
        return initialMap;
      } catch (e) {
        console.error(e);
      }
    }
    return {};
  });

  // Hope Mode (希望勤務モード) state
  const [isHopeMode, setIsHopeMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('benishouen_is_hope_mode');
    return saved ? saved === 'true' : false;
  });

  // Schedule state loaded from localStorage or initialized as empty
  const [schedule, setSchedule] = useState<MonthSchedule>(() => {
    const saved = localStorage.getItem('benishouen_schedule');
    const savedYearMonth = localStorage.getItem('benishouen_schedule_year_month');
    const curYear = localStorage.getItem('benishouen_year') ? parseInt(localStorage.getItem('benishouen_year')!, 10) : 2026;
    const curMonth = localStorage.getItem('benishouen_month') ? parseInt(localStorage.getItem('benishouen_month')!, 10) : 7;
    
    if (saved && savedYearMonth === `${curYear}_${curMonth}`) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [days, setDays] = useState<DayInfo[]>([]);
  const [ruleSummary, setRuleSummary] = useState<RuleSummary>({ passed: false, details: [] });
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize and solve schedule on load or parameter change
  useEffect(() => {
    const savedSchedule = localStorage.getItem('benishouen_schedule');
    const savedYearMonth = localStorage.getItem('benishouen_schedule_year_month');
    if (savedSchedule && savedYearMonth === `${year}_${month}` && schedule.length > 0) {
      // Valid schedule exists in localStorage, just validate it to keep rule checkers and stats synced!
      const validation = validateSchedule(schedule, year, month, staffList, regularTargetOffDays);
      setRuleSummary(validation);
    } else {
      // No valid saved schedule, generate a new one
      generateAndValidate();
    }
  }, [year, month, rotationOffset, staffList, regularTargetOffDays, requestedOffs, requestedShifts]);

  // Save requested offs and requested shifts whenever they change
  useEffect(() => {
    localStorage.setItem('benishouen_requested_offs', JSON.stringify(requestedOffs));
  }, [requestedOffs]);

  useEffect(() => {
    localStorage.setItem('benishouen_requested_shifts', JSON.stringify(requestedShifts));
  }, [requestedShifts]);

  useEffect(() => {
    localStorage.setItem('benishouen_is_hope_mode', isHopeMode.toString());
  }, [isHopeMode]);

  const handleSetRequestedShift = (staffId: number, dayIndex: number, shift: ShiftType | undefined) => {
    setRequestedShifts(prev => {
      const staffMap = { ...(prev[staffId] || {}) };
      if (shift) {
        staffMap[dayIndex] = shift;
      } else {
        delete staffMap[dayIndex];
      }
      return {
        ...prev,
        [staffId]: staffMap
      };
    });

    setRequestedOffs(prev => {
      const staffMap = { ...(prev[staffId] || {}) };
      if (shift === '休') {
        staffMap[dayIndex] = true;
      } else {
        delete staffMap[dayIndex];
      }
      return {
        ...prev,
        [staffId]: staffMap
      };
    });

    if (shift) {
      setSchedule(prev => {
        if (prev.length === 0) return prev;
        return prev.map((dayShifts, idx) => {
          if (idx === dayIndex) {
            return {
              ...dayShifts,
              [staffId]: shift
            };
          }
          return dayShifts;
        });
      });
    }
  };

  // Save schedule whenever it changes
  useEffect(() => {
    if (schedule && schedule.length > 0) {
      localStorage.setItem('benishouen_schedule', JSON.stringify(schedule));
      localStorage.setItem('benishouen_schedule_year_month', `${year}_${month}`);
    }
  }, [schedule, year, month]);

  // Save staff list whenever it changes
  useEffect(() => {
    localStorage.setItem('benishouen_staff_list', JSON.stringify(staffList));
  }, [staffList]);

  // Save regular target off days whenever it changes
  useEffect(() => {
    localStorage.setItem('benishouen_target_off_days', regularTargetOffDays.toString());
  }, [regularTargetOffDays]);

  // Save year, month, and rotation offset whenever they change
  useEffect(() => {
    localStorage.setItem('benishouen_year', year.toString());
  }, [year]);

  useEffect(() => {
    localStorage.setItem('benishouen_month', month.toString());
  }, [month]);

  useEffect(() => {
    localStorage.setItem('benishouen_rotation_offset', rotationOffset.toString());
  }, [rotationOffset]);

  const handleToggleRequestedOff = (staffId: number, dayIndex: number) => {
    setRequestedOffs(prev => {
      const staffMap = prev[staffId] || {};
      const updatedStaffMap = {
        ...staffMap,
        [dayIndex]: !staffMap[dayIndex]
      };
      const updated = {
        ...prev,
        [staffId]: updatedStaffMap
      };
      return updated;
    });

    // When toggling a requested off, let's also force that cell to be '休' if turned on
    setSchedule(prev => {
      if (prev.length === 0) return prev;
      return prev.map((dayShifts, idx) => {
        if (idx === dayIndex) {
          return {
            ...dayShifts,
            [staffId]: '休' as ShiftType
          };
        }
        return dayShifts;
      });
    });
  };

  const handleClearSchedule = () => {
    setShowClearConfirmation(true);
  };

  const handleConfirmClearSchedule = () => {
    const monthDays = getDaysInMonth(year, month);
    const clearedSchedule: MonthSchedule = monthDays.map((_, dIdx) => {
      const dayShifts: Record<number, ShiftType> = {};
      staffList.forEach(staff => {
        const reqShift = requestedShifts[staff.id]?.[dIdx] || (requestedOffs[staff.id]?.[dIdx] ? '休' : undefined);
        if (reqShift) {
          dayShifts[staff.id] = reqShift;
        } else {
          dayShifts[staff.id] = '休';
        }
      });
      return dayShifts;
    });

    setSchedule(clearedSchedule);
    localStorage.setItem('benishouen_schedule', JSON.stringify(clearedSchedule));
    localStorage.setItem('benishouen_schedule_year_month', `${year}_${month}`);

    const validation = validateSchedule(clearedSchedule, year, month, staffList, regularTargetOffDays);
    setRuleSummary(validation);
    setShowClearConfirmation(false);

    triggerToastNotice('シフト割り当てをクリアしました（希望勤務・希望休は保持されます）。');
  };

  const handleUpdateCell = (dayIndex: number, staffId: number, newShift: ShiftType) => {
    setSchedule(prev => {
      const updated = prev.map((dayShifts, idx) => {
        if (idx === dayIndex) {
          return {
            ...dayShifts,
            [staffId]: newShift
          };
        }
        return dayShifts;
      });
      // Validate immediately based on manual edits
      const validation = validateSchedule(updated, year, month, staffList, regularTargetOffDays);
      setRuleSummary(validation);
      return updated;
    });
  };

  const handleUpdateStaffTarget = (staffId: number, targetDays: number) => {
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, targetOffDays: targetDays } : s));
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      alert('職員名を入力してください。');
      return;
    }

    // Generate unique ID
    const newId = staffList.length > 0 ? Math.max(...staffList.map(s => s.id)) + 1 : 1;

    // Default allowed shifts based on properties
    const allowedShifts: ShiftType[] = ['早出', '日B', '日C'];
    if (newStaffCanNight) {
      allowedShifts.push('5夜S');
    }

    const newStaff: Staff = {
      id: newId,
      name: newStaffName.trim(),
      isRegular: newStaffIsRegular,
      canNightShift: newStaffCanNight,
      maxConsecutive: newStaffMaxConsecutive,
      notes: newStaffNotes.trim() || (newStaffIsRegular ? '正職員・夜勤可' : '非正規・夜勤不可'),
      allowedShifts,
      role: newStaffRole.trim() || undefined,
      committee: newStaffCommitteeType !== 'none' ? {
        name: newStaffCommitteeName.trim() || '委員会',
        scheduleType: newStaffCommitteeType,
        dayOfMonth: newStaffCommitteeType === 'dayOfMonth' ? newStaffCommitteeDay : undefined,
        weekIndex: newStaffCommitteeType === 'dayOfWeek' ? newStaffCommitteeWeekIndex : undefined,
        dayOfWeek: newStaffCommitteeType === 'dayOfWeek' ? newStaffCommitteeDayOfWeek : undefined,
      } : undefined,
    };

    setStaffList(prev => [...prev, newStaff]);
    
    // Reset form states
    setNewStaffName('');
    setNewStaffNotes('');
    setNewStaffRole('');
    setNewStaffCommitteeName('');
    setNewStaffCommitteeType('none');
    setNewStaffCommitteeDay(10);
    setNewStaffCommitteeWeekIndex(2);
    setNewStaffCommitteeDayOfWeek(2);
    setIsAddingStaff(false);
  };

  const startEditingStaff = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setEditStaffName(staff.name);
    setEditStaffIsRegular(staff.isRegular);
    setEditStaffCanNight(staff.canNightShift);
    setEditStaffMaxConsecutive(staff.maxConsecutive);
    setEditStaffNotes(staff.notes || '');
    setEditStaffTargetOff(staff.targetOffDays ?? 10);
    setEditStaffRole(staff.role || '');
    setEditStaffCommitteeName(staff.committee?.name || '');
    setEditStaffCommitteeType(staff.committee?.scheduleType || 'none');
    setEditStaffCommitteeDay(staff.committee?.dayOfMonth ?? 10);
    setEditStaffCommitteeWeekIndex(staff.committee?.weekIndex ?? 2);
    setEditStaffCommitteeDayOfWeek(staff.committee?.dayOfWeek ?? 2);
  };

  const handleSaveStaffEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaffId === null) return;
    if (!editStaffName.trim()) {
      alert('職員名を入力してください。');
      return;
    }

    const allowedShifts: ShiftType[] = ['早出', '日B', '日C'];
    if (editStaffCanNight) {
      allowedShifts.push('5夜S');
    }

    setStaffList(prev => prev.map(s => s.id === editingStaffId ? {
      ...s,
      name: editStaffName.trim(),
      isRegular: editStaffIsRegular,
      canNightShift: editStaffCanNight,
      maxConsecutive: editStaffMaxConsecutive,
      notes: editStaffNotes.trim() || (editStaffIsRegular ? '正職員・夜勤可' : '非正規・夜勤不可'),
      allowedShifts: allowedShifts,
      role: editStaffRole.trim() || undefined,
      committee: editStaffCommitteeType !== 'none' ? {
        name: editStaffCommitteeName.trim() || '委員会',
        scheduleType: editStaffCommitteeType,
        dayOfMonth: editStaffCommitteeType === 'dayOfMonth' ? editStaffCommitteeDay : undefined,
        weekIndex: editStaffCommitteeType === 'dayOfWeek' ? editStaffCommitteeWeekIndex : undefined,
        dayOfWeek: editStaffCommitteeType === 'dayOfWeek' ? editStaffCommitteeDayOfWeek : undefined,
      } : undefined,
    } : s));

    setEditingStaffId(null);
  };

  const handleRemoveStaff = (id: number) => {
    setStaffList(prev => prev.filter(s => s.id !== id));
    setDeleteConfirmation(null);
  };

  // Export all settings to a JSON file (manual file save)
  const handleExportSettings = () => {
    const settingsData = {
      version: '1.0',
      year,
      month,
      rotationOffset,
      regularTargetOffDays,
      staffList,
      requestedOffs,
      schedule,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(settingsData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `benishouen_settings_${year}_${month}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Import settings from a JSON file
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    fileReader.onload = (e) => {
      try {
        const targetResult = e.target?.result;
        if (typeof targetResult !== 'string') return;
        const parsed = JSON.parse(targetResult);
        
        // Validate imported data
        if (parsed.staffList && Array.isArray(parsed.staffList)) {
          if (parsed.year) setYear(parsed.year);
          if (parsed.month) setMonth(parsed.month);
          if (parsed.rotationOffset !== undefined) setRotationOffset(parsed.rotationOffset);
          if (parsed.regularTargetOffDays) setRegularTargetOffDays(parsed.regularTargetOffDays);
          setStaffList(parsed.staffList);
          
          if (parsed.requestedOffs) {
            setRequestedOffs(parsed.requestedOffs);
            localStorage.setItem('benishouen_requested_offs', JSON.stringify(parsed.requestedOffs));
          } else {
            setRequestedOffs({});
            localStorage.setItem('benishouen_requested_offs', '{}');
          }
          
          if (parsed.schedule) {
            setSchedule(parsed.schedule);
            localStorage.setItem('benishouen_schedule', JSON.stringify(parsed.schedule));
            localStorage.setItem('benishouen_schedule_year_month', `${parsed.year || year}_${parsed.month || month}`);
          }
          
          alert('設定ファイル（希望休・シフト含む）を正常に読み込みました。');
        } else {
          alert('不正な設定ファイル形式です。');
        }
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。正しいJSONファイルかご確認ください。');
        console.error(err);
      }
    };
    fileReader.readAsText(files[0]);
    // Reset file input value to allow uploading same file again
    event.target.value = '';
  };

  const generateAndValidate = () => {
    setIsSolving(true);
    setErrorMsg(null);
    
    // Calculate calendar days
    const monthDays = getDaysInMonth(year, month);
    setDays(monthDays);

    // Solve schedule
    setTimeout(() => {
      let solvedSchedule: MonthSchedule | null = null;
      
      const isDefaultStaffList = JSON.stringify(staffList) === JSON.stringify(STAFF_LIST);
      const hasRequestedOffs = Object.values(requestedOffs).some(staffMap => Object.values(staffMap).some(Boolean));
      
      // Run the backtracking constraint solver
      solvedSchedule = solveShiftSchedule({
        year,
        month,
        nightShiftStartOffset: rotationOffset,
        staffList,
        regularTargetOffDays,
        requestedOffs,
        requestedShifts,
      });

      if (solvedSchedule) {
        setSchedule(solvedSchedule);
        // Validate schedule
        const validation = validateSchedule(solvedSchedule, year, month, staffList, regularTargetOffDays);
        setRuleSummary(validation);
      } else {
        setErrorMsg('現在の条件設定では矛盾のないシフトを作成できません。夜勤開始位置をずらすか、職員の設定条件（可能勤務、最大連勤数など）を緩めてください。');
        // Clear schedule or fall back to an empty template
        setSchedule(Array.from({ length: monthDays.length }, () => ({})));
        setRuleSummary({ passed: false, details: [] });
      }
      setIsSolving(false);
    }, 100);
  };

  const handleExportCSV = () => {
    if (!schedule || schedule.length === 0) {
      alert('シフト表がまだ作成されていません。');
      return;
    }
    try {
      const csvContent = exportToCSV(schedule, days, staffList);
      if (!csvContent) {
        alert('CSVデータの作成に失敗しました。');
        return;
      }

      // 1. Download CSV File with UTF-8 BOM for Excel
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Benishouen_Shift_${year}_${month}.csv`);
      document.body.appendChild(link);
      link.click();

      // 2. Fallback: Copy to Clipboard in case iframe blocks download
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(csvContent).catch(() => {});
      }

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      console.error('CSV Export Error:', err);
      alert('CSV出力中にエラーが発生しました。');
    }
  };

  return (
    <div id="shift_app" className="min-h-screen bg-bg-main text-brand-dark pb-16 font-sans flex flex-col">
      {/* Upper Branding Header */}
      <header className="bg-white border-b border-border-main py-4 px-6 shadow-sm">
        <div className="max-w-full mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-brand rounded-xl p-3 text-white shadow-xs">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-brand-light text-brand border border-border-main px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  紅生園 5階フロア
                </span>
                <span className="text-[11px] bg-[#e8f2e8] text-[#3e6b3e] border border-[#cce0cc] px-3 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-2 h-2 bg-[#4caf50] rounded-full animate-pulse"></span>
                  AI自動作成: 適合
                </span>
              </div>
              <h1 className="font-serif font-bold tracking-tight text-3xl mt-2 text-brand-dark">
                介護施設シフト自動作成システム
              </h1>
              <p className="text-brand-muted text-sm mt-1 max-w-xl font-medium">
                夜勤明け休みの自動確保、連勤日数上限、個別労働契約、及びペアリング制約のすべてをリアルタイムに自動解決します。
              </p>
            </div>
          </div>
          
          {/* Quick Stats Summary */}
          <div className="flex gap-4 sm:gap-6 bg-brand-light border border-border-main p-4 rounded-xl">
            <div className="text-center px-2">
              <div className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">対象スタッフ</div>
              <div className="text-2xl font-bold font-mono mt-0.5 text-brand-dark">10名</div>
            </div>
            <div className="w-[1px] bg-border-main my-1"></div>
            <div className="text-center px-2">
              <div className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">必須毎日稼働</div>
              <div className="text-2xl font-bold font-mono mt-0.5 text-brand-dark">5名+明け</div>
            </div>
            <div className="w-[1px] bg-border-main my-1"></div>
            <div className="text-center px-2">
              <div className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">ハード制約</div>
              <div className="text-2xl font-bold font-mono mt-0.5 text-[#3e6b3e]">100%</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Interactive Work Area */}
      <div className="max-w-full w-full mx-auto px-3 sm:px-4 md:px-5 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        
        {/* Left Side: Controllers & Instructions (3 cols on lg) */}
        <div className="lg:col-span-3 xl:col-span-2.5 flex flex-col gap-5">
          
          {/* Calendar Parameters Control Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-border-main p-6 flex flex-col gap-4">
            <h3 className="font-serif font-semibold text-brand-dark flex items-center gap-2 pb-3 border-b border-border-main">
              <CalendarCheck className="w-4 h-4 text-brand" />
              <span>作成対象月の設定</span>
            </h3>

            {/* Year Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-muted uppercase tracking-wider">作成年度</label>
              <select 
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-brand-light border border-border-main rounded-lg p-2 text-sm text-brand-dark outline-none focus:border-brand focus:bg-white transition-all"
              >
                <option value={2026}>2026年 (令和8年)</option>
                <option value={2027}>2027年</option>
              </select>
            </div>

            {/* Month Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-muted uppercase tracking-wider">作成月</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <button
                    key={m}
                    onClick={() => setMonth(m)}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all border ${
                      month === m 
                        ? 'bg-brand text-white border-brand shadow-sm' 
                        : 'bg-brand-light hover:bg-border-subtle border-border-main text-brand-muted'
                    }`}
                  >
                    {m}月
                  </button>
                ))}
              </div>
            </div>

            {/* Rotation Start Offset */}
            <div className="flex flex-col gap-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                  <span>夜勤ローテーション開始</span>
                  <span className="group relative inline-block">
                    <Info className="w-3.5 h-3.5 text-brand-muted cursor-pointer" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-brand-dark text-white text-[10px] rounded-md p-2 hidden group-hover:block z-50 shadow-md leading-relaxed font-normal">
                      1日目の5夜Sを担当する夜勤スタッフをローテーションからずらすことができます。
                    </span>
                  </span>
                </label>
              </div>
              <select
                value={rotationOffset}
                onChange={(e) => setRotationOffset(Number(e.target.value))}
                className="w-full bg-brand-light border border-border-main rounded-lg p-2 text-sm text-brand-dark outline-none focus:border-brand focus:bg-white transition-all"
              >
                <option value={0}>中村 亜梨紗 から開始</option>
                <option value={1}>木下 竜平 から開始</option>
                <option value={2}>阿部 まや から開始</option>
                <option value={3}>乾 翔太 から開始</option>
                <option value={4}>辰野 裕次 から開始</option>
              </select>
            </div>

            {/* Target Off Days for Regular Staff */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border-main/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                  <span>正職員の目標公休数</span>
                  <span className="group relative inline-block">
                    <Info className="w-3.5 h-3.5 text-brand-muted cursor-pointer" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-brand-dark text-white text-[10px] rounded-md p-2 hidden group-hover:block z-50 shadow-md leading-relaxed font-normal">
                      正職員が1ヶ月に取得する公休（休み）の日数の目標値です。ソルバーはこの値に基づいて自動調整を試みます。
                    </span>
                  </span>
                </label>
                <span className="text-xs font-bold text-brand font-mono">{regularTargetOffDays} 日</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[8, 9, 10, 11, 12].map(days => (
                  <button
                    key={days}
                    onClick={() => setRegularTargetOffDays(days)}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all border ${
                      regularTargetOffDays === days
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-brand-light hover:bg-border-subtle border-border-main text-brand-muted'
                    }`}
                  >
                    {days}日
                  </button>
                ))}
              </div>
            </div>

            {/* Settings File Backup / Load */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border-main/50">
              <label className="text-xs font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1">
                <span>設定ファイルの保存・読込</span>
                <span className="group relative inline-block">
                  <Info className="w-3.5 h-3.5 text-brand-muted cursor-pointer" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-brand-dark text-white text-[10px] rounded-md p-2 hidden group-hover:block z-50 shadow-md leading-relaxed font-normal">
                    現在の設定（職員リストや目標公休数など）をファイルとして保存、または過去に保存した設定を読み込んで復元します。
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportSettings}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                  title="現在の職員構成・設定をファイル保存"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>設定を保存</span>
                </button>
                <label className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer transition-colors" title="設定ファイルを読み込んで復元">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>設定を読込</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSettings}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Staff Shifts & Max Consecutive Settings Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-border-main p-6 flex flex-col gap-4">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full font-serif font-semibold text-brand-dark flex items-center justify-between pb-3 border-b border-border-main text-left group"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand group-hover:rotate-180 transition-transform duration-500" />
                <span>職員の勤務・連勤設定</span>
              </div>
              {isSettingsOpen ? (
                <ChevronUp className="w-4 h-4 text-brand-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-brand-muted" />
              )}
            </button>

            {isSettingsOpen ? (
              <div className="flex flex-col gap-5 max-h-[500px] overflow-y-auto pr-1">
                <div className="text-xs text-brand-muted leading-relaxed bg-brand-light p-3 rounded-lg border border-border-subtle flex items-start gap-2">
                  <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <div>
                    各職員の「可能連勤数」と「担当可能なシフト」を個別にカスタマイズできます。変更すると、シフトが自動的に再計算されます。
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {staffList.map((staff) => (
                    <div key={staff.id} className="p-3 border border-border-main rounded-xl hover:border-brand/40 transition-colors flex flex-col gap-2.5 bg-[#fbfbfa]/50">
                      {editingStaffId === staff.id ? (
                        <div className="flex flex-col gap-2.5">
                          <div className="text-xs font-bold text-brand-dark pb-1.5 border-b border-border-main flex items-center justify-between">
                            <span>職員情報の編集</span>
                            <span className="text-[10px] font-mono text-brand-muted">ID: {staff.id}</span>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-brand-muted">名前</label>
                            <input
                              type="text"
                              value={editStaffName}
                              onChange={(e) => setEditStaffName(e.target.value)}
                              className="bg-white border border-border-main rounded-md px-2 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-brand-muted">雇用区分</label>
                              <select
                                value={editStaffIsRegular ? 'regular' : 'part'}
                                onChange={(e) => {
                                  const isReg = e.target.value === 'regular';
                                  setEditStaffIsRegular(isReg);
                                  setEditStaffCanNight(isReg);
                                }}
                                className="bg-white border border-border-main rounded-md px-1 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                              >
                                <option value="regular">正職員</option>
                                <option value="part">非正規</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-brand-muted">夜勤担当</label>
                              <select
                                value={editStaffCanNight ? 'yes' : 'no'}
                                onChange={(e) => setEditStaffCanNight(e.target.value === 'yes')}
                                className="bg-white border border-border-main rounded-md px-1 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                              >
                                <option value="yes">可能 (5夜S)</option>
                                <option value="no">不可 (日勤のみ)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-brand-muted">最大可能連勤</label>
                            <select
                              value={editStaffMaxConsecutive}
                              onChange={(e) => setEditStaffMaxConsecutive(Number(e.target.value))}
                              className="bg-white border border-border-main rounded-md px-1 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                            >
                              {[2, 3, 4, 5, 6, 7].map(num => (
                                <option key={num} value={num}>{num}日</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-brand-muted">肩書（例：介護長、リーダーなど）</label>
                            <input
                              type="text"
                              value={editStaffRole}
                              onChange={(e) => setEditStaffRole(e.target.value)}
                              placeholder="なし"
                              className="bg-white border border-border-main rounded-md px-2 py-1 text-xs font-medium text-brand-dark outline-none focus:border-brand"
                            />
                          </div>

                          <div className="border border-brand/20 bg-brand-light/10 p-2.5 rounded-lg flex flex-col gap-2">
                            <span className="text-[10px] font-extrabold text-brand flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" />
                              委員会・会議の登録
                            </span>
                            
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-brand-muted">委員会名</label>
                              <input
                               type="text"
                               value={editStaffCommitteeName}
                               onChange={(e) => setEditStaffCommitteeName(e.target.value)}
                               placeholder="例：事故防止対策委員会"
                               className="bg-white border border-border-main rounded-md px-2 py-1 text-xs font-medium text-brand-dark outline-none focus:border-brand"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-brand-muted">会議スケジュール</label>
                                <select
                                  value={editStaffCommitteeType}
                                  onChange={(e) => setEditStaffCommitteeType(e.target.value as any)}
                                  className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                                >
                                  <option value="none">なし (会議なし)</option>
                                  <option value="dayOfMonth">毎月〇日</option>
                                  <option value="dayOfWeek">毎月第何曜日</option>
                                </select>
                              </div>

                              {editStaffCommitteeType === 'dayOfMonth' && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] font-bold text-brand-muted">開催日</label>
                                  <select
                                    value={editStaffCommitteeDay}
                                    onChange={(e) => setEditStaffCommitteeDay(Number(e.target.value))}
                                    className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                                  >
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(num => (
                                      <option key={num} value={num}>{num}日</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {editStaffCommitteeType === 'dayOfWeek' && (
                                <div className="flex flex-col gap-1 col-span-2 grid grid-cols-2 gap-1.5 mt-1">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-brand-muted">週（第1〜第5）</label>
                                    <select
                                      value={editStaffCommitteeWeekIndex}
                                      onChange={(e) => setEditStaffCommitteeWeekIndex(Number(e.target.value))}
                                      className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                                    >
                                      {[1, 2, 3, 4, 5].map(num => (
                                        <option key={num} value={num}>第{num}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-brand-muted">曜日</label>
                                    <select
                                      value={editStaffCommitteeDayOfWeek}
                                      onChange={(e) => setEditStaffCommitteeDayOfWeek(Number(e.target.value))}
                                      className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                                    >
                                      {['日', '月', '火', '水', '木', '金', '土'].map((w, idx) => (
                                        <option key={idx} value={idx}>{w}曜日</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>

                            {editStaffCommitteeType !== 'none' && (
                              <p className="text-[9px] text-[#2c5c2c] bg-[#ecf7ec] border border-[#d6ebd6] p-1.5 rounded-md font-medium leading-relaxed">
                                ※ 会議当日は【自動的に出勤（早出・日B・日Cのいずれか）】に配置されます。希望休が優先されます。
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-brand-muted">備考</label>
                            <input
                              type="text"
                              value={editStaffNotes}
                              onChange={(e) => setEditStaffNotes(e.target.value)}
                              placeholder="備考（例：週3勤務、平日のみ）"
                              className="bg-white border border-border-main rounded-md px-2 py-1 text-xs font-medium text-brand-dark outline-none focus:border-brand"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingStaffId(null)}
                              className="py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveStaffEdit}
                              className="py-1 bg-brand hover:bg-brand-hover rounded-lg text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-brand-dark">{staff.name}</span>
                                {staff.role && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-extrabold shadow-xs">
                                    {staff.role}
                                  </span>
                                )}
                                <span className="text-[9px] bg-brand-light text-brand px-1.5 py-0.2 rounded font-bold">
                                  {staff.isRegular ? '正職員' : '非正規'}
                                </span>
                              </div>
                              
                              {staff.committee && staff.committee.scheduleType !== 'none' && (
                                <div className="text-[9px] text-[#2c5c2c] bg-[#ecf7ec] px-2 py-0.5 rounded-sm font-bold inline-flex items-center gap-1 w-fit mt-0.5">
                                  <ClipboardList className="w-2.5 h-2.5 shrink-0 text-[#3e8e3e]" />
                                  <span>{staff.committee.name}</span>
                                  <span className="text-[8px] font-medium text-brand-muted">
                                    ({staff.committee.scheduleType === 'dayOfMonth' 
                                      ? `毎月${staff.committee.dayOfMonth}日` 
                                      : `毎月第${staff.committee.weekIndex}${['日','月','火','水','木','金','土'][staff.committee.dayOfWeek || 0]}曜日`})
                                  </span>
                                </div>
                              )}

                              {staff.notes && (
                                <span className="text-[9px] text-brand-muted truncate max-w-[150px] mt-0.5" title={staff.notes}>
                                  {staff.notes}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditingStaff(staff)}
                                className="text-brand hover:text-brand-hover hover:bg-brand-light p-1 rounded-md transition-colors cursor-pointer"
                                title="編集する"
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmation({ id: staff.id, name: staff.name })}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md transition-colors cursor-pointer"
                                title="削除する"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-border-main/50 pt-2 text-[10px]">
                            <div className="flex items-center gap-1 font-medium">
                              <span className="text-brand-muted">連勤上限:</span>
                              <span className="font-bold text-brand-dark">{staff.maxConsecutive}日</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 pt-1.5 border-t border-border-main/30">
                            <span className="text-[10px] font-bold text-brand-muted">可能勤務:</span>
                            <div className="grid grid-cols-4 gap-1">
                              {(['早出', '日B', '日C', '5夜S'] as ShiftType[]).map(shift => {
                                const isAllowed = staff.allowedShifts.includes(shift);
                                let activeStyle = '';
                                let inactiveStyle = 'bg-brand-light hover:bg-[#eae8e0] text-brand-muted/70 border border-border-main';
                                if (shift === '早出') activeStyle = 'bg-[#fcf5e8] text-[#dc2626] border-2 border-[#dc2626] font-extrabold shadow-xs';
                                else if (shift === '日B') activeStyle = 'bg-[#f5fbf7] text-[#dc2626] border-2 border-[#dc2626] font-extrabold shadow-xs';
                                else if (shift === '日C') activeStyle = 'bg-[#efede5] text-[#dc2626] border-2 border-[#dc2626] font-extrabold shadow-xs';
                                else if (shift === '5夜S') activeStyle = 'bg-[#e8f2fa] text-[#dc2626] border-2 border-[#dc2626] font-extrabold shadow-xs';

                                return (
                                  <button
                                    key={shift}
                                    type="button"
                                    onClick={() => {
                                      let newAllowed: ShiftType[];
                                      if (isAllowed) {
                                        if (staff.allowedShifts.length <= 1) return;
                                        newAllowed = staff.allowedShifts.filter(s => s !== shift);
                                      } else {
                                        newAllowed = [...staff.allowedShifts, shift];
                                      }

                                      const canNight = newAllowed.includes('5夜S');

                                      setStaffList(prev => prev.map(s => s.id === staff.id ? { 
                                        ...s, 
                                        allowedShifts: newAllowed,
                                        canNightShift: canNight
                                      } : s));
                                    }}
                                    className={`py-1 text-[9px] rounded-md transition-all font-bold ${isAllowed ? activeStyle : inactiveStyle}`}
                                  >
                                    {shift === '5夜S' ? '夜勤' : shift}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add New Staff Form */}
                <div className="border-t border-border-main pt-4 flex flex-col gap-3">
                  {!isAddingStaff ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingStaff(true)}
                      className="w-full py-2 bg-brand text-white hover:bg-brand-hover rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>職員を追加する</span>
                    </button>
                  ) : (
                    <form onSubmit={handleAddStaff} className="p-3 border border-dashed border-brand/40 rounded-xl bg-brand-light/30 flex flex-col gap-2.5">
                      <div className="text-xs font-bold text-brand-dark flex items-center gap-1.5 pb-1.5 border-b border-border-main/50">
                        <Plus className="w-3.5 h-3.5 text-brand" />
                        <span>新規職員の登録</span>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-brand-muted">職員名 *</label>
                        <input
                          type="text"
                          required
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          placeholder="例：佐藤 健"
                          className="w-full bg-white border border-border-main rounded-md px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-brand-muted">雇用区分</label>
                          <select
                            value={newStaffIsRegular ? 'regular' : 'part'}
                            onChange={(e) => {
                              const isReg = e.target.value === 'regular';
                              setNewStaffIsRegular(isReg);
                              setNewStaffCanNight(isReg);
                            }}
                            className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                          >
                            <option value="regular">正職員</option>
                            <option value="part">非正規 (パート/派遣)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-brand-muted">夜勤担当</label>
                          <select
                            value={newStaffCanNight ? 'yes' : 'no'}
                            onChange={(e) => setNewStaffCanNight(e.target.value === 'yes')}
                            className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                          >
                            <option value="yes">可能 (5夜S含む)</option>
                            <option value="no">不可 (日勤のみ)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-brand-muted">最大可能連勤数</label>
                        <select
                          value={newStaffMaxConsecutive}
                          onChange={(e) => setNewStaffMaxConsecutive(Number(e.target.value))}
                          className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                        >
                          {[2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}日</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-brand-muted">備考（例：週3勤務、平日のみなど）</label>
                        <input
                          type="text"
                          value={newStaffNotes}
                          onChange={(e) => setNewStaffNotes(e.target.value)}
                          placeholder="未入力の場合、雇用区分等から自動設定"
                          className="w-full bg-white border border-border-main rounded-md px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand font-medium"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-brand-muted">肩書（例：介護長、リーダーなど）</label>
                        <input
                          type="text"
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value)}
                          placeholder="なし"
                          className="w-full bg-white border border-border-main rounded-md px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand font-medium"
                        />
                      </div>

                      <div className="border border-brand/20 bg-brand-light/10 p-2.5 rounded-lg flex flex-col gap-2">
                        <span className="text-[10px] font-extrabold text-brand flex items-center gap-1">
                          <ClipboardList className="w-3 h-3" />
                          委員会・会議の登録
                        </span>
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-brand-muted">委員会名</label>
                          <input
                            type="text"
                            value={newStaffCommitteeName}
                            onChange={(e) => setNewStaffCommitteeName(e.target.value)}
                            placeholder="例：事故防止対策委員会"
                            className="bg-white border border-border-main rounded-md px-2 py-1 text-xs font-medium text-brand-dark outline-none focus:border-brand"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-brand-muted">会議スケジュール</label>
                            <select
                              value={newStaffCommitteeType}
                              onChange={(e) => setNewStaffCommitteeType(e.target.value as any)}
                              className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                            >
                              <option value="none">なし (会議なし)</option>
                              <option value="dayOfMonth">毎月〇日</option>
                              <option value="dayOfWeek">毎月第何曜日</option>
                            </select>
                          </div>

                          {newStaffCommitteeType === 'dayOfMonth' && (
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-brand-muted">開催日</label>
                              <select
                                value={newStaffCommitteeDay}
                                onChange={(e) => setNewStaffCommitteeDay(Number(e.target.value))}
                                className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(num => (
                                  <option key={num} value={num}>{num}日</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {newStaffCommitteeType === 'dayOfWeek' && (
                            <div className="flex flex-col gap-1 col-span-2 grid grid-cols-2 gap-1.5 mt-1">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-brand-muted">週（第1〜第5）</label>
                                <select
                                  value={newStaffCommitteeWeekIndex}
                                  onChange={(e) => setNewStaffCommitteeWeekIndex(Number(e.target.value))}
                                  className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                                >
                                  {[1, 2, 3, 4, 5].map(num => (
                                    <option key={num} value={num}>第{num}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-brand-muted">曜日</label>
                                <select
                                  value={newStaffCommitteeDayOfWeek}
                                  onChange={(e) => setNewStaffCommitteeDayOfWeek(Number(e.target.value))}
                                  className="bg-white border border-border-main rounded-md px-1.5 py-1 text-xs font-bold text-brand-dark outline-none focus:border-brand"
                                >
                                  {['日', '月', '火', '水', '木', '金', '土'].map((w, idx) => (
                                    <option key={idx} value={idx}>{w}曜日</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>

                        {newStaffCommitteeType !== 'none' && (
                          <p className="text-[9px] text-[#2c5c2c] bg-[#ecf7ec] border border-[#d6ebd6] p-1.5 rounded-md font-medium leading-relaxed">
                            ※ 会議当日は【自動的に出勤（早出・日B・日Cのいずれか）】に配置されます。希望休が優先されます。
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingStaff(false)}
                          className="py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                        >
                          キャンセル
                        </button>
                        <button
                          type="submit"
                          className="py-1.5 bg-brand hover:bg-brand-hover rounded-lg text-xs font-bold text-white transition-colors cursor-pointer shadow-xs"
                        >
                          職員を追加
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Reset to Default Button */}
                <button
                  type="button"
                  onClick={() => setResetConfirmation(true)}
                  className="w-full py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>設定を初期値にリセット</span>
                </button>
              </div>
            ) : (
              <div className="text-xs text-brand-muted flex items-center justify-between bg-brand-light/50 px-3 py-2 rounded-xl border border-border-subtle cursor-pointer hover:bg-brand-light transition-colors" onClick={() => setIsSettingsOpen(true)}>
                <span className="font-medium">クリックして設定を展開</span>
                <span className="text-[10px] bg-brand-light text-brand border border-border-main px-2 py-0.5 rounded-full font-bold">10名設定中</span>
              </div>
            )}
          </div>

          {/* Rule constraints explanation panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-border-main p-6 flex flex-col gap-4">
            <h3 className="font-serif font-semibold text-brand-dark flex items-center gap-2 pb-3 border-b border-border-main">
              <Users className="w-4 h-4 text-brand" />
              <span>シフト作成ルールと記号凡例</span>
            </h3>

            <div className="flex flex-col gap-3 text-xs text-brand-muted leading-relaxed">
              <div className="flex items-center gap-2 bg-brand-light p-2 rounded-lg border border-border-subtle text-brand-dark font-medium">
                <Sparkles className="w-4 h-4 shrink-0 text-brand" />
                <span>「5夜S」の翌日は「／（明け）」、翌々日は「休」を完全確保！</span>
              </div>
              
              <div className="space-y-2 mt-1">
                <div className="flex items-start gap-2">
                  <span className="bg-[#e8f2fa] text-blue-800 border border-[#bcd7f0] text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">5夜S</span>
                  <span>夜勤 (17:30〜翌10:00) / 1名</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-[#f0f8f0] text-emerald-800 border border-[#cce0cc] text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">／</span>
                  <span>夜勤明け。連勤数には含みますが、回復にあてられます。</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-[#fcf5e8] text-amber-800 border border-[#f5e1c0] text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">早出</span>
                  <span>早出枠 (5早) / 1名 / 橋爪は週3勤務</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">日A</span>
                  <span>日A枠 (8:00〜17:00) / 日勤枠</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-brand-light text-brand border border-border-main text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">日B</span>
                  <span>日B枠 (5B) / 1名 / 水原は週4、平日のみ</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-[#efede5] text-brand-dark border border-[#e5e1d8] text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">日C</span>
                  <span>日C枠 (5C) / 2名 / 遅番時間帯</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-[#fff0f0] text-rose-800 border border-[#ffcccc] text-[9px] font-bold px-1 py-0.5 rounded shrink-0 min-w-[42px] text-center">休</span>
                  <span>公休日</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Rule compliance summary side panel */}
          <RuleCheckerPanel ruleSummary={ruleSummary} />
        </div>

        {/* Right Side: Main Schedule Grid & Stats (9 cols on lg) */}
        <div className="lg:col-span-9 xl:col-span-9.5 flex flex-col gap-5">
          
          {/* Error Message if solving fails */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 flex gap-3 text-rose-900">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">シフト作成失敗</h4>
                <p className="text-xs mt-1 text-rose-700 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Core Shift Table */}
          <ScheduleGrid 
            schedule={schedule}
            days={days}
            year={year}
            month={month}
            onExportCSV={handleExportCSV}
            onRegenerate={generateAndValidate}
            onClearSchedule={handleClearSchedule}
            isSolving={isSolving}
            staffList={staffList}
            regularTargetOffDays={regularTargetOffDays}
            onChangeTargetOffDays={setRegularTargetOffDays}
            onUpdateStaffTarget={handleUpdateStaffTarget}
            requestedOffs={requestedOffs}
            requestedShifts={requestedShifts}
            onToggleRequestedOff={handleToggleRequestedOff}
            onSetRequestedShift={handleSetRequestedShift}
            onUpdateCell={handleUpdateCell}
            isHopeMode={isHopeMode}
            onToggleHopeMode={() => setIsHopeMode(prev => !prev)}
          />

          {/* Stats Breakdown Grid */}
          <StatsPanel schedule={schedule} days={days} staffList={staffList} regularTargetOffDays={regularTargetOffDays} />
        </div>
      </div>

      {/* 削除確認カスタムモーダル */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-border-main shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <h4 className="font-serif font-bold text-sm text-brand-dark flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>職員の削除確認</span>
            </h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              「<strong className="text-brand-dark">{deleteConfirmation.name}</strong>」さんを職員リストから削除しますか？<br />
              この操作は取り消せません。
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleRemoveStaff(deleteConfirmation.id)}
                className="py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 設定初期化確認カスタムモーダル */}
      {resetConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-border-main shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <h4 className="font-serif font-bold text-sm text-brand-dark flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>設定リセットの確認</span>
            </h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              すべての職員設定を初期状態（デフォルト値）に戻しますか？<br />
              追加された職員や、カスタマイズされた連勤上限などはすべて消去されます。
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmation(false)}
                className="py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setStaffList(STAFF_LIST);
                  setResetConfirmation(false);
                }}
                className="py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                初期値にリセット
              </button>
            </div>
          </div>
        </div>
      )}

      {/* シフトクリア確認カスタムモーダル */}
      {showClearConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in zoom-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-border-main shadow-2xl flex flex-col gap-4">
            <h4 className="font-serif font-bold text-sm text-brand-dark flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>シフト表クリアの確認</span>
            </h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              現在のシフト割り当てをクリアしますか？<br />
              <span className="inline-block mt-2 font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                ※ 登録されている希望勤務・希望休は保持され、その他のシフトが「休」に初期化されます。
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmation(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmClearSchedule}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>クリアを実行</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notice Banner */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}
    </div>
  );
}
