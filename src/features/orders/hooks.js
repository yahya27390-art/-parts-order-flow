/**
 * orders/hooks.js — استعلامات وتعديلات طلبات الشراء عبر React Query.
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/errors';
import * as ordersApi from './api';
import { isOpenOrderStatus } from './logic';

export const useOrdersPage = (params = {}) =>
  useQuery({
    queryKey: ordersApi.ordersQueryKey(params),
    queryFn: () => ordersApi.listOrdersPage(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

export const useOpenOrders = () =>
  useQuery({
    queryKey: ordersApi.openOrdersQueryKey(),
    queryFn: () => ordersApi.listOpenOrders(),
    staleTime: 20_000,
  });

export const useRecentOrders = (limit = 5) =>
  useQuery({
    queryKey: ['orders', 'recent', limit],
    queryFn: () => ordersApi.listRecentOrders(limit),
    staleTime: 30_000,
  });

export const useOrderDetail = (orderId) =>
  useQuery({
    queryKey: ordersApi.orderDetailQueryKey(orderId),
    queryFn: () => ordersApi.getOrderDetail(orderId),
    enabled: Boolean(orderId),
  });

const useInvalidateOrders = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
};

export const useCreatePurchaseOrder = () => {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: (payload) => ordersApi.createPurchaseOrder(payload),
    onSuccess: (data) => {
      invalidate();
      toast.success(`تم إنشاء الطلب ${data?.order_number || ''} بنجاح`);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر إنشاء طلب الشراء')),
  });
};

export const useUpdatePurchaseOrder = () => {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: (payload) => ordersApi.updatePurchaseOrder(payload),
    onSuccess: () => {
      invalidate();
      toast.success('تم تحديث طلب الشراء');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر تحديث الطلب')),
  });
};

export const useCancelPurchaseOrder = () => {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: (payload) => ordersApi.cancelPurchaseOrder(payload),
    onSuccess: () => {
      invalidate();
      toast.success('تم إلغاء الطلب');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر إلغاء الطلب')),
  });
};

export const useDeletePurchaseOrder = () => {
  const invalidate = useInvalidateOrders();

  return useMutation({
    mutationFn: (orderId) => ordersApi.deletePurchaseOrder(orderId),
    onSuccess: () => {
      invalidate();
      toast.success('تم حذف الطلب');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر حذف الطلب')),
  });
};

export { isOpenOrderStatus };
