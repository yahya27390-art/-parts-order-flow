import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAuth();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(Boolean(session?.user));
      setIsLoadingAuth(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      if (!supabase) {
        setAuthError({
          type: 'configuration_missing',
          message: 'إعدادات قاعدة البيانات غير مكتملة'
        });
        setIsLoadingAuth(false);
        return;
      }
      setAuthError(null);
      setIsLoadingAuth(true);
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthenticated(Boolean(session?.user));
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('Authentication check failed:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (supabase) supabase.auth.signOut();
    if (shouldRedirect) window.location.assign('/');
  };

  const navigateToLogin = () => {
    setAuthError({
      type: 'auth_required',
      message: 'يرجى تسجيل الدخول باستخدام حساب Supabase'
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState: checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
