import { CostRecord, CostTrackerState, ModuleId } from '../types';

export const PRICING_RATES = {
  whisperPerMin: 0.006, // $0.006 per minute
  gpt4oMiniInputPerM: 0.15, // $0.15 per 1M tokens
  gpt4oMiniOutputPerM: 0.60, // $0.60 per 1M tokens
  ffmpegComputePerMin: 0.0, // $0.00 - Local FFmpeg compute has zero API cost
};

export function calculateWhisperCost(durationSeconds: number): number {
  return (durationSeconds / 60) * PRICING_RATES.whisperPerMin;
}

export function calculateLlmCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICING_RATES.gpt4oMiniInputPerM +
    (outputTokens / 1_000_000) * PRICING_RATES.gpt4oMiniOutputPerM
  );
}

export function calculateClippingCost(durationSeconds: number): number {
  // Local FFmpeg has zero API cost
  return 0;
}

export function getInitialCostState(): CostTrackerState {
  const saved = localStorage.getItem('cost_tracker_v1');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // If legacy sample run was stored, discard sample
      if (parsed.records && parsed.records.some((r: any) => r.operationName === 'Sample Initialization Run')) {
        localStorage.removeItem('cost_tracker_v1');
      } else {
        return parsed;
      }
    } catch {
      // fallback
    }
  }

  return {
    budgetLimitUSD: 10.0,
    records: [],
    moduleTotals: {
      'video-transcriber': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
      'media-clipper': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
      'audiobook-transcriber': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
      'audio-extractor': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
      'secrets-settings': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
      'cost-analytics': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
      'code-environment': { costUSD: 0.0, runs: 0, totalSeconds: 0 },
    },
  };
}

export function addCostRecord(
  prevState: CostTrackerState,
  moduleId: ModuleId,
  operationName: string,
  durationSec: number,
  inputTokens: number = 0,
  outputTokens: number = 0,
  details: string = ''
): CostTrackerState {
  let costUSD = 0;
  if (moduleId === 'video-transcriber' || moduleId === 'audiobook-transcriber') {
    costUSD = calculateWhisperCost(durationSec) + calculateLlmCost(inputTokens, outputTokens);
  } else {
    costUSD = calculateClippingCost(durationSec);
  }

  const newRecord: CostRecord = {
    moduleId,
    operationName,
    timestamp: Date.now(),
    durationSec,
    inputTokens,
    outputTokens,
    costUSD,
    details,
  };

  const prevModuleTotal = prevState.moduleTotals[moduleId] || { costUSD: 0, runs: 0, totalSeconds: 0 };
  const updatedTotals = {
    ...prevState.moduleTotals,
    [moduleId]: {
      costUSD: prevModuleTotal.costUSD + costUSD,
      runs: prevModuleTotal.runs + 1,
      totalSeconds: prevModuleTotal.totalSeconds + durationSec,
    },
  };

  const newState: CostTrackerState = {
    ...prevState,
    records: [newRecord, ...prevState.records].slice(0, 100), // Keep last 100 records
    moduleTotals: updatedTotals,
  };

  try {
    localStorage.setItem('cost_tracker_v1', JSON.stringify(newState));
  } catch (e) {
    console.warn('Failed to persist cost tracker in localStorage:', e);
  }

  return newState;
}
