import React from 'react';
import { MonthSchedule, Staff, DayInfo, ShiftType } from '../types';
import { STAFF_LIST } from '../utils/solver';
import { Calendar, Download, RefreshCw, AlertTriangle, Info, Maximize2, Minimize2, ChevronLeft, ChevronRight, Lock, Unlock, Star, Trash2 } from 'lucide-react';

interface ScheduleGridProps {
  schedule: MonthSchedule;
  days: DayInfo[];
  year: number;
  month: number;
  onExportCSV: () => void;
  onRegenerate: () => void;
  onClearSchedule?: () => void;
  isSolving: boolean;
  staffList?: Staff[];
  regularTargetOffDays?: number;
  onChangeTargetOffDays?: (days: number) => void;
  onUpdateStaffTarget?: (staffId: number, targetDays: number) => void;
  requestedOffs?: Record<number, Record<number, boolean>>;
  requestedShifts?: Record<number, Record<number, ShiftType>>;
  onToggleRequestedOff?: (staffId: number, dayIndex: number) => void;
  onSetRequestedShift?: (staffId: number, dayIndex: number, shift: ShiftType | undefined) => void;
  onUpdateCell?: (dayIndex: number, staffId: number, newShift: ShiftType) => void;
  isHopeMode?: boolean;
  onToggleHopeMode?: () => void;
}

