import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EyeIcon, EyeSlashIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline';
import { notificationService } from '../services/notificationService';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberedUser, setRememberedUser] = useState<any>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Remove localStorage user checking since we're using backend now
    // This can be enhanced later with backend user lookup if needed
    setRememberedUser(null);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login form submitted with:', { username, password });
    setError('');
    setIsLoading(true);

    try {
      // Use the auth hook which connects to our backend
      console.log('Attempting login...');
      await login({ username, password });
      console.log('Login successful, navigating to dashboard');
      
      // Show welcome notification
      notificationService.success(
        'Welcome to DroneStrike!',
        `Successfully logged in as ${username}`,
        { duration: 5000 }
      );
      
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="py-8 px-4 space-y-8">

        {/* Login Card */}
      <div className="w-full max-w-md mx-auto rounded-lg border border-gray-600 bg-gray-800 text-white shadow-lg">
        {/* Card Header */}
        <div className="flex flex-col space-y-1.5 p-6 items-center">
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full mb-3">
              <MapPinIcon className="w-6 h-6 text-gray-900" />
            </div>
            <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">DroneStrike CRM</h3>
          </div>
          <p className="text-sm text-gray-400">Enter your credentials to access the command center</p>

          {rememberedUser && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mt-4 w-full">
              <p className="text-green-300 text-sm text-center">
                Welcome back, {rememberedUser.firstName || rememberedUser.username}!
              </p>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-6 pt-0">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-white">Username</label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-white">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                  ) : (
                    <EyeIcon className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 px-4 py-3 bg-white hover:bg-gray-100 text-black font-semibold text-lg rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] border border-gray-300"
            >
              {isLoading ? (
                <div className="flex items-center justify-center text-black">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                  <span className="text-black font-medium">Signing in...</span>
                </div>
              ) : (
                <span className="text-black font-semibold">Sign In</span>
              )}
            </button>
          </form>
        </div>

        {/* Card Footer */}
        <div className="flex justify-center p-6 pt-0">
          <p className="text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
              Sign up here
            </Link>
          </p>
        </div>
      </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Target. Engage. Close.</p>
          <p className="mt-1">© 2024 DroneStrike. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
