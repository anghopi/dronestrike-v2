import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  MapIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  RadioIcon,
  TagIcon,
  CalendarIcon,
  QuestionMarkCircleIcon,
  UsersIcon,
  BanknotesIcon,
  CommandLineIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: RadioIcon, current: false },
  { 
    name: 'Targets', 
    href: '/targets', 
    icon: TagIcon, 
    current: false,
    submenu: [
      { name: 'Get New', href: '/targets/search' },
      { name: 'My Targets', href: '/targets' }
    ]
  },
  { 
    name: 'Missions', 
    href: '/missions', 
    icon: CommandLineIcon, 
    current: false,
    submenu: [
      { name: 'Call List', href: '/missions/call-list' },
      { name: 'Tasks', href: '/missions/tasks' },
      { name: 'Opportunities', href: '/opportunities' }
    ]
  },
  { 
    name: 'War Room', 
    href: '/war-room', 
    icon: ChatBubbleLeftRightIcon, 
    current: false,
    submenu: [
      { name: 'Inbox', href: '/war-room' },
      { name: 'Marketing Campaigns', href: '/war-room#campaigns' }
    ]
  },
  { name: 'Properties', href: '/properties', icon: HomeIcon, current: false },
  { name: 'TLC Clients', href: '/tlc-clients', icon: BanknotesIcon, current: false },
  { name: 'Documents', href: '/documents', icon: DocumentTextIcon, current: false },
];

const systemNavigation = [
  { name: 'Intelligence Tokens', href: '/tokens', icon: BanknotesIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
  { name: 'Scheduled Imports', href: '/scheduled-imports', icon: CalendarIcon },
  { name: 'FAQ', href: '/faq', icon: QuestionMarkCircleIcon },
];

interface SidebarProps {
  isVisible: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isVisible }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  if (!isVisible) return null;

  return (
    <div className="nav-military" style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(180deg, var(--navy-blue-dark) 0%, var(--navy-blue) 100%)',
      borderRight: '1px solid #374151'
    }}>
      {/* Logo Section */}
      <div style={{ padding: '1rem', borderBottom: '1px solid #374151' }}>
        <Link to="/dashboard" className="no-underline" style={{
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{ 
            height: '2.5rem', 
            width: '2.5rem', 
            borderRadius: '0.5rem', 
            background: 'linear-gradient(135deg, var(--brand-color), var(--brand-color-light))', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', 
            transition: 'all 0.3s ease' 
          }}>
            <span className="text-white font-bold" style={{ fontSize: '1.125rem' }}>DS</span>
          </div>
          <div style={{ marginLeft: '0.75rem' }}>
            <span className="text-white font-bold" style={{ 
              fontSize: '1.125rem', 
              letterSpacing: '-0.025em' 
            }}>
              DroneStrike
            </span>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <div style={{ 
        flex: '1 1 0%', 
        padding: '1rem 0.5rem', 
        overflowY: 'auto' 
      }} className="custom-scrollbar">
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ 
            padding: '0 0.75rem', 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#9ca3af', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            marginBottom: '0.75rem' 
          }}>
            Mission Control
          </h3>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="nav-item no-underline"
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: active ? '#ffffff' : '#d1d5db',
                    borderRadius: '0.5rem',
                    margin: '0 0.25rem',
                    transition: 'all 0.2s ease',
                    background: active 
                      ? 'linear-gradient(90deg, rgba(var(--brand-color), 0.8), var(--brand-color))'
                      : 'transparent',
                    boxShadow: active ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  <item.icon style={{
                    marginRight: '0.75rem',
                    height: '1.25rem',
                    width: '1.25rem',
                    color: active ? '#ffffff' : '#9ca3af',
                    transition: 'colors 0.2s ease'
                  }} />
                  <span style={{ fontWeight: '500' }}>{item.name}</span>
                  {active && (
                    <div style={{ 
                      marginLeft: 'auto', 
                      width: '0.5rem', 
                      height: '0.5rem', 
                      backgroundColor: '#ffffff', 
                      borderRadius: '9999px', 
                      opacity: '0.8' 
                    }}></div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* System Section */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid #374151' }}>
          <h3 style={{ 
            padding: '0 0.75rem', 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#9ca3af', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            marginBottom: '0.75rem' 
          }}>
            System
          </h3>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {systemNavigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className="nav-item no-underline"
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: active ? '#ffffff' : '#d1d5db',
                    borderRadius: '0.5rem',
                    margin: '0 0.25rem',
                    transition: 'all 0.2s ease',
                    background: active 
                      ? 'linear-gradient(90deg, rgba(138, 162, 74, 0.8), var(--success-green))'
                      : 'transparent',
                    boxShadow: active ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                >
                  <item.icon style={{
                    marginRight: '0.75rem',
                    height: '1.25rem',
                    width: '1.25rem',
                    color: active ? '#ffffff' : '#9ca3af',
                    transition: 'colors 0.2s ease'
                  }} />
                  <span style={{ fontWeight: '500' }}>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Section */}
      <div style={{ padding: '1rem', borderTop: '1px solid #374151' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '0.75rem', 
          padding: '0.5rem', 
          borderRadius: '0.5rem', 
          backgroundColor: 'rgba(31, 41, 55, 0.3)' 
        }}>
          <div style={{ 
            height: '2rem', 
            width: '2rem', 
            borderRadius: '9999px', 
            background: 'linear-gradient(135deg, var(--brand-color), var(--brand-color-light))', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <span className="text-white" style={{ 
              fontSize: '0.875rem', 
              fontWeight: '700' 
            }}>
              {user?.first_name?.[0] || user?.username?.[0] || 'U'}
            </span>
          </div>
          <div style={{ 
            marginLeft: '0.75rem', 
            flex: '1 1 0%', 
            minWidth: '0' 
          }}>
            <p className="text-white" style={{ 
              fontSize: '0.875rem', 
              fontWeight: '500', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              margin: '0'
            }}>
              {user?.username}
            </p>
            <p style={{ 
              fontSize: '0.75rem', 
              color: '#9ca3af', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              margin: '0'
            }}>
              Command Officer
            </p>
          </div>
          <div style={{ 
            width: '0.5rem', 
            height: '0.5rem', 
            backgroundColor: '#4ade80', 
            borderRadius: '9999px' 
          }} className="animate-pulse"></div>
        </div>
        
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#d1d5db',
            borderRadius: '0.5rem',
            margin: '0 0.25rem',
            transition: 'all 0.2s ease',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.2)';
            e.currentTarget.style.color = '#f87171';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#d1d5db';
          }}
        >
          <ArrowRightOnRectangleIcon style={{
            marginRight: '0.75rem',
            height: '1.25rem',
            width: '1.25rem',
            color: '#9ca3af',
            transition: 'colors 0.2s ease'
          }} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Version Footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid #1f2937' }}>
        <p style={{ 
          fontSize: '0.75rem', 
          color: '#6b7280', 
          textAlign: 'center', 
          fontWeight: '500',
          margin: '0'
        }}>
          DroneStrike v2.0.0
        </p>
      </div>
    </div>
  );
};