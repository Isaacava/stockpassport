export type PortfolioPosition = {
  assetId: string;
  symbol: string;
  valueUsd: number;
};

export type PortfolioRules = {
  maxSingleAssetPct: number;
  minReservePct: number;
  rebalanceThresholdPct: number;
  targetAllocations: Record<string, number>;
};

export type RuleProposal = {
  id: string;
  kind: 'sell-overweight' | 'buy-underweight' | 'reserve-cash';
  assetId?: string;
  symbol?: string;
  currentPct: number;
  targetPct: number;
  valueUsd: number;
  reason: string;
};

export type PortfolioEvaluation = {
  totalValueUsd: number;
  cashValueUsd: number;
  cashPct: number;
  proposals: RuleProposal[];
  violations: string[];
};

export const DEFAULT_PORTFOLIO_RULES: PortfolioRules = {
  maxSingleAssetPct: 25,
  minReservePct: 10,
  rebalanceThresholdPct: 5,
  targetAllocations: {},
};

export function evaluatePortfolio(
  positions: PortfolioPosition[],
  cashValueUsd: number,
  rules: PortfolioRules = DEFAULT_PORTFOLIO_RULES,
): PortfolioEvaluation {
  const positionTotal = positions.reduce((sum, position) => sum + position.valueUsd, 0);
  const totalValueUsd = positionTotal + cashValueUsd;
  if (totalValueUsd <= 0) return { totalValueUsd: 0, cashValueUsd: 0, cashPct: 0, proposals: [], violations: [] };

  const cashPct = (cashValueUsd / totalValueUsd) * 100;
  const proposals: RuleProposal[] = [];
  const violations: string[] = [];

  if (cashPct < rules.minReservePct) {
    violations.push(`Cash reserve is ${cashPct.toFixed(1)}%, below the ${rules.minReservePct}% minimum.`);
    proposals.push({
      id: 'reserve-cash',
      kind: 'reserve-cash',
      currentPct: cashPct,
      targetPct: rules.minReservePct,
      valueUsd: totalValueUsd * ((rules.minReservePct - cashPct) / 100),
      reason: `Raise cash reserve to ${rules.minReservePct}%.`,
    });
  }

  for (const position of positions) {
    const currentPct = (position.valueUsd / totalValueUsd) * 100;
    const targetPct = rules.targetAllocations[position.assetId] ?? 0;

    if (currentPct > rules.maxSingleAssetPct) {
      violations.push(`${position.symbol} is ${currentPct.toFixed(1)}%, above the ${rules.maxSingleAssetPct}% maximum.`);
      proposals.push({
        id: `max-${position.assetId}`,
        kind: 'sell-overweight',
        assetId: position.assetId,
        symbol: position.symbol,
        currentPct,
        targetPct: Math.min(targetPct || rules.maxSingleAssetPct, rules.maxSingleAssetPct),
        valueUsd: position.valueUsd - totalValueUsd * (rules.maxSingleAssetPct / 100),
        reason: `Reduce ${position.symbol} below the ${rules.maxSingleAssetPct}% single-asset cap.`,
      });
      continue;
    }

    const drift = currentPct - targetPct;
    if (targetPct > 0 && Math.abs(drift) >= rules.rebalanceThresholdPct) {
      const desiredValue = totalValueUsd * (targetPct / 100);
      proposals.push({
        id: `rebalance-${position.assetId}`,
        kind: drift > 0 ? 'sell-overweight' : 'buy-underweight',
        assetId: position.assetId,
        symbol: position.symbol,
        currentPct,
        targetPct,
        valueUsd: Math.abs(position.valueUsd - desiredValue),
        reason: `${position.symbol} is ${Math.abs(drift).toFixed(1)} percentage points from its ${targetPct}% target.`,
      });
    }
  }

  return { totalValueUsd, cashValueUsd, cashPct, proposals, violations };
}
