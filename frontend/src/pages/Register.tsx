import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon, MapPinIcon, UserIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { authService } from '../services/api';

export const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<any>(null);
  
  const navigate = useNavigate();

  // Remove localStorage checking since we're using backend now
  useEffect(() => {
    setExistingUser(null);
  }, [formData.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.username || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Register with backend API
      await authService.register(formData);
      
      setSuccess('Account created successfully! Redirecting to login...');

      // Redirect to login after success
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
            <MapPinIcon className="w-10 h-10 text-gray-900" />
          </div>
          <h1 className="text-4xl font-bold text-white">DroneStrike CRM</h1>
          <p className="mt-2 text-gray-400">Real Estate CRM & Operations Command Center</p>
        </div>

        {/* Registration Card */}
      <div className="w-full max-w-lg mx-auto rounded-lg border border-gray-600 bg-gray-800 text-white shadow-lg">
        {/* Card Header */}
        <div className="flex flex-col space-y-1.5 p-6 items-center">
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full mb-3">
              <MapPinIcon className="w-6 h-6 text-gray-900" />
            </div>
            <h3 className="text-2xl font-semibold leading-none tracking-tight text-white">Join DroneStrike CRM</h3>
          </div>
          <p className="text-sm text-gray-400">Create your account to access the command center</p>

          {existingUser && (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mt-4 w-full">
              <p className="text-blue-300 text-sm text-center">
                Welcome back! We found your previous information.
              </p>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-6 pt-0">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-white">First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium text-white">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-white">Username *</label>
              <div className="relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="username"
                  value={formData.username}
                  onChange={handleInputChange}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white">Email Address *</label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <EnvelopeIcon className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>

            {/* Phone and Company */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-white">Phone</label>
                <div className="relative">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <PhoneIcon className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="company" className="text-sm font-medium text-white">Company</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                  placeholder="Company Name"
                  value={formData.company}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-white">Password *</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
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
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-white">Confirm Password *</label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className="flex h-10 w-full rounded-md border border-gray-600 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                    ) : (
                      <EyeIcon className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {existingUser ? 'Updating Account...' : 'Creating Account...'}
                </div>
              ) : (
                existingUser ? 'Update Account' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Card Footer */}
        <div className="flex justify-center p-6 pt-0">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
              Sign in here
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