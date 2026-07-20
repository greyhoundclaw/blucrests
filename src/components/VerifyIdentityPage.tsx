import React, { useState, useRef } from 'react';
import { ShieldCheck, Upload, FileText, CheckCircle, Clock, AlertTriangle, CloudIcon } from 'lucide-react';
import { getTranslation, LanguageCode } from '../lib/translations';

interface VerifyIdentityPageProps {
  user: any;
  onKycSubmitted: (newKycStatus: string) => void;
  lang?: LanguageCode;
}

export default function VerifyIdentityPage({ user, onKycSubmitted, lang = 'en' }: VerifyIdentityPageProps) {
  const [docNumber, setDocNumber] = useState(user.government_id_number || user.kycDocumentId || '');
  const [frontImage, setFrontImage] = useState<string | null>(user.kycFrontImage || null);
  const [backImage, setBackImage] = useState<string | null>(user.kycBackImage || null);
  
  const [dragActiveFront, setDragActiveFront] = useState(false);
  const [dragActiveBack, setDragActiveBack] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string, fallback: string = "") => getTranslation(lang, key, fallback);

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent, type: 'front' | 'back') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      if (type === 'front') setDragActiveFront(true);
      else setDragActiveBack(true);
    } else if (e.type === "dragleave") {
      if (type === 'front') setDragActiveFront(false);
      else setDragActiveBack(false);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'front' | 'back') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'front') setDragActiveFront(false);
    else setDragActiveBack(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      previewFile(file, type);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      previewFile(file, type);
    }
  };

  const previewFile = (file: File, type: 'front' | 'back') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'front') {
        setFrontImage(reader.result as string);
      } else {
        setBackImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const normalizedSsn = docNumber.trim();

    if (!normalizedSsn) {
      setErrorMsg('Please enter your SSN.');
      return;
    }

    if (!frontImage || !backImage) {
      setErrorMsg('Please upload both Front and Back images of your document.');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/users/kyc', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          government_id_number: normalizedSsn,
          id_front_image: frontImage,
          id_back_image: backImage
        })
      });

      setIsLoading(false);
      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error?.message || data.error || 'Identity verification submission failed.');
        return;
      }

      setSuccessMsg('Your identity verification documents have been submitted successfully! Status has been updated to PENDING.');
      onKycSubmitted('PENDING');
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Could not connect to the verification servers.');
    }
  };

  const renderStatusAlert = () => {
    const status = (user.kycStatus || user.kyc_status || '').toUpperCase();
    switch (status) {
      case 'VERIFIED':
        return (
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 mb-8 flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0 mt-1" />
            <div>
              <h4 className="text-emerald-950 font-bold text-lg mb-1">Identity Verified (Level 3)</h4>
              <p className="text-emerald-700 text-sm font-medium">Your profile has been fully authorized under regulatory compliance. Your daily transfer limits are active and loans can be processed instantly.</p>
            </div>
          </div>
        );
      case 'PENDING':
        return (
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 mb-8 flex items-start gap-4">
            <Clock className="w-8 h-8 text-slate-500 shrink-0 mt-1 animate-pulse" />
            <div>
              <h4 className="text-slate-800 font-bold text-lg mb-1">Verification Review In Progress</h4>
              <p className="text-slate-500 text-sm font-medium">Your documents are under review by our compliance team. Verification is typically completed within 15-30 minutes. You can apply for test loans once verified.</p>
            </div>
          </div>
        );
      case 'REJECTED':
        return (
          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0 mt-1" />
            <div>
              <h4 className="text-rose-950 font-bold text-lg mb-1">Identity Verification Failed</h4>
              <p className="text-rose-700 text-sm font-medium">Our system could not verify the documents loaded. Please ensure the photos are clearly legible and the government ID matches your profile registration.</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-8 flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0 mt-1" />
            <div>
              <h4 className="text-amber-950 font-bold text-lg mb-1">Verification Required Before Loans</h4>
              <p className="text-amber-700 text-sm font-medium">To protect your funds and comply with financial licensing terms, please verify your identity with a valid Government ID.</p>
            </div>
          </div>
        );
    }
  };

  const currentKycStatus = (user.kycStatus || user.kyc_status || 'NOT_SUBMITTED').toUpperCase();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-50">
        
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#003399]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('verifyIdentity', 'Verify Identity')}</h2>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{t('kycStatusLabel', 'KYC Verification Status')}: <span className="font-bold underline text-[#003399]">{currentKycStatus}</span></p>
          </div>
        </div>

        {renderStatusAlert()}

        {successMsg && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 text-xs font-bold p-4 rounded-2xl border border-emerald-100 text-center">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 bg-rose-50 text-rose-600 text-xs font-bold p-4 rounded-2xl border border-rose-100 text-center">
            {errorMsg}
          </div>
        )}

        {currentKycStatus !== 'VERIFIED' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* SSN Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                SSN
              </label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="XXX-XX-XXXX"
                  autoComplete="off"
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 text-sm font-semibold focus:bg-white focus:border-blue-200 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Document Side Uploaders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Front Side */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                  Front Image Cover
                </label>
                
                <div 
                  onDragEnter={(e) => handleDrag(e, 'front')}
                  onDragLeave={(e) => handleDrag(e, 'front')}
                  onDragOver={(e) => handleDrag(e, 'front')}
                  onDrop={(e) => handleDrop(e, 'front')}
                  onClick={() => frontInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all h-56 flex flex-col items-center justify-center relative overflow-hidden ${
                    dragActiveFront ? 'border-[#003399] bg-blue-50/20' : 'border-slate-200 hover:border-[#003399]/40 bg-slate-50/50'
                  }`}
                >
                  {frontImage ? (
                    <>
                      <img src={frontImage} alt="Front ID Preview" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold bg-[#003399] px-4 py-2 rounded-xl">Replace Photo</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-100 text-slate-400 mb-4 shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-xs text-slate-600 mb-1">Drag and drop file here, or click to upload</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                  <input 
                    ref={frontInputRef}
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleChange(e, 'front')}
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Back Side */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                  Back Image Cover
                </label>

                <div 
                  onDragEnter={(e) => handleDrag(e, 'back')}
                  onDragLeave={(e) => handleDrag(e, 'back')}
                  onDragOver={(e) => handleDrag(e, 'back')}
                  onDrop={(e) => handleDrop(e, 'back')}
                  onClick={() => backInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all h-56 flex flex-col items-center justify-center relative overflow-hidden ${
                    dragActiveBack ? 'border-[#003399] bg-blue-50/20' : 'border-slate-200 hover:border-[#003399]/40 bg-slate-50/50'
                  }`}
                >
                  {backImage ? (
                    <>
                      <img src={backImage} alt="Back ID Preview" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-bold bg-[#003399] px-4 py-2 rounded-xl">Replace Photo</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-100 text-slate-400 mb-4 shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-xs text-slate-600 mb-1">Drag and drop file here, or click to upload</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                  <input 
                    ref={backInputRef}
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleChange(e, 'back')}
                    className="hidden" 
                  />
                </div>
              </div>

            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[#003399] text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 active:scale-[0.98] disabled:opacity-70 mt-6"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Submit Identification'
              )}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
