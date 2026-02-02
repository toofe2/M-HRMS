// src/pages/PersonalInfo.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Lock,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Heart,
  AlertCircle,
  CheckCircle2,
  Camera,
  X,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import OptimizedImage from '../components/OptimizedImage';
import ImageUploader from '../components/ImageUploader';
import ChangePasswordCard from '../components/ChangePasswordCard';

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department_id: string | null;
  position_id: string | null;
  employment_status: string;
  hire_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  profile_image_url: string | null;
  avatar_url: string | null;
  image_path: string | null;
  departments?: { name: string };
  positions?: { title: string };
}

const initialProfile: Profile = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department_id: null,
  position_id: null,
  employment_status: 'full-time',
  hire_date: new Date().toISOString().split('T')[0],
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  profile_image_url: null,
  avatar_url: null,
  image_path: null,
};

export default function PersonalInfo() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [originalProfile, setOriginalProfile] = useState<Profile>(initialProfile);
  const [hasChanges, setHasChanges] = useState(false);

  const [showImageModal, setShowImageModal] = useState(false);

  const fetchProfile = async () => {
    try {
      if (!user?.id) throw new Error('No user ID found');

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(
          `
          first_name,
          last_name,
          email,
          phone,
          department_id,
          position_id,
          employment_status,
          hire_date,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relationship,
          profile_image_url,
          avatar_url,
          image_path,
          departments:profiles_department_id_fkey ( name ),
          positions:profiles_position_id_fkey ( title )
        `
        )
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const profileData: Profile = {
        ...initialProfile,
        ...data,
        departments: data?.departments || { name: '' },
        positions: data?.positions || { title: '' },
      };

      setProfile(profileData);
      setOriginalProfile(profileData);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const hasAnyChange = Object.keys(profile).some(
      (key) => profile[key as keyof Profile] !== originalProfile[key as keyof Profile]
    );
    setHasChanges(hasAnyChange);
  }, [profile, originalProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // محدودية التعديل لغير الادمن
    if (
      !isAdmin &&
      !['phone', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'].includes(
        name
      )
    ) {
      return;
    }

    setProfile((prev) => ({ ...prev, [name]: value }));
    setSuccess(null);
  };

  const handleImageUploadSuccess = async (result: { url: string; path: string }) => {
    if (!user?.id) return;

    setError(null);
    setSuccess(null);
    setUploadingImage(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_image_url: result.url,
          avatar_url: result.url,
          image_path: result.path,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) => ({
        ...prev,
        profile_image_url: result.url,
        avatar_url: result.url,
        image_path: result.path,
      }));
      setOriginalProfile((prev) => ({
        ...prev,
        profile_image_url: result.url,
        avatar_url: result.url,
        image_path: result.path,
      }));

      setSuccess('Profile image updated successfully');
      setShowImageModal(false);
    } catch (err: any) {
      console.error('Error saving image url to profile:', err);
      setError(err.message || 'Failed to save image info');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUploadError = (msg: string) => {
    setError(msg);
    setUploadingImage(false);
    setShowImageModal(false);
  };

  const handleRemoveImage = async () => {
    if (!user?.id || !profile.image_path) return;

    setUploadingImage(true);
    setError(null);
    setSuccess(null);

    try {
      const { deleteProfileImage } = await import('../lib/imageUpload');
      await deleteProfileImage(profile.image_path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_image_url: null,
          avatar_url: null,
          image_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, profile_image_url: null, avatar_url: null, image_path: null }));
      setOriginalProfile((prev) => ({ ...prev, profile_image_url: null, avatar_url: null, image_path: null }));
      setSuccess('Profile image removed successfully');
    } catch (err: any) {
      console.error('Error removing image:', err);
      setError(err.message || 'Failed to remove image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImageLegacy = async () => {
    if (!user?.id || !profile.profile_image_url) return;

    setUploadingImage(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_image_url: null,
          avatar_url: null,
          image_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, profile_image_url: null, avatar_url: null, image_path: null }));
      setOriginalProfile((prev) => ({ ...prev, profile_image_url: null, avatar_url: null, image_path: null }));
      setSuccess('Profile image removed successfully');
    } catch (err: any) {
      console.error('Error removing legacy image:', err);
      setError(err.message || 'Failed to remove image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveClick = () => {
    if (profile.image_path) handleRemoveImage();
    else handleRemoveImageLegacy();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !hasChanges) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          department_id: profile.department_id,
          position_id: profile.position_id,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
          emergency_contact_relationship: profile.emergency_contact_relationship,
          hire_date: profile.hire_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess('Profile updated successfully');
      setOriginalProfile(profile);
      setHasChanges(false);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();

  const renderField = (
    label: string,
    name: keyof Profile,
    type: string,
    icon: React.ReactNode,
    required: boolean = true
  ) => {
    const isEditable =
      isAdmin ||
      ['phone', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'].includes(name);

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            {icon}
          </div>
          <input
            type={type}
            name={name}
            value={(profile[name] as any) || ''}
            onChange={handleChange}
            required={required}
            disabled={!isEditable}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
              isEditable
                ? 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            } transition-colors duration-200`}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>

          {!isAdmin && (
            <div className="flex items-center text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              <Lock className="h-4 w-4 mr-2" />
              <span className="text-sm">Limited Access Mode</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Personal Information</h2>
            <p className="mt-1 text-sm text-gray-500">Manage your personal and emergency contact information</p>
          </div>

          {(error || success) && (
            <div className={`p-4 ${error ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {error ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm ${error ? 'text-red-700' : 'text-green-700'}`}>{error || success}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-8">
              {/* Profile Image */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                    {profile.profile_image_url || profile.avatar_url ? (
                      <OptimizedImage
                        src={profile.profile_image_url || profile.avatar_url || ''}
                        alt="Profile"
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                        transformation={[{ crop: 'maintain_ratio', focus: 'face' }]}
                        onError={() => setError('Failed to load profile image')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 text-2xl font-bold">
                        {profile.first_name && profile.last_name ? (
                          getInitials(profile.first_name, profile.last_name)
                        ) : (
                          <User className="h-12 w-12" />
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowImageModal(true)}
                    disabled={uploadingImage}
                    className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
                  >
                    {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  </button>
                </div>

                <div className="mt-4 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowImageModal(true)}
                    disabled={uploadingImage}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
                  >
                    Change Photo
                  </button>
                  {(profile.profile_image_url || profile.avatar_url) && (
                    <button
                      type="button"
                      onClick={handleRemoveClick}
                      disabled={uploadingImage}
                      className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderField('First Name', 'first_name', 'text', <User className="h-5 w-5" />)}
                  {renderField('Last Name', 'last_name', 'text', <User className="h-5 w-5" />)}
                  {renderField('Email', 'email', 'email', <Mail className="h-5 w-5" />)}
                  {renderField('Phone Number', 'phone', 'tel', <Phone className="h-5 w-5" />)}
                </div>
              </div>

              {/* Employment Details */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        value={profile.departments?.name || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 border-gray-200 text-gray-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        value={profile.positions?.title || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 border-gray-200 text-gray-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hire Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <input
                        type="date"
                        value={profile.hire_date || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 border-gray-200 text-gray-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {renderField('Contact Name', 'emergency_contact_name', 'text', <User className="h-5 w-5" />)}
                  {renderField('Contact Phone', 'emergency_contact_phone', 'tel', <Phone className="h-5 w-5" />)}
                  {renderField(
                    'Relationship',
                    'emergency_contact_relationship',
                    'text',
                    <Heart className="h-5 w-5" />,
                    false
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className={`flex items-center px-4 py-2 rounded-lg text-white transition-all duration-200 ${
                  hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security */}
        <ChangePasswordCard />
      </div>

      {/* Image Upload Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Update Profile Photo</h3>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setUploadingImage(false);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ImageUploader onSuccess={handleImageUploadSuccess} onError={handleImageUploadError} maxSize={5} />

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setUploadingImage(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
