import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  XMarkIcon,
  MapPinIcon,
  UserGroupIcon,
  CalendarIcon,
  ClockIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  FireIcon,
  BoltIcon,
  UserIcon,
  PhoneIcon,
  GlobeAltIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Property {
  id: number;
  address: string;
  latitude?: number;
  longitude?: number;
  amount_due?: number;
  property_type?: string;
}

interface Lead {
  id: number;
  full_name: string;
  property_address: string;
  phone: string;
  email: string;
  property_value: number;
  lead_source: string;
}

interface Soldier {
  id: number;
  name: string;
  phone: string;
  email: string;
  active_missions: number;
  success_rate: number;
  specialties: string[];
  status: string;
}

interface DeclineReason {
  id: number;
  name: string;
  description: string;
  is_safety_related: boolean;
  sort_order: number;
}

// Enhanced mock services with all Laravel functionality
const mockServices = {
  getProperties: async (): Promise<Property[]> => {
    return [
      {
        id: 1,
        address: '123 Main St, Dallas, TX 75201',
        latitude: 32.7767,
        longitude: -96.7970,
        amount_due: 15420.50,
        property_type: 'residential'
      },
      {
        id: 2,
        address: '456 Oak Ave, Austin, TX 78701',
        latitude: 30.2672,
        longitude: -97.7431,
        amount_due: 8750.25,
        property_type: 'commercial'
      },
      {
        id: 3,
        address: '789 Pine St, Houston, TX 77001',
        latitude: 29.7604,
        longitude: -95.3698,
        amount_due: 22100.75,
        property_type: 'land'
      }
    ];
  },

  getLeads: async (): Promise<Lead[]> => {
    return [
      {
        id: 1,
        full_name: 'John Smith',
        property_address: '123 Main St, Dallas, TX 75201',
        phone: '+1-555-0123',
        email: 'john.smith@email.com',
        property_value: 250000,
        lead_source: 'online_inquiry'
      },
      {
        id: 2,
        full_name: 'Sarah Johnson',
        property_address: '456 Oak Ave, Austin, TX 78701',
        phone: '+1-555-0124',
        email: 'sarah.j@email.com',
        property_value: 180000,
        lead_source: 'referral'
      },
      {
        id: 3,
        full_name: 'Mike Wilson',
        property_address: '789 Pine St, Houston, TX 77001',
        phone: '+1-555-0125',
        email: 'mike.wilson@email.com',
        property_value: 320000,
        lead_source: 'marketing_campaign'
      }
    ];
  },

  getSoldiers: async (): Promise<Soldier[]> => {
    return [
      {
        id: 1,
        name: 'Agent Rodriguez',
        phone: '+1-555-0201',
        email: 'rodriguez@dronestrike.com',
        active_missions: 2,
        success_rate: 92,
        specialties: ['property_assessment', 'photo_documentation'],
        status: 'active'
      },
      {
        id: 2,
        name: 'Agent Chen',
        phone: '+1-555-0202',
        email: 'chen@dronestrike.com',
        active_missions: 1,
        success_rate: 88,
        specialties: ['condition_inspection', 'neighbor_contact'],
        status: 'standby'
      },
      {
        id: 3,
        name: 'Agent Thompson',
        phone: '+1-555-0203',
        email: 'thompson@dronestrike.com',
        active_missions: 0,
        success_rate: 95,
        specialties: ['market_research', 'compliance_check'],
        status: 'active'
      }
    ];
  },

  createMission: async (missionData: any) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      success: true,
      mission_id: `M-2025-${String(Date.now()).slice(-3)}`,
      message: 'Mission deployed successfully'
    };
  }
};

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    // Basic Information
    title: '',
    description: '',
    instructions: '',
    mission_type: 'property_assessment',
    priority: 'normal',
    safety_level: 'green',
    
    // Targets
    property_id: null as number | null,
    prospect_id: null as number | null,
    
    // Scheduling
    scheduled_date: '',
    estimated_duration: 60,
    
    // Location
    lat_created: null as number | null,
    lng_created: null as number | null,
    use_current_location: false,
    
    // Options
    go_to_lead: false,
    initial_amount_due: null as number | null,
    create_route: true,
    
    // Assignment
    assigned_soldiers: [] as number[],
    
    // Filters (Laravel mission filtering system)
    filters: {
      residential_only: false,
      commercial_only: false,
      land_only: false,
      mobile_home_only: false,
      exclude_mobile_home: false,
      returned_postcard_only: false,
      lawsuit_only: false,
      in_foreclosure_only: false,
      existing_loan_only: false,
      with_improvements_only: false,
      not_visited_by_me_only: false,
      amount_due_min: null as number | null,
      amount_due_max: null as number | null
    }
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch data
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: mockServices.getProperties,
    enabled: isOpen
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: mockServices.getLeads,
    enabled: isOpen
  });

  const { data: soldiers = [] } = useQuery({
    queryKey: ['soldiers'],
    queryFn: mockServices.getSoldiers,
    enabled: isOpen
  });

  // Create mission mutation
  const createMissionMutation = useMutation({
    mutationFn: mockServices.createMission,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      onSuccess?.();
      onClose();
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      instructions: '',
      mission_type: 'property_assessment',
      priority: 'normal',
      safety_level: 'green',
      property_id: null,
      prospect_id: null,
      scheduled_date: '',
      estimated_duration: 60,
      lat_created: null,
      lng_created: null,
      use_current_location: false,
      go_to_lead: false,
      initial_amount_due: null,
      create_route: true,
      assigned_soldiers: [],
      filters: {
        residential_only: false,
        commercial_only: false,
        land_only: false,
        mobile_home_only: false,
        exclude_mobile_home: false,
        returned_postcard_only: false,
        lawsuit_only: false,
        in_foreclosure_only: false,
        existing_loan_only: false,
        with_improvements_only: false,
        not_visited_by_me_only: false,
        amount_due_min: null,
        amount_due_max: null
      }
    });
    setCurrentStep(1);
    setCurrentLocation(null);
    setShowAdvancedFilters(false);
  };

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          setFormData(prev => ({
            ...prev,
            lat_created: latitude,
            lng_created: longitude,
            use_current_location: true
          }));
          setIsGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      console.error('Geolocation is not supported');
      setIsGettingLocation(false);
    }
  };

  const handleSoldierToggle = (soldierId: number) => {
    setFormData(prev => ({
      ...prev,
      assigned_soldiers: prev.assigned_soldiers.includes(soldierId)
        ? prev.assigned_soldiers.filter(id => id !== soldierId)
        : [...prev.assigned_soldiers, soldierId]
    }));
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('Mission title is required');
      return;
    }

    if (formData.assigned_soldiers.length === 0) {
      alert('At least one soldier must be assigned');
      return;
    }

    // Prepare data with Laravel format
    const missionData = {
      // Basic info
      title: formData.title,
      description: formData.description,
      instructions: formData.instructions,
      mission_type: formData.mission_type,
      priority: formData.priority,
      safety_level: formData.safety_level,
      
      // Targets
      property_id: formData.property_id,
      prospect_id: formData.prospect_id,
      
      // Scheduling
      scheduled_date: formData.scheduled_date,
      estimated_duration: formData.estimated_duration,
      
      // Location
      lat_created: formData.lat_created,
      lng_created: formData.lng_created,
      
      // Options
      go_to_lead: formData.go_to_lead,
      initial_amount_due: formData.initial_amount_due,
      
      // Assignment
      soldier_ids: formData.assigned_soldiers,
      create_route: formData.create_route,
      
      // Filters - only include active filters
      filters: Object.keys(formData.filters).reduce((acc, key) => {
        const value = formData.filters[key as keyof typeof formData.filters];
        if (value !== null && value !== false && (typeof value === 'string' ? value !== '' : value !== 0)) {
          acc[key] = value;
        }
        return acc;
      }, {} as any)
    };

    createMissionMutation.mutate(missionData);
  };

  const canProceedToStep2 = formData.title.trim() !== '';
  const canProceedToStep3 = canProceedToStep2 && (formData.property_id || formData.prospect_id || formData.lat_created);
  const canSubmit = canProceedToStep3 && formData.assigned_soldiers.length > 0;

  const getPriorityIcon = (priority: string) => {
    const icons = {
      low: ClockIcon,
      normal: ShieldCheckIcon,
      high: ExclamationTriangleIcon,
      urgent: FireIcon
    };
    return icons[priority as keyof typeof icons] || ShieldCheckIcon;
  };

  const getSafetyIcon = (level: string) => {
    const icons = {
      green: ShieldCheckIcon,
      yellow: ExclamationTriangleIcon,
      red: FireIcon
    };
    return icons[level as keyof typeof icons] || ShieldCheckIcon;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="enhanced-card w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-navy-blue-light">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-color/20 rounded-lg border border-brand-color/30">
              <BoltIcon className="h-6 w-6 text-brand-color" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Deploy New Mission</h2>
              <p className="text-sm text-gray-400">Enhanced BOTG operations with route optimization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="p-6 border-b border-navy-blue-light">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                  currentStep >= step 
                    ? 'bg-brand-color border-brand-color text-white' 
                    : 'border-gray-600 text-gray-400'
                }`}>
                  {currentStep > step ? <CheckCircleIcon className="h-6 w-6" /> : step}
                </div>
                {step < 4 && (
                  <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                    currentStep > step ? 'bg-brand-color' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm">
            <span className={currentStep >= 1 ? 'text-white font-medium' : 'text-gray-400'}>Mission Setup</span>
            <span className={currentStep >= 2 ? 'text-white font-medium' : 'text-gray-400'}>Target & Location</span>
            <span className={currentStep >= 3 ? 'text-white font-medium' : 'text-gray-400'}>Assignment</span>
            <span className={currentStep >= 4 ? 'text-white font-medium' : 'text-gray-400'}>Review & Deploy</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(95vh - 240px)' }}>
          {/* Step 1: Mission Setup */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Mission Configuration</h3>
                <p className="text-gray-400">Set up the basic mission parameters and objectives</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mission Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="input-military w-full"
                      placeholder="Enter descriptive mission title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mission Type
                    </label>
                    <select
                      value={formData.mission_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, mission_type: e.target.value }))}
                      className="input-military w-full"
                    >
                      <option value="property_assessment">🏠 Property Assessment</option>
                      <option value="photo_documentation">📸 Photo Documentation</option>
                      <option value="condition_inspection">🔍 Condition Inspection</option>
                      <option value="neighbor_contact">👥 Neighbor Contact</option>
                      <option value="market_research">📊 Market Research</option>
                      <option value="compliance_check">✓ Compliance Check</option>
                      <option value="lead_conversion">💼 Lead Conversion</option>
                      <option value="opportunity_pursuit">🎯 Opportunity Pursuit</option>
                      <option value="safety_check">⚠️ Safety Check</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="input-military w-full h-24 resize-none"
                      placeholder="Mission description and objectives"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Priority Level
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'low', label: 'Low', color: 'bg-gray-500' },
                        { value: 'normal', label: 'Normal', color: 'bg-brand-color' },
                        { value: 'high', label: 'High', color: 'bg-orange-500' },
                        { value: 'urgent', label: 'Urgent', color: 'bg-critical-red' }
                      ].map((priority) => {
                        const Icon = getPriorityIcon(priority.value);
                        return (
                          <button
                            key={priority.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, priority: priority.value }))}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              formData.priority === priority.value
                                ? `${priority.color} border-white text-white`
                                : 'border-gray-600 text-gray-400 hover:border-gray-500'
                            }`}
                          >
                            <Icon className="w-4 h-4 mx-auto mb-1" />
                            <div className="text-xs font-medium">{priority.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Safety Level
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'green', label: 'Green', color: 'bg-olive-green' },
                        { value: 'yellow', label: 'Yellow', color: 'bg-alert-yellow' },
                        { value: 'red', label: 'Red', color: 'bg-critical-red' }
                      ].map((safety) => {
                        const Icon = getSafetyIcon(safety.value);
                        return (
                          <button
                            key={safety.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, safety_level: safety.value }))}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              formData.safety_level === safety.value
                                ? `${safety.color} border-white text-white`
                                : 'border-gray-600 text-gray-400 hover:border-gray-500'
                            }`}
                          >
                            <Icon className="w-4 h-4 mx-auto mb-1" />
                            <div className="text-xs font-medium">{safety.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Special Instructions
                    </label>
                    <textarea
                      value={formData.instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                      className="input-military w-full h-24 resize-none"
                      placeholder="Special instructions for field agents"
                    />
                  </div>
                </div>
              </div>

              {/* Scheduling and Duration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <CalendarIcon className="w-4 h-4 inline mr-1" />
                    Scheduled Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="input-military w-full"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <ClockIcon className="w-4 h-4 inline mr-1" />
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.estimated_duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: parseInt(e.target.value) || 60 }))}
                    className="input-military w-full"
                    min="15"
                    max="480"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    💰 Target Amount
                  </label>
                  <input
                    type="number"
                    value={formData.initial_amount_due || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, initial_amount_due: e.target.value ? parseFloat(e.target.value) : null }))}
                    className="input-military w-full"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Target & Location */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Target & Location</h3>
                <p className="text-gray-400">Select target property/lead and set mission location</p>
              </div>

              {/* Target Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Properties */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    🏠 Target Property
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div
                      onClick={() => setFormData(prev => ({ ...prev, property_id: null }))}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        formData.property_id === null
                          ? 'border-brand-color bg-brand-color/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-sm text-gray-400">No specific property</div>
                    </div>
                    {properties.map((property) => (
                      <div
                        key={property.id}
                        onClick={() => setFormData(prev => ({ ...prev, property_id: property.id }))}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          formData.property_id === property.id
                            ? 'border-brand-color bg-brand-color/10'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <div className="text-sm text-white font-medium">{property.address}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {property.property_type} • ${property.amount_due?.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leads */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    👤 Target Lead
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div
                      onClick={() => setFormData(prev => ({ ...prev, prospect_id: null }))}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        formData.prospect_id === null
                          ? 'border-brand-color bg-brand-color/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-sm text-gray-400">No specific lead</div>
                    </div>
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => setFormData(prev => ({ ...prev, prospect_id: lead.id }))}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          formData.prospect_id === lead.id
                            ? 'border-brand-color bg-brand-color/10'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      >
                        <div className="text-sm text-white font-medium">{lead.full_name}</div>
                        <div className="text-xs text-gray-400 mt-1">{lead.property_address}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="border-t border-gray-700 pt-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  📍 Mission Location
                </label>
                <div className="flex items-center space-x-4 mb-4">
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <MapPinIcon className={`w-4 h-4 ${isGettingLocation ? 'animate-spin' : ''}`} />
                    <span>{isGettingLocation ? 'Getting Location...' : 'Use Current Location'}</span>
                  </button>
                  
                  {currentLocation && (
                    <div className="text-sm text-gray-400">
                      📍 {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                    </div>
                  )}
                </div>

                {/* Advanced Filters */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="btn-secondary flex items-center space-x-2 mb-4"
                  >
                    <AdjustmentsHorizontalIcon className="w-4 h-4" />
                    <span>Advanced Filtering {showAdvancedFilters ? '(Hide)' : '(Show)'}</span>
                  </button>

                  {showAdvancedFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-gray-800/30 rounded-lg">
                      {/* Property Type Filters */}
                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.residential_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, residential_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">Residential Only</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.commercial_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, commercial_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">Commercial Only</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.land_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, land_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">Land Only</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.with_improvements_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, with_improvements_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">With Improvements</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.in_foreclosure_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, in_foreclosure_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">In Foreclosure</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.lawsuit_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, lawsuit_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">Lawsuit Properties</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.not_visited_by_me_only}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, not_visited_by_me_only: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">Not Visited</span>
                      </label>

                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.filters.exclude_mobile_home}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filters: { ...prev.filters, exclude_mobile_home: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <span className="text-gray-300">Exclude Mobile</span>
                      </label>

                      {/* Amount Range */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Amount Due Range</label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={formData.filters.amount_due_min || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              filters: { ...prev.filters, amount_due_min: e.target.value ? parseFloat(e.target.value) : null }
                            }))}
                            className="input-military flex-1 text-xs"
                            placeholder="Min"
                          />
                          <input
                            type="number"
                            value={formData.filters.amount_due_max || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              filters: { ...prev.filters, amount_due_max: e.target.value ? parseFloat(e.target.value) : null }
                            }))}
                            className="input-military flex-1 text-xs"
                            placeholder="Max"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="border-t border-gray-700 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.go_to_lead}
                      onChange={(e) => setFormData(prev => ({ ...prev, go_to_lead: e.target.checked }))}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Convert to lead opportunity</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.create_route}
                      onChange={(e) => setFormData(prev => ({ ...prev, create_route: e.target.checked }))}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Create optimized route</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Assignment */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Soldier Assignment</h3>
                <p className="text-gray-400">Select field agents for this mission</p>
              </div>

              <div className="grid gap-4">
                {soldiers.map((soldier) => (
                  <div
                    key={soldier.id}
                    onClick={() => handleSoldierToggle(soldier.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
                      formData.assigned_soldiers.includes(soldier.id)
                        ? 'border-brand-color bg-brand-color/10 shadow-lg'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-lg ${
                          soldier.status === 'active' ? 'bg-olive-green/20' : 
                          soldier.status === 'standby' ? 'bg-alert-yellow/20' : 'bg-gray-500/20'
                        }`}>
                          <UserIcon className={`w-6 h-6 ${
                            soldier.status === 'active' ? 'text-olive-green' : 
                            soldier.status === 'standby' ? 'text-alert-yellow' : 'text-gray-400'
                          }`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-white">{soldier.name}</h4>
                            <Badge 
                              variant={soldier.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {soldier.status.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-400">Active Missions</div>
                              <div className="text-white font-medium">{soldier.active_missions}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Success Rate</div>
                              <div className="text-olive-green font-medium">{soldier.success_rate}%</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Phone</div>
                              <div className="text-white font-mono text-xs">{soldier.phone}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Specialties</div>
                              <div className="flex flex-wrap gap-1">
                                {soldier.specialties.slice(0, 2).map((specialty, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {specialty.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {formData.assigned_soldiers.includes(soldier.id) && (
                        <CheckCircleIcon className="h-8 w-8 text-brand-color" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {formData.assigned_soldiers.length > 0 && (
                <div className="bg-brand-color/10 border border-brand-color/30 rounded-lg p-4">
                  <div className="text-sm text-brand-color font-medium mb-2">
                    ✓ {formData.assigned_soldiers.length} soldier(s) selected
                  </div>
                  <div className="text-xs text-gray-400">
                    {formData.create_route && "Optimized routes will be created for each assigned soldier."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Deploy */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Mission Review</h3>
                <p className="text-gray-400">Review all mission parameters before deployment</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mission Details */}
                <div className="enhanced-card p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Mission Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Title:</span>
                      <span className="text-white">{formData.title || 'Untitled Mission'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type:</span>
                      <span className="text-white">{formData.mission_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Priority:</span>
                      <Badge variant={formData.priority === 'urgent' ? 'destructive' : 'default'}>
                        {formData.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Safety:</span>
                      <Badge variant={formData.safety_level === 'red' ? 'destructive' : 'default'}>
                        {formData.safety_level.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white">{formData.estimated_duration} minutes</span>
                    </div>
                  </div>
                </div>

                {/* Assignment Summary */}
                <div className="enhanced-card p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Assignment</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Soldiers:</span>
                      <span className="text-white">{formData.assigned_soldiers.length} assigned</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Route Optimization:</span>
                      <span className="text-white">{formData.create_route ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lead Conversion:</span>
                      <span className="text-white">{formData.go_to_lead ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {formData.scheduled_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Scheduled:</span>
                        <span className="text-white">
                          {new Date(formData.scheduled_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned Soldiers List */}
              {formData.assigned_soldiers.length > 0 && (
                <div className="enhanced-card p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Assigned Soldiers</h4>
                  <div className="space-y-2">
                    {formData.assigned_soldiers.map(soldierId => {
                      const soldier = soldiers.find(s => s.id === soldierId);
                      return soldier ? (
                        <div key={soldier.id} className="flex items-center justify-between p-2 bg-gray-800/30 rounded">
                          <div className="flex items-center space-x-3">
                            <UserIcon className="w-4 h-4 text-brand-color" />
                            <span className="text-white">{soldier.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <PhoneIcon className="w-3 h-3" />
                            <span>{soldier.phone}</span>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-navy-blue-light">
          <div className="flex items-center gap-4">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-6 py-2"
              >
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="px-6 py-2"
            >
              Cancel
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3) ||
                  (currentStep === 3 && formData.assigned_soldiers.length === 0)
                }
                className="btn-primary px-8 py-2"
              >
                Next Step
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createMissionMutation.isPending}
                className="btn-danger px-8 py-2"
              >
                {createMissionMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deploying...
                  </>
                ) : (
                  <>
                    <BoltIcon className="w-5 h-5 mr-2" />
                    Deploy Mission
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};