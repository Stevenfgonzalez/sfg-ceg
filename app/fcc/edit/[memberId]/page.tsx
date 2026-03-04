'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface CriticalFlag { flag: string; type: string }
interface Medication { name: string; dose: string; freq: string; last_dose: string }
interface Equipment { item: string; location: string }

interface Clinical {
  critical_flags: CriticalFlag[];
  medications: Medication[];
  history: string[];
  mobility_status: string | null;
  lift_method: string | null;
  precautions: string | null;
  pain_notes: string | null;
  stair_chair_needed: boolean;
  equipment: Equipment[];
  life_needs: string[];
}

interface Member {
  id: string;
  full_name: string;
  date_of_birth: string;
  photo_url: string | null;
  baseline_mental: string | null;
  primary_language: string;
  code_status: string;
  directive_location: string | null;
  fcc_member_clinical?: Clinical[];
}

const FLAG_TYPES = ['allergy', 'med', 'equipment', 'safety'] as const;

function resizeImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function FCCMemberEditPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Photo state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Member base fields
  const [full_name, setFullName] = useState('');
  const [date_of_birth, setDob] = useState('');
  const [baseline_mental, setBaseline] = useState('');
  const [primary_language, setLanguage] = useState('English');
  const [code_status, setCodeStatus] = useState('full_code');
  const [directive_location, setDirective] = useState('');

  // Clinical fields
  const [critical_flags, setFlags] = useState<CriticalFlag[]>([]);
  const [medications, setMeds] = useState<Medication[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [mobility_status, setMobilityStatus] = useState('');
  const [lift_method, setLiftMethod] = useState('');
  const [precautions, setPrecautions] = useState('');
  const [pain_notes, setPainNotes] = useState('');
  const [stair_chair_needed, setStairChair] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [life_needs, setLifeNeeds] = useState<string[]>([]);

  // Add-item form states
  const [newFlag, setNewFlag] = useState({ flag: '', type: 'allergy' });
  const [newMed, setNewMed] = useState({ name: '', dose: '', freq: '', last_dose: '' });
  const [newHistory, setNewHistory] = useState('');
  const [newEquip, setNewEquip] = useState({ item: '', location: '' });
  const [newNeed, setNewNeed] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/fcc/members/${memberId}`);
        const data = await res.json();
        if (!res.ok || !data.member) {
          setError('Member not found');
          setLoading(false);
          return;
        }
        const m: Member = data.member;
        setPhotoUrl(m.photo_url || null);
        setFullName(m.full_name);
        setDob(m.date_of_birth);
        setBaseline(m.baseline_mental || '');
        setLanguage(m.primary_language);
        setCodeStatus(m.code_status);
        setDirective(m.directive_location || '');

        const c = m.fcc_member_clinical?.[0];
        if (c) {
          setFlags(c.critical_flags || []);
          setMeds(c.medications || []);
          setHistory(c.history || []);
          setMobilityStatus(c.mobility_status || '');
          setLiftMethod(c.lift_method || '');
          setPrecautions(c.precautions || '');
          setPainNotes(c.pain_notes || '');
          setStairChair(c.stair_chair_needed || false);
          setEquipment(c.equipment || []);
          setLifeNeeds(c.life_needs || []);
        }
      } catch {
        setError('Failed to load member');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [memberId]);

  async function saveAll() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Save base fields and clinical in parallel
      const [baseRes, clinRes] = await Promise.all([
        fetch(`/api/fcc/members/${memberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name, date_of_birth, baseline_mental: baseline_mental || null,
            primary_language, code_status, directive_location: directive_location || null,
          }),
        }),
        fetch(`/api/fcc/members/${memberId}/clinical`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            critical_flags, medications, history,
            mobility_status: mobility_status || null,
            lift_method: lift_method || null,
            precautions: precautions || null,
            pain_notes: pain_notes || null,
            stair_chair_needed,
            equipment, life_needs,
          }),
        }),
      ]);

      const baseData = await baseRes.json();
      const clinData = await clinRes.json();

      if (!baseRes.ok) throw new Error(baseData.error || 'Failed to save member');
      if (!clinRes.ok) throw new Error(clinData.error || 'Failed to save clinical data');

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const resized = await resizeImage(file, 400, 0.85);
      const photoFile = new File([resized], 'photo.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('photo', photoFile);
      const res = await fetch(`/api/fcc/members/${memberId}/photo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setPhotoUrl(data.photo_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setPhotoUploading(false);
    }
  }

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setShowCamera(true);
      // Wait for video element to mount, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setError('Camera access denied. Check browser permissions.');
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    closeCamera();
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setPhotoUploading(true);
      setError(null);
      try {
        // Camera already constrained to 640x640 — upload directly, skip resize
        const photoFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('photo', photoFile);
        const res = await fetch(`/api/fcc/members/${memberId}/photo`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setPhotoUrl(data.photo_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Photo upload failed');
      } finally {
        setPhotoUploading(false);
      }
    }, 'image/jpeg', 0.85);
  }, [closeCamera, memberId]);

  async function handlePhotoRemove() {
    setPhotoUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fcc/members/${memberId}/photo`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Remove failed');
      }
      setPhotoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo remove failed');
    } finally {
      setPhotoUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error && !full_name) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/fcc/edit" aria-label="Back to profiles" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">Member Not Found</h1>
        </header>
        <div className="px-4 pt-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <a href="/fcc/edit" className="inline-block mt-4 text-sm text-blue-400">Back to profiles</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-white font-bold text-sm">Take Photo</p>
            <button onClick={closeCamera} className="text-white text-sm font-semibold bg-slate-800 rounded-lg px-3 py-1.5">Cancel</button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-contain" />
          </div>
          <div className="p-4 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-slate-400 active:bg-slate-200 transition-colors"
              aria-label="Capture photo"
            />
          </div>
        </div>
      )}

      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/fcc/edit" aria-label="Back to profiles" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold flex-1">{full_name}</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 text-xs">×</button>
          </div>
        )}

        {/* 1. Identification */}
        <Section title="Identification">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-24 h-24 rounded-xl bg-slate-700 border border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-slate-500">👤</span>
              )}
              {photoUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-input"
                disabled={photoUploading}
              />
              <button
                onClick={openCamera}
                disabled={photoUploading}
                className="block w-full bg-amber-600 rounded-lg px-3 py-1.5 text-xs font-bold text-black text-center active:bg-amber-700 disabled:opacity-50"
              >
                Take Photo
              </button>
              <label
                htmlFor="photo-input"
                className="block bg-blue-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-center cursor-pointer active:bg-blue-700"
              >
                {photoUrl ? 'Choose from Gallery' : 'Upload Photo'}
              </label>
              {photoUrl && (
                <button
                  onClick={handlePhotoRemove}
                  disabled={photoUploading}
                  className="block w-full bg-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400 active:bg-slate-600 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <p className="text-[10px] text-slate-500">JPEG/PNG, max 2MB</p>
            </div>
          </div>
          <Input label="Full Name" value={full_name} onChange={setFullName} />
          <Input label="Date of Birth" value={date_of_birth} onChange={setDob} type="date" />
          <Input label="Baseline Mental Status" value={baseline_mental} onChange={setBaseline} placeholder="e.g. A&O x4, mild hearing loss" />
          <Input label="Primary Language" value={primary_language} onChange={setLanguage} />
          <div className="py-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block mb-1">Code Status</label>
            <select value={code_status} onChange={(e) => setCodeStatus(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm">
              <option value="full_code">Full Code</option>
              <option value="dnr">DNR</option>
              <option value="dnr_polst">DNR/POLST</option>
            </select>
          </div>
          <Input label="Directive Location" value={directive_location} onChange={setDirective} placeholder="e.g. Filed with Dr. Smith" />
        </Section>

        {/* 2. Critical Flags */}
        <Section title="Critical Flags">
          {critical_flags.map((f, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
              <div>
                <span className="text-sm">{f.flag}</span>
                <span className="ml-2 text-[10px] text-slate-400 capitalize bg-slate-700 px-1.5 py-0.5 rounded">{f.type}</span>
              </div>
              <button onClick={() => setFlags(critical_flags.filter((_, j) => j !== i))} className="text-red-400 text-xs ml-2">×</button>
            </div>
          ))}
          <div className="mt-2 space-y-2 border-t border-slate-700 pt-2">
            <input
              value={newFlag.flag}
              onChange={(e) => setNewFlag({ ...newFlag, flag: e.target.value })}
              placeholder="New flag description"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <select value={newFlag.type} onChange={(e) => setNewFlag({ ...newFlag, type: e.target.value })} className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-xs">
                {FLAG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => { if (newFlag.flag.trim()) { setFlags([...critical_flags, { flag: newFlag.flag.trim(), type: newFlag.type }]); setNewFlag({ flag: '', type: 'allergy' }); } }}
                className="bg-blue-600 rounded-lg px-3 py-2 text-xs font-semibold active:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </Section>

        {/* 3. Medications */}
        <Section title="Medications">
          {medications.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
              <div>
                <p className="text-sm font-semibold">{m.name} — {m.dose}</p>
                <p className="text-xs text-slate-400">{m.freq}{m.last_dose ? ` · Last: ${m.last_dose}` : ''}</p>
              </div>
              <button onClick={() => setMeds(medications.filter((_, j) => j !== i))} className="text-red-400 text-xs ml-2">×</button>
            </div>
          ))}
          <div className="mt-2 space-y-2 border-t border-slate-700 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="Drug name" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
              <input value={newMed.dose} onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })} placeholder="Dose (e.g. 5mg)" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
            <div className="flex gap-2">
              <input value={newMed.freq} onChange={(e) => setNewMed({ ...newMed, freq: e.target.value })} placeholder="Freq (e.g. BID)" className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
              <input value={newMed.last_dose} onChange={(e) => setNewMed({ ...newMed, last_dose: e.target.value })} placeholder="Last dose" className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
              <button
                onClick={() => { if (newMed.name.trim()) { setMeds([...medications, { name: newMed.name.trim(), dose: newMed.dose.trim(), freq: newMed.freq.trim(), last_dose: newMed.last_dose.trim() }]); setNewMed({ name: '', dose: '', freq: '', last_dose: '' }); } }}
                className="bg-blue-600 rounded-lg px-3 py-2 text-xs font-semibold active:bg-blue-700 shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        </Section>

        {/* 4. Medical History */}
        <Section title="Medical History">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {history.map((h, i) => (
              <span key={i} className="bg-slate-700 px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1">
                {h}
                <button onClick={() => setHistory(history.filter((_, j) => j !== i))} className="text-red-400 text-[10px] ml-1">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 border-t border-slate-700 pt-2">
            <input value={newHistory} onChange={(e) => setNewHistory(e.target.value)} placeholder="e.g. CHF, COPD, T2DM" className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
            <button
              onClick={() => { if (newHistory.trim()) { setHistory([...history, newHistory.trim()]); setNewHistory(''); } }}
              className="bg-blue-600 rounded-lg px-3 py-2 text-xs font-semibold active:bg-blue-700"
            >
              Add
            </button>
          </div>
        </Section>

        {/* 5. Mobility & Movement */}
        <Section title="Mobility & Movement">
          <Input label="Status" value={mobility_status} onChange={setMobilityStatus} placeholder="e.g. Ambulatory w/ rolling walker" />
          <Input label="Lift Method" value={lift_method} onChange={setLiftMethod} placeholder="e.g. 1-person standby assist" />
          <Input label="Precautions" value={precautions} onChange={setPrecautions} placeholder="e.g. L hip — no internal rotation past 90°" />
          <Input label="Pain Notes" value={pain_notes} onChange={setPainNotes} placeholder="e.g. Chronic low back, managed" />
          <div className="py-1.5 flex items-center gap-3">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Stair Chair Needed</label>
            <button
              type="button"
              onClick={() => setStairChair(!stair_chair_needed)}
              className={`w-11 h-6 rounded-full transition-colors ${stair_chair_needed ? 'bg-green-600' : 'bg-slate-600'}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${stair_chair_needed ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </Section>

        {/* 6. Equipment */}
        <Section title="Equipment">
          {equipment.map((e, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
              <div>
                <p className="text-sm font-semibold">{e.item}</p>
                <p className="text-xs text-slate-400">{e.location}</p>
              </div>
              <button onClick={() => setEquipment(equipment.filter((_, j) => j !== i))} className="text-red-400 text-xs ml-2">×</button>
            </div>
          ))}
          <div className="mt-2 space-y-2 border-t border-slate-700 pt-2">
            <input value={newEquip.item} onChange={(e) => setNewEquip({ ...newEquip, item: e.target.value })} placeholder="Equipment name" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
            <div className="flex gap-2">
              <input value={newEquip.location} onChange={(e) => setNewEquip({ ...newEquip, location: e.target.value })} placeholder="Location in home" className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
              <button
                onClick={() => { if (newEquip.item.trim()) { setEquipment([...equipment, { item: newEquip.item.trim(), location: newEquip.location.trim() }]); setNewEquip({ item: '', location: '' }); } }}
                className="bg-blue-600 rounded-lg px-3 py-2 text-xs font-semibold active:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </Section>

        {/* 7. Life Needs */}
        <Section title="Life Needs">
          {life_needs.map((n, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
              <p className="text-sm">{n}</p>
              <button onClick={() => setLifeNeeds(life_needs.filter((_, j) => j !== i))} className="text-red-400 text-xs ml-2">×</button>
            </div>
          ))}
          <div className="flex gap-2 border-t border-slate-700 pt-2 mt-2">
            <input value={newNeed} onChange={(e) => setNewNeed(e.target.value)} placeholder="e.g. Hard of hearing R side" className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500" />
            <button
              onClick={() => { if (newNeed.trim()) { setLifeNeeds([...life_needs, newNeed.trim()]); setNewNeed(''); } }}
              className="bg-blue-600 rounded-lg px-3 py-2 text-xs font-semibold active:bg-blue-700"
            >
              Add
            </button>
          </div>
        </Section>

        {/* Save button */}
        <button
          onClick={saveAll}
          disabled={saving}
          className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-amber-600 text-black active:bg-amber-700'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </main>
  );
}

// ── Shared Components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">{title}</p>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="py-1.5">
      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}
