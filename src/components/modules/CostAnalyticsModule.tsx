import React, { useState } from 'react';
import { CostTrackerState, ModuleId } from '../../types';
import { PRICING_RATES } from '../../utils/costEstimator';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  PieChart,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface CostAnalyticsModuleProps {
  costTracker: CostTrackerState;
  onUpdateBudgetLimit: (newLimit: number) => void;
  onClearRecords: () => void;
  isDarkMode: boolean;
}

const MODULE_TITLES: Record<ModuleId, string> = {
  'video-transcriber': 'Video Transcription',
  'media-clipper': 'Audio/Video Clipper',
  'audiobook-transcriber': 'Audiobook Transcriber',
  'audio-extractor': 'Audio Extractor',
  'secrets-settings': 'Secrets Vault',
  'cost-analytics': 'Cost Analytics',
  'code-environment': 'Environment',
};

export const CostAnalyticsModule: React.FC<CostAnalyticsModuleProps> = ({
  costTracker,
  onUpdateBudgetLimit,
  onClearRecords,
  isDarkMode,
}) => {
  const [budgetInput, setBudgetInput] = useState(costTracker.budgetLimitUSD.toString());
  const [isSaved, setIsSaved] = useState(false);

  const totalCost = costTracker.records.reduce((acc, r) => acc + r.costUSD, 0);
  const remainingBudget = Math.max(0, costTracker.budgetLimitUSD - totalCost);
  const percentUsed = Math.min(100, (totalCost / costTracker.budgetLimitUSD) * 100);

  const handleSaveBudget = () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) {
      onUpdateBudgetLimit(val);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  return (
    <div id="cost-analytics-module" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div
        className={`p-4 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-colors ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
              isDarkMode ? 'bg-[#262626] text-[#f3e79a]' : 'bg-[#f4f4f5] text-[#854d0e]'
            }`}
          >
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Usage Cost & Budget Monitor</h3>
            <p className={`text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
              Live cost calculations per module based on audio duration, tokens, and compute benchmarks.
            </p>
          </div>
        </div>

        {percentUsed >= 80 && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono font-semibold ${
              isDarkMode
                ? 'bg-[#222222] border-[#f3e79a]/40 text-[#f3e79a]'
                : 'bg-[#fef9c3] border-[#ffd600] text-neutral-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Warning: Reached {percentUsed.toFixed(0)}% of budget ceiling!</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded border space-y-1.5 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Total Expense</span>
            <DollarSign className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
          </div>
          <p className={`text-xl font-bold font-mono ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
            ${totalCost.toFixed(4)}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>Aggregated all modules</p>
        </div>

        <div
          className={`p-4 rounded border space-y-1.5 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Budget Ceiling</span>
            <TrendingUp className="w-4 h-4 text-neutral-400" />
          </div>
          <p className={`text-xl font-bold font-mono ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
            ${costTracker.budgetLimitUSD.toFixed(2)}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>Configured target limit</p>
        </div>

        <div
          className={`p-4 rounded border space-y-1.5 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Remaining Allowance</span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <p className={`text-xl font-bold font-mono ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
            ${remainingBudget.toFixed(4)}
          </p>
          <p className={`text-xs font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
            {percentUsed.toFixed(1)}% consumed
          </p>
        </div>

        <div
          className={`p-4 rounded border space-y-1.5 ${
            isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Total Operations</span>
            <Layers className="w-4 h-4 text-neutral-400" />
          </div>
          <p className={`text-xl font-bold font-mono ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
            {costTracker.records.length}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>Completed jobs</p>
        </div>
      </div>

      {/* Budget Meter Bar */}
      <div
        className={`p-5 rounded border space-y-3 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex justify-between items-center text-xs font-medium">
          <span>Budget Consumption Meter</span>
          <span className={`font-mono text-xs font-semibold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
            ${totalCost.toFixed(4)} of ${costTracker.budgetLimitUSD.toFixed(2)} ({percentUsed.toFixed(1)}%)
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 border ${
          isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-neutral-100 border-[#e0e0e0]'
        }`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDarkMode ? 'bg-[#f3e79a]' : 'bg-[#ffd600]'
            }`}
            style={{ width: `${Math.max(2, percentUsed)}%` }}
          />
        </div>

        {/* Set Budget Form */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <label className={`text-xs font-medium ${isDarkMode ? 'text-[#aaaaaa]' : 'text-[#555555]'}`}>
              Daily/Monthly Limit ($ USD):
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="500"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className={`w-24 px-3 py-1.5 font-mono text-xs rounded border focus:outline-none ${
                isDarkMode
                  ? 'bg-[#121212] border-[#333333] text-white focus:border-[#f3e79a]'
                  : 'bg-white border-[#d4d4d8] text-neutral-900 focus:border-[#ffd600]'
              }`}
            />
            <button
              onClick={handleSaveBudget}
              id="btn-update-budget-limit"
              className={`px-3.5 py-1.5 rounded font-semibold text-xs transition-colors shadow-xs ${
                isDarkMode
                  ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                  : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
              }`}
            >
              Update
            </button>
            {isSaved && (
              <span className={`font-semibold text-xs ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                Saved!
              </span>
            )}
          </div>

          <button
            onClick={onClearRecords}
            id="btn-clear-cost-records"
            className="flex items-center gap-1 text-neutral-400 hover:text-rose-400 text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset History</span>
          </button>
        </div>
      </div>

      {/* Per-Module Expense Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['video-transcriber', 'media-clipper', 'audiobook-transcriber'] as ModuleId[]).map(
          (modId) => {
            const stats = costTracker.moduleTotals[modId] || { costUSD: 0, runs: 0, totalSeconds: 0 };
            return (
              <div
                key={modId}
                className={`p-4 rounded border space-y-2 ${
                  isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    {MODULE_TITLES[modId]}
                  </h4>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                      isDarkMode
                        ? 'bg-[#262626] text-[#f3e79a]'
                        : 'bg-[#fef9c3] text-[#854d0e]'
                    }`}
                  >
                    {stats.runs} ops
                  </span>
                </div>
                <div className="pt-0.5">
                  <span className={`text-lg font-bold font-mono ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                    ${stats.costUSD.toFixed(4)}
                  </span>
                </div>
                <p className={`text-xs font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                  Processed: {(stats.totalSeconds / 60).toFixed(1)}m audio
                </p>
              </div>
            );
          }
        )}
      </div>

      {/* Benchmark Rates Reference */}
      <div
        className={`p-4 rounded border space-y-2.5 text-xs ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <div className="flex items-center gap-2 text-neutral-400">
          <FileSpreadsheet className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`} />
          <h4 className={`font-semibold uppercase tracking-wider text-xs ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
            Real-Time Cost Model Rates Reference
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5 font-mono text-xs">
          <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'}`}>
            <span className={`text-xs block mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>Whisper Model Audio</span>
            <span className={`font-bold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
              ${PRICING_RATES.whisperPerMin.toFixed(4)}
            </span> / min
          </div>
          <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'}`}>
            <span className={`text-xs block mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>OpenAI GPT-4o-mini</span>
            <span className={`font-bold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>$0.150</span> / 1M In • <span className={`font-bold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>$0.600</span> / 1M Out
          </div>
          <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#121212] border-[#2c2c2c]' : 'bg-[#fafafa] border-[#e0e0e0]'}`}>
            <span className={`text-xs block mb-1 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>FFmpeg Clip Compute</span>
            <span className={`font-bold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
              ${PRICING_RATES.ffmpegComputePerMin.toFixed(4)}
            </span> / min
          </div>
        </div>
      </div>

      {/* Transaction History Log */}
      <div
        className={`p-5 rounded border space-y-3 ${
          isDarkMode ? 'bg-[#181818] border-[#2c2c2c]' : 'bg-white border-[#e0e0e0]'
        }`}
      >
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
          Operation Cost Ledger (Last 100 Transactions)
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className={`border-b text-xs ${isDarkMode ? 'border-[#2c2c2c] text-[#888888]' : 'border-[#e0e0e0] text-[#666666]'}`}>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Module</th>
                <th className="py-2.5 px-3">Operation</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Tokens (In / Out)</th>
                <th className="py-2.5 px-3 text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-[#222222]' : 'divide-[#eeeeee]'}`}>
              {costTracker.records.map((r, idx) => (
                <tr key={idx} className={isDarkMode ? 'hover:bg-[#202020]' : 'hover:bg-neutral-50'}>
                  <td className={`py-2 px-3 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td className={`py-2 px-3 font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    {MODULE_TITLES[r.moduleId] || r.moduleId}
                  </td>
                  <td className={`py-2 px-3 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>{r.operationName}</td>
                  <td className={`py-2 px-3 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>{r.durationSec}s</td>
                  <td className={`py-2 px-3 ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                    {r.inputTokens} / {r.outputTokens}
                  </td>
                  <td className={`py-2 px-3 text-right font-bold ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                    ${r.costUSD.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
