import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUser } from '@/api/supabaseClient';
import { canWrite, isAdminRole } from '@/lib/labels';

const AuthContext = createContext();

// الحسابات الإدارية المعتمدة لمنظومة قطع كوريا (درة السيارة)
export const MANAGEMENT_ACCOUNTS = [
  {
    id: 'user-yahya',
    username: 'yahya',
    email: 'yahya9031@gmail.com',
    passwords: ['Dell2020KoKa', 'Dell2020KoKa*', 'dora#2026', 'dora2026'],
    full_name: 'يحيى محمد باشا',
    role: 'admin',
    avatar: 'ي',
    title: 'مدير النظام التنفيذي',
  },
  {
    id: 'user-fahad',
    username: 'fahad',
    email: 'dortalsiarh@gmail.com',
    passwords: ['fahad@dora2026', 'dora#2026', 'dora2026', 'Dell2020KoKa'],
    full_name: 'فهد ناصر الجوعي',
    role: 'admin',
    avatar: 'ف',
    title: 'مالك المنصة / الإدارة العليا',
  },
];

const MASTER_PASSWORDS = ['dora2026', 'dora#2026', 'dora@2026'];
const STORAGE_KEY = 'korea_active_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.email)) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(user));
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const resolveAuthState = useCallback(async () => {
    // 1. فحص الجلسة الإدارية المحفوظة محلياً أولاً
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.email)) {
          // مزامنة أحدث بيانات للحسابات الإدارية
          const matched = MANAGEMENT_ACCOUNTS.find(
            a => a.id === parsed.id || a.email.toLowerCase() === (parsed.email || '').toLowerCase()
          );
          const activeUser = matched
            ? { ...parsed, role: matched.role, full_name: matched.full_name, title: matched.title }
            : parsed;

          setUser(activeUser);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          setAuthError(null);
          return;
        }
      }
    } catch {}

    // 2. فحص جلسة Supabase Auth
    if (!supabase) {
      setAuthError({ type: 'configuration_missing', message: 'إعدادات قاعدة البيانات غير مكتملة' });
      setIsLoadingAuth(false);
      return;
    }

    setIsLoadingAuth(true);
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        // إذا كان الحساب من الحسابات الإدارية تأكد من منحه دور admin فوراً
        const isMgmt = MANAGEMENT_ACCOUNTS.some(
          a => a.email.toLowerCase() === (currentUser.email || '').toLowerCase()
        );
        if (isMgmt) {
          currentUser.role = 'admin';
        }
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'يرجى تسجيل الدخول للوصول إلى النظام' });
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setAuthError({ type: 'unknown', message: error.message || 'حدث خطأ غير متوقع' });
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    resolveAuthState();
    if (!supabase) return undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'يرجى تسجيل الدخول للوصول إلى النظام' });
        }
        return;
      }

      setTimeout(() => {
        resolveAuthState();
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, [resolveAuthState]);

  // دالة تسجيل الدخول الفورية والحاسمة (Radical Login Engine)
  const login = async (identifier, password) => {
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanId || !cleanPass) {
      throw new Error('يرجى إدخال البريد الإلكتروني أو اسم المستخدم وكلمة المرور');
    }

    // 1. التحقق من الحسابات الإدارية المعتمدة (يحيى / فهد)
    const matched = MANAGEMENT_ACCOUNTS.find(
      acc => acc.username.toLowerCase() === cleanId || 
             acc.email.toLowerCase() === cleanId ||
             (cleanId === 'admin' && acc.username === 'yahya')
    );

    if (matched) {
      const isPassValid =
        matched.passwords.includes(cleanPass) ||
        MASTER_PASSWORDS.includes(cleanPass);

      if (isPassValid) {
        const authUser = {
          id: matched.id,
          email: matched.email,
          username: matched.username,
          full_name: matched.full_name,
          role: matched.role,
          avatar: matched.avatar,
          title: matched.title,
          is_active: true,
          authenticatedAt: new Date().toISOString(),
        };

        setUser(authUser);
        setIsAuthenticated(true);
        setAuthError(null);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));

        // محاولة ربط جلسة Supabase في الخلفية إن أمكن
        if (supabase) {
          try {
            await supabase.auth.signInWithPassword({
              email: matched.email,
              password: cleanPass,
            });
          } catch {
            // يتم تجاهل أي رسالة تأكيد إيميل من سوبابيز، الجلسة الإدارية مفعلة بنجاح
          }
        }

        return authUser;
      } else {
        throw new Error('كلمة المرور غير صحيحة، يرجى التأكد وإعادة المحاولة');
      }
    }

    // 2. تسجيل دخول عادي عبر Supabase Auth
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanId,
        password: cleanPass,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور');
        }
        throw new Error(error.message || 'تعذر تسجيل الدخول');
      }

      await resolveAuthState();
      return data.user;
    }

    throw new Error('بيانات الدخول غير صحيحة');
  };

  const logout = async (shouldRedirect = true) => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    if (shouldRedirect) {
      window.location.assign(import.meta.env.BASE_URL || '/');
    }
  };

  const navigateToLogin = () => {
    setAuthError({ type: 'auth_required', message: 'يرجى تسجيل الدخول للوصول إلى النظام' });
  };

  const role = user?.role || 'admin'; // الحسابات الإدارية تمنح admin فوراً

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: isAdminRole(role) || role === 'admin',
      canWrite: canWrite(role) || role === 'admin',
      isAuthenticated: Boolean(user && isAuthenticated),
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      login,
      logout,
      navigateToLogin,
      checkAppState: resolveAuthState,
      managementAccounts: MANAGEMENT_ACCOUNTS,
    }),
    [user, role, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, appPublicSettings, resolveAuthState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
