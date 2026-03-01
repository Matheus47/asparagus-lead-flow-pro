import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  LayoutDashboard,
  Users,
  Target,
  TrendingUp,
  GitBranch,
  Lightbulb,
  FileText,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Sidebar({ currentPage, unreadInsights = 0 }) {
  const [collapsed, setCollapsed] = React.useState(false);

  const menuItems = [
    { name: 'Dashboard', path: 'Dashboard', icon: LayoutDashboard },
    { name: 'Leads', path: 'Leads', icon: Users },
    { name: 'Campanhas', path: 'Campanhas', icon: Target },
    { name: 'Analytics', path: 'Analytics', icon: TrendingUp },
    { name: 'Pipeline', path: 'Pipeline', icon: GitBranch },
    { name: 'Insights', path: 'Insights', icon: Lightbulb, badge: unreadInsights },
    { name: 'Relatórios', path: 'Relatorios', icon: FileText },
    { name: 'Configurações', path: 'Configuracoes', icon: Settings }
  ];

  return (
    <div className={`fixed left-0 top-0 h-screen bg-[#1E3A5F] text-white flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2E86AB] rounded-lg flex items-center justify-center font-bold">LF</div>
            <span className="font-bold text-lg">LeadFlow</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.path;
          
          return (
            <Link
              key={item.path}
              to={createPageUrl(item.path)}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors relative ${
                isActive ? 'bg-white/10 border-l-4 border-[#2E86AB]' : ''
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.name}</span>
                  {item.badge > 0 && (
                    <Badge variant="default" className="bg-[#EC4899] text-white">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/60">Workspace</div>
          <div className="font-medium mt-1">Agência Demo</div>
        </div>
      )}
    </div>
  );
}