/**
 * items/hooks.js — استعلامات وتعديلات الأصناف عبر React Query
 * (كاش تلقائي + إبطال بعد كل تعديل + رسائل خطأ عربية موحّدة).
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/errors';
import * as itemsApi from './api';

export const useItemsPage = (params = {}) =>
  useQuery({
    queryKey: itemsApi.itemsQueryKey(params),
    queryFn: () => itemsApi.listItemsPage(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

export const useItemSearch = (term = '', options = {}) =>
  useQuery({
    queryKey: ['items', 'search', term],
    queryFn: () => itemsApi.searchItems(term, options),
    staleTime: 60_000,
  });

export const useItemMovements = (itemId, params = {}) =>
  useQuery({
    queryKey: ['item-movements', itemId, params],
    queryFn: () => itemsApi.listItemMovements(itemId, params),
    enabled: Boolean(itemId),
  });

export const useSaveItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }) => (id ? itemsApi.updateItem(id, values) : itemsApi.createItem(values)),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(variables.id ? 'تم تحديث الصنف بنجاح' : 'تم إضافة الصنف بنجاح');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر حفظ الصنف')),
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => itemsApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('تم حذف الصنف');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'تعذّر حذف الصنف (قد يكون مرتبطًا بطلبات أو إذونات استلام)')),
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => itemsApi.adjustItemStock(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['item-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      const delta = Number(data?.delta ?? 0);
      toast.success(delta === 0 ? 'لا يوجد تغيير في الرصيد' : `تم تحديث الرصيد (${delta > 0 ? '+' : ''}${delta})`);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر تحديث الرصيد')),
  });
};