export default function ScheduleGrid({
  schedule,
  days,
  year,
  month,
  onExportCSV,
  onRegenerate,
  onClearSchedule,
  isSolving,
  staffList = STAFF_LIST,
  regularTargetOffDays = 10,
  onChangeTargetOffDays,
  onUpdateStaffTarget,
  requestedOffs = {},
  requestedShifts = {},
  onToggleRequestedOff,
  onSetRequestedShift,
  onUpdateCell,
  isHopeMode = false,
  onToggleHopeMode,
}: ScheduleGridProps) {
  
  const [editingTargetStaffId, setEditingTargetStaffId] = React.useState<number | null>(null);
  const [isStaffNamesCollapsed, setIsStaffNamesCollapsed] = React.useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = React.useState<boolean>(false);
  const [forceRotate, setForceRotate] = React.useState<boolean>(true);

  const getStaffShiftCounts = (staffId: number) => {
    let haya = 0;
    let a = 0;
    let b = 0;
    let c = 0;
    let night = 0;
    let ake = 0;
    let off = 0;

    days.forEach((_, idx) => {
      const shift = schedule[idx]?.[staffId];
      if (shift === '早出') haya++;
      else if (shift === '日A') a++;
      else if (shift === '日B') b++;
      else if (shift === '日C') c++;
      else if (shift === '5夜S') night++;
      else if (shift === '／') ake++;
      else if (shift === '休' || !shift) off++;
    });

    return { haya, a, b, c, night, ake, off };
  };

  const increaseActualOffDays = (staffId: number) => {
    const workShifts: ShiftType[] = ['日B', '日C', '日A', '早出'];
    for (const shiftToReplace of workShifts) {
      for (let dIdx = 0; dIdx < days.length; dIdx++) {
        if (schedule[dIdx]?.[staffId] === shiftToReplace) {
          if (requestedOffs[staffId]?.[dIdx] !== true) {
            onUpdateCell?.(dIdx, staffId, '休');
            return;
          }
        }
      }
    }
  };

  const decreaseActualOffDays = (staffId: number) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    const allowedShifts = staff.allowedShifts || ['日B'];
    let shiftToAssign: ShiftType = '日B';
    if (allowedShifts.includes('日B')) {
      shiftToAssign = '日B';
    } else if (allowedShifts.includes('早出')) {
      shiftToAssign = '早出';
    } else if (allowedShifts.length > 0) {
      shiftToAssign = allowedShifts[0];
    }

    for (let dIdx = 0; dIdx < days.length; dIdx++) {
      if ((schedule[dIdx]?.[staffId] === '休' || !schedule[dIdx]?.[staffId]) && requestedOffs[staffId]?.[dIdx] !== true) {
        if (dIdx > 0 && schedule[dIdx - 1]?.[staffId] === '／') {
          continue;
        }
        onUpdateCell?.(dIdx, staffId, shiftToAssign);
        return;
      }
    }

    for (let dIdx = 0; dIdx < days.length; dIdx++) {
      if ((schedule[dIdx]?.[staffId] === '休' || !schedule[dIdx]?.[staffId]) && requestedOffs[staffId]?.[dIdx] !== true) {
        onUpdateCell?.(dIdx, staffId, shiftToAssign);
        return;
      }
    }
  };

  const increaseActualNightShifts = (staffId: number) => {
    // Try to find a consecutive pair of days where we can place 5夜S and ／
    for (let d = 0; d < days.length - 1; d++) {
      const sD = schedule[d]?.[staffId] || '休';
      const sDNext = schedule[d + 1]?.[staffId] || '休';
      
      if (sD !== '5夜S' && sD !== '／' && sDNext !== '5夜S' && sDNext !== '／') {
        if (requestedOffs[staffId]?.[d] !== true && requestedOffs[staffId]?.[d + 1] !== true) {
          const prevNight = d > 0 && schedule[d - 1]?.[staffId] === '5夜S';
          const prevAke = d > 0 && schedule[d - 1]?.[staffId] === '／';
          const nextNight = d + 2 < days.length && schedule[d + 2]?.[staffId] === '5夜S';
          
          if (!prevNight && !prevAke && !nextNight) {
            onUpdateCell?.(d, staffId, '5夜S');
            onUpdateCell?.(d + 1, staffId, '／');
            return;
          }
        }
      }
    }
    
    // Fallback if no clean intervals: find any valid pair that doesn't overwrite requested offs or existing night shifts
    for (let d = 0; d < days.length - 1; d++) {
      const sD = schedule[d]?.[staffId] || '休';
      const sDNext = schedule[d + 1]?.[staffId] || '休';
      if (sD !== '5夜S' && sD !== '／' && sDNext !== '5夜S' && sDNext !== '／') {
        if (requestedOffs[staffId]?.[d] !== true && requestedOffs[staffId]?.[d + 1] !== true) {
          onUpdateCell?.(d, staffId, '5夜S');
          onUpdateCell?.(d + 1, staffId, '／');
          return;
        }
      }
    }
  };

  const decreaseActualNightShifts = (staffId: number) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    const allowedShifts = staff.allowedShifts || ['日B'];
    let shiftToAssign: ShiftType = '日B';
    if (allowedShifts.includes('日B')) {
      shiftToAssign = '日B';
    } else if (allowedShifts.includes('早出')) {
      shiftToAssign = '早出';
    } else if (allowedShifts.length > 0) {
      shiftToAssign = allowedShifts[0];
    }

    // Find the first '5夜S' shift
    for (let d = 0; d < days.length; d++) {
      if (schedule[d]?.[staffId] === '5夜S') {
        onUpdateCell?.(d, staffId, shiftToAssign);
        if (d + 1 < days.length && schedule[d + 1]?.[staffId] === '／') {
          onUpdateCell?.(d + 1, staffId, '休');
        }
        return;
      }
    }
  };

  const renderPopover = (staff: Staff, idx: number, counts: ReturnType<typeof getStaffShiftCounts>, targetVal: number) => {
    if (editingTargetStaffId !== staff.id) return null;

    const isNightShiftCapable = staff.canNightShift || staff.allowedShifts.includes('5夜S');

    return (
      <>
        {/* Backdrop dismiss helper */}
        <div 
          className="fixed inset-0 z-40 bg-black/5" 
          onClick={(e) => {
            e.stopPropagation();
            setEditingTargetStaffId(null);
          }}
        />
        
        {/* Popover content box */}
        <div 
          className={`absolute ${idx < 4 ? 'top-full mt-1 animate-in fade-in slide-in-from-top-2' : 'bottom-full mb-1 animate-in fade-in slide-in-from-bottom-2'} right-0 z-50 bg-white border-2 border-brand rounded-2xl p-3 shadow-2xl flex flex-col gap-3 min-w-[170px] duration-150`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10.5px] font-extrabold text-brand-dark text-left pb-1 border-b border-rose-100 whitespace-nowrap">
            {staff.name} 個別調整・設定
          </div>
          
          {/* Target Off Days Control */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-gray-500 text-left">① 目標公休数 (自動作成の基準)</span>
            <div className="flex items-center justify-between bg-rose-50/40 p-1 rounded-xl border border-rose-100">
              <button 
                type="button"
                onClick={() => {
                  onUpdateStaffTarget?.(staff.id, Math.max(0, targetVal - 1));
                }}
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg text-rose-800 text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-90"
                title="目標を減らす"
              >
                ▼
              </button>
              <div className="flex flex-col items-center min-w-[45px]">
                <span className="text-xs font-extrabold text-rose-950 font-mono leading-none">{targetVal}</span>
                <span className="text-[7.5px] font-bold text-rose-500 mt-0.5">日目標</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  onUpdateStaffTarget?.(staff.id, Math.min(31, targetVal + 1));
                }}
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg text-rose-800 text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-90"
                title="目標を増やす"
              >
                ▲
              </button>
            </div>
          </div>

          {/* Actual Off Days Control */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-gray-500 text-left">② 実際の公休数 (個別変更)</span>
            <div className="flex items-center justify-between bg-emerald-50/40 p-1 rounded-xl border border-emerald-100">
              <button 
                type="button"
                onClick={() => {
                  decreaseActualOffDays(staff.id);
                }}
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-90"
                title="実際の公休を1日減らす (勤務を追加)"
              >
                ▼
              </button>
              <div className="flex flex-col items-center min-w-[45px]">
                <span className="text-xs font-extrabold text-emerald-950 font-mono leading-none">{counts.off}日</span>
                <span className="text-[7.5px] font-bold text-emerald-600 mt-0.5">現在</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  increaseActualOffDays(staff.id);
                }}
                className="w-8 h-8 flex items-center justify-center bg-white hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-90"
                title="実際の公休を1日増やす (勤務を休みに)"
              >
                ▲
              </button>
            </div>
          </div>

          {/* Actual Night Shifts Control */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-gray-500 text-left">③ 実際の夜勤数 (個別変更)</span>
            {isNightShiftCapable ? (
              <div className="flex items-center justify-between bg-blue-50/40 p-1 rounded-xl border border-blue-100">
                <button 
                  type="button"
                  onClick={() => {
                    decreaseActualNightShifts(staff.id);
                  }}
                  disabled={counts.night <= 0}
                  className="w-8 h-8 flex items-center justify-center bg-white hover:bg-blue-100 active:bg-blue-200 border border-blue-200 rounded-lg text-blue-800 text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-90 disabled:opacity-40 disabled:pointer-events-none"
                  title="夜勤回数を1回減らす"
                >
                  ▼
                </button>
                <div className="flex flex-col items-center min-w-[45px]">
                  <span className="text-xs font-extrabold text-blue-950 font-mono leading-none">{counts.night}回</span>
                  <span className="text-[7.5px] font-bold text-blue-500 mt-0.5">現在</span>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    increaseActualNightShifts(staff.id);
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-white hover:bg-blue-100 active:bg-blue-200 border border-blue-200 rounded-lg text-blue-800 text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-90"
                  title="夜勤回数を1回増やす (空き日に夜勤・明けを追加)"
                >
                  ▲
                </button>
              </div>
            ) : (
              <div className="text-[9px] text-gray-400 font-bold bg-gray-50 p-2 rounded-xl border border-gray-100 text-center leading-normal">
                夜勤対象外のスタッフ
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setEditingTargetStaffId(null)}
            className="w-full py-1.5 bg-brand hover:bg-brand-hover active:bg-brand-dark text-white font-bold text-[10.5px] rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </>
    );
  };

  const getShiftAbbreviation = (shift: ShiftType): string => {
    switch (shift) {
      case '早出': return '早';
      case '日A': return 'Ａ';
      case '日B': return 'Ｂ';
      case '日C': return 'Ｃ';
      case '5夜S': return '夜';
      case '／': return '明';
      case '休': return '休';
      default: return '休';
    }
  };

  const getShiftStyle = (shift: ShiftType, isRequested: boolean = false) => {
    if (isRequested) {
      switch (shift) {
        case '早出': return 'bg-[#fef3c7] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        case '日A': return 'bg-[#f0fdf4] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        case '日B': return 'bg-[#f0f9ff] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        case '日C': return 'bg-[#faf5ff] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        case '5夜S': return 'bg-[#e0e7ff] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        case '／': return 'bg-[#ecfdf5] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        case '休': return 'bg-[#fff1f2] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
        default: return 'bg-[#fff1f2] text-red-600 font-extrabold border-2 border-red-500 shadow-2xs';
      }
    }

    switch (shift) {
      case '早出': return 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d] font-bold hover:border-[#f59e0b]';
      case '日A': return 'bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] font-bold hover:border-[#22c55e]';
      case '日B': return 'bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] font-bold hover:border-[#0284c7]';
      case '日C': return 'bg-[#faf5ff] text-[#7e22ce] border border-[#f3e8ff] font-bold hover:border-[#a855f7]';
      case '5夜S': return 'bg-[#e0e7ff] text-[#3730a3] border border-[#c7d2fe] font-bold hover:border-[#6366f1]';
      case '／': return 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] font-bold hover:border-[#10b981]';
      case '休': return 'bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0] font-medium hover:border-[#94a3b8]';
      default: return 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300';
    }
  };

  const getDayOfWeekName = (dayOfWeek: number) => {
    return ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];
  };

  return (
    <>
      <style>{`
        @media (orientation: portrait) {
          .rotated-fullscreen-container {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            width: 100vh !important;
            height: 100vw !important;
            transform: translate(-50%, -50%) rotate(90deg) !important;
            transform-origin: center !important;
            z-index: 100 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      <div className={isFullScreen ? `fixed inset-0 z-[100] bg-bg-main p-2 md:p-3 flex flex-col gap-2 h-screen w-screen overflow-hidden ${forceRotate ? 'rotated-fullscreen-container' : ''}` : "bg-white rounded-xl shadow-sm border border-border-main p-3.5 flex flex-col gap-3.5"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-brand" />
            <h2 className="font-serif font-bold text-base text-brand-dark">
              {year}年{month}月 5階フロアシフト表{isFullScreen && " (フルスクリーン表示)"}
            </h2>
          </div>
          {isFullScreen && (
            <span className="sm:hidden text-[9.5px] bg-brand-light text-brand px-2 py-0.5 rounded-full font-bold animate-pulse">
              横画面推奨
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-1.5">
          {isFullScreen && (
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-brand-muted mr-1.5">
              <span>💡 スマホ等では画面を横向きにすると、シフト全体がより大きく表示されます。</span>
            </div>
          )}

          {/* 希望勤務モード Toggle Button */}
          <button
            type="button"
            onClick={onToggleHopeMode}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all border shadow-xs cursor-pointer ${
              isHopeMode 
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title={isHopeMode ? "希望勤務モードを解除（希望部をロック）" : "希望勤務モードを起動（希望勤務・希望休を入力）"}
          >
            {isHopeMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>希望勤務モード: {isHopeMode ? "入力中 (ON)" : "解除 (ロック中)"}</span>
          </button>

          {/* Toggle Staff Name Column Button */}
          <button
            type="button"
            onClick={() => setIsStaffNamesCollapsed(!isStaffNamesCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-brand bg-brand-light hover:bg-border-subtle border border-border-main transition-colors cursor-pointer"
            title={isStaffNamesCollapsed ? "職員名を表示" : "職員名を折りたたむ"}
          >
            <span>名前: {isStaffNamesCollapsed ? "表示" : "折りたたむ"}</span>
          </button>

          <button
            onClick={onRegenerate}
            disabled={isSolving}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-brand bg-brand-light hover:bg-border-subtle border border-border-main transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSolving ? 'animate-spin' : ''}`} />
            <span>シフト再自動作成</span>
          </button>

          {/* シフトクリア Button */}
          {onClearSchedule && (
            <button
              type="button"
              onClick={onClearSchedule}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
              title="シフト表の割り当てをクリア（確認アラート表示）"
            >
              <Trash2 className="w-3 h-3 text-rose-600" />
              <span>シフトクリア</span>
            </button>
          )}
          
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-brand hover:bg-brand-hover transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>CSV出力</span>
          </button>

          {/* Full Screen Toggle Button */}
          {isFullScreen && (
            <button
              type="button"
              onClick={() => setForceRotate(!forceRotate)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                forceRotate 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border-gray-300'
              }`}
              title={forceRotate ? "横向き自動回転をオフにする" : "横向き自動回転をオンにする"}
            >
              <RefreshCw className="w-3 h-3" />
              <span>自動横画面: {forceRotate ? "ON" : "OFF"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all border shadow-xs cursor-pointer ${
              isFullScreen 
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600' 
                : 'bg-slate-800 hover:bg-slate-900 text-white border-slate-800'
            }`}
            title={isFullScreen ? "フルスクリーンを終了" : "フルスクリーン表示（大きく表示）"}
          >
            {isFullScreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span>{isFullScreen ? "通常表示に戻る" : "拡大表示（横画面）"}</span>
          </button>
        </div>
      </div>

      {/* Operation Guide */}
      {!isFullScreen && (
        <div className="bg-[#fdfaf2] border border-[#f5e6c4] text-[#855e10] rounded-lg p-2.5 text-[11px] font-medium leading-relaxed flex items-start gap-1.5 shrink-0">
          <Info className="w-4 h-4 text-[#bf9130] shrink-0 mt-0.5" />
          <div>
            <strong>操作ガイド:</strong> シフト種別ごとに背景色をわかりやすく色分けし、<strong>希望勤務・希望休は「赤太字」</strong>で強調表示されます。<br />
            ヘッダーの<strong>「希望勤務モード」ボタン</strong>をONにすると、各セルに希望休や希望勤務（早出・日B・日C・夜勤など）を設定できます。希望勤務モードを解除（OFF）にすると、希望設定部分は<strong>自動的にロックされ編集不可</strong>になります。
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div className={`border border-border-main bg-white rounded-xl ${isFullScreen ? 'flex-grow h-0 min-h-0 overflow-hidden' : 'overflow-auto'}`}>
        <table className={`min-w-full border-collapse text-center table-fixed ${isFullScreen ? 'h-full' : ''}`}>
          <thead>
            {/* Header Dates Row */}
            <tr className="bg-brand-light border-b border-border-main">
              <th 
                className={`sticky left-0 z-20 bg-[#f9f8f5] border-r border-border-main p-0 text-left transition-all duration-300 text-[11px] font-bold text-brand-muted uppercase tracking-wider ${
                  isStaffNamesCollapsed ? 'w-[36px] min-w-[36px] max-w-[36px]' : 'w-[110px] min-w-[110px] max-w-[110px]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsStaffNamesCollapsed(!isStaffNamesCollapsed)}
                  className="w-full h-full flex items-center justify-between gap-0.5 py-1.5 px-1 bg-brand-light/40 hover:bg-brand-light transition-colors text-left font-bold outline-none cursor-pointer"
                  title={isStaffNamesCollapsed ? "クリックして名前を表示" : "クリックして名前を折りたたむ"}
                >
                  <span className="truncate pl-0.5 leading-none">
                    {isStaffNamesCollapsed ? "名" : "スタッフ名"}
                  </span>
                  <span className="text-[10px] text-brand shrink-0 pr-0.5 leading-none font-extrabold">
                    {isStaffNamesCollapsed ? "≫" : "≪"}
                  </span>
                </button>
              </th>
              {days.map(dayInfo => {
                const isSun = dayInfo.dayOfWeek === 0;
                const isSat = dayInfo.dayOfWeek === 6;
                const colWidth = isFullScreen ? 'w-[15px] min-w-[15px]' : 'w-[22px] min-w-[22px]';
                return (
                  <th
                    key={dayInfo.day}
                    className={`border-r border-border-main font-bold transition-colors ${colWidth} ${
                      isFullScreen ? 'p-0 text-[8.5px]' : 'p-0.5 text-[10.5px]'
                    } ${
                      isSun ? 'bg-rose-50/50 text-rose-700 font-extrabold' : isSat ? 'bg-blue-50/30 text-blue-700 font-extrabold' : 'text-brand-dark'
                    }`}
                  >
                    <div>{dayInfo.day}</div>
                    <div className={`${isFullScreen ? 'text-[7px]' : 'text-[8px] scale-90'} leading-none mt-0.5 opacity-80`}>
                      {getDayOfWeekName(dayInfo.dayOfWeek)}
                    </div>
                  </th>
                );
              })}
              {/* Summary Headers */}
              {isFullScreen ? (
                <>
                  <th className="p-0 w-[24px] min-w-[24px] border-r border-border-main text-[8.5px] font-extrabold text-brand bg-brand-light/70">
                    <div>シフト</div>
                  </th>
                  <th className="p-0 w-[22px] min-w-[22px] text-[8.5px] font-extrabold text-blue-800 bg-blue-50/70">
                    <div>夜数</div>
                  </th>
                </>
              ) : (
                <>
                  <th className="p-0.5 w-[20px] min-w-[20px] border-r border-border-main text-[10px] font-extrabold text-amber-900 bg-[#fef3c7]">
                    <div>早</div>
                  </th>
                  <th className="p-0.5 w-[20px] min-w-[20px] border-r border-border-main text-[10px] font-extrabold text-teal-800 bg-teal-50/80">
                    <div>Ａ</div>
                  </th>
                  <th className="p-0.5 w-[20px] min-w-[20px] border-r border-border-main text-[10px] font-extrabold text-brand bg-brand-light/70">
                    <div>Ｂ</div>
                  </th>
                  <th className="p-0.5 w-[20px] min-w-[20px] border-r border-border-main text-[10px] font-extrabold text-gray-700 bg-gray-100/75">
                    <div>Ｃ</div>
                  </th>
                  <th className="p-0.5 w-[20px] min-w-[20px] border-r border-border-main text-[10px] font-extrabold text-blue-800 bg-blue-50/70">
                    <div>夜</div>
                  </th>
                  <th className="p-0.5 w-[20px] min-w-[20px] border-r border-border-main text-[10px] font-extrabold text-green-800 bg-green-50/70">
                    <div>明</div>
                  </th>
                  <th className="p-0.5 w-[46px] min-w-[46px] text-[10px] font-extrabold text-rose-800 bg-rose-50/70">
                    <div>公休</div>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main">
            {staffList.map((staff, idx) => {
              const isRegular = staff.isRegular;
              const counts = getStaffShiftCounts(staff.id);
              const targetVal = staff.targetOffDays !== undefined 
                ? staff.targetOffDays 
                : (isRegular 
                    ? regularTargetOffDays 
                    : (staff.id === 8 
                        ? days.length - Math.round(4 * (days.length / 7))
                        : (staff.id === 9 
                            ? days.length - Math.round(3 * (days.length / 7))
                            : days.length - 15
                          )
                      )
                  );
              return (
                <tr key={staff.id} className="hover:bg-brand-light/30 transition-colors">
                  {/* Name column */}
                  <td 
                    onClick={() => setIsStaffNamesCollapsed(!isStaffNamesCollapsed)}
                    className={`sticky left-0 z-10 bg-white border-r border-border-main text-left font-bold text-brand-dark transition-all duration-300 hover:bg-brand-light/50 cursor-pointer ${
                      isFullScreen ? 'p-0.5' : 'p-1.5'
                    } ${
                      isStaffNamesCollapsed ? 'w-[36px] min-w-[36px] max-w-[36px]' : 'w-[110px] min-w-[110px] max-w-[110px]'
                    }`}
                    title={isStaffNamesCollapsed ? `クリックして展開 | ${idx + 1}: ${staff.name}` : `クリックして折りたたむ`}
                  >
                    {isStaffNamesCollapsed ? (
                      <div className="flex flex-col items-center justify-center font-mono leading-none select-none w-full">
                        <span className={`bg-brand/10 text-brand rounded-sm font-extrabold leading-none ${isFullScreen ? 'text-[8.5px] px-0.5 py-0.5' : 'text-[10px] px-1 py-0.5 scale-90'}`}>
                          {idx + 1}
                        </span>
                        <span className={`font-extrabold text-brand-dark font-sans leading-none ${isFullScreen ? 'text-[9.5px] mt-0.5' : 'text-[11px] mt-1'}`}>
                          {staff.name.charAt(0)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full gap-0.5">
                        <div className="flex flex-col truncate leading-none">
                          <span className={`font-extrabold text-brand-dark truncate ${isFullScreen ? 'text-[8.5px]' : 'text-[10px]'}`}>{staff.name}</span>
                          <span className={`text-brand-muted font-medium origin-left ${isFullScreen ? 'text-[7px]' : 'text-[8px] scale-90'}`}>
                            {isRegular ? '正正' : '非正'}
                          </span>
                        </div>
                        <span className={`font-mono text-brand-muted shrink-0 bg-brand-light/70 px-0.5 py-0.5 rounded ${isFullScreen ? 'text-[7px]' : 'text-[8px] scale-95'}`}>
                          {idx + 1}
                        </span>
                      </div>
                    )}
                  </td>
 
                  {/* Day Columns */}
                  {days.map((dayInfo, dIdx) => {
                    const currentShift = schedule[dIdx]?.[staff.id] || '休';
                    const isSun = dayInfo.dayOfWeek === 0;
                    const isSat = dayInfo.dayOfWeek === 6;

                    const reqShift = requestedShifts[staff.id]?.[dIdx] || (requestedOffs[staff.id]?.[dIdx] ? '休' : undefined);
                    const isRequested = reqShift !== undefined;

                    const colWidth = isFullScreen ? 'w-[15px] min-w-[15px]' : 'w-[22px] min-w-[22px]';
                    const btnOrSelectSize = isFullScreen ? 'w-[14px] h-[14px]' : 'w-[20px] h-[20px]';
                    
                    return (
                      <td
                        key={dayInfo.day}
                        className={`text-center border-r border-border-main align-middle ${colWidth} ${
                          isFullScreen ? 'p-0' : 'p-0.5'
                        } ${
                          isSun ? 'bg-rose-50/10' : isSat ? 'bg-blue-50/5' : ''
                        }`}
                      >
                        {!isHopeMode ? (
                          // Hope Mode OFF (解除 - 希望部はロック)
                          isRequested ? (
                            <button
                              type="button"
                              title={`希望勤務（ロック中）: ${reqShift} - 編集するには「希望勤務モード」をONにしてください`}
                              className={`inline-flex items-center justify-center rounded select-none cursor-pointer hover:opacity-90 transition-all ${btnOrSelectSize} ${
                                isFullScreen ? 'text-[7.5px]' : 'text-[9.5px]'
                              } ${getShiftStyle(reqShift, true)}`}
                            >
                              <span className="flex items-center justify-center gap-[0.5px]">
                                {getShiftAbbreviation(reqShift)}
                                <Lock className="w-2 h-2 text-red-500 shrink-0 inline-block" />
                              </span>
                            </button>
                          ) : (
                            <select
                              value={currentShift}
                              onChange={(e) => onUpdateCell?.(dIdx, staff.id, e.target.value as ShiftType)}
                              title="クリックしてシフトを変更"
                              className={`inline-flex items-center justify-center rounded text-center appearance-none cursor-pointer outline-none select-none transition-all ${btnOrSelectSize} ${
                                isFullScreen ? 'text-[8.5px]' : 'text-[10px]'
                              } ${getShiftStyle(currentShift, false)}`}
                              style={{ textAlignLast: 'center', padding: 0 }}
                            >
                              <option value="早出" className="bg-[#fef3c7] text-[#92400e] font-bold">早</option>
                              <option value="日A" className="bg-[#f0fdf4] text-[#166534] font-bold">Ａ</option>
                              <option value="日B" className="bg-[#f0f9ff] text-[#0369a1] font-bold">Ｂ</option>
                              <option value="日C" className="bg-[#faf5ff] text-[#7e22ce] font-bold">Ｃ</option>
                              <option value="5夜S" className="bg-[#e0e7ff] text-[#3730a3] font-bold">夜</option>
                              <option value="／" className="bg-[#ecfdf5] text-[#047857] font-bold">明</option>
                              <option value="休" className="bg-[#f8fafc] text-[#64748b] font-medium">休</option>
                            </select>
                          )
                        ) : (
                          // Hope Mode ON (入力中 - 希望勤務・希望休の変更・登録可能)
                          <select
                            value={isRequested ? `HOPE_${reqShift}` : 'NORMAL'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'NORMAL') {
                                onSetRequestedShift?.(staff.id, dIdx, undefined);
                              } else if (val.startsWith('HOPE_')) {
                                const targetShift = val.replace('HOPE_', '') as ShiftType;
                                onSetRequestedShift?.(staff.id, dIdx, targetShift);
                              }
                            }}
                            title="希望勤務・希望休を設定 / 解除"
                            className={`inline-flex items-center justify-center rounded text-center appearance-none cursor-pointer outline-none select-none transition-all ${btnOrSelectSize} ${
                              isFullScreen ? 'text-[8.5px]' : 'text-[10px]'
                            } ${
                              isRequested
                                ? getShiftStyle(reqShift, true)
                                : getShiftStyle(currentShift, false)
                            }`}
                            style={{ textAlignLast: 'center', padding: 0 }}
                          >
                            {!isRequested && <option value="NORMAL" className="font-normal text-slate-600">{getShiftAbbreviation(currentShift)}</option>}
                            {isRequested && <option value={`HOPE_${reqShift}`} className="font-extrabold text-red-600">★ {getShiftAbbreviation(reqShift)} (希望中)</option>}
                            {isRequested && <option value="NORMAL" className="font-normal text-slate-500">希望解除 (通常シフトに戻す)</option>}
                            <option value="HOPE_休" className="font-extrabold text-red-600 bg-rose-50">★ 希望: 公休(休)</option>
                            <option value="HOPE_早出" className="font-extrabold text-red-600 bg-amber-50">★ 希望: 早出(早)</option>
                            <option value="HOPE_日A" className="font-extrabold text-red-600 bg-emerald-50">★ 希望: 日A(Ａ)</option>
                            <option value="HOPE_日B" className="font-extrabold text-red-600 bg-sky-50">★ 希望: 日B(Ｂ)</option>
                            <option value="HOPE_日C" className="font-extrabold text-red-600 bg-purple-50">★ 希望: 日C(Ｃ)</option>
                            <option value="HOPE_5夜S" className="font-extrabold text-red-600 bg-indigo-50">★ 希望: 夜勤(夜)</option>
                          </select>
                        )}
                      </td>
                    );
                  })}
 
                  {/* Summary Columns */}
                  {isFullScreen ? (
                    <>
                      <td className="p-0 border-r border-border-main align-middle bg-brand-light/70 text-[8.5px] font-bold text-brand font-mono w-[24px] min-w-[24px]">
                        {counts.haya + counts.a + counts.b + counts.c}
                      </td>
                      <td 
                        onClick={() => setEditingTargetStaffId(staff.id)}
                        title="クリックして夜勤・公休数を変更"
                        className="p-0 align-middle bg-blue-50/70 hover:bg-blue-100/80 cursor-pointer text-[8.5px] font-bold text-blue-800 font-mono w-[22px] min-w-[22px] relative transition-colors"
                      >
                        {counts.night}
                        {renderPopover(staff, idx, counts, targetVal)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-0.5 border-r border-border-main align-middle bg-[#fef7ec] text-[10.5px] font-bold text-orange-800 font-mono w-[20px] min-w-[20px]">
                        {counts.haya}
                      </td>
                      <td className="p-0.5 border-r border-border-main align-middle bg-teal-50/60 text-[10.5px] font-bold text-teal-800 font-mono w-[20px] min-w-[20px]">
                        {counts.a}
                      </td>
                      <td className="p-0.5 border-r border-border-main align-middle bg-brand-light/70 text-[10.5px] font-bold text-brand font-mono w-[20px] min-w-[20px]">
                        {counts.b}
                      </td>
                      <td className="p-0.5 border-r border-border-main align-middle bg-gray-100/75 text-[10.5px] font-bold text-gray-700 font-mono w-[20px] min-w-[20px]">
                        {counts.c}
                      </td>
                      <td 
                        onClick={() => setEditingTargetStaffId(staff.id)}
                        title="クリックして夜勤・公休数を変更"
                        className="p-0.5 border-r border-border-main align-middle bg-blue-50/70 hover:bg-blue-100/80 cursor-pointer text-[10.5px] font-bold text-blue-800 font-mono w-[22px] min-w-[22px] transition-colors"
                      >
                        {counts.night}
                      </td>
                      <td className="p-0.5 border-r border-border-main align-middle bg-green-50/70 text-[10.5px] font-bold text-green-800 font-mono w-[22px] min-w-[22px]">
                        {counts.ake}
                      </td>
                      <td className="p-0.5 align-middle bg-rose-50/70 text-[10.5px] font-extrabold text-rose-700 font-mono w-[50px] min-w-[50px]">
                        <div className="relative flex flex-col items-center justify-center gap-0.5 py-0.5 select-none">
                          <div 
                            onClick={() => setEditingTargetStaffId(staff.id)}
                            title="クリックして公休・夜勤設定を調整"
                            className="flex flex-col items-center justify-center cursor-pointer hover:bg-rose-50/50 rounded p-0.5 transition-colors w-full"
                          >
                            <div className="flex items-baseline gap-0.5 justify-center leading-none">
                              <span className="text-[11px] font-extrabold text-rose-800">{counts.off}</span>
                              <span className="text-[8px] text-rose-500 font-bold">日</span>
                              <span className={`text-[7px] font-extrabold ml-1 scale-90 leading-none ${
                                counts.off === targetVal 
                                  ? 'text-emerald-700' 
                                  : Math.abs(counts.off - targetVal) <= 1
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                              }`}>
                                {counts.off === targetVal ? 'OK' : `${counts.off > targetVal ? '+' : ''}${counts.off - targetVal}`}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 mt-0.5 bg-rose-50/70 hover:bg-rose-100/80 px-1 py-0.5 rounded border border-rose-200/50 text-[8.5px] font-extrabold text-rose-950 font-mono leading-none select-none transition-colors">
                              <span>目標 {targetVal}日</span>
                            </div>
                          </div>
 
                          {renderPopover(staff, idx, counts, targetVal)}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Daily Total Summary */}
      <div className="bg-brand-light rounded-xl p-4 border border-border-subtle">
        <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">
          各シフトの日次稼働状況（チェック完了）
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-border-main flex items-center justify-between">
            <span className="text-brand-muted font-bold">早出</span>
            <span className="font-bold text-[#9a3412] bg-[#fcf5e8] border border-[#fed7aa] px-1.5 py-0.5 rounded-md">
              毎日 1名
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-border-main flex items-center justify-between">
            <span className="text-brand-muted font-bold">日B</span>
            <span className="font-bold text-brand bg-brand-light border border-border-main px-1.5 py-0.5 rounded-md">
              毎日 1名
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-border-main flex items-center justify-between">
            <span className="text-brand-muted font-bold">日C</span>
            <span className="font-bold text-brand-dark bg-[#efede5] border border-border-main px-1.5 py-0.5 rounded-md">
              毎日 2名
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-border-main flex items-center justify-between">
            <span className="text-brand-muted font-bold">5夜S</span>
            <span className="font-bold text-[#1e3a8a] bg-[#e8f2fa] border border-[#bcd7f0] px-1.5 py-0.5 rounded-md">
              毎日 1名
            </span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-border-main flex items-center justify-between">
            <span className="text-brand-muted font-bold">／ (明け)</span>
            <span className="font-bold text-[#166534] bg-[#f0f8f0] border border-[#bbf7d0] px-1.5 py-0.5 rounded-md">
              毎日 1名
            </span>
          </div>
        </div>
      </div>
    </div>
  </>
);
}
