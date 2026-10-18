import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Package, 
  ShieldCheck, 
  UserCheck, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowLeft, 
  Layers, 
  CheckCircle2, 
  Globe2, 
  Boxes,
  KeyRound
} from 'lucide-react';
import { useAuth, MANAGEMENT_ACCOUNTS } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc.id);
    setIdentifier(acc.email);
    setErrorMsg('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMsg('');

    if (!identifier.trim()) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني أو اسم المستخدم.');
      return;
    }
    if (!password) {
      setErrorMsg('يرجى إدخال كلمة المرور.');
      return;
    }

    setBusy(true);
    try {
      await login(identifier.trim(), password);
      // الدخول ناجح، سيقوم AuthContext بتحديث الحالة وتوجيه المستخدم فوراً
    } catch (err) {
      setErrorMsg(err.message || 'تعذر تسجيل الدخول، يرجى التأكد من البيانات.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div 
      dir="rtl" 
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#070d19] text-slate-100 relative overflow-hidden font-sans select-none"
    >
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Glass Card */}
      <div className="w-full max-w-xl relative z-10">
        <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-black/80 p-6 sm:p-9 space-y-7">
          
          {/* Header & Brand */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/20 ring-4 ring-amber-400/15">
              <Package className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-300 text-xs font-semibold">
                <Globe2 className="w-3.5 h-3.5" />
                <span>درة السيارة — منظومة استيراد وطلبيات كوريا</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                إدارة المخزون وطلبات الشراء
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                قطع غيار هيونداي وكيا الأصلية • بوابة الدخول الإدارية الموحدة
              </p>
            </div>
          </div>

          {/* Quick Executive Account Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>اختيار الحساب السريع:</span>
              </span>
              <span className="text-[11px] text-slate-500">انقر للتعبئة الفورية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MANAGEMENT_ACCOUNTS.map((acc) => {
                const isSelected = selectedAccount === acc.id || identifier.toLowerCase() === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectAccount(acc)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-right transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-l from-amber-500/20 via-blue-900/30 to-blue-800/40 border-amber-400/60 shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/30'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-inner ${
                      isSelected
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 ring-2 ring-white/30'
                        : 'bg-slate-700 text-slate-200'
                    }`}>
                      {acc.avatar}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm text-white truncate">{acc.full_name}</p>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 ml-1" />}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{acc.title}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                البريد الإلكتروني أو اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <Input
                  type="text"
                  dir="ltr"
                  placeholder="yahya9031@gmail.com أو yahya"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-11 pr-10 pl-3 bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-xl focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-sm font-mono text-right"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  كلمة المرور
                </label>
                <span className="text-[11px] text-slate-400">مشفرة ومحمية</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 pl-11 bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-xl focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-sm font-mono text-right"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-ping" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-gradient-to-l from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 border border-amber-300/40 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحقق والدخول...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>تسجيل الدخول الإداري</span>
                  <ArrowLeft className="w-4 h-4" />
                </div>
              )}
            </Button>
          </form>

          {/* Footer Security Badges */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>جلسة إدارية مشفرة 256-bit</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-blue-400" />
              <span>مزامنة مباشرة مع كوريا</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>صلاحيات المدير العام Admin</span>
            </span>
          </div>

        </div>

        {/* Brand Copyright */}
        <p className="text-center text-[11px] text-slate-500 mt-4">
          درة السيارة للتجارة © {new Date().getFullYear()} — كافة الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
