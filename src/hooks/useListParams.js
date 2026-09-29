/**
 * useListParams.js — حالة موحّدة لجداول القوائم: البحث (مع تأخير زمني)،
 * الترقيم، وحجم الصفحة. تُقلّل تكرار نفس المنطق في كل صفحة قائمة.
 */
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '@/api/supabaseClient';

export const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export const useListParams = ({ initialPageSize = DEFAULT_PAGE_SIZE, initialStatus = 'all' } = {}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);

  const debouncedSearch = useDebouncedValue(search, 250);

  // أي تغيير في الفلاتر يعيدنا للصفحة الأولى.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, pageSize]);

  const params = useMemo(
    () => ({ page, pageSize, search: debouncedSearch, status: status === 'all' ? '' : status }),
    [page, pageSize, debouncedSearch, status],
  );

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    status,
    setStatus,
    debouncedSearch,
    params,
    resetPage: () => setPage(1),
  };
};
