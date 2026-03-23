import React, { useEffect, useState } from "react";
import { Role } from "../types";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  getUserRole,
} from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import Modal, { ConfirmModal, AlertModal } from "../components/Modal";
import { Shield, Plus, Edit, Trash2, UserPlus, Search } from "lucide-react";

// Styles consistent with other manager pages
const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<Role>>({});
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Assign Role State
  const [assignUsername, setAssignUsername] = useState("");
  const [assignRoleId, setAssignRoleId] = useState<number | "">("");
  const [checkedUserRole, setCheckedUserRole] = useState<{ username: string; roleId: number } | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    const res = await listRoles();
    if (res.status === "OK" && res.data) {
      setRoles(res.data);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setLoading(false);
  };

  const handleCreateRole = () => {
    setCurrentRole({});
    setIsRoleModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setCurrentRole(role);
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (role: Role) => {
    setRoleToDelete(role);
  };

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRole.roleName) return;
    
    setIsActionLoading(true);
    let res;
    
    if (currentRole.roleId !== undefined) {
      res = await updateRole(currentRole.roleId, currentRole.roleName, currentRole.description);
    } else {
      res = await createRole(currentRole.roleName, currentRole.description);
    }

    if (res.status === "OK") {
      setSuccess(currentRole.roleId ? "Роль обновлена" : "Роль создана");
      setIsRoleModalOpen(false);
      fetchRoles();
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsActionLoading(false);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    setIsActionLoading(true);
    const res = await deleteRole(roleToDelete.roleId);
    if (res.status === "OK") {
      setSuccess("Роль удалена");
      setRoleToDelete(null);
      fetchRoles();
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsActionLoading(false);
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUsername || assignRoleId === "") return;
    setIsActionLoading(true);
    const res = await assignRoleToUser(assignUsername, Number(assignRoleId));
    if (res.status === "OK") {
      setSuccess(`Роль успешно назначена пользователю ${assignUsername}`);
      setAssignUsername("");
      setAssignRoleId("");
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsActionLoading(false);
  };

  const handleCheckUserRole = async () => {
    if (!assignUsername) return;
    setIsActionLoading(true);
    const res = await getUserRole(assignUsername);
    if (res.status === "OK" && res.data) {
      setCheckedUserRole({ username: assignUsername, roleId: res.data.roleId });
    } else {
      setError({ status: res.status, message: res.message });
      setCheckedUserRole(null);
    }
    setIsActionLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-8 border-b border-ui pb-4">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Shield size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-text">Управление ролями</h1>
          <p className="text-text/60 text-sm">Администрирование прав доступа и ролей пользователей</p>
        </div>
      </div>

      <div className="mb-6"><ErrorAlert error={error} /></div>
      <AlertModal isOpen={!!success} onClose={() => setSuccess(null)} title="Успешно" message={success || ""} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Roles List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-ui">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Список ролей
              </h2>
              <Button 
                text="Создать роль" 
                variant={ButtonVariant.Primary} 
                icon={<Plus size={18} />} 
                onClick={handleCreateRole} 
                className="py-2 text-sm"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ui/50 text-xs text-text/60 uppercase font-semibold">
                    <tr>
                      <th className="p-3 rounded-tl-lg">ID</th>
                      <th className="p-3">Название</th>
                      <th className="p-3">Описание</th>
                      <th className="p-3 text-right rounded-tr-lg">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui">
                    {roles.map((role) => (
                      <tr key={role.roleId} className="hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs">{role.roleId}</td>
                        <td className="p-3 font-bold text-primary">{role.roleName}</td>
                        <td className="p-3 text-text/70">{role.description || "—"}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleEditRole(role)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Редактировать"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRole(role)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {roles.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-text/50 italic">
                          Роли не найдены.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Assign Role Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-ui sticky top-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserPlus size={20} className="text-primary" /> Назначение роли
            </h2>
            
            <form onSubmit={handleAssignRole} className="space-y-4">
              <div>
                <label className={labelClass}>Имя пользователя</label>
                <div className="flex gap-2">
                  <input 
                    value={assignUsername}
                    onChange={(e) => setAssignUsername(e.target.value)}
                    className={inputClass}
                    placeholder="Login..."
                    required
                  />
                  <button
                    type="button" 
                    onClick={handleCheckUserRole}
                    className="bg-ui border border-gray-300 rounded-md px-3 hover:bg-gray-200 transition-colors text-text/70"
                    title="Проверить текущую роль"
                    disabled={isActionLoading || !assignUsername}
                  >
                    <Search size={18} />
                  </button>
                </div>
                {checkedUserRole && checkedUserRole.username === assignUsername && (
                  <p className="text-xs mt-2 p-2 bg-blue-50 text-blue-800 rounded border border-blue-100">
                    Текущая роль ID: <strong>{checkedUserRole.roleId}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Выберите роль</label>
                <select 
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(Number(e.target.value))}
                  className={inputClass}
                  required
                >
                  <option value="">-- Выберите --</option>
                  {roles.map(r => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.roleName} (ID: {r.roleId})
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                text="Назначить роль" 
                type="submit" 
                className="w-full" 
                isLoading={isActionLoading}
                disabled={!assignUsername || assignRoleId === ""}
              />
            </form>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={currentRole.roleId !== undefined ? "Редактировать роль" : "Создать роль"}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={saveRole} className="space-y-4">
          <div>
            <label className={labelClass}>Название роли *</label>
            <input 
              value={currentRole.roleName || ""}
              onChange={(e) => setCurrentRole({...currentRole, roleName: e.target.value})}
              className={inputClass}
              required
              placeholder="Напр. MANAGER"
            />
          </div>
          <div>
            <label className={labelClass}>Описание</label>
            <textarea 
              value={currentRole.description || ""}
              onChange={(e) => setCurrentRole({...currentRole, description: e.target.value})}
              className={inputClass}
              rows={3}
              placeholder="Краткое описание прав..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button text="Отмена" type="button" variant={ButtonVariant.Tertiary} onClick={() => setIsRoleModalOpen(false)} />
            <Button text="Сохранить" type="submit" isLoading={isActionLoading} />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal 
        isOpen={!!roleToDelete}
        onClose={() => setRoleToDelete(null)}
        onConfirm={confirmDelete}
        title="Удалить роль?"
        message={`Вы уверены, что хотите удалить роль "${roleToDelete?.roleName}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        isLoading={isActionLoading}
      />
    </div>
  );
}