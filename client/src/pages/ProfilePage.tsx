import React, { memo, useState, useCallback, useEffect } from 'react';
import { Phone, Calendar, Globe, Shield, Save, User as UserIcon, QrCode } from 'lucide-react';
import { QRApproveModal } from '@/pages/QRLoginPage';
import api from '@/api/axiosInstance';
import useAppSelector from '@/hooks/useAppSelector';
import useAppDispatch from '@/hooks/useAppDispatch';
import { updateUser } from '@/store/slices/authSlice';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { User } from '@/types';
import { COUNTRIES } from '@/utils/countries';
import {
  validatePhone,
  validateBirthDate,
  validateGender,
  validateCitizenship,
  validateDisplayName,
  getMaxBirthDate,
  normalizePhone,
} from '@/utils/validation';

// ─── Role badge (only for non-user roles) ────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  manager: 'Менеджер',
  admin: 'Администратор',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-amber-50 text-amber-700',
  admin: 'bg-red-50 text-red-700',
};

// ─── Options ─────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: '', label: 'Не указан' },
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'other', label: 'Другой' },
];

const CITIZENSHIP_OPTIONS = [
  { value: '', label: 'Не указано' },
  ...COUNTRIES.map((c) => ({ value: c.value, label: c.label })),
];

// ─── Types ───────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>;

// ─── Main component ──────────────────────────────────────────────────────────

const ProfilePage = memo(function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user) as User | null;

  const [showQRApprove, setShowQRApprove] = useState(false);

  // Editable form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [citizenship, setCitizenship] = useState('');

  // Validation
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // UI state
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const errorFor = (field: string) => touched[field] ? fieldErrors[field] || '' : '';

  // ── Validation helpers ─────────────────────────────────────────────────

  const validateField = useCallback((field: string, value?: string): string => {
    switch (field) {
      case 'displayName': return validateDisplayName(value ?? displayName);
      case 'phone': return validatePhone(value ?? phone);
      case 'birthDate': return validateBirthDate(value ?? birthDate);
      case 'gender': return validateGender(value ?? gender);
      case 'citizenship': return validateCitizenship(value ?? citizenship);
      default: return '';
    }
  }, [displayName, phone, birthDate, gender, citizenship]);

  const handleBlur = useCallback((field: string) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const err = validateField(field);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  }, [validateField]);

  const validateAllFields = useCallback((): boolean => {
    const fields = ['displayName', 'phone', 'birthDate', 'gender', 'citizenship'];
    const newErrors: FieldErrors = {};
    const newTouched: Record<string, boolean> = {};
    let valid = true;
    for (const field of fields) {
      newTouched[field] = true;
      const err = validateField(field);
      newErrors[field] = err;
      if (err) valid = false;
    }
    setTouched((t) => ({ ...t, ...newTouched }));
    setFieldErrors((prev) => ({ ...prev, ...newErrors }));
    return valid;
  }, [validateField]);

  // ── Populate form from user data ───────────────────────────────────────

  const populateForm = useCallback((u: User) => {
    setDisplayName(u.displayName ?? '');
    setPhone(u.phone ?? '');
    setBirthDate(u.birthDate ? new Date(u.birthDate).toISOString().split('T')[0] : '');
    setGender(u.gender ?? '');
    setCitizenship(u.citizenship ?? '');
    setHasChanges(false);
    setFieldErrors({});
    setTouched({});
  }, []);

  // Fetch fresh user data on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        dispatch(updateUser(data.user));
        populateForm(data.user);
      } catch {
        if (user) populateForm(user);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect changes
  useEffect(() => {
    if (!user) return;
    const changed =
      displayName !== (user.displayName ?? '') ||
      phone !== (user.phone ?? '') ||
      birthDate !== (user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '') ||
      gender !== (user.gender ?? '') ||
      citizenship !== (user.citizenship ?? '');
    setHasChanges(changed);
  }, [displayName, phone, birthDate, gender, citizenship, user]);

  // ── Save all changes ───────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validateAllFields()) return;

    setSaving(true);
    setServerError('');
    setSuccess('');
    try {
      const payload: Record<string, any> = {
        displayName: displayName || null,
        phone: normalizePhone(phone) || null,
        birthDate: birthDate || null,
        gender: gender || null,
        citizenship: citizenship || null,
      };

      const { data } = await api.patch('/auth/me', payload);
      dispatch(updateUser(data.user));
      populateForm(data.user);
      setSuccess('Изменения сохранены');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const resp = err.response?.data;
      if (resp?.errors) {
        const newErrors: FieldErrors = {};
        const newTouched: Record<string, boolean> = {};
        for (const [field, msg] of Object.entries(resp.errors)) {
          newErrors[field] = msg as string;
          newTouched[field] = true;
        }
        setFieldErrors((prev) => ({ ...prev, ...newErrors }));
        setTouched((t) => ({ ...t, ...newTouched }));
      } else {
        setServerError(resp?.error || 'Не удалось сохранить');
      }
    } finally {
      setSaving(false);
    }
  }, [displayName, phone, birthDate, gender, citizenship, dispatch, populateForm, validateAllFields]);

  if (!user) return null;

  const roleName = user.role?.name ?? 'user';
  const showRoleBadge = roleName === 'manager' || roleName === 'admin';
  const maxDate = getMaxBirthDate();

  return (
    <>
    {showQRApprove && <QRApproveModal onClose={() => setShowQRApprove(false)} />}
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ── Header card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-semibold text-primary">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-text">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-text/50 text-sm">{user.email}</p>
          </div>
          {showRoleBadge && (
            <div
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                ROLE_COLORS[roleName] ?? 'bg-gray-50 text-gray-700',
              ].join(' ')}
            >
              <Shield size={12} />
              {ROLE_LABELS[roleName] ?? roleName}
            </div>
          )}
        </div>
      </div>

      {/* ── Status messages ──────────────────────────────────────────── */}
      {serverError && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl">{serverError}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-xl">{success}</div>
      )}

      {/* ── Profile form ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h2 className="text-lg font-medium text-text mb-6">Профиль</h2>

        <div className="space-y-5">
          {/* Display name */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <UserIcon size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <Input
                label="Отображаемое имя"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (touched.displayName) {
                    setFieldErrors((prev) => ({ ...prev, displayName: validateDisplayName(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('displayName')}
                error={errorFor('displayName')}
                placeholder="Будет показано в отзывах и комментариях"
                hint="Не используется в бронированиях"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Phone size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <Input
                label="Номер телефона"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (touched.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: validatePhone(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('phone')}
                error={errorFor('phone')}
                placeholder="+7XXXXXXXXXX"
                hint="Формат: +7XXXXXXXXXX (международный)"
              />
            </div>
          </div>

          {/* Birth date */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Calendar size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <Input
                label="Дата рождения"
                type="date"
                value={birthDate}
                max={maxDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  if (touched.birthDate) {
                    setFieldErrors((prev) => ({ ...prev, birthDate: validateBirthDate(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('birthDate')}
                error={errorFor('birthDate')}
              />
            </div>
          </div>

          {/* Gender */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <UserIcon size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <Select
                label="Пол"
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  if (touched.gender) {
                    setFieldErrors((prev) => ({ ...prev, gender: validateGender(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('gender')}
                error={errorFor('gender')}
              />
            </div>
          </div>

          {/* Citizenship */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Globe size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <Select
                label="Гражданство"
                options={CITIZENSHIP_OPTIONS}
                value={citizenship}
                onChange={(e) => {
                  setCitizenship(e.target.value);
                  if (touched.citizenship) {
                    setFieldErrors((prev) => ({ ...prev, citizenship: validateCitizenship(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('citizenship')}
                error={errorFor('citizenship')}
              />
            </div>
          </div>
        </div>

        {/* ── Save button ──────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <Button
            onClick={handleSave}
            isLoading={saving}
            disabled={!hasChanges}
            icon={<Save size={18} />}
          >
            Сохранить изменения
          </Button>
        </div>
      </div>

      {/* ── QR login card ────────────────────────────────────────────── */}
      <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <QrCode size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text">Одобрить вход по QR</p>
          <p className="text-xs text-text/50 mt-0.5">Отсканируйте QR-код с экрана компьютера</p>
        </div>
        <Button variant="secondary" onClick={() => setShowQRApprove(true)}>
          Сканировать
        </Button>
      </div>

      {/* ── Account info ─────────────────────────────────────────────── */}
      <div className="mt-6 text-center">
        <p className="text-xs text-text/30">
          Аккаунт создан: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
        </p>
      </div>
    </div>
    </>
  );
});

export default ProfilePage;
