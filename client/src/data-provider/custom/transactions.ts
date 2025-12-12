/**
 * Custom data provider for transactions/usage tracking
 * Isolated from core LibreChat code for easier upstream merges
 */
import { useQuery } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';

// Types
export interface Transaction {
  _id: string;
  user: string;
  conversationId?: string;
  model?: string;
  context?: string;
  tokenType: 'prompt' | 'completion' | 'credits';
  rawAmount?: number;
  tokenValue?: number;
  inputTokens?: number;
  writeTokens?: number;
  readTokens?: number;
  rate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionsSummary {
  totalTokens: number;
  totalCost: number;
  promptTokens: number;
  completionTokens: number;
  transactionCount: number;
  period: string;
  modelBreakdown: Array<{
    _id: string;
    tokens: number;
    cost: number;
    count: number;
  }>;
  dailyUsage: Array<{
    _id: string;
    tokens: number;
    cost: number;
  }>;
}

export interface TransactionsQueryParams {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  model?: string;
  conversationId?: string;
}

// API endpoints
const BASE_URL = typeof window !== 'undefined' ? '' : '';

const endpoints = {
  transactions: (params?: TransactionsQueryParams) => {
    const query = params
      ? '?' +
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return `${BASE_URL}/api/user/transactions${query}`;
  },
  transactionsSummary: (period: string = 'month') =>
    `${BASE_URL}/api/user/transactions/summary?period=${period}`,
};

// API functions
export const getTransactions = async (
  params?: TransactionsQueryParams,
): Promise<TransactionsResponse> => {
  return request.get(endpoints.transactions(params));
};

export const getTransactionsSummary = async (
  period: string = 'month',
): Promise<TransactionsSummary> => {
  return request.get(endpoints.transactionsSummary(period));
};

// React Query hooks
export const useGetTransactions = (params?: TransactionsQueryParams, enabled: boolean = true) => {
  return useQuery<TransactionsResponse>({
    queryKey: ['transactions', params],
    queryFn: () => getTransactions(params),
    enabled,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
};

export const useGetTransactionsSummary = (period: string = 'month', enabled: boolean = true) => {
  return useQuery<TransactionsSummary>({
    queryKey: ['transactions-summary', period],
    queryFn: () => getTransactionsSummary(period),
    enabled,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
};

// Query keys for cache invalidation
export const transactionsQueryKeys = {
  all: ['transactions'] as const,
  list: (params?: TransactionsQueryParams) => ['transactions', params] as const,
  summary: (period: string) => ['transactions-summary', period] as const,
};

