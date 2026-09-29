/**
 * inventory/hooks.js — استعلامات المخزون وحركاته.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as inventoryApi from './api';

export const useInventoryPage = (params = {}) =>
  useQuery({
    queryKey: inventoryApi.inventoryQueryKey(params),
    queryFn: () => inventoryApi.listInventoryPage(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

export const useInventorySummary = () =>
  useQuery({
    queryKey: inventoryApi.inventorySummaryKey(),
    queryFn: () => inventoryApi.getInventorySummary(),
    staleTime: 30_000,
  });

export const useStockMovements = (params = {}) =>
  useQuery({
    queryKey: inventoryApi.stockMovementsQueryKey(params),
    queryFn: () => inventoryApi.listStockMovements(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
