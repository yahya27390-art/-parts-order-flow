/**
 * receipts/hooks.js — استعلامات وتعديلات أذونات الاستلام.
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/errors';
import * as receiptsApi from './api';

export const useReceiptsPage = (params = {}) =>
  useQuery({
    queryKey: receiptsApi.receiptsQueryKey(params),
    queryFn: () => receiptsApi.listReceiptsPage(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

export const useRecentReceipts = (limit = 5) =>
  useQuery({
    queryKey: ['receipts', 'recent', limit],
    queryFn: () => receiptsApi.listRecentReceipts(limit),
    staleTime: 30_000,
  });

export const useReceiptDetail = (receiptId) =>
  useQuery({
    queryKey: receiptsApi.receiptDetailQueryKey(receiptId),
    queryFn: () => receiptsApi.getReceiptDetail(receiptId),
    enabled: Boolean(receiptId),
  });

const useInvalidateReceipts = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
    queryClient.invalidateQueries({ queryKey: ['receipt'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
};

export const useCreateGoodsReceipt = () => {
  const invalidate = useInvalidateReceipts();

  return useMutation({
    mutationFn: (payload) => receiptsApi.createGoodsReceipt(payload),
    onSuccess: () => {
      invalidate();
      toast.success('تم تسجيل إذن الاستلام وتحديث الرصيد');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر تسجيل إذن الاستلام')),
  });
};

export const useUpdateGoodsReceipt = () => {
  const invalidate = useInvalidateReceipts();

  return useMutation({
    mutationFn: (payload) => receiptsApi.updateGoodsReceipt(payload),
    onSuccess: () => {
      invalidate();
      toast.success('تم تحديث إذن الاستلام');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر تحديث إذن الاستلام')),
  });
};

export const useVoidGoodsReceipt = () => {
  const invalidate = useInvalidateReceipts();

  return useMutation({
    mutationFn: (payload) => receiptsApi.voidGoodsReceipt(payload),
    onSuccess: () => {
      invalidate();
      toast.success('تم إلغاء إذن الاستلام وعكس أثره على المخزون');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر إلغاء إذن الاستلام')),
  });
};
