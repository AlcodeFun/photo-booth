import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconChevronDown,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconPhotoBooth,
  IconPrinter,
  IconSearch,
  IconSessions,
  IconTemplates,
} from './AdminIcons';
import { ConfirmModal } from './Modal';

export type AdminNavArea = 'dashboard' | 'sesi' | 'templates' | 'print-queue';

const NAV_ITEMS: Array<{ area: AdminNavArea; label: string; keywords: string }> = [
  { area: 'dashboard', label: 'Dashboard', keywords: 'dashboard home summary overview' },
  { area: 'sesi', label: 'Sessions', keywords: 'sessions sesi upload results photos' },
  { area: 'print-queue', label: 'Print Queue', keywords: 'print printer queue selphy cups reprint batch' },
  { area: 'templates', label: 'Templates', keywords: 'templates frame gallery frames' },
];

interface AdminLayoutProps {
  active: AdminNavArea;
  userEmail: string;
  onNavigate: (area: AdminNavArea) => void;
  onLogout: () => void;
  onBackToBooth: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  active,
  userEmail,
  onNavigate,
  onLogout,
  onBackToBooth,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pb-admin-collapsed') === '1');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('pb-admin-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q));
  }, [query]);

  const handleSearchSelect = (area: AdminNavArea) => {
    setQuery('');
    setSearchOpen(false);
    searchRef.current?.blur();
    onNavigate(area);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && matches.length > 0) {
      handleSearchSelect(matches[0].area);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      searchRef.current?.blur();
    }
  };

  const initial = (userEmail || 'A').trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#140b26] text-white">
      <aside
        className={`hidden shrink-0 flex-col border-r border-white/10 bg-[#1a0b2e] transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[76px]' : 'w-60'
        }`}
      >
        <div className={`flex items-center gap-3 py-5 ${collapsed ? 'justify-center' : 'px-4'}`}>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ff4bb5] text-[#140b26] shadow-[0_0_20px_rgba(255,75,181,0.45)]"
            onClick={() => onNavigate('dashboard')}
            aria-label="Admin home"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide">PHOTO BOOTH</p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#d9f85a]">Admin</p>
            </div>
          )}
        </div>

        <nav className={`mt-2 flex-1 space-y-1 ${collapsed ? 'px-4' : 'px-3'}`}>
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.area;
            return (
              <button
                key={item.area}
                onClick={() => onNavigate(item.area)}
                className={`relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/10 text-[#d9f85a]' : 'text-white/60 hover:bg-white/5 hover:text-white'
                } ${collapsed ? 'w-full justify-center px-0' : 'w-full px-3'}`}
                title={collapsed ? item.label : undefined}
              >
                {(isActive && !collapsed) && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-[#d9f85a] " />}
                
                <span className="shrink-0">
                  {item.area === 'dashboard' && <IconDashboard />}
                  {item.area === 'sesi' && <IconSessions />}
                  {item.area === 'print-queue' && <IconPrinter />}
                  {item.area === 'templates' && <IconTemplates />}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            onClick={onBackToBooth}
            className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
            title={collapsed ? 'Back to booth' : undefined}
          >
            <span className="shrink-0">
              <IconPhotoBooth className="h-5 w-5" />
            </span>
            {!collapsed && <span className="truncate">Back to booth</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#1a0b2e] px-5">
          <button
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white md:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconMenu />
          </button>

          <div className="relative w-full max-w-xs" data-testid="admin-search">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search menus…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/35 focus:border-[#ff4bb5]/60 focus:outline-none"
            />
            {searchOpen && query.trim() !== '' && (
              <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-xl border border-white/10 bg-[#241341] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                {matches.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-white/40">No matches</p>
                ) : (
                  matches.map((item) => (
                    <button
                      key={item.area}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSearchSelect(item.area)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="text-[#d9f85a]">
                        {item.area === 'dashboard' && <IconDashboard className="h-4 w-4" />}
                        {item.area === 'sesi' && <IconSessions className="h-4 w-4" />}
                        {item.area === 'print-queue' && <IconPrinter className="h-4 w-4" />}
                        {item.area === 'templates' && <IconTemplates className="h-4 w-4" />}
                      </span>
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="relative ml-auto">
            <button
              onClick={() => setProfileOpen((value) => !value)}
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 transition hover:bg-white/10"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#a35ef6] to-[#ff4bb5] text-sm font-bold text-white">
                {initial}
              </span>
              <span className="hidden max-w-[180px] truncate text-left text-sm text-white/85 sm:block">{userEmail}</span>
              <IconChevronDown className={`h-4 w-4 text-white/50 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#241341] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-white">{userEmail}</p>
                    <p className="text-xs text-white/50">Administrator</p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setConfirmLogout(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#ff5e87] transition hover:bg-white/10"
                  >
                    <IconLogout className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1a0b2e] to-[#140b26] p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-[#1a0b2e]/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.area;
          return (
            <button
              key={item.area}
              onClick={() => onNavigate(item.area)}
              className={`relative flex min-w-0 flex-1 items-center justify-center py-3 transition ${
                isActive ? 'text-[#d9f85a]' : 'text-white/50 hover:text-white'
              }`}
              aria-label={item.label}
            >
              {isActive && <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b bg-[#d9f85a]" />}
              <span className="shrink-0">
                {item.area === 'dashboard' && <IconDashboard />}
                {item.area === 'sesi' && <IconSessions />}
                {item.area === 'print-queue' && <IconPrinter />}
                {item.area === 'templates' && <IconTemplates />}
              </span>
            </button>
          );
        })}
        <button
          onClick={onBackToBooth}
          className="relative flex min-w-0 flex-1 items-center justify-center py-3 text-white/50 transition hover:text-white"
          aria-label="Back to booth"
        >
          <IconPhotoBooth className="h-5 w-5" />
        </button>
      </nav>

      <ConfirmModal
        open={confirmLogout}
        title="Sign out?"
        message="You'll need to sign in again to manage the booth from this device."
        confirmLabel="Sign out"
        cancelLabel="Stay"
        danger
        onConfirm={onLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
};