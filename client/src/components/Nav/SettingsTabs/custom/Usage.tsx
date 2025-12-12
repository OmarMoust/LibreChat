/**
 * Usage Settings Tab - Shows token usage statistics and transaction history
 * Custom component isolated from core LibreChat for easier upstream merges
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Clock,
  Coins,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  useGetTransactionsSummary,
  useGetTransactions,
  type Transaction,
} from '~/data-provider/custom';
import { useLocalize } from '~/hooks';

type Period = 'day' | 'week' | 'month' | 'all';

// Local storage key for token display preference
const TOKEN_DISPLAY_KEY = 'librechat_show_message_tokens';

const PeriodSelector: React.FC<{
  period: Period;
  onChange: (period: Period) => void;
}> = ({ period, onChange }) => {
  const localize = useLocalize();
  const periods: { value: Period; label: string }[] = [
    { value: 'day', label: localize('com_ui_usage_today') },
    { value: 'week', label: localize('com_ui_usage_week') },
    { value: 'month', label: localize('com_ui_usage_month') },
    { value: 'all', label: localize('com_ui_usage_all_time') },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-surface-secondary p-1">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            period === p.value
              ? 'bg-surface-primary text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
}> = ({ icon, label, value, subValue }) => (
  <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
    <div className="flex items-center gap-1.5 text-text-secondary">
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </div>
    <div className="mt-1.5">
      <span className="text-xl font-bold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {subValue && <span className="ml-1.5 text-[10px] text-text-secondary">{subValue}</span>}
    </div>
  </div>
);

const ModelBreakdown: React.FC<{
  data: Array<{ _id: string; tokens: number; cost: number; count: number }>;
}> = ({ data }) => {
  const localize = useLocalize();
  const maxTokens = Math.max(...data.map((d) => d.tokens), 1);

  if (!data.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-medium text-text-primary">
        {localize('com_ui_usage_by_model')}
      </h3>
      <div className="space-y-2">
        {data.slice(0, 5).map((model) => (
          <div key={model._id || 'unknown'} className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate font-medium text-text-primary" title={model._id || 'Unknown'}>
                {model._id || 'Unknown'}
              </span>
              <span className="ml-2 flex-shrink-0 text-text-secondary">
                {model.tokens.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${(model.tokens / maxTokens) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TransactionsList: React.FC<{
  transactions: Transaction[];
  isLoading: boolean;
}> = ({ transactions, isLoading }) => {
  const localize = useLocalize();
  const [expanded, setExpanded] = useState(false);

  const displayedTransactions = expanded ? transactions : transactions.slice(0, 8);

  if (isLoading) {
    return (
      <div className="mt-4 flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="mt-4 rounded-lg border border-border-light bg-surface-secondary p-4 text-center">
        <p className="text-xs text-text-secondary">{localize('com_ui_usage_no_transactions')}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-medium text-text-primary">
        {localize('com_ui_usage_recent_transactions')}
      </h3>
      <div className="overflow-hidden rounded-lg border border-border-light">
        <div className="max-h-[200px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-surface-secondary">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-text-secondary">
                  {localize('com_ui_usage_date')}
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-text-secondary">
                  {localize('com_ui_usage_model')}
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-text-secondary">
                  {localize('com_ui_usage_type')}
                </th>
                <th className="px-2 py-1.5 text-right font-medium text-text-secondary">
                  {localize('com_ui_tokens')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {displayedTransactions.map((tx) => (
                <tr key={tx._id} className="bg-surface-primary hover:bg-surface-secondary">
                  <td className="px-2 py-1.5 text-text-secondary">
                    {new Date(tx.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="max-w-[120px] truncate px-2 py-1.5 font-medium text-text-primary" title={tx.model || 'Unknown'}>
                    {tx.model || 'Unknown'}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        tx.tokenType === 'prompt'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : tx.tokenType === 'completion'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {tx.tokenType}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-text-primary">
                    {Math.abs(tx.rawAmount || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {transactions.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {localize('com_ui_usage_show_less')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {localize('com_ui_usage_show_more')} ({transactions.length - 8} {localize('com_ui_more')})
            </>
          )}
        </button>
      )}
    </div>
  );
};

const TokenDisplayToggle: React.FC = () => {
  const localize = useLocalize();
  const [showTokens, setShowTokens] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_DISPLAY_KEY) !== 'false';
    }
    return true;
  });

  const handleToggle = () => {
    const newValue = !showTokens;
    setShowTokens(newValue);
    localStorage.setItem(TOKEN_DISPLAY_KEY, String(newValue));
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('tokenDisplayChange', { detail: newValue }));
  };

  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary p-3">
      <div className="flex items-center gap-2">
        {showTokens ? <Eye className="h-4 w-4 text-text-secondary" /> : <EyeOff className="h-4 w-4 text-text-secondary" />}
        <div>
          <p className="text-xs font-medium text-text-primary">{localize('com_ui_usage_show_tokens')}</p>
          <p className="text-[10px] text-text-secondary">{localize('com_ui_usage_show_tokens_desc')}</p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          showTokens ? 'bg-green-500' : 'bg-gray-400'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            showTokens ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
};

export default function Usage() {
  const localize = useLocalize();
  const [period, setPeriod] = useState<Period>('month');

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useGetTransactionsSummary(period, true);
  const { data: transactionsData, isLoading: transactionsLoading } = useGetTransactions(
    { limit: 100 },
    true,
  );

  const transactions = useMemo(
    () => transactionsData?.transactions || [],
    [transactionsData?.transactions],
  );

  // Format cost as currency
  const formatCost = (cost: number) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="flex flex-col gap-3 text-sm text-text-primary">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{localize('com_ui_usage_title')}</h2>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {/* Summary Stats */}
      {summaryLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
        </div>
      ) : summaryError ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Failed to load usage data. Please try again.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<Coins className="h-3.5 w-3.5" />}
              label={localize('com_ui_usage_total_tokens')}
              value={summary?.totalTokens || 0}
            />
            <StatCard
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label={localize('com_ui_usage_cost')}
              value={formatCost(summary?.totalCost || 0)}
            />
            <StatCard
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label={localize('com_ui_usage_prompt_tokens')}
              value={summary?.promptTokens || 0}
            />
            <StatCard
              icon={<Clock className="h-3.5 w-3.5" />}
              label={localize('com_ui_usage_completion_tokens')}
              value={summary?.completionTokens || 0}
            />
          </div>

          {/* Model breakdown */}
          <ModelBreakdown data={summary?.modelBreakdown || []} />
        </>
      )}

      {/* Token display toggle */}
      <TokenDisplayToggle />

      {/* Transactions list */}
      <TransactionsList transactions={transactions} isLoading={transactionsLoading} />
    </div>
  );
}

// Export the storage key for use in other components
export { TOKEN_DISPLAY_KEY };
