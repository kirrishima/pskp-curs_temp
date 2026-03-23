
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "../types";
import { authenticateUser, registerUser } from "../services/oracleApiService";
import Button from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";

interface AuthProps {
  type: "login" | "register";
  onAuthSuccess: (user: User) => void;
}

export default function Auth({ type, onAuthSuccess }: AuthProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
  });
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (type === "login") {
        const res = await authenticateUser(formData.username, formData.password);
        if (res.status === "OK" && res.data) {
          onAuthSuccess(res.data);
          navigate("/");
        } else {
          setError({ status: res.status, message: res.message });
        }
      } else {
        const res = await registerUser(formData.username, formData.password, formData.fullName, formData.email);
        if (res.status === "OK") {
          // Auto login after register
          const loginRes = await authenticateUser(formData.username, formData.password);
          if (loginRes.status === "OK" && loginRes.data) {
            onAuthSuccess(loginRes.data);
            navigate("/");
          } else {
            // Fallback if auto-login fails for some reason
            setError({ status: loginRes.status, message: loginRes.message });
          }
        } else {
          setError({ status: res.status, message: res.message });
        }
      }
    } catch (err) {
      setError({ status: "NETWORK_ERROR", message: "Произошла непредвиденная ошибка. Проверьте подключение к серверу." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-xl border border-ui">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-serif text-text">{type === "login" ? "С возвращением" : "Добро пожаловать"}</h2>
          <p className="mt-2 text-sm text-text/60">
            {type === "login" ? "Войдите, чтобы получить доступ к системе" : "Создайте свой аккаунт!"}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-text/70 mb-1">Имя пользователя (Логин)</label>
              <input
                type="text"
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-text rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            {type === "register" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-text/70 mb-1">Полное имя</label>
                  <input
                    type="text"
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-text rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text/70 mb-1">Email</label>
                  <input
                    type="text"
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-text rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-text/70 mb-1">Пароль</label>
              <input
                type="text"
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-text rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <ErrorAlert error={error} />

          <div>
            <Button
              text={type === "login" ? "Войти" : "Создать аккаунт"}
              type="submit"
              className="w-full"
              isLoading={isLoading}
            />
          </div>
        </form>

        <div className="text-center mt-4">
          <button
            className="text-primary hover:text-secondary text-sm font-medium"
            onClick={() => {
              setError(null);
              navigate(type === "login" ? "/register" : "/login");
            }}
          >
            {type === "login" ? "Нет аккаунта? Зарегистрируйтесь" : "Уже есть аккаунт? Войдите"}
          </button>
        </div>
      </div>
    </div>
  );
}
