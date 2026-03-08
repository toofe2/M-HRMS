// src/pages/PersonalInfo.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  Plus,
  Trash2,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import OptimizedImage from '../components/OptimizedImage';
import ImageUploader from '../components/ImageUploader';

interface Profile {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department_id: string | null;
  position_id: string | null;
  employment_status: string;
  hire_date: string;
  profile_image_url: string | null;
  avatar_url: string | null;
  image_path: string | null;
  departments?: { name: string } | null;
  positions?: { title: string } | null;
}

interface EmergencyContact {
  id: string;
  profile_id?: string;
  contact_name: string;
  contact_phone: string;
  relationship: string | null;
  is_primary: boolean;
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
  profile_image_url: null,
  avatar_url: null,
  image_path: null,
  departments: { name: '' },
  positions: { title: '' },
};

const relationshipOptions = [
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Spouse',
  'Son',
  'Daughter',
  'Friend',
  'Relative',
  'Manager',
  'Other',
];

const createEmptyContact = (): EmergencyContact => ({
  id: crypto.randomUUID(),
  contact_name: '',
  contact_phone: '',
  relationship: '',
  is_primary: false,
});

export default function PersonalInfo() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [originalProfile, setOriginalProfile] = useState<Profile>(initialProfile);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { ...createEmptyContact(), is_primary: true },
  ]);
  const [originalEmergencyContacts, setOriginalEmergencyContacts] = useState<EmergencyContact[]>([
    { ...createEmptyContact(), is_primary: true },
  ]);

  const [showImageModal, setShowImageModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const canEditProfileField = (name: keyof Profile) => {
    if (isAdmin) return true;
    return ['phone'].includes(name);
  };

  const normalizeContacts = (contacts: EmergencyContact[]) =>
    contacts.map(({ id, profile_id, ...rest }) => rest);

  const hasChanges = useMemo(() => {
    const profileChanged = JSON.stringify(profile) !== JSON.stringify(originalProfile);
    const contactsChanged =
      JSON.stringify(normalizeContacts(emergencyContacts)) !==
      JSON.stringify(normalizeContacts(originalEmergencyContacts));
    return profileChanged || contactsChanged;
  }, [profile, originalProfile, emergencyContacts, originalEmergencyContacts]);

  const fetchProfile = async () => {
    try {
      if (!user?.id) throw new Error('No user ID found');

      const [profileRes, contactsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            email,
            phone,
            department_id,
            position_id,
            employment_status,
            hire_date,
            profile_image_url,
            avatar_url,
            image_path,
            departments:profiles_department_id_fkey ( name ),
            positions:profiles_position_id_fkey ( title )
          `)
          .eq('id', user.id)
          .single(),
        supabase
          .from('emergency_contacts')
          .select(`
            id,
            profile_id,
            contact_name,
            contact_phone,
            relationship,
            is_primary
          `)
          .eq('profile_id', user.id)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (contactsRes.error) throw contactsRes.error;

      const profileData: Profile = {
        ...initialProfile,
        ...profileRes.data,
        departments: profileRes.data?.departments || { name: '' },
        positions: profileRes.data?.positions || { title: '' },
      };

      const contactsData: EmergencyContact[] =
        contactsRes.data && contactsRes.data.length > 0
          ? contactsRes.data.map((contact: any) => ({
              id: contact.id,
              profile_id: contact.profile_id,
              contact_name: contact.contact_name || '',
              contact_phone: contact.contact_phone || '',
              relationship: contact.relationship || '',
              is_primary: !!contact.is_primary,
            }))
          : [{ ...createEmptyContact(), is_primary: true }];

      setProfile(profileData);
      setOriginalProfile(profileData);
      setEmergencyContacts(contactsData);
      setOriginalEmergencyContacts(contactsData);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!canEditProfileField(name as keyof Profile)) return;
    setProfile((prev) => ({ ...prev, [name]: value }));
    setSuccess(null);
    setError(null);
  };

  const handleEmergencyContactChange = (
    id: string,
    field: keyof Omit<EmergencyContact, 'id' | 'profile_id'>,
    value: string | boolean
  ) => {
    setEmergencyContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact))
    );
    setSuccess(null);
    setError(null);
  };

  const addEmergencyContact = () => {
    setEmergencyContacts((prev) => [...prev, createEmptyContact()]);
    setSuccess(null);
    setError(null);
  };

  const removeEmergencyContact = (id: string) => {
    setEmergencyContacts((prev) => {
      const next = prev.filter((contact) => contact.id !== id);
      if (next.length === 0) return [{ ...createEmptyContact(), is_primary: true }];
      if (!next.some((contact) => contact.is_primary)) next[0] = { ...next[0], is_primary: true };
      return next;
    });
    setSuccess(null);
    setError(null);
  };

  const setPrimaryContact = (id: string) => {
    setEmergencyContacts((prev) =>
      prev.map((contact) => ({ ...contact, is_primary: contact.id === id }))
    );
    setSuccess(null);
    setError(null);
  };

  const openPasswordModal = () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) return;
    setShowPasswordModal(false);
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      setChangingPassword(true);
      const { error: passwordUpdateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (passwordUpdateError) throw passwordUpdateError;

      setPasswordSuccess('Password changed successfully');
      setPasswordForm({ newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 1000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
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

      const updatedProfile = {
        ...profile,
        profile_image_url: result.url,
        avatar_url: result.url,
        image_path: result.path,
      };

      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
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

      const updatedProfile = {
        ...profile,
        profile_image_url: null,
        avatar_url: null,
        image_path: null,
      };

      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
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

      const updatedProfile = {
        ...profile,
        profile_image_url: null,
        avatar_url: null,
        image_path: null,
      };

      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
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

  const validateContacts = () => {
    for (const contact of emergencyContacts) {
      const hasAnyValue =
        contact.contact_name.trim() ||
        contact.contact_phone.trim() ||
        (contact.relationship || '').trim();

      if (!hasAnyValue) continue;

      if (!contact.contact_name.trim()) {
        setError('Emergency contact name is required');
        return false;
      }

      if (!contact.contact_phone.trim()) {
        setError('Emergency contact phone is required');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !hasChanges) return;
    if (!validateContacts()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          phone: profile.phone,
          department_id: profile.department_id,
          position_id: profile.position_id,
          hire_date: profile.hire_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileUpdateError) throw profileUpdateError;

      const validContacts = emergencyContacts.filter(
        (contact) =>
          contact.contact_name.trim() ||
          contact.contact_phone.trim() ||
          (contact.relationship || '').trim()
      );

      const contactsToSave = validContacts.map((contact, index) => ({
        id: contact.id,
        profile_id: user.id,
        contact_name: contact.contact_name.trim(),
        contact_phone: contact.contact_phone.trim(),
        relationship: (contact.relationship || '').trim() || null,
        is_primary: validContacts.some((c) => c.is_primary) ? contact.is_primary : index === 0,
      }));

      const originalIds = originalEmergencyContacts
        .filter((contact) => contact.profile_id)
        .map((contact) => contact.id);

      const currentIds = contactsToSave.map((contact) => contact.id);
      const idsToDelete = originalIds.filter((id) => !currentIds.includes(id));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('emergency_contacts')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) throw deleteError;
      }

      if (contactsToSave.length > 0) {
        const { error: upsertError } = await supabase
          .from('emergency_contacts')
          .upsert(contactsToSave, {
            onConflict: 'id',
          });

        if (upsertError) throw upsertError;
      }

      if (contactsToSave.length === 0 && originalIds.length > 0) {
        const { error: deleteAllError } = await supabase
          .from('emergency_contacts')
          .delete()
          .eq('profile_id', user.id);

        if (deleteAllError) throw deleteAllError;
      }

      const refreshedContacts =
        contactsToSave.length > 0
          ? contactsToSave.map((contact) => ({
              id: contact.id,
              profile_id: contact.profile_id,
              contact_name: contact.contact_name,
              contact_phone: contact.contact_phone,
              relationship: contact.relationship,
              is_primary: contact.is_primary,
            }))
          : [{ ...createEmptyContact(), is_primary: true }];

      setOriginalProfile(profile);
      setEmergencyContacts(refreshedContacts);
      setOriginalEmergencyContacts(refreshedContacts);
      setSuccess('Profile updated successfully');
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
    const isEditable = canEditProfileField(name);

    return (
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
            {icon}
          </div>
          <input
            type={type}
            name={name}
            value={(profile[name] as string) || ''}
            onChange={handleProfileChange}
            required={required}
            disabled={!isEditable}
            className={`w-full rounded-xl border py-3 pl-10 pr-4 transition ${
              isEditable
                ? 'border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                : 'border-gray-200 bg-gray-50 text-gray-700'
            }`}
          />
        </div>
      </div>
    );
  };

  const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              onClick={() => navigate('/')}
              className="mb-3 inline-flex items-center text-sm font-medium text-gray-600 transition hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your personal information, account security, and emergency contacts.
            </p>
          </div>

          {!isAdmin && (
            <div className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              <Lock className="mr-2 h-4 w-4" />
              Limited Access Mode
            </div>
          )}
        </div>

        {(error || success) && (
          <div
            className={`mb-6 rounded-2xl border p-4 ${
              error ? 'border-red-100 bg-red-50' : 'border-green-100 bg-green-50'
            }`}
          >
            <div className="flex items-start">
              {error ? (
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
              )}
              <p className={`ml-3 text-sm font-medium ${error ? 'text-red-700' : 'text-green-700'}`}>
                {error || success}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Update your profile details and emergency contacts.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8 p-6">
                <div className="flex flex-col items-center rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-8 text-center">
                  <div className="relative">
                    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg">
                      {profile.profile_image_url || profile.avatar_url ? (
                        <OptimizedImage
                          src={profile.profile_image_url || profile.avatar_url || ''}
                          alt="Profile"
                          width={128}
                          height={128}
                          className="h-full w-full object-cover"
                          transformation={[{ crop: 'maintain_ratio', focus: 'face' }]}
                          onError={() => setError('Failed to load profile image')}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-blue-100 text-2xl font-bold text-blue-600">
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
                      className="absolute bottom-0 right-0 rounded-full bg-blue-600 p-2 text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <h3 className="mt-4 text-xl font-semibold text-gray-900">
                    {fullName || 'Your Name'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{profile.email || 'No email available'}</p>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowImageModal(true)}
                      disabled={uploadingImage}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      Change Photo
                    </button>

                    {(profile.profile_image_url || profile.avatar_url) && (
                      <button
                        type="button"
                        onClick={handleRemoveClick}
                        disabled={uploadingImage}
                        className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <section>
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Basic Information</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {renderField('First Name', 'first_name', 'text', <User className="h-5 w-5" />)}
                    {renderField('Last Name', 'last_name', 'text', <User className="h-5 w-5" />)}
                    {renderField('Email', 'email', 'email', <Mail className="h-5 w-5" />)}
                    {renderField('Phone Number', 'phone', 'tel', <Phone className="h-5 w-5" />)}
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Employment Details</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Department</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <input
                          type="text"
                          value={profile.departments?.name || ''}
                          disabled
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Position</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <input
                          type="text"
                          value={profile.positions?.title || ''}
                          disabled
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <input
                          type="date"
                          value={profile.hire_date || ''}
                          disabled
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Emergency Contacts</h3>
                      <p className="text-sm text-gray-500">Add one or more emergency contacts</p>
                    </div>

                    <button
                      type="button"
                      onClick={addEmergencyContact}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Contact
                    </button>
                  </div>

                  <div className="space-y-4">
                    {emergencyContacts.map((contact, index) => (
                      <div
                        key={contact.id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                              {index + 1}
                            </div>
                            <h4 className="font-medium text-gray-900">Emergency Contact {index + 1}</h4>
                            {contact.is_primary && (
                              <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                Primary
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setPrimaryContact(contact.id)}
                              className={`text-sm font-medium ${
                                contact.is_primary
                                  ? 'text-green-700'
                                  : 'text-blue-600 hover:text-blue-700'
                              }`}
                            >
                              {contact.is_primary ? 'Primary Contact' : 'Set as Primary'}
                            </button>

                            <button
                              type="button"
                              onClick={() => removeEmergencyContact(contact.id)}
                              className="inline-flex items-center gap-2 text-red-600 transition hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              Contact Name
                            </label>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                <User className="h-5 w-5" />
                              </div>
                              <input
                                type="text"
                                value={contact.contact_name}
                                onChange={(e) =>
                                  handleEmergencyContactChange(contact.id, 'contact_name', e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              Contact Phone
                            </label>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                <Phone className="h-5 w-5" />
                              </div>
                              <input
                                type="tel"
                                value={contact.contact_phone}
                                onChange={(e) =>
                                  handleEmergencyContactChange(contact.id, 'contact_phone', e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              Relationship
                            </label>
                            <div className="relative">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                                <Heart className="h-5 w-5" />
                              </div>
                              <input
                                type="text"
                                list={`relationship-options-${contact.id}`}
                                value={contact.relationship || ''}
                                onChange={(e) =>
                                  handleEmergencyContactChange(contact.id, 'relationship', e.target.value)
                                }
                                placeholder="Select or type relationship"
                                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                              />
                              <datalist id={`relationship-options-${contact.id}`}>
                                {relationshipOptions.map((option) => (
                                  <option key={option} value={option} />
                                ))}
                              </datalist>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={openPasswordModal}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-gray-700 transition hover:bg-gray-50"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Change Password
                  </button>

                  <button
                    type="submit"
                    disabled={saving || !hasChanges}
                    className={`inline-flex items-center justify-center rounded-xl px-5 py-3 font-medium text-white transition ${
                      hasChanges
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'cursor-not-allowed bg-gray-400'
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-5 w-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Update Profile Photo</h3>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setUploadingImage(false);
                }}
                className="text-gray-400 transition hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ImageUploader
              onSuccess={handleImageUploadSuccess}
              onError={handleImageUploadError}
              maxSize={5}
            />

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setUploadingImage(false);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <button onClick={closePasswordModal} className="text-gray-400 transition hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {(passwordError || passwordSuccess) && (
                <div
                  className={`rounded-xl border p-4 ${
                    passwordError ? 'border-red-100 bg-red-50' : 'border-green-100 bg-green-50'
                  }`}
                >
                  <div className="flex items-start">
                    {passwordError ? (
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    )}
                    <p
                      className={`ml-3 text-sm font-medium ${
                        passwordError ? 'text-red-700' : 'text-green-700'
                      }`}
                    >
                      {passwordError || passwordSuccess}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordInputChange}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-white transition hover:bg-black disabled:opacity-50"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      Save Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
