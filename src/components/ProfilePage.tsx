import React, { useState, useRef } from 'react';
import { User, Mail, Phone, Calendar, MapPin, Briefcase, Camera, Check, ShieldCheck, Heart, Globe, DollarSign, Lock } from 'lucide-react';
import { getTranslation, LanguageCode } from '../lib/translations';
import JointAccountsPanel from './JointAccountsPanel';

interface ProfilePageProps {
  currentUser: any;
  onProfileUpdated: () => void;
  lang?: LanguageCode;
}

export default function ProfilePage({ currentUser, onProfileUpdated, lang = 'en' }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editable fields
  const [firstName, setFirstName] = useState(currentUser.first_name || currentUser.firstName || '');
  const [lastName, setLastName] = useState(currentUser.last_name || currentUser.lastName || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [dob, setDob] = useState(currentUser.date_of_birth || currentUser.dob || '');
  const [gender, setGender] = useState(currentUser.gender || '');
  const [state, setState] = useState(currentUser.state || '');
  const [zipCode, setZipCode] = useState(currentUser.zip_code || '');
  const [maritalStatus, setMaritalStatus] = useState(currentUser.marital_status || '');
  const [occupation, setOccupation] = useState(currentUser.occupation || '');
  const [address, setAddress] = useState(currentUser.address || '');
  const [preferredCurrency, setPreferredCurrency] = useState(currentUser.preferred_currency || currentUser.preferredCurrency || 'USD');
  const [profileImage, setProfileImage] = useState(currentUser.profile_image || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = (key: string, fb: string = "") => getTranslation(lang, key, fb);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setProfileImage(base64String);
      
      // Auto-save image directly
      setIsLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/v1/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ profile_image: base64String })
        });
        setIsLoading(false);
        if (res.ok) {
          setSuccessMsg('Profile picture updated successfully.');
          onProfileUpdated();
        } else {
          setErrorMsg('Failed to upload profile picture.');
        }
      } catch (err) {
        setIsLoading(false);
        setErrorMsg('Network error uploading profile image.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          date_of_birth: dob,
          gender,
          state,
          zip_code: zipCode,
          marital_status: maritalStatus,
          occupation,
          address,
          preferred_currency: preferredCurrency
        })
      });

      setIsLoading(false);
      if (res.ok) {
        setSuccessMsg('Profile updated successfully!');
        setIsEditing(false);
        onProfileUpdated();
      } else {
        const data = await res.json();
        setErrorMsg(data.error?.message || data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Network error saving profile changes.');
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault(); setIsLoading(true); setErrorMsg(''); setSuccessMsg('');
    if (newPassword !== confirmPassword) { setIsLoading(false); return setErrorMsg('Passwords do not match.'); }
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Could not change password');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setSuccessMsg('Password changed successfully.');
    } catch (error: any) { setErrorMsg(error.message); } finally { setIsLoading(false); }
  };

  const initials = ((firstName?.charAt(0) || '') + (lastName?.charAt(0) || '')).toUpperCase() || 'U';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Top Banner Summary Card */}
      <div className="bg-[#003399] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-900/10 flex flex-col md:flex-row items-center gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
        
        {/* Profile Picture Upload Section */}
        <div className="relative group shrink-0 select-none">
          <div className="w-24 h-24 rounded-full border-4 border-white/20 bg-blue-900 overflow-hidden flex items-center justify-center font-bold text-2xl shadow-lg relative">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer"
          >
            <Camera className="w-5 h-5 text-white animate-pulse" />
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Change</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="text-center md:text-left flex-1 space-y-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h2 className="text-2xl font-bold">{firstName} {lastName}</h2>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/20 uppercase tracking-widest self-center">
              {currentUser.role || 'USER'}
            </span>
          </div>
          <p className="text-blue-200/80 text-sm font-semibold select-none font-mono">#{currentUser.accountNumber || currentUser.account_number}</p>
          <p className="text-blue-100/60 text-xs flex items-center justify-center md:justify-start gap-1 font-medium">
            <Mail className="w-3.5 h-3.5" /> {currentUser.email}
          </p>
          <div className="pt-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
              Number(currentUser.email_verified) === 1
                ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-200'
                : 'border-amber-400/30 bg-amber-500/20 text-amber-200'
            }`}>
              {Number(currentUser.email_verified) === 1 ? <Check className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
              Email {Number(currentUser.email_verified) === 1 ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
          <span className="text-xs text-blue-200/80 font-bold uppercase tracking-wider">KYC CLEARANCE STATUS</span>
          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border ${
            currentUser.kycStatus === 'VERIFIED' || currentUser.kyc_status === 'VERIFIED'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : currentUser.kycStatus === 'PENDING' || currentUser.kyc_status === 'PENDING'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-white/10 text-white/70 border-white/10'
          }`}>
            {currentUser.kycStatus || currentUser.kyc_status || 'NOT SUBMITTED'}
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-4 rounded-2xl border border-emerald-100 text-center flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 text-rose-600 text-xs font-bold p-4 rounded-2xl border border-rose-100 text-center">
          {errorMsg}
        </div>
      )}

      {/* Profile Details Block */}
      <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-50 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#003399]" />
            Personal Clearance Profile
          </h3>
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              isEditing 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-[#003399] text-white hover:bg-blue-800 shadow-md shadow-blue-900/10'
            }`}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">First Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Last Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2831"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Marital Status</label>
                <div className="relative">
                  <Heart className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  >
                    <option value="">Select Marital Status</option>
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Occupation</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">State / Region</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. California"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Zip Code</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="e.g. 94108"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Preferred Currency</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <select
                    value={preferredCurrency}
                    onChange={(e) => setPreferredCurrency(e.target.value)}
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Residential Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 582 Market St, San Francisco, CA"
                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-3 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 text-xs font-bold rounded-xl bg-[#003399] text-white hover:bg-blue-800 transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-2"
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {[
              { label: 'Full Name', value: `${firstName} ${lastName}`, icon: <User className="w-4 h-4 text-slate-400" /> },
              { label: 'Account Number', value: currentUser.accountNumber || currentUser.account_number, icon: <ShieldCheck className="w-4 h-4 text-slate-400" /> },
              { label: 'Phone Number', value: phone || 'Not provided', icon: <Phone className="w-4 h-4 text-slate-400" /> },
              { label: 'Date of Birth', value: dob || 'Not provided', icon: <Calendar className="w-4 h-4 text-slate-400" /> },
              { label: 'Gender', value: gender ? gender.replace('_', ' ') : 'Not provided', icon: <User className="w-4 h-4 text-slate-400" /> },
              { label: 'Marital Status', value: maritalStatus ? maritalStatus.replace('_', ' ') : 'Not provided', icon: <Heart className="w-4 h-4 text-slate-400" /> },
              { label: 'Occupation', value: occupation || 'Not provided', icon: <Briefcase className="w-4 h-4 text-slate-400" /> },
              { label: 'Residential Address', value: address || 'Not provided', icon: <MapPin className="w-4 h-4 text-slate-400" /> },
              { label: 'State / Region', value: state || 'Not provided', icon: <Globe className="w-4 h-4 text-slate-400" /> },
              { label: 'Zip Code', value: zipCode || 'Not provided', icon: <MapPin className="w-4 h-4 text-slate-400" /> },
              { label: 'Preferred Currency', value: preferredCurrency, icon: <DollarSign className="w-4 h-4 text-slate-400" /> },
            ].map((field, idx) => (
              <div key={idx} className="flex items-start gap-3.5 py-1">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {field.icon}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{field.label}</span>
                  <span className="text-xs font-semibold text-slate-700 mt-1 block leading-normal">{field.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <JointAccountsPanel currentUser={currentUser} onBalancesChanged={onProfileUpdated} />

      <form onSubmit={handlePasswordChange} className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-50 space-y-5">
        <div><h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2"><Lock className="w-5 h-5 text-[#003399]" /> Change password</h3><p className="text-xs text-slate-400 mt-1">Use at least eight characters and keep this password unique.</p></div>
        <div className="grid md:grid-cols-3 gap-3">
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="field-control" placeholder="Current password" required />
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="field-control" placeholder="New password" minLength={8} required />
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="field-control" placeholder="Confirm new password" minLength={8} required />
        </div>
        <button disabled={isLoading} className="px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold">{isLoading ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  );
}
