import React, { useState } from 'react';
import { LockKeyhole, Mail, Package, UserPlus } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({ type: 'error', text: 'إعدادات قاعدة البيانات غير مكتملة.' });
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'تم إنشاء الحساب. افحص بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.' });
        setMode('login');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'تعذر إتمام العملية.' });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setMessage(null);
    if (!supabase || !email.trim()) {
      setMessage({ type: 'error', text: 'اكتب بريدك الإلكتروني أولًا.' });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`
      });
      if (error) throw error;
      setMessage({ type: 'success', text: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'تعذر إرسال رابط إعادة التعيين.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-8 sm:flex sm:items-center sm:justify-center">
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70">
        <div className="bg-gradient-to-br from-[#173253] to-[#102640] px-6 py-8 text-center text-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e5bd69] to-[#c79236] shadow-lg">
            <Package className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">إدارة المخزون</h1>
          <p className="mt-2 text-sm text-slate-300">
            {mode === 'login' ? 'سجّل الدخول للوصول إلى النظام' : 'أنشئ حساب مستخدم جديد'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 sm:p-8">
          {mode === 'signup' && (
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              الاسم
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="الاسم الكامل" />
            </label>
          )}
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            البريد الإلكتروني
            <div className="relative">
              <Mail className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pr-10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@example.com" dir="ltr" />
            </div>
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            كلمة المرور
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pr-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="6 أحرف على الأقل" dir="ltr" />
            </div>
          </label>

          {message && (
            <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {message.text}
            </div>
          )}

          <Button type="submit" disabled={busy} className="h-11 w-full bg-[#173253] hover:bg-[#102640]">
            {busy ? 'جاري التنفيذ...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
          </Button>

          {mode === 'login' && (
            <button type="button" onClick={handleReset} disabled={busy} className="w-full text-center text-sm text-[#1e3a5f] hover:underline">
              نسيت كلمة المرور؟
            </button>
          )}

          <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(null); }} className="flex w-full items-center justify-center gap-2 text-sm text-slate-500 hover:text-[#1e3a5f]">
            <UserPlus className="h-4 w-4" />
            {mode === 'login' ? 'إنشاء حساب جديد' : 'العودة لتسجيل الدخول'}
          </button>
        </form>
      </section>
    </main>
  );
}
