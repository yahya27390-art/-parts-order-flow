import React, { useState, useEffect } from 'react';
import { db as base44 } from '@/api/databaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Upload, Save, Image } from 'lucide-react';
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    system_name: 'نظام إدارة المخزون',
    logo_url: '',
    show_logo_interface: true,
    show_logo_reports: true,
    show_logo_print: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await base44.entities.SystemSettings.list();
      if (data.length > 0) {
        setSettings(data[0]);
        setSettingsId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingsId) {
        await base44.entities.SystemSettings.update(settingsId, settings);
      } else {
        const newSettings = await base44.entities.SystemSettings.create(settings);
        setSettingsId(newSettings.id);
      }
      toast.success('تم حفظ الإعدادات بنجاح');
      // Reload to apply changes
      window.location.reload();
    } catch (error) {
      toast.error('حدث خطأ في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSettings({ ...settings, logo_url: file_url });
      toast.success('تم رفع اللوجو بنجاح');
    } catch (error) {
      toast.error('حدث خطأ في رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
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