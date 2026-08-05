import React from 'react';
import { MonthSchedule, Staff, DayInfo } from '../types';
import { STAFF_LIST, isWorkShift } from '../utils/solver';
import { BarChart, User, Moon, Calendar, EyeOff } from 'lucide-react';

interface StatsPanelProps {
  schedule: MonthSchedule;
  days: DayInfo[];
  staffList?: Staff[];
  regularTargetOffDays?: number;
}

export default function StatsPanel({ schedule, days, staffList = STAFF_LIST, regularTargetOffDays = 10 }: StatsPanelProps) {
  const getStats = (staff: Staff) => {
    let workShiftsCount = 0;
    let nightShiftsCount = 0;
    let akeShiftsCount = 0;
    let offDaysCount = 0;
    let maxConsec = 0;
    let currentConsec = 0;

    days.forEach((dayInfo, idx) => {
      const shift = schedule[idx]?.[staff.id] || '休';
      if (isWorkShift(shift)) {
        workShiftsCount++;
        if (shift === '5夜S') nightShiftsCount++;
        if (shift === '／') akeShiftsCount++;
        
        currentConsec++;
        if (currentConsec > maxConsec) {
          maxConsec = currentConsec;
        }
      } else {
        offDaysCount++;
        currentConsec = 0;
      }
    });

    return {
      workShiftsCount,
      nightShiftsCount,
      akeShiftsCount,
      offDaysCount,
      maxConsec,
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-main p-4">
      <h3 className="font-serif font-bold text-base text-brand-dark flex items-center gap-2 mb-3.5">
        <BarChart className="w-4.5 h-4.5 text-brand" />
        <span>スタッフ別勤務統計（行順固定）</span>
      </h3>
 
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-brand-dark">
          <thead>
            <tr className="border-b border-border-main text-brand-muted text-[10px] font-bold uppercase tracking-wider">
              <th className="py-2 px-3">順</th>
              <th className="py-2 px-3">スタッフ名</th>
              <th className="py-2 px-3">属性 / 契約</th>
              <th className="py-2 px-3 text-center">勤務日数</th>
              <th className="py-2 px-3 text-center">5夜S</th>
              <th className="py-2 px-3 text-center">明け(／)</th>
              <th className="py-2 px-3 text-center">公休日数</th>
              <th className="py-2 px-3 text-center">最大連勤</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main">
            {staffList.map((staff, index) => {
              const stats = getStats(staff);
              const isRegular = staff.isRegular;
              const isTatsuno = staff.name.includes('辰野');
              const targetOff = isTatsuno
                ? stats.offDaysCount
                : (staff.targetOffDays !== undefined 
                    ? staff.targetOffDays 
                    : (isRegular 
                        ? regularTargetOffDays 
                        : (staff.name.includes('水原') 
                            ? days.length - Math.round(4 * (days.length / 7))
                            : (staff.name.includes('橋爪') 
                                ? days.length - Math.round(3 * (days.length / 7))
                                : days.length - 15
                              )
                          )
                      )
                  );
              
              return (
                <tr key={staff.id} className="hover:bg-brand-light/30 transition-colors">
                  <td className="py-1.5 px-3 font-mono text-[11px] text-brand-muted">
                    {index + 1}
                  </td>
                  <td className="py-1.5 px-3 font-bold text-brand-dark flex items-center gap-1.5">
                    <User className={`w-3 h-3 ${isRegular ? 'text-brand' : 'text-brand-muted'}`} />
                    <span>{staff.name}</span>
                  </td>
                  <td className="py-1.5 px-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full inline-block font-bold border leading-none ${
                      staff.id === 8 ? 'bg-[#efede5] text-brand-dark border-[#e5e1d8]' :
                      staff.id === 9 ? 'bg-[#fcf5e8] text-[#9a3412] border-[#fed7aa]' :
                      isRegular ? 'bg-brand-light text-brand border border-border-main' : 'bg-[#f0f0e8] text-brand-muted border-[#e0dfd5]'
                    }`}>
                      {staff.notes.split('・')[0] || staff.notes}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center font-bold text-brand-dark text-[11px]">
                    {stats.workShiftsCount}日
                  </td>
                  <td className="py-1.5 px-3 text-center font-mono">
                    {stats.nightShiftsCount > 0 ? (
                      <span className="bg-[#e8f2fa] text-[#1e3a8a] border border-[#bcd7f0] px-1 py-0.5 rounded text-[10px] font-bold">
                        {stats.nightShiftsCount}回
                      </span>
                    ) : (
                      <span className="text-brand-muted/40 text-[10px]">-</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-center font-mono">
                    {stats.akeShiftsCount > 0 ? (
                      <span className="bg-[#f0f8f0] text-[#166534] border border-[#bbf7d0] px-1 py-0.5 rounded text-[10px] font-bold">
                        {stats.akeShiftsCount}回
                      </span>
                    ) : (
                      <span className="text-brand-muted/40 text-[10px]">-</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span className={`font-bold text-[11px] ${
                      stats.offDaysCount !== targetOff ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {stats.offDaysCount}日
                    </span>
                    <span className="text-[9px] text-brand-muted block font-medium">
                      (目標:{targetOff}日)
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border ${
                      stats.maxConsec > staff.maxConsecutive 
                        ? 'bg-[#fff0f0] text-[#9f1239] border-[#fecdd3]' 
                        : 'bg-[#f0f8f0] text-[#166534] border-[#bbf7d0]'
                    }`}>
                      {stats.maxConsec}連勤
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
