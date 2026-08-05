import React from 'react';
import { RuleSummary } from '../types';
import { CheckCircle2, AlertCircle, HelpCircle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface RuleCheckerPanelProps {
  ruleSummary: RuleSummary;
}

export default function RuleCheckerPanel({ ruleSummary }: RuleCheckerPanelProps) {
  const hardRules = ruleSummary.details.filter(r => r.isHard);
  const softRules = ruleSummary.details.filter(r => !r.isHard);

  const allHardPassed = hardRules.every(r => r.status === 'pass');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border-main p-6">
      <div className="flex items-center justify-between mb-6 gap-2">
        <h3 className="font-serif font-bold text-lg text-brand-dark flex items-center gap-2">
          {allHardPassed ? (
            <ShieldCheck className="w-5 h-5 text-brand" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-[#9f1239]" />
          )}
          <span>制約ルール自動判定</span>
        </h3>
        <span className={`px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
          allHardPassed ? 'bg-[#f0f8f0] text-[#166534] border-[#cce0cc]' : 'bg-[#fff0f0] text-[#9f1239] border-[#ffcccc]'
        }`}>
          {allHardPassed ? '矛盾なし（完全適合）' : 'ルール違反あり'}
        </span>
      </div>

      <div className="space-y-6">
        {/* Hard Constraints */}
        <div>
          <h4 className="text-xs font-bold text-brand-muted tracking-wider uppercase mb-3">
            絶対遵守ルール（ハード制約）
          </h4>
          <div className="space-y-3">
            {hardRules.map(rule => (
              <div 
                key={rule.id} 
                className={`p-4 rounded-xl border flex gap-3 transition-colors ${
                  rule.status === 'pass' 
                    ? 'bg-[#f0f8f0]/40 border-[#cce0cc]/60 text-emerald-950' 
                    : 'bg-[#fff0f0]/40 border-[#ffcccc]/60 text-rose-950'
                }`}
              >
                {rule.status === 'pass' ? (
                  <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#9f1239] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm text-brand-dark flex items-center gap-2">
                    <span>{rule.name}</span>
                    <span className="text-[10px] bg-brand-light text-brand border border-border-main px-1.5 py-0.5 rounded font-bold">
                      必須
                    </span>
                  </div>
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">{rule.description}</p>
                  <p className={`text-xs mt-2 font-bold ${
                    rule.status === 'pass' ? 'text-[#166534]' : 'text-[#9f1239]'
                  }`}>
                    {rule.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Soft Constraints */}
        <div>
          <h4 className="text-xs font-bold text-brand-muted tracking-wider uppercase mb-3">
            努力目標（ソフト制約）
          </h4>
          <div className="space-y-3">
            {softRules.map(rule => (
              <div 
                key={rule.id} 
                className={`p-4 rounded-xl border flex gap-3 transition-colors ${
                  rule.status === 'pass' 
                    ? 'bg-brand-light border-border-main text-brand-dark' 
                    : 'bg-[#fcf5e8]/40 border-[#fed7aa]/60 text-amber-950'
                }`}
              >
                {rule.status === 'pass' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
                ) : (
                  <HelpCircle className="w-5 h-5 text-[#9a3412] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm text-brand-dark flex items-center gap-2">
                    <span>{rule.name}</span>
                    <span className="text-[10px] bg-[#fcf5e8] text-[#9a3412] border border-[#fed7aa] px-1.5 py-0.5 rounded font-bold">
                      努力
                    </span>
                  </div>
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">{rule.description}</p>
                  <p className={`text-xs mt-2 font-bold ${
                    rule.status === 'pass' ? 'text-brand' : 'text-[#9a3412]'
                  }`}>
                    {rule.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
