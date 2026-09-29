import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Upload, Save, Image, Users } from 'lucide-react';
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/lib/AuthContext';
import { useDeleteLogoFile, useSaveSettings, useSettings, useUploadLogo } from '@/features/settings/hooks';
import { db } from '@/api/supabaseClient';
import { getErrorMessage } from '@/api/errors';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/labels';
import { formatDate } from '@/lib/format';

const DEFAULT_SETTINGS = {
  system_name: 'نظام إدارة المخزون',
  logo_url: '',
  show_logo_interface: true,
  show_logo_reports: true,
  show_logo_print: true,
};

const ROLE_OPTIONS = ['admin', 'storekeeper', 'viewer'];

export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const { data: savedSettings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();
  const uploadLogo = useUploadLogo();
  const deleteLogoFile = useDeleteLogoFile();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
  }, [savedSettings]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin) return;
      try {
        const result = await db.profiles.list({ pageSize: 100 });
        setUsers(result.rows ?? []);
      } catch (error) {
        toast.error(getErrorMessage(error, 'تعذّر تحميل المستخدمين — تأكد من تطبيق ترحيل المستخدمين والأدوار'));
      }
    };

    loadUsers();
  }, [isAdmin]);

  const handleSave = async () => {
    try {
      await saveSettings.mutateAsync({ ...settings, id: savedSettings?.id });
    } catch {
      /* رسالة الخطأ تظهر من الـ hook */
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const previousUrl = settings.logo_url;
      const logoUrl = await uploadLogo.mutateAsync(file);
      setSettings((current) => ({ ...current, logo_url: logoUrl }));

      // حذف ملف الشعار القديم حتى لا تتراكم الملفات في التخزين.
      if (previousUrl && previousUrl !== logoUrl) {
        deleteLogoFile.mutate(previousUrl);
      }
    } catch {
      /* رسالة الخطأ تظهر من الـ hook */
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await db.profiles.updateRole(userId, role);
      setUsers((current) => current.map((item) => (item.id === userId ? { ...item, role } : item)));
      toast.success('تم تحديث صلاحية المستخدم');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذّر تحديث الصلاحية'));
    }
  };

  const handleActiveToggle = async (userId, isActive) => {
    try {
      await db.profiles.setActive(userId, isActive);
      setUsers((current) => current.map((item) => (item.id === userId ? { ...item, is_active: isActive } : item)));
      toast.success(isActive ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب');
    } catch (error) {
      toast.error(getErrorMessage(error, 'تعذّر تحديث حالة الحساب'));
    }
  };

  const saving = saveSettings.isPending;
  const uploading = uploadLogo.isPending;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>الإعدادات</h1>
        <p className="text-slate-500 mt-1">إعدادات النظام العامة</p>
      </div>

      {/* System Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Settings className="h-5 w-5" />
            إعدادات النظام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* System Name */}
          <div className="space-y-2">
            <Label>اسم النظام</Label>
            <Input
              value={settings.system_name}
              onChange={(e) => setSettings({...settings, system_name: e.target.value})}
              placeholder="اسم النظام"
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-4">
            <Label>لوجو الشركة</Label>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {settings.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt="Logo" 
                    className="h-24 w-24 object-contain rounded-xl border border-slate-200 bg-white p-2"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                    <Image className="h-8 w-8 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload">
                  <Button variant="outline" disabled={uploading} asChild>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 ml-2" />
                      {uploading ? 'جاري الرفع...' : 'رفع لوجو'}
                    </span>
                  </Button>
                </label>
                <p className="text-sm text-slate-500">PNG أو JPG (يفضل 200x200 بكسل)</p>
                {settings.logo_url && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setSettings({...settings, logo_url: ''})}
                  >
                    إزالة اللوجو
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Logo Display Options */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-medium">إظهار اللوجو في</Label>
            
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium" style={{ color: '#1e3a5f' }}>الواجهة الرئيسية</p>
                <p className="text-sm text-slate-500">إظهار اللوجو في القائمة الجانبية</p>
              </div>
              <Switch
                checked={settings.show_logo_interface}
                onCheckedChange={(checked) => setSettings({...settings, show_logo_interface: checked})}
              />
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium" style={{ color: '#1e3a5f' }}>التقارير</p>
                <p className="text-sm text-slate-500">إظهار اللوجو في رأس التقارير</p>
              </div>
              <Switch
                checked={settings.show_logo_reports}
                onCheckedChange={(checked) => setSettings({...settings, show_logo_reports: checked})}
              />
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50">
              <div>
                <p className="font-medium" style={{ color: '#1e3a5f' }}>الطباعة</p>
                <p className="text-sm text-slate-500">إظهار اللوجو عند طباعة المستندات</p>
              </div>
              <Switch
                checked={settings.show_logo_print}
                onCheckedChange={(checked) => setSettings({...settings, show_logo_print: checked})}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* المستخدمون والصلاحيات (للمدير فقط) */}
      {isAdmin ? (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b" style={{ backgroundColor: '#1e3a5f' }}>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Users className="h-5 w-5" />
              المستخدمون والصلاحيات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                لا يوجد مستخدمون مسجّلون بعد. يظهر هنا كل من يسجّل حسابًا في النظام.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">البريد الإلكتروني</TableHead>
                      <TableHead className="text-right">الدور</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">تاريخ الإضافة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((profileUser) => (
                      <TableRow key={profileUser.id}>
                        <TableCell className="font-medium">{profileUser.full_name || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-left text-xs text-slate-500">
                          {profileUser.email || '-'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={profileUser.role}
                            onValueChange={(value) => handleRoleChange(profileUser.id, value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((roleValue) => (
                                <SelectItem key={roleValue} value={roleValue} title={ROLE_DESCRIPTIONS[roleValue]}>
                                  {ROLE_LABELS[roleValue]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={Boolean(profileUser.is_active)}
                              onCheckedChange={(checked) => handleActiveToggle(profileUser.id, checked)}
                            />
                            <span className="text-xs text-slate-500">
                              {profileUser.is_active ? 'مُفعَّل' : 'موقوف'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(profileUser.created_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          style={{ backgroundColor: '#1e3a5f' }}
          className="hover:opacity-90"
        >
          <Save className="h-4 w-4 ml-2" />
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </div>
    </div>
  );
}