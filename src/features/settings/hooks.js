/**
 * settings/hooks.js — إعدادات النظام مع كاش مشترك لكل الصفحات
 * (بدل تكرار طلب الإعدادات في Layout و Dashboard وصفحات التفاصيل).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/errors';
import * as settingsApi from './api';

export const useSettings = () =>
  useQuery({
    queryKey: settingsApi.settingsQueryKey(),
    queryFn: () => settingsApi.getSettings(),
    staleTime: 5 * 60_000,
  });

export const useSaveSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values) => settingsApi.saveSettings(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsApi.settingsQueryKey() });
      toast.success('تم حفظ الإعدادات');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر حفظ الإعدادات')),
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => settingsApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsApi.settingsQueryKey() });
      toast.success('تم رفع الشعار');
    },
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر رفع الشعار')),
  });
};

export const useDeleteLogoFile = () =>
  useMutation({
    mutationFn: (url) => settingsApi.deleteLogoFile(url),
    onError: (error) => toast.error(getErrorMessage(error, 'تعذّر حذف ملف الشعار القديم')),
  });
