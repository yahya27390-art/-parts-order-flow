/**
 * reports/hooks.js — استعلامات لوحة التحكم والتقارير.
 */
import { useQuery } from '@tanstack/react-query';
import * as reportsApi from './api';

export const useDashboardData = () =>
  useQuery({
    queryKey: reportsApi.dashboardQueryKey(),
    queryFn: () => reportsApi.getDashboardData(),
    staleTime: 30_000,
  });

export const useReceiptsReport = (params = {}) =>
  useQuery({
    queryKey: reportsApi.reportsQueryKey({ type: 'receipts', ...params }),
    queryFn: () => reportsApi.getReceiptsReport(params),
    staleTime: 60_000,
  });

export const useInventoryReport = () =>
  useQuery({
    queryKey: reportsApi.reportsQueryKey({ type: 'inventory' }),
    queryFn: () => reportsApi.getInventoryReport(),
    staleTime: 60_000,
  });

export const useNegativeStockReport = () =>
  useQuery({
    queryKey: reportsApi.reportsQueryKey({ type: 'negative-stock' }),
    queryFn: () => reportsApi.getNegativeStockItems(),
    staleTime: 60_000,
  });

export const useSupplierDiscrepancies = (orderId = null) =>
  useQuery({
    queryKey: reportsApi.discrepancyQueryKey(orderId),
    queryFn: () => reportsApi.getSupplierDiscrepancies(orderId),
    enabled: Boolean(orderId),
    staleTime: 60_000,
  });
