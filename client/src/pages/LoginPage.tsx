import React, { memo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import api from '@/api/axiosInstance';
import useAppDispatch from '@/hooks/useAppDispatch';
import { loginSuccess } from '@/store/slices/authSlice';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { validateEmail } from '@/utils/validation';

type FieldErrors = Record<string, string>;

const LoginPage = memo(function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // Per-field errors & touched state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errorFor = (field: string) => touched[field] ? fieldErrors[field] || '' : '';

  const handleBlur = useCallback((field: string) => {
    setTouched((t) => ({ ...t, [field]: true }));
    let err = '';
    if (field === 'email') err = validateEmail(email);
    else if (field === 'password') err = password ? '' : 'Введите пароль';
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    // Validate all fields at once
    const emailErr = validateEmail(email);
    const passErr = password ? '' : 'Введите пароль';
    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailErr, password: passErr });
    if (emailErr || passErr) return;

    setLoading(true);
    setServerError('');
    try {
      const { data } = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
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
      setServerError(err.response?.data?.error || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  }, [email, password, dispatch, navigate]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleLogin();
    },
    [handleLogin],
  );

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4">
      <div className="w-full max-w-md" onKeyDown={onKeyDown}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-2xl font-semibold text-text text-center mb-2">Вход</h2>
          <p className="text-text/50 text-sm text-center mb-8">Войдите в свой аккаунт</p>

          <div className="flex flex-col gap-4">
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

            <Input
              label="Пароль"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) {
                  setFieldErrors((prev) => ({ ...prev, password: e.target.value ? '' : 'Введите пароль' }));
                }
              }}
              onBlur={() => handleBlur('password')}
              error={errorFor('password')}
              placeholder="Введите пароль"
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

            {serverError && <p className="text-sm text-red-500">{serverError}</p>}

            <Button
              onClick={handleLogin}
              isLoading={loading}
              icon={<LogIn size={18} />}
              iconPosition="right"
              className="w-full mt-2"
            >
              Войти
            </Button>

            <p className="text-center text-sm text-text/50 mt-2">
              Нет аккаунта?{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LoginPage;
