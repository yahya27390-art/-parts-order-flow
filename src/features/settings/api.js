/**
 * settings/api.js — إعدادات النظام (اسم النظام والشعار).
 */
import { db, validateLogoFile, storagePathFromPublicUrl } from '@/api/supabaseClient';
import { settingsSchema, firstValidationError } from '@/lib/schemas';

export const settingsQueryKey = () => ['settings'];

export const getSettings = async () => {
  const rows = await db.entities.SystemSettings.list('created_date', 1);
  return rows[0] ?? null;
};

export const saveSettings = async (values) => {
  const validation = settingsSchema.safeParse(values);
  if (!validation.success) throw new Error(firstValidationError(validation));

  const payload = {
    system_name: validation.data.system_name,
    logo_url: validation.data.logo_url || null,
    show_logo_interface: validation.data.show_logo_interface,
    show_logo_reports: validation.data.show_logo_reports,
    show_logo_print: validation.data.show_logo_print,
  };

  if (values.id) {
    return db.entities.SystemSettings.update(values.id, payload);
  }

  return db.entities.SystemSettings.create(payload);
};

export const uploadLogo = async (file) => {
  const validationMessage = validateLogoFile(file);
  if (validationMessage) throw new Error(validationMessage);
  return db.storage.uploadLogo(file);
};

/** يحذف ملف الشعار القديم من التخزين حتى لا تتراكم الملفات. */
export const deleteLogoFile = async (url) => {
  const path = storagePathFromPublicUrl(url);
  if (!path) return false;
  await db.storage.deleteStorageObject(path);
  return true;
};
