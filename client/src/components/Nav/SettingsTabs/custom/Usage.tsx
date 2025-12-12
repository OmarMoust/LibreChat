/**
 * Usage Settings Tab - Shows token usage statistics and transaction history
 * Custom component isolated from core LibreChat for easier upstream merges
 */
import React, { useState, useMemo } from 'react';
import { BarChart3, Clock, Coins, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useGetTransactionsSummary,
  useGetTransactions,
  type Transaction,
} from '~/data-provider/custom';
import { useLocalize } from '~/hooks';

type Period = 'day' | 'week' | 'month' | 'all';

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
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
  <div className="rounded-lg border border-border-light bg-surface-secondary p-4">
    <div className="flex items-center gap-2 text-text-secondary">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="mt-2">
      <span className="text-2xl font-bold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {subValue && <span className="ml-2 text-xs text-text-secondary">{subValue}</span>}
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
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-medium text-text-primary">
        {localize('com_ui_usage_by_model')}
      </h3>
      <div className="space-y-3">
        {data.map((model) => (
          <div key={model._id || 'unknown'} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-text-primary">{model._id || 'Unknown'}</span>
              <span className="text-text-secondary">{model.tokens.toLocaleString()} tokens</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
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

  const displayedTransactions = expanded ? transactions : transactions.slice(0, 10);

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="mt-6 rounded-lg border border-border-light bg-surface-secondary p-6 text-center">
        <p className="text-sm text-text-secondary">{localize('com_ui_usage_no_transactions')}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-medium text-text-primary">
        {localize('com_ui_usage_recent_transactions')}
      </h3>
      <div className="overflow-hidden rounded-lg border border-border-light">
        <table className="w-full text-xs">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">
                {localize('com_ui_usage_date')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">
                {localize('com_ui_usage_model')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">
                {localize('com_ui_usage_type')}
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-secondary">
                {localize('com_ui_tokens')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {displayedTransactions.map((tx) => (
              <tr key={tx._id} className="bg-surface-primary hover:bg-surface-secondary">
                <td className="px-3 py-2 text-text-secondary">
                  {new Date(tx.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2 font-medium text-text-primary">
                  {tx.model || 'Unknown'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
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
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {Math.abs(tx.rawAmount || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transactions.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              {localize('com_ui_usage_show_less')}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              {localize('com_ui_usage_show_more')} ({transactions.length - 10}{' '}
              {localize('com_ui_more')})
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default function Usage() {
  const localize = useLocalize();
  const [period, setPeriod] = useState<Period>('month');

  const { data: summary, isLoading: summaryLoading } = useGetTransactionsSummary(period, true);
  const { data: transactionsData, isLoading: transactionsLoading } = useGetTransactions(
    { limit: 100 },
    true,
  );

  const transactions = useMemo(
    () => transactionsData?.transactions || [],
    [transactionsData?.transactions],
  );

  return (
    <div className="flex flex-col gap-4 p-1 text-sm text-text-primary">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{localize('com_ui_usage_title')}</h2>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {/* Summary Stats */}
      {summaryLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Coins className="h-4 w-4" />}
              label={localize('com_ui_usage_total_tokens')}
              value={summary?.totalTokens || 0}
            />
            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              label={localize('com_ui_usage_requests')}
              value={summary?.transactionCount || 0}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label={localize('com_ui_usage_prompt_tokens')}
              value={summary?.promptTokens || 0}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label={localize('com_ui_usage_completion_tokens')}
              value={summary?.completionTokens || 0}
            />
          </div>

          {/* Model breakdown */}
          <ModelBreakdown data={summary?.modelBreakdown || []} />
        </>
      )}

      {/* Transactions list */}
      <TransactionsList transactions={transactions} isLoading={transactionsLoading} />
    </div>
  );
}

