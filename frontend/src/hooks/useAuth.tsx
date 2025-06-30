import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserProfile, LoginRequest } from '../types';
import { authService } from '../services/api';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('access_token');
    if (token && !isRefreshing) {
      setIsRefreshing(true);
      refreshProfile().finally(() => setIsRefreshing(false));
    } else {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (credentials: LoginRequest): Promise<void> => {
    if (isLoading || isRefreshing) {
      console.log('Auth hook: Login already in progress, skipping duplicate request');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('Auth hook: calling authService.login with:', credentials);
      await authService.login(credentials);
      console.log('Auth hook: login successful, refreshing profile');
      await refreshProfile();
      console.log('Auth hook: profile refresh complete');
    } catch (error) {
      console.error('Auth hook: Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    authService.logout();
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
  };

  const refreshProfile = async (): Promise<void> => {
    if (isRefreshing) {
      console.log('Auth hook: Profile refresh already in progress, skipping duplicate request');
      return;
    }
    
    try {
      setIsRefreshing(true);
      setIsLoading(true);
      const profileData = await authService.getCurrentProfile();
      setProfile(profileData);
      setUser(profileData.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      logout();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};