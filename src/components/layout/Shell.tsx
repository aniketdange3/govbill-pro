import React from 'react';
import { LayoutDashboard, FileText, Users, Settings, LogOut, Plus, Building } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface ShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export default function Shell({ children, activeTab, setActiveTab, user, onLogout }: ShellProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'companies', label: 'Companies', icon: Building },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 border-bottom border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">GovBill</h1>
            <span className="text-xs text-orange-600 font-medium">Pro Software</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                activeTab === item.id
                  ? "bg-orange-50 text-orange-600 shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-colors",
                activeTab === item.id ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {item.label}
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTab"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-600"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-xs">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.name || user?.email}
              </p>
              <p className="text-[10px] text-emerald-600 truncate uppercase tracking-wider font-bold">🗄️ MySQL Backend</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium group"
          >
            <LogOut size={20} className="group-hover:text-red-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900 capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onLogout}
              className="md:hidden p-2 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl transition-all"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="p-6 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-40 flex items-center justify-around px-2 pb-safe shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors relative"
            >
              <Icon size={18} className={cn(
                "transition-colors",
                isActive ? "text-orange-600" : "text-slate-400"
              )} />
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider mt-1 scale-90",
                isActive ? "text-orange-600" : "text-slate-500"
              )}>
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTabMobile"
                  className="absolute top-0 w-8 h-1 bg-orange-600 rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
