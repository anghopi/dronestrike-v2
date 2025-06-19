import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Fragment } from 'react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  BellIcon,
  XMarkIcon,
  UserIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', current: false },
  { name: 'Leads', href: '/leads', current: false },
  { name: 'Properties', href: '/properties', current: false },
  { name: 'Opportunities', href: '/opportunities', current: false },
  { name: 'Analytics', href: '/analytics', current: false },
];

export const Navbar: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userNavigation = [
    { name: 'Profile', href: '/profile', icon: UserIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  return (
    <Disclosure as="nav" className="bg-military-900 border-b border-military-700 shadow-lg">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                {/* Logo */}
                <div className="flex-shrink-0">
                  <Link to="/dashboard" className="flex items-center hover:opacity-80 transition-opacity">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-color to-brand-color-light flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">DS</span>
                    </div>
                    <div className="ml-3">
                      <span className="text-xl font-bold text-white tracking-tight">
                        DroneStrike
                      </span>
                      <span className="block text-xs text-primary-400 font-medium -mt-1">
                        Command & Control
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:block">
                  <div className="ml-12 flex items-center space-x-1">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={clsx(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                          'text-gray-300 hover:bg-military-700 hover:text-white hover:shadow-md',
                          'border border-transparent hover:border-military-600'
                        )}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right side */}
              <div className="hidden md:block">
                <div className="ml-4 flex items-center md:ml-6">
                  {/* Token Display */}
                  {profile && (
                    <div className="flex items-center space-x-3 mr-6">
                      <div className="flex items-center space-x-2 bg-gradient-to-r from-token-button-bg to-token-button-hover px-4 py-2 rounded-lg shadow-md border border-military-600">
                        <div className="w-2 h-2 bg-success-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-300 font-medium">TOKENS</span>
                        <span className="text-sm font-bold text-white">{profile.tokens.toLocaleString()}</span>
                      </div>
                      {profile.mail_tokens > 0 && (
                        <div className="flex items-center space-x-2 bg-gradient-to-r from-warning-600 to-alert-yellow px-4 py-2 rounded-lg shadow-md border border-warning-500">
                          <span className="text-xs text-white font-medium">MAIL</span>
                          <span className="text-sm font-bold text-white">{profile.mail_tokens}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notifications */}
                  <button
                    type="button"
                    className="rounded-full bg-military-800 p-1 text-military-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-military-800"
                  >
                    <span className="sr-only">View notifications</span>
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                  </button>

                  {/* Profile dropdown */}
                  <Menu as="div" className="relative ml-3">
                    <div>
                      <Menu.Button className="flex max-w-xs items-center rounded-full bg-military-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-military-800">
                        <span className="sr-only">Open user menu</span>
                        <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {user?.first_name?.[0] || user?.username?.[0] || 'U'}
                          </span>
                        </div>
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-military-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <div className="px-4 py-2 text-sm text-military-300 border-b border-military-600">
                          <div className="font-medium text-white">{user?.username}</div>
                          <div className="text-xs">{profile?.role}</div>
                        </div>
                        {userNavigation.map((item) => (
                          <Menu.Item key={item.name}>
                            {({ active }) => (
                              <Link
                                to={item.href}
                                className={clsx(
                                  active ? 'bg-military-700' : '',
                                  'flex items-center px-4 py-2 text-sm text-military-300 hover:text-white'
                                )}
                              >
                                <item.icon className="mr-3 h-4 w-4" />
                                {item.name}
                              </Link>
                            )}
                          </Menu.Item>
                        ))}
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleLogout}
                              className={clsx(
                                active ? 'bg-military-700' : '',
                                'flex w-full items-center px-4 py-2 text-sm text-military-300 hover:text-white'
                              )}
                            >
                              <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4" />
                              Sign out
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              </div>

              {/* Mobile menu button */}
              <div className="-mr-2 flex md:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-military-800 p-2 text-military-400 hover:bg-military-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-military-800">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <Disclosure.Panel className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-military-300 hover:bg-military-700 hover:text-white"
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="border-t border-military-700 pb-3 pt-4">
              <div className="flex items-center px-5">
                <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-white font-medium">
                    {user?.first_name?.[0] || user?.username?.[0] || 'U'}
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-white">{user?.username}</div>
                  <div className="text-sm font-medium text-military-400">{profile?.role}</div>
                </div>
                {profile && (
                  <div className="ml-auto flex space-x-2">
                    <span className="bg-success-600 px-2 py-1 rounded text-xs text-white">
                      {profile.tokens.toLocaleString()}
                    </span>
                    {profile.mail_tokens > 0 && (
                      <span className="bg-warning-600 px-2 py-1 rounded text-xs text-white">
                        {profile.mail_tokens}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1 px-2">
                {userNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-military-400 hover:bg-military-700 hover:text-white"
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center px-3 py-2 rounded-md text-base font-medium text-military-400 hover:bg-military-700 hover:text-white"
                >
                  <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
                  Sign out
                </button>
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
};