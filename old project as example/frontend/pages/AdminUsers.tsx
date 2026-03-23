import React, { useEffect, useState } from "react";
import { User, Role } from "../types";
import { listUsers, getUserInfo, getRoleById, updateUserStatus, deleteUser } from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import Modal, { ConfirmModal } from "../components/Modal";
import { Users, Search, Eye, Shield, Mail, Phone, Calendar, Activity, User as UserIcon, Lock, Unlock, UserCog, Trash2, Info } from "lucide-react";

// Input/Label styles reused from other admin pages
const inputClass = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-text/80 cursor-default focus:outline-none";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";
const MAX_ROWS = 50;

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  // Detail Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [roleDetails, setRoleDetails] = useState<Role | null>(null);

  // Status Change Modal State
  const [statusUser, setStatusUser] = useState<{username: string, currentStatus: string} | null>(null);
  const [newStatus, setNewStatus] = useState("ACTIVE");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Client-side filtering and limiting
    let result = users;
    
    if (search) {
      const lower = search.toLowerCase();
      result = users.filter(u => 
        u.username.toLowerCase().includes(lower) || 
        (u.fullName && u.fullName.toLowerCase().includes(lower)) ||
        (u.email && u.email.toLowerCase().includes(lower)) ||
        (u.phone && u.phone.toLowerCase().includes(lower))
      );
    }
    
    // Limit rows
    setDisplayedUsers(result.slice(0, MAX_ROWS));
  }, [search, users]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const res = await listUsers();
    if (res.status === "OK" && res.data) {
      setUsers(res.data);
    } else {
      setError({ status: res.status, message: res.message });
      setUsers([]);
    }
    setLoading(false);
  };

  const handleViewDetails = async (username: string) => {
    setIsDetailModalOpen(true);
    setLoadingDetails(true);
    setRoleDetails(null);
    setSelectedUser(null);
    
    // Fetch full user details
    const res = await getUserInfo(username);
    if (res.status === "OK" && res.data) {
        setSelectedUser(res.data);
        // If user has a role, fetch role details too for better context
        if (res.data.roleId !== undefined) {
            try {
                const roleRes = await getRoleById(res.data.roleId);
                if (roleRes.status === "OK" && roleRes.data) {
                    setRoleDetails(roleRes.data);
                }
            } catch (e) {
                console.warn("Failed to fetch role details for user modal");
            }
        }
    } else {
        // Fallback: try to find the user in our current list if fetch failed
        const fallback = users.find(u => u.username === username);
        if (fallback) {
            setSelectedUser(fallback);
        } else {
            setError({ status: "ERROR", message: "Не удалось загрузить информацию о пользователе" });
            setIsDetailModalOpen(false);
        }
    }
    setLoadingDetails(false);
  };

  const openStatusModal = (u: User) => {
    setStatusUser({ username: u.username, currentStatus: u.accountStatus || 'ACTIVE' });
    setNewStatus(u.accountStatus || 'ACTIVE');
    setIsStatusModalOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!statusUser) return;
    setIsStatusLoading(true);
    
    const res = await updateUserStatus(statusUser.username, newStatus);
    
    if (res.status === 'OK') {
      setSuccess(`Статус пользователя ${statusUser.username} изменен на ${translateStatus(newStatus)}`);
      fetchUsers();
      setIsStatusModalOpen(false);
      setStatusUser(null);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsStatusLoading(false);
  };

  const openDeleteModal = (u: User) => {
      setUserToDelete(u);
  };

  const handleDeleteUser = async () => {
      if (!userToDelete) return;
      setIsDeleteLoading(true);
      const res = await deleteUser(userToDelete.username);
      
      if (res.status === 'OK' || res.status === 'SOFT_DELETED') {
        const msg = res.status === 'SOFT_DELETED' 
            ? `Пользователь ${userToDelete.username} помечен как удаленный (есть связанные данные).`
            : `Пользователь ${userToDelete.username} полностью удален.`;
        
        setSuccess(msg);
        fetchUsers();
        setUserToDelete(null);
      } else {
         setError({ status: res.status, message: res.message });
      }
      setIsDeleteLoading(false);
  };

  const translateStatus = (status: string | undefined) => {
      if (!status) return "Неизвестно";
      switch(status.toUpperCase()) {
          case 'ACTIVE': return "Активен";
          case 'SUSPENDED': return "Заблокирован";
          case 'LOCKED': return "Заблокирован";
          case 'DELETED': return "Удален";
          default: return status;
      }
  }

  const getStatusBadgeColor = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800";
    switch(status.toUpperCase()) {
        case 'ACTIVE': return "bg-green-100 text-green-800";
        case 'SUSPENDED': return "bg-orange-100 text-orange-800";
        case 'LOCKED': return "bg-orange-100 text-orange-800";
        case 'DELETED': return "bg-red-100 text-red-800";
        default: return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-8 border-b border-ui pb-4">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Users size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-text">Управление пользователями</h1>
          <p className="text-text/60 text-sm">Администрирование учетных записей, ролей и статусов</p>
        </div>
      </div>

      <div className="mb-4"><ErrorAlert error={error} /></div>
      
      {success && (
         <div className="bg-green-50 text-green-800 p-4 rounded-md border border-green-200 mb-6 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-800 hover:text-green-900"><Info size={16}/></button>
         </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-ui space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
           <h2 className="text-xl font-bold">Список пользователей</h2>
           <div className="relative w-full md:w-auto min-w-[300px]">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени, логину, email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
           </div>
        </div>

        {loading ? (
            <div className="flex justify-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        ) : (
            <>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-ui/50 text-xs text-text/60 uppercase font-semibold">
                        <tr>
                          <th className="p-3 rounded-tl-lg">Пользователь</th>
                          <th className="p-3">Контакты</th>
                          <th className="p-3">Роль</th>
                          <th className="p-3">Статус</th>
                          <th className="p-3">Создан</th>
                          <th className="p-3 text-right rounded-tr-lg">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui">
                        {displayedUsers.map((u) => (
                          <tr key={u.username} className="hover:bg-gray-50">
                            <td className="p-3">
                                <div className="font-bold text-text">{u.fullName}</div>
                                <div className="text-xs text-text/50 font-mono">@{u.username}</div>
                            </td>
                            <td className="p-3">
                                <div className="text-text/80">{u.email}</div>
                                {u.phone && <div className="text-xs text-text/50">{u.phone}</div>}
                            </td>
                            <td className="p-3">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${u.roleId === 0 ? 'bg-purple-100 text-purple-800' : u.roleId === 1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {u.roleId === 0 ? 'ADMIN' : u.roleId === 1 ? 'MANAGER' : 'USER'} <span className="opacity-50">({u.roleId})</span>
                                </span>
                            </td>
                            <td className="p-3">
                                 <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStatusBadgeColor(u.accountStatus)}`}>
                                    {translateStatus(u.accountStatus)}
                                 </span>
                            </td>
                            <td className="p-3 text-text/60 text-xs">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button 
                                    onClick={() => handleViewDetails(u.username)}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    title="Профиль"
                                >
                                    <Eye size={18} />
                                </button>
                                <button 
                                    onClick={() => openStatusModal(u)}
                                    className="p-2 text-primary hover:bg-primary/10 rounded transition-colors"
                                    title="Изменить статус"
                                >
                                    <UserCog size={18} />
                                </button>
                                <button 
                                    onClick={() => openDeleteModal(u)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Удалить"
                                >
                                    <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {displayedUsers.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-text/50 italic">
                                    Пользователи не найдены
                                </td>
                            </tr>
                        )}
                      </tbody>
                    </table>
                </div>
                
                {/* Limit Warning */}
                <div className="mt-4 flex justify-between items-center text-xs text-text/50 border-t border-ui pt-4">
                    <span>Показано {displayedUsers.length} из {users.length} записей</span>
                    {users.length > MAX_ROWS && (
                        <span className="text-orange-600 font-medium">
                            Список ограничен {MAX_ROWS} записями. Используйте поиск для уточнения.
                        </span>
                    )}
                </div>
            </>
        )}
      </div>

      {/* User Details Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Профиль пользователя"
        maxWidthClass="max-w-2xl"
        footer={
             <Button text="Закрыть" variant={ButtonVariant.Tertiary} onClick={() => setIsDetailModalOpen(false)} />
        }
      >
         {loadingDetails ? (
            <div className="flex justify-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
         ) : selectedUser ? (
            <div className="space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-ui">
                    <div className="w-16 h-16 bg-ui rounded-full flex items-center justify-center text-text/40">
                        <UserIcon size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-serif text-text">{selectedUser.fullName}</h3>
                        <p className="text-text/60 font-mono">@{selectedUser.username}</p>
                    </div>
                    <div className="ml-auto">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedUser.roleId === 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                            ID Роли: {selectedUser.roleId}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass}><Mail size={12} className="inline mr-1"/> Email</label>
                        <input value={selectedUser.email} readOnly className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}><Phone size={12} className="inline mr-1"/> Телефон</label>
                        <input value={selectedUser.phone || "—"} readOnly className={inputClass} />
                    </div>
                    <div>
                         <label className={labelClass}><Activity size={12} className="inline mr-1"/> Статус аккаунта</label>
                         <input value={translateStatus(selectedUser.accountStatus)} readOnly className={inputClass} />
                    </div>
                    <div>
                         <label className={labelClass}><Calendar size={12} className="inline mr-1"/> Дата регистрации</label>
                         <input value={selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "—"} readOnly className={inputClass} />
                    </div>
                </div>

                {roleDetails && (
                    <div className="bg-ui/30 p-4 rounded-lg border border-ui mt-4">
                        <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                            <Shield size={16} className="text-primary"/> Информация о роли: {roleDetails.roleName}
                        </h4>
                        <p className="text-sm text-text/70">{roleDetails.description || "Описание роли отсутствует"}</p>
                    </div>
                )}
            </div>
         ) : (
            <div className="text-center py-8 text-text/50">Не удалось загрузить данные пользователя</div>
         )}
      </Modal>

      {/* Change Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Изменение статуса"
        maxWidthClass="max-w-sm"
        footer={
            <>
                <Button text="Отмена" variant={ButtonVariant.Tertiary} onClick={() => setIsStatusModalOpen(false)} />
                <Button text="Сохранить" variant={ButtonVariant.Primary} onClick={handleStatusUpdate} isLoading={isStatusLoading} />
            </>
        }
      >
        <div className="space-y-4">
            <p className="text-text/80">
                Выберите новый статус для пользователя <strong>{statusUser?.username}</strong>:
            </p>
            <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input 
                        type="radio" 
                        name="status" 
                        value="ACTIVE" 
                        checked={newStatus === 'ACTIVE'} 
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="text-primary focus:ring-primary"
                    />
                    <span className="flex-grow">Активен (ACTIVE)</span>
                    <Unlock size={16} className="text-green-600" />
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input 
                        type="radio" 
                        name="status" 
                        value="SUSPENDED" 
                        checked={newStatus === 'SUSPENDED'} 
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="text-primary focus:ring-primary"
                    />
                    <span className="flex-grow">Заблокирован (SUSPENDED)</span>
                    <Lock size={16} className="text-orange-600" />
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 border-red-100 bg-red-50/30">
                    <input 
                        type="radio" 
                        name="status" 
                        value="DELETED" 
                        checked={newStatus === 'DELETED'} 
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="text-red-600 focus:ring-red-500"
                    />
                    <span className="flex-grow text-red-900">Удален (DELETED)</span>
                    <Trash2 size={16} className="text-red-600" />
                </label>
            </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Удалить пользователя?"
        message={`Вы уверены, что хотите удалить пользователя ${userToDelete?.username}? Если у пользователя есть история (бронирования), он будет помечен как 'DELETED', но данные сохранятся.`}
        confirmText="Удалить"
        isLoading={isDeleteLoading}
      />
    </div>
  );
}