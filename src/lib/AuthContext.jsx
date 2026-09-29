import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUser } from '@/api/supabaseClient';
import { canWrite, isAdminRole } from '@/lib/labels';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const resolveAuthState = useCallback(async () => {
    if (!supabase) {
      setAuthError({ type: 'configuration_missing', message: 'إعدادات قاعدة البيانات غير مكتملة' });
      setIsLoadingAuth(false);
      return;
    }

    setIsLoadingAuth(true);
    try {
      const currentUser = await getCurrentUser();

      setUser(currentUser);
      setIsAuthenticated(Boolean(currentUser));

      if (!currentUser) {
        setAuthError({ type: 'auth_required', message: 'يرجى تسجيل الدخول باستخدام حساب Supabase' });
      } else if (currentUser.is_active === false) {
        setAuthError({ type: 'user_not_active', message: 'حسابك غير مُفعَّل في النظام' });
      } else {
        setAuthError(null);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    resolveAuthState();
    if (!supabase) return undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      // لا نستدعي Supabase داخل الـ callback مباشرة لتفادي الجمود (Deadlock).
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'يرجى تسجيل الدخول باستخدام حساب Supabase' });
        setIsLoadingAuth(false);
        return;
      }

      setTimeout(() => {
        resolveAuthState();
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, [resolveAuthState]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (supabase) await supabase.auth.signOut();
    if (shouldRedirect) window.location.assign(import.meta.env.BASE_URL);
  };

  const navigateToLogin = () => {
    setAuthError({ type: 'auth_required', message: 'يرجى تسجيل الدخول باستخدام حساب Supabase' });
  };

  const role = user?.role || null;

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: isAdminRole(role),
      canWrite: canWrite(role),
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState: resolveAuthState,
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

