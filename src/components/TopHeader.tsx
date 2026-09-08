import React from 'react';
import { AppLogo } from './AppLogo';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';

interface TopHeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  activeTasksCount: number;
  onOpenTaskDrawer: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  activeTasksCount,
  onOpenTaskDrawer,
  isDarkMode,
  onToggleDarkMode,
}) => {
  return (
    <header
      id="app-top-header"
      className={`h-14 px-4 border-b flex items-center justify-between transition-colors z-30 select-none shrink-0 ${
        isDarkMode
          ? 'bg-[#141414] border-[#262626] text-[#f2f2f2]'
          : 'bg-[#ffffff] border-[#e5e5e5] text-[#121212]'
      }`}
    >
      {/* Left: Sidebar Toggle, Logo, App Name, Version */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-1.5 rounded border transition-colors ${
            isDarkMode
              ? 'bg-[#1f1f1f] border-[#303030] text-[#cccccc] hover:text-white hover:bg-[#282828]'
              : 'bg-[#f4f4f5] border-[#d4d4d8] text-[#444444] hover:text-[#111111] hover:bg-[#e4e4e7]'
          }`}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo isDarkMode={isDarkMode} className="w-7 h-7 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold tracking-tight whitespace-nowrap">
              W.&apos;s Simple Media Tools
            </h1>
            <a
              id="badge-app-version"
              href="https://github.com/raviwarrier/W.-s-Simple-Media-Tools"
              target="_blank"
              rel="noopener noreferrer"
              title="View source repository on GitHub (v1.5.1)"
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold shrink-0 cursor-pointer transition-all hover:scale-105 inline-flex items-center gap-1 ${
                isDarkMode
                  ? 'bg-[#1e1e1e] border-[#333333] text-[#f3e79a] hover:bg-[#282828] hover:border-[#f3e79a]/60'
                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400'
              }`}
            >
              v1.5.1
            </a>
          </div>
        </div>
      </div>

      {/* Right: Tasks Button and Light/Dark Mode Button */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Background Tasks Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenTaskDrawer}
          id="btn-header-task-drawer"
          title="Open Background Tasks Manager"
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all ${
            activeTasksCount > 0
              ? isDarkMode
                ? 'bg-[#f3e79a]/15 border-[#f3e79a] text-[#f3e79a]'
                : 'bg-[#ffd600]/25 border-[#ffd600] text-neutral-900 font-semibold'
              : isDarkMode
              ? 'bg-[#1f1f1f] border-[#303030] text-[#cccccc] hover:bg-[#282828]'
              : 'bg-[#f4f4f5] border-[#d4d4d8] text-[#222222] hover:bg-[#e4e4e7]'
          }`}
        >
          <Activity
            className={`w-3.5 h-3.5 ${
              activeTasksCount > 0
                ? isDarkMode
                  ? 'animate-spin text-[#f3e79a]'
                  : 'animate-spin text-[#ca8a04]'
                : 'text-[#888888]'
            }`}
          />
          <span className="hidden sm:inline">Tasks</span>
          {activeTasksCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                isDarkMode
                  ? 'bg-[#f3e79a] text-neutral-950'
                  : 'bg-[#ffd600] text-neutral-950'
              }`}
            >
              {activeTasksCount}
            </span>
          )}
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleDarkMode}
          id="btn-theme-toggle"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`p-2 rounded border transition-colors ${
            isDarkMode
              ? 'bg-[#1f1f1f] border-[#303030] text-[#cccccc] hover:text-white hover:bg-[#282828]'
              : 'bg-[#f4f4f5] border-[#d4d4d8] text-[#444444] hover:text-[#111111] hover:bg-[#e4e4e7]'
          }`}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-[#f3e79a]" />
          ) : (
            <Moon className="w-4 h-4 text-[#222222]" />
          )}
        </button>
      </div>
    </header>
  );
};
