import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ShieldCheck, UserPlus, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import api from '@/api/axiosInstance';
import useAppDispatch from '@/hooks/useAppDispatch';
import { loginSuccess } from '@/store/slices/authSlice';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  validateEmail,
  validateCode,
  validateFirstName,
  validateLastName,
  validatePassword,
  validateConfirmPassword,
} from '@/utils/validation';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'email' | 'code' | 'details';

type FieldErrors = Record<string, string>;

// ─── Animated step wrapper ───────────────────────────────────────────────────

const StepWrapper = memo(function StepWrapper({
  children,
  direction,
}: {
  children: React.ReactNode;
  direction: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = direction === 'right' ? 'translateX(24px)' : 'translateX(-24px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 300ms ease, transform 300ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
  }, [direction]);

  return <div ref={ref}>{children}</div>;
});

// ─── Main component ──────────────────────────────────────────────────────────

const RegisterPage = memo(function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<Step>('email');
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  // Form state
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Per-field errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Tracks which fields have been blurred (touched)
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ── Validation helpers ─────────────────────────────────────────────────

  const validateField = useCallback((field: string, value?: string): string => {
    switch (field) {
      case 'email': return validateEmail(value ?? email);
      case 'code': return validateCode(value ?? code);
      case 'firstName': return validateFirstName(value ?? firstName);
      case 'lastName': return validateLastName(value ?? lastName);
      case 'password': return validatePassword(value ?? password);
      case 'confirmPassword': return validateConfirmPassword(value ?? password, value !== undefined ? value : confirmPassword);
      default: return '';
    }
  }, [email, code, firstName, lastName, password, confirmPassword]);

  const handleBlur = useCallback((field: string) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const err = validateField(field);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  }, [validateField]);

  /** Validate a set of fields, set all errors, return true if all valid */
  const validateFields = useCallback((fields: string[]): boolean => {
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

  // Show error for a field only if it's been touched
  const errorFor = (field: string) => touched[field] ? fieldErrors[field] || '' : '';

  // ── Navigation ─────────────────────────────────────────────────────────

  const goForward = useCallback((to: Step) => {
    setDirection('right');
    setServerError('');
    setStep(to);
  }, []);

  const goBack = useCallback((to: Step) => {
    setDirection('left');
    setServerError('');
    setStep(to);
  }, []);

  // ── Step 1: Send code ──────────────────────────────────────────────────

  const handleSendCode = useCallback(async () => {
    if (!validateFields(['email'])) return;

    setLoading(true);
    setServerError('');
    try {
      await api.post('/auth/register/send-code', { email: email.trim().toLowerCase() });
      setResendCooldown(60);
      goForward('code');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Не удалось отправить код';
      if (err.response?.data?.field === 'email') {
        setFieldErrors((prev) => ({ ...prev, email: msg }));
        setTouched((t) => ({ ...t, email: true }));
      } else {
        setServerError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [email, validateFields, goForward]);

  // ── Resend code ────────────────────────────────────────────────────────

  const handleResendCode = useCallback(async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setServerError('');
    try {
      await api.post('/auth/register/send-code', { email: email.trim().toLowerCase() });
      setResendCooldown(60);
      setCode('');
      setFieldErrors((prev) => ({ ...prev, code: '' }));
      setTouched((t) => ({ ...t, code: false }));
    } catch (err: any) {
      setServerError(err.response?.data?.error || 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldown]);

  // ── Step 2: Verify code ────────────────────────────────────────────────

  const handleVerifyCode = useCallback(async () => {
    if (!validateFields(['code'])) return;

    setLoading(true);
    setServerError('');
    try {
      await api.post('/auth/register/verify-code', { email: email.trim().toLowerCase(), code: code.trim() });
      goForward('details');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Неверный код';
      if (err.response?.data?.field === 'code') {
        setFieldErrors((prev) => ({ ...prev, code: msg }));
        setTouched((t) => ({ ...t, code: true }));
      } else {
        setServerError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [email, code, validateFields, goForward]);

  // ── Step 3: Complete registration ──────────────────────────────────────

  const handleComplete = useCallback(async () => {
    if (!validateFields(['firstName', 'lastName', 'password', 'confirmPassword'])) return;

    setLoading(true);
    setServerError('');
    try {
      const { data } = await api.post('/auth/register/complete', {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });

      dispatch(
        loginSuccess({
          user: data.user,
          tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
        }),
      );

      navigate('/', { replace: true });
    } catch (err: any) {
      const resp = err.response?.data;
      if (resp?.errors) {
        // Server returned per-field errors
        const newErrors: FieldErrors = {};
        const newTouched: Record<string, boolean> = {};
        for (const [field, msg] of Object.entries(resp.errors)) {
          newErrors[field] = msg as string;
          newTouched[field] = true;
        }
        setFieldErrors((prev) => ({ ...prev, ...newErrors }));
        setTouched((t) => ({ ...t, ...newTouched }));
      } else {
        setServerError(resp?.error || 'Регистрация не удалась');
      }
    } finally {
      setLoading(false);
    }
  }, [email, firstName, lastName, password, confirmPassword, validateFields, dispatch, navigate]);

  // ── Key handler for Enter ──────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (step === 'email') handleSendCode();
      else if (step === 'code') handleVerifyCode();
      else if (step === 'details') handleComplete();
    },
    [step, handleSendCode, handleVerifyCode, handleComplete],
  );

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4">
      <div className="w-full max-w-md" onKeyDown={onKeyDown}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-2xl font-semibold text-text text-center mb-2">Регистрация</h2>
          <p className="text-text/50 text-sm text-center mb-6">Создайте аккаунт для бронирования</p>

          {/* ── Step: Email ─────────────────────────────────────────────── */}
          {step === 'email' && (
            <StepWrapper direction={direction}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 pl-0 pr-4 py-4 bg-primary/5 rounded-xl mb-2">
                  <Mail size={20} className="text-primary flex-shrink-0 ml-3" />
                  <p className="text-sm text-text/70">
                    Введите email для получения кода подтверждения
                  </p>
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched.email) {
                      setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                    }
                  }}
                  onBlur={() => handleBlur('email')}
                  error={errorFor('email')}
                  placeholder="your@email.com"
                  autoFocus
                />

                {serverError && <p className="text-sm text-red-500">{serverError}</p>}

                <Button
                  onClick={handleSendCode}
                  isLoading={loading}
                  icon={<ArrowRight size={18} />}
                  iconPosition="right"
                  className="w-full"
                >
                  Отправить код
                </Button>

                <p className="text-center text-sm text-text/50 mt-2">
                  Уже есть аккаунт?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Войти
                  </Link>
                </p>
              </div>
            </StepWrapper>
          )}

          {/* ── Step: Code ──────────────────────────────────────────────── */}
          {step === 'code' && (
            <StepWrapper direction={direction}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 pl-0 pr-4 py-4 bg-primary/5 rounded-xl mb-2">
                  <ShieldCheck size={20} className="text-primary flex-shrink-0 ml-3" />
                  <p className="text-sm text-text/70">
                    Код отправлен на <span className="font-medium text-text">{email}</span>
                  </p>
                </div>

                <Input
                  label="Код подтверждения"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setCode(v);
                    if (touched.code) {
                      setFieldErrors((prev) => ({ ...prev, code: validateCode(v) }));
                    }
                  }}
                  onBlur={() => handleBlur('code')}
                  error={errorFor('code')}
                  placeholder="000000"
                  autoFocus
                  className="text-center text-2xl tracking-[0.3em] font-mono"
                />

                {serverError && <p className="text-sm text-red-500">{serverError}</p>}

                <div className="flex gap-3">
                  <Button variant="tertiary" onClick={() => goBack('email')} className="flex-shrink-0">
                    <ArrowLeft size={18} />
                  </Button>
                  <Button
                    onClick={handleVerifyCode}
                    isLoading={loading}
                    icon={<ArrowRight size={18} />}
                    iconPosition="right"
                    className="flex-1"
                  >
                    Подтвердить
                  </Button>
                </div>

                <button
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                  className="text-sm text-primary hover:underline disabled:text-text/30 disabled:no-underline mt-1 text-center"
                >
                  {resendCooldown > 0 ? `Отправить повторно (${resendCooldown}с)` : 'Отправить код повторно'}
                </button>
              </div>
            </StepWrapper>
          )}

          {/* ── Step: Details ───────────────────────────────────────────── */}
          {step === 'details' && (
            <StepWrapper direction={direction}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 pl-0 pr-4 py-4 bg-primary/5 rounded-xl mb-2">
                  <UserPlus size={20} className="text-primary flex-shrink-0 ml-3" />
                  <p className="text-sm text-text/70">Заполните данные для завершения регистрации</p>
                </div>

                <div className="flex gap-3">
                  <Input
                    label="Имя (Latin)"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (touched.firstName) {
                        setFieldErrors((prev) => ({ ...prev, firstName: validateFirstName(e.target.value) }));
                      }
                    }}
                    onBlur={() => handleBlur('firstName')}
                    error={errorFor('firstName')}
                    placeholder="John"
                    autoFocus
                  />
                  <Input
                    label="Фамилия (Latin)"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (touched.lastName) {
                        setFieldErrors((prev) => ({ ...prev, lastName: validateLastName(e.target.value) }));
                      }
                    }}
                    onBlur={() => handleBlur('lastName')}
                    error={errorFor('lastName')}
                    placeholder="Doe"
                  />
                </div>

                <Input
                  label="Пароль"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) {
                      setFieldErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                    }
                    // Re-validate confirm if it's been touched
                    if (touched.confirmPassword) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        confirmPassword: validateConfirmPassword(e.target.value, confirmPassword),
                      }));
                    }
                  }}
                  onBlur={() => handleBlur('password')}
                  error={errorFor('password')}
                  placeholder="Минимум 6 символов"
                  rightAddon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                <Input
                  label="Подтверждение пароля"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (touched.confirmPassword) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        confirmPassword: validateConfirmPassword(password, e.target.value),
                      }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, confirmPassword: true }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: validateConfirmPassword(password, confirmPassword),
                    }));
                  }}
                  error={errorFor('confirmPassword')}
                  placeholder="Повторите пароль"
                />

                {serverError && <p className="text-sm text-red-500">{serverError}</p>}

                <div className="flex gap-3">
                  <Button variant="tertiary" onClick={() => goBack('code')} className="flex-shrink-0">
                    <ArrowLeft size={18} />
                  </Button>
                  <Button
                    onClick={handleComplete}
                    isLoading={loading}
                    icon={<UserPlus size={18} />}
                    iconPosition="right"
                    className="flex-1"
                  >
                    Создать аккаунт
                  </Button>
                </div>
              </div>
            </StepWrapper>
          )}
        </div>
      </div>
    </div>
  );
});

export default RegisterPage;
