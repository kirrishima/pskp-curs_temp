import React, { useEffect, useState } from "react";
import { User, Role } from "../types";
import { getRoleById, getUserInfo } from "../services/oracleApiService";
import { User as UserIcon, Shield, Mail, Hash, Phone, Activity, Calendar } from "lucide-react";

interface ProfileProps {
  user: User | null;
}

// Consistent Read-only Input Styles
const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-md text-text/80 cursor-default focus:outline-none";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-2";

export default function Profile({ user: initialUser }: ProfileProps) {
  const [userDetails, setUserDetails] = useState<User | null>(initialUser);
  const [roleInfo, setRoleInfo] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (initialUser && initialUser.username) {
        fetchUserDetails(initialUser.username);
    }
  }, [initialUser]);

  useEffect(() => {
    if (userDetails && userDetails.roleId !== undefined) {
      fetchRoleInfo(userDetails.roleId);
    }
  }, [userDetails]);

  const fetchUserDetails = async (username: string) => {
      setLoadingDetails(true);
      try {
          const res = await getUserInfo(username);
          if (res.status === 'OK' && res.data) {
              setUserDetails(res.data);
          }
      } catch (e) {
          console.error("Failed to fetch full user details", e);
      } finally {
          setLoadingDetails(false);
      }
  }

  const fetchRoleInfo = async (roleId: number) => {
    setLoadingRole(true);
    try {
      const res = await getRoleById(roleId);
      if (res.status === "OK" && res.data) {
        setRoleInfo(res.data);
      }
    } catch (error) {
      console.error("Error fetching role info", error);
    } finally {
      setLoadingRole(false);
    }
  };

  if (!userDetails) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-ui overflow-hidden">
        {/* Header */}
        <div className="bg-ui/30 p-8 border-b border-ui flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-ui mb-4">
            <UserIcon size={48} className="text-primary" />
          </div>
          <h1 className="text-3xl font-serif text-text">{userDetails.fullName}</h1>
          <p className="text-text/60 mt-1">Профиль пользователя</p>
        </div>

        {/* Details Form */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>
                <div className="flex items-center gap-2">
                  <UserIcon size={14} /> Логин (Username)
                </div>
              </label>
              <input value={userDetails.username} readOnly className={inputClass} />
            </div>
            
            <div>
              <label className={labelClass}>
                <div className="flex items-center gap-2">
                  <Mail size={14} /> Email
                </div>
              </label>
              <input value={userDetails.email} readOnly className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>
                <div className="flex items-center gap-2">
                  <Phone size={14} /> Телефон
                </div>
              </label>
              <input value={userDetails.phone || "—"} readOnly className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>
                <div className="flex items-center gap-2">
                  <Activity size={14} /> Статус Аккаунта
                </div>
              </label>
              <div className="relative">
                 <input 
                    value={userDetails.accountStatus || "UNKNOWN"} 
                    readOnly 
                    className={`${inputClass} ${userDetails.accountStatus === 'ACTIVE' ? 'text-green-700 bg-green-50 border-green-100' : ''}`} 
                 />
              </div>
            </div>

            <div className="md:col-span-2">
                <label className={labelClass}>
                    <div className="flex items-center gap-2">
                        <Calendar size={14} /> Дата регистрации
                    </div>
                </label>
                <input 
                    value={userDetails.createdAt ? new Date(userDetails.createdAt).toLocaleString() : "—"} 
                    readOnly 
                    className={inputClass} 
                />
            </div>
          </div>

          <div className="border-t border-gray-100 my-6"></div>

          <div>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield className="text-primary" size={20} /> Информация о роли
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>
                   <div className="flex items-center gap-2">
                    <Hash size={14} /> ID Роли
                   </div>
                </label>
                <input value={userDetails.roleId} readOnly className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Название роли</label>
                <div className="relative">
                  <input 
                    value={loadingRole ? "Загрузка..." : roleInfo?.roleName || "Неизвестно"} 
                    readOnly 
                    className={`${inputClass} font-bold text-primary`} 
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Описание прав доступа</label>
                <textarea 
                  rows={3}
                  value={loadingRole ? "Загрузка..." : roleInfo?.description || "Описание отсутствует"} 
                  readOnly 
                  className={`${inputClass} resize-none`} 
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-8 py-4 border-t border-ui text-center text-xs text-text/40">
          Данные профиля доступны только для чтения. Для изменения обратитесь к администратору.
        </div>
      </div>
    </div>
  );
}