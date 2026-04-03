import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User as UserIcon,
  Shield,
  ShieldOff,
  ShieldCheck,
  X,
  ChevronDown,
  Filter,
  CalendarDays,
  Phone,
  Mail,
  Hash,
  BookOpen,
  UserCog,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import {
  getUsers,
  getAdminUser,
  blockUser,
  unblockUser,
  changeUserRole,
} from '@/api/hotelApi';
import type { AdminUser, UsersPagination } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  user:    'Пользователь',
  manager: 'Менеджер',
  admin:   'Администратор',
};

const ROLE_STYLES: Record<string, string> = {
  user:    'bg-gray-100 text-gray-600',
  manager: 'bg-blue-50 text-blue-700',
  admin:   'bg-violet-50 text-violet-700',
};

const ROLE_OPTIONS = ['user', 'manager', 'admin'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(user: AdminUser): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ isBlocked }: { isBlocked: boolean }) {
  return isBlocked ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
      <Ban size={11} />
      Заблокирован
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
      <CheckCircle2 size={11} />
      Активен
    </span>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: UsersPagination;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, totalCount, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, totalCount);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6 text-sm">
      <p className="text-text/40">
        {from}–{to} из {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 text-text/60">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────

interface UserDetailModalProps {
  userId: string;
  currentAdminId: string;
  onClose: () => void;
  onUserUpdated: (user: AdminUser) => void;
}

function UserDetailModal({ userId, currentAdminId, onClose, onUserUpdated }: UserDetailModalProps) {
  const [user, setUser]           = useState<AdminUser | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  const isSelf = user?.id === currentAdminId;

  // Load user detail
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminUser(userId)
      .then(({ user: u }) => { if (!cancelled) setUser(u); })
      .catch((e) => { if (!cancelled) setError('Не удалось загрузить данные пользователя.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  // Close role menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBlock = useCallback(async () => {
    if (!user) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const { user: updated } = await blockUser(user.id);
      setUser(updated);
      onUserUpdated(updated);
    } catch (e: any) {
      setActionError(e?.response?.data?.error ?? 'Ошибка при блокировке.');
    } finally {
      setActionLoading(false);
    }
  }, [user, onUserUpdated]);

  const handleUnblock = useCallback(async () => {
    if (!user) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const { user: updated } = await unblockUser(user.id);
      setUser(updated);
      onUserUpdated(updated);
    } catch (e: any) {
      setActionError(e?.response?.data?.error ?? 'Ошибка при разблокировке.');
    } finally {
      setActionLoading(false);
    }
  }, [user, onUserUpdated]);

  const handleRoleChange = useCallback(async (roleName: string) => {
    if (!user) return;
    setRoleMenuOpen(false);
    setActionLoading(true);
    setActionError(null);
    try {
      const { user: updated } = await changeUserRole(user.id, roleName);
      setUser(updated);
      onUserUpdated(updated);
    } catch (e: any) {
      setActionError(e?.response?.data?.error ?? 'Ошибка при смене роли.');
    } finally {
      setActionLoading(false);
    }
  }, [user, onUserUpdated]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-text">Профиль пользователя</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text/40 hover:text-text/70 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          /* ── Shimmer skeleton — mirrors the real content layout ── */
          <div className="p-6 space-y-6 animate-pulse">
            {/* Avatar + name row */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded-full w-2/3" />
                <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                <div className="flex gap-2 mt-1">
                  <div className="h-5 bg-gray-200 rounded-full w-24" />
                  <div className="h-5 bg-gray-200 rounded-full w-20" />
                </div>
              </div>
            </div>
            {/* Fields */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-4 h-4 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded-full w-16" />
                  <div className="h-3.5 bg-gray-200 rounded-full w-3/4" />
                </div>
              </div>
            ))}
            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <div className="h-9 bg-gray-200 rounded-xl w-36" />
              <div className="h-9 bg-gray-200 rounded-xl w-24 ml-auto" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-text/60">{error}</p>
          </div>
        ) : user ? (
          <div className="p-6 space-y-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0 ${
                user.isBlocked ? 'bg-red-100 text-red-500' : 'bg-primary/10 text-primary'
              }`}>
                {getInitials(user)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-text text-base leading-tight">
                  {user.firstName} {user.lastName}
                  {user.displayName && (
                    <span className="text-text/40 font-normal ml-1.5">({user.displayName})</span>
                  )}
                </p>
                <p className="text-sm text-text/50 truncate mt-0.5">{user.email}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <RoleBadge role={user.role?.name} />
                  <StatusBadge isBlocked={user.isBlocked} />
                </div>
              </div>
            </div>

            {/* Action error */}
            {actionError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle size={16} className="shrink-0" />
                {actionError}
              </div>
            )}

            {/* Profile fields */}
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Hash size={15} className="text-text/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-text/40 leading-none mb-0.5">ID</p>
                  <p className="font-mono text-text/70 text-xs break-all">{user.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Mail size={15} className="text-text/30 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-text/40 leading-none mb-0.5">E-mail</p>
                  <p className="text-text/80 truncate">{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Phone size={15} className="text-text/30 shrink-0" />
                  <div>
                    <p className="text-xs text-text/40 leading-none mb-0.5">Телефон</p>
                    <p className="text-text/80">{user.phone}</p>
                  </div>
                </div>
              )}

              {user.birthDate && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <CalendarDays size={15} className="text-text/30 shrink-0" />
                  <div>
                    <p className="text-xs text-text/40 leading-none mb-0.5">Дата рождения</p>
                    <p className="text-text/80">{formatDate(user.birthDate)}</p>
                  </div>
                </div>
              )}

              {user.citizenship && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <UserIcon size={15} className="text-text/30 shrink-0" />
                  <div>
                    <p className="text-xs text-text/40 leading-none mb-0.5">Гражданство</p>
                    <p className="text-text/80">{user.citizenship}</p>
                  </div>
                </div>
              )}

              {user._count !== undefined && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <BookOpen size={15} className="text-text/30 shrink-0" />
                  <div>
                    <p className="text-xs text-text/40 leading-none mb-0.5">Бронирований</p>
                    <p className="text-text/80 font-medium">{user._count.bookings}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <CalendarDays size={15} className="text-text/30 shrink-0" />
                <div>
                  <p className="text-xs text-text/40 leading-none mb-0.5">Зарегистрирован</p>
                  <p className="text-text/80">{formatDateTime(user.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Actions (disabled for own account) */}
            {!isSelf && (
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                {/* Block / Unblock */}
                {user.isBlocked ? (
                  <button
                    type="button"
                    onClick={handleUnblock}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    Разблокировать
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <ShieldOff size={15} />}
                    Заблокировать
                  </button>
                )}

                {/* Role change */}
                <div className="relative ml-auto" ref={roleMenuRef}>
                  <button
                    type="button"
                    onClick={() => setRoleMenuOpen((v) => !v)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-text/70 hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white"
                  >
                    <UserCog size={15} />
                    Роль
                    <ChevronDown size={14} className={`transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {roleMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-44 bg-white border border-gray-100 rounded-xl shadow-xl z-10 overflow-hidden animate-slide-top">
                      {ROLE_OPTIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleRoleChange(r)}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50 ${
                            user.role?.name === r ? 'text-primary font-medium' : 'text-text/70'
                          }`}
                        >
                          {user.role?.name === r && <Shield size={13} className="text-primary" />}
                          {user.role?.name !== r && <span className="w-[13px]" />}
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isSelf && (
              <p className="text-xs text-text/40 text-center pt-1">
                Управление собственным аккаунтом недоступно
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const currentUser = useAppSelector((s) => s.auth.user);

  // ── State ─────────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<UsersPagination | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput]   = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'blocked' | ''>('');
  const [page, setPage]                 = useState(1);
  const [filtersOpen, setFiltersOpen]   = useState(false);

  // Detail modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers(
        { page, limit: 20, search: searchQuery || undefined, role: roleFilter || undefined, status: statusFilter || undefined },
        signal,
      );
      if (!signal?.aborted) {
        setUsers(result.users);
        setPagination(result.pagination ?? null);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError('Не удалось загрузить список пользователей.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // ── Search debounce ───────────────────────────────────────────────────────
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 400);
  }, []);

  const handleRoleFilterChange = useCallback((value: string) => {
    setRoleFilter(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value as 'active' | 'blocked' | '');
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const hasActiveFilters = searchQuery || roleFilter || statusFilter;

  // Update a user in the list after an action in the modal
  const handleUserUpdated = useCallback((updated: AdminUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Пользователи</h1>
        <p className="text-sm text-text/50 mt-1">
          Список всех зарегистрированных пользователей с управлением ролями и блокировками
        </p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-grow max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/30" />
          <input
            type="text"
            placeholder="Поиск по ID, email, имени..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            hasActiveFilters
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-white text-text/60 border-gray-200 hover:border-primary/30'
          }`}
        >
          <Filter size={16} />
          Фильтры
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-text/40 hover:text-text/60 transition-colors"
          >
            <X size={14} />
            Сбросить
          </button>
        )}
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-end">
          {/* Role */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-text/50 mb-1.5">Роль</label>
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Все роли</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-text/50 mb-1.5">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              <option value="">Все</option>
              <option value="active">Активные</option>
              <option value="blocked">Заблокированные</option>
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-text/60">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <UserIcon size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-medium text-text">Пользователей не найдено</p>
            <p className="text-sm text-text/50 mt-1">
              {hasActiveFilters
                ? 'Нет пользователей, соответствующих заданным фильтрам.'
                : 'Список пользователей пуст.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide w-10"></th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Пользователь</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Роль</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Статус</th>
                  <th className="px-4 py-3 text-xs font-medium text-text/40 uppercase tracking-wide">Зарегистрирован</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer"
                  >
                    {/* Avatar */}
                    <td className="px-4 py-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        u.isBlocked ? 'bg-red-100 text-red-500' : 'bg-primary/10 text-primary'
                      }`}>
                        {getInitials(u)}
                      </div>
                    </td>

                    {/* Name + email */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text">
                        {u.firstName} {u.lastName}
                        {u.id === currentUser?.id && (
                          <span className="ml-1.5 text-xs text-text/30">(вы)</span>
                        )}
                      </p>
                      <p className="text-xs text-text/40 truncate max-w-[220px]">{u.email}</p>
                    </td>

                    {/* ID */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text/40">{u.id.slice(0, 8).toUpperCase()}</span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role?.name} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge isBlocked={u.isBlocked} />
                    </td>

                    {/* Registered */}
                    <td className="px-4 py-3 text-sm text-text/50 whitespace-nowrap">
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}

      {/* Detail modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          currentAdminId={currentUser?.id ?? ''}
          onClose={() => setSelectedUserId(null)}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </div>
  );
}
