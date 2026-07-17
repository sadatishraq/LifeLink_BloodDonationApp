import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, User, Phone, Mail, MapPin, Calendar, Droplets,
  AlertCircle, ChevronRight, ArrowLeft, CheckCircle, Plus,
  Activity, RefreshCw, MessageCircle, X, Send, Loader2,
  Lock, Eye, EyeOff, LogIn, UserPlus, Shield,
  LayoutDashboard, Users, ClipboardList, Trash2, Ban, CircleCheck, ChevronDown, ChevronUp
} from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────────
const API = "https://khnbyexmdhqidpoimpal.supabase.co/functions/v1/make-server-fd15274a";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtobmJ5ZXhtZGhxaWRwb2ltcGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODcxMTcsImV4cCI6MjA5OTg2MzExN30.dN4CEzr6ZP4hZxrT-shxPW4h48q4WDEw7Efe7adM8LM";

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error ?? `Server error ${res.status}`;
    console.error(`[LifeLink API] ${options?.method ?? "GET"} ${path} → ${res.status}`, msg);
    throw new Error(msg);
  }
  return res.json();
}

// ── Blood compatibility ───────────────────────────────────────────────────
type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

const COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  "A+":  ["O-", "O+", "A-", "A+"],
  "A-":  ["O-", "A-"],
  "B+":  ["O-", "O+", "B-", "B+"],
  "B-":  ["O-", "B-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "O+":  ["O-", "O+"],
  "O-":  ["O-"],
};

function isCompatible(donorGroup: BloodGroup, recipientGroup: BloodGroup) {
  return COMPATIBLE_DONORS[recipientGroup]?.includes(donorGroup) ?? false;
}

// ── Types ─────────────────────────────────────────────────────────────────
type UserRole = "donor" | "taker";
type AppScreen = "landing" | "login" | "register" | "dashboard" | "admin-login" | "admin";

interface HistoryRecord {
  id: string;
  requestId: string;
  responseId: string;
  donorId: string;
  donorName: string;
  donorBloodGroup: BloodGroup;
  donorPhone: string;
  donorEmail: string;
  donorCity: string;
  takerId: string;
  takerName: string;
  bloodGroup: BloodGroup;
  hospital: string;
  city: string;
  unitsRequired: number;
  urgency: UrgencyLevel;
  notes: string;
  completedAt: string;
  requestCreatedAt: string;
  role: "donor" | "taker";
}
type Gender = "Male" | "Female" | "Other" | "Prefer not to say";
type UrgencyLevel = "Critical" | "High" | "Moderate" | "Low";

interface Profile {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  dob: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  altPhone?: string;
  email: string;
  address: string;
  city: string;
  state: string;
  lastDonationDate?: string;
  medicalConditions?: string;
  availableTodonate?: boolean;
  urgency?: UrgencyLevel;
  hospital?: string;
  unitsRequired?: number;
  reason?: string;
  createdAt: string;
}

interface BloodRequest {
  id: string;
  takerId: string;
  takerName: string;
  bloodGroup: BloodGroup;
  urgency: UrgencyLevel;
  hospital: string;
  city: string;
  unitsRequired: number;
  reason: string;
  status: "open" | "fulfilled" | "closed";
  responseCount: number;
  createdAt: string;
}

interface DonorResponse {
  id: string;
  requestId: string;
  donorId: string;
  donorName: string;
  donorBloodGroup: BloodGroup;
  donorPhone: string;
  donorEmail: string;
  donorCity: string;
  message: string;
  status: "pending" | "accepted";
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────
const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS: Gender[] = ["Male", "Female", "Other", "Prefer not to say"];
const URGENCY_LEVELS: UrgencyLevel[] = ["Critical", "High", "Moderate", "Low"];

const URGENCY_COLORS: Record<UrgencyLevel, { card: string; badge: string; dot: string }> = {
  Critical: { card: "border-red-200 bg-red-50",    badge: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-500"    },
  High:     { card: "border-orange-200 bg-orange-50", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  Moderate: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-100 text-amber-700 border-amber-200",   dot: "bg-amber-400"  },
  Low:      { card: "border-green-200 bg-green-50",  badge: "bg-green-100 text-green-700 border-green-200",   dot: "bg-green-500"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── UI Atoms ──────────────────────────────────────────────────────────────
function BloodDropIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 4 9.5 4 14a8 8 0 0016 0C20 9.5 12 2 12 2z" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`w-4 h-4 animate-spin ${className ?? ""}`} />;
}

function FormField({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-foreground">
        {label}{required && <span className="text-primary ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextInput({ type = "text", placeholder, value, onChange, icon, right }: {
  type?: string; placeholder?: string; value: string;
  onChange: (v: string) => void; icon?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full ${icon ? "pl-10" : "px-3.5"} ${right ? "pr-10" : "pr-3.5"} py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm`} />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm appearance-none cursor-pointer">
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BloodGroupSelector({ value, onChange }: { value: BloodGroup | ""; onChange: (v: BloodGroup) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {BLOOD_GROUPS.map(bg => (
        <button key={bg} type="button" onClick={() => onChange(bg)}
          className={`py-2.5 rounded-md text-sm font-bold border-2 transition-all ${value === bg ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
          {bg}
        </button>
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{message}
    </div>
  );
}

function PrimaryBtn({ children, onClick, loading, disabled, className }: {
  children: React.ReactNode; onClick?: () => void;
  loading?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={`w-full bg-primary text-primary-foreground py-3 rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60 ${className ?? ""}`}>
      {loading ? <Spinner /> : children}
    </button>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────
function LandingScreen({ onLogin, onRegister, onAdmin }: { onLogin: () => void; onRegister: () => void; onAdmin: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border flex items-center gap-3">
        <BloodDropIcon className="w-7 h-7 text-primary" />
        <span className="font-display text-xl font-bold text-foreground tracking-tight">LifeLink</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full text-center">
          <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground text-sm font-medium px-4 py-1.5 rounded-full mb-8 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Blood Needed Now — Join the Network
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-extrabold text-foreground leading-tight mb-6 tracking-tight">
            Every drop<br /><span className="text-primary">saves a life.</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-sm mx-auto">
            Connect blood donors with those in need — fast, secure, and life-saving.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
            <button onClick={onLogin}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-md font-semibold hover:bg-primary/90 transition-colors">
              <LogIn className="w-4 h-4" /> Log In
            </button>
            <button onClick={onRegister}
              className="flex-1 flex items-center justify-center gap-2 bg-card text-foreground border-2 border-border py-3.5 rounded-md font-semibold hover:border-primary/40 transition-colors">
              <UserPlus className="w-4 h-4" /> Create Account
            </button>
          </div>
          <button onClick={onAdmin}
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto">
            <Shield className="w-3 h-3" /> Admin Panel
          </button>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-xs w-full text-center">
          {[{ val: "18K+", label: "Donors" }, { val: "4.2K", label: "Lives Saved" }, { val: "142", label: "Cities" }].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-foreground font-display">{s.val}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────
function LoginScreen({ onBack, onSuccess, onGoRegister }: {
  onBack: () => void; onSuccess: (p: Profile) => void; onGoRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true); setError("");
    try {
      const { profile } = await api("/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      onSuccess(profile);
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.includes("No account found")) {
        setError("No account found with this email. Please create a new account — existing accounts registered before the latest update need to be re-created.");
      } else if (msg.includes("Incorrect password")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError(msg || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <BloodDropIcon className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-foreground">LifeLink</span>
        </div>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-accent border border-primary/20 flex items-center justify-center mb-6">
            <LogIn className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-8">Log in to see your dashboard and status.</p>

          {error && <div className="mb-2"><ErrorBox message={error} /></div>}

          <div className="flex flex-col gap-4">
            <FormField label="Email Address" required>
              <TextInput type="email" placeholder="you@example.com" value={email} onChange={setEmail}
                icon={<Mail className="w-4 h-4" />} />
            </FormField>

            <FormField label="Password" required>
              <TextInput type={showPw ? "text" : "password"} placeholder="Enter your password"
                value={password} onChange={setPassword}
                icon={<Lock className="w-4 h-4" />}
                right={
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                } />
            </FormField>

            <PrimaryBtn loading={loading} onClick={handleLogin}>
              <LogIn className="w-4 h-4" /> Log In
            </PrimaryBtn>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {"Don't have an account? "}
            <button onClick={onGoRegister} className="text-primary font-semibold hover:underline">Create one</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Register Screen ───────────────────────────────────────────────────────
function RegisterScreen({ onBack, onComplete, onGoLogin }: {
  onBack: () => void; onComplete: (p: Profile) => void; onGoLogin: () => void;
}) {
  const [roleChosen, setRoleChosen] = useState(false);
  const [role, setRole] = useState<UserRole>("donor");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isDonor = role === "donor";

  const [form, setForm] = useState({
    firstName: "", lastName: "", dob: "", gender: "" as Gender | "",
    bloodGroup: "" as BloodGroup | "",
    email: "", password: "", confirmPassword: "",
    phone: "", address: "", city: "", state: "",
    lastDonationDate: "", medicalConditions: "", availableTodonate: true,
    urgency: "Moderate" as UrgencyLevel, hospital: "", unitsRequired: "1", reason: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const set = (key: keyof typeof form) => (val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }));

  const totalSteps = 4; // role → personal → contact+auth → role-specific

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match."); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setSaving(true); setError("");
    try {
      const { profile } = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          role, email: form.email, password: form.password,
          firstName: form.firstName, lastName: form.lastName,
          dob: form.dob, gender: form.gender,
          bloodGroup: form.bloodGroup, phone: form.phone,
          address: form.address, city: form.city, state: form.state,
          lastDonationDate: form.lastDonationDate,
          medicalConditions: form.medicalConditions,
          availableTodonate: form.availableTodonate,
          urgency: form.urgency, hospital: form.hospital,
          unitsRequired: parseInt(form.unitsRequired) || 1,
          reason: form.reason,
        }),
      });

      if (!isDonor) {
        await api("/requests", {
          method: "POST",
          body: JSON.stringify({
            takerId: profile.id,
            takerName: `${form.firstName} ${form.lastName}`,
            bloodGroup: form.bloodGroup,
            urgency: form.urgency, hospital: form.hospital,
            city: form.city,
            unitsRequired: parseInt(form.unitsRequired) || 1,
            reason: form.reason,
          }),
        });
      }

      onComplete(profile);
    } catch (e: any) {
      setError(e.message ?? "Registration failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Role chooser
  if (!roleChosen) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-6 py-5 border-b border-border flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <BloodDropIcon className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-foreground">LifeLink</span>
          </div>
          <div className="w-12" />
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-accent border border-primary/20 flex items-center justify-center mb-6">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Create account</h1>
            <p className="text-muted-foreground text-sm mb-8">First, tell us how you want to use LifeLink.</p>

            <div className="flex flex-col gap-3">
              <button onClick={() => { setRole("donor"); setRoleChosen(true); setStep(1); }}
                className="group bg-primary text-primary-foreground rounded-lg p-5 text-left hover:bg-primary/90 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center"><Heart className="w-4 h-4" /></div>
                  <ChevronRight className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                </div>
                <h2 className="font-bold text-lg mb-0.5">I want to donate blood</h2>
                <p className="text-primary-foreground/70 text-sm">Register as a donor and respond to requests.</p>
              </button>

              <button onClick={() => { setRole("taker"); setRoleChosen(true); setStep(1); }}
                className="group bg-card text-foreground border-2 border-border rounded-lg p-5 text-left hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center"><Activity className="w-4 h-4 text-primary" /></div>
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-80" />
                </div>
                <h2 className="font-bold text-lg mb-0.5">I need blood</h2>
                <p className="text-muted-foreground text-sm">Post a request and get connected with donors.</p>
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <button onClick={onGoLogin} className="text-primary font-semibold hover:underline">Log in</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stepTitles = [
    "Personal Information",
    "Login Credentials",
    "Contact & Location",
    isDonor ? "Donor Details" : "Request Details",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border flex items-center justify-between">
        <button onClick={step === 1 ? () => setRoleChosen(false) : () => setStep(s => s - 1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />{step === 1 ? "Back" : "Previous"}
        </button>
        <div className="flex items-center gap-2">
          <BloodDropIcon className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-foreground">LifeLink</span>
        </div>
        <div className="text-sm text-muted-foreground font-medium">{step}/{totalSteps}</div>
      </header>

      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }} />
      </div>

      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-10">
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-4 ${isDonor ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border border-border"}`}>
          {isDonor ? <Heart className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
          {isDonor ? "Donor Registration" : "Blood Request Registration"}
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-1">{stepTitles[step - 1]}</h1>
        <p className="text-muted-foreground text-sm mb-8">Step {step} of {totalSteps}</p>

        {/* Step 1 — Personal */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name" required>
                <TextInput placeholder="Arjun" value={form.firstName} onChange={set("firstName")} />
              </FormField>
              <FormField label="Last Name" required>
                <TextInput placeholder="Mehta" value={form.lastName} onChange={set("lastName")} />
              </FormField>
            </div>
            <FormField label="Date of Birth" required hint={isDonor ? "Must be 18–65 years to donate." : undefined}>
              <TextInput type="date" value={form.dob} onChange={set("dob")} />
            </FormField>
            <FormField label="Gender" required>
              <Select value={form.gender} onChange={set("gender") as any} options={GENDERS} placeholder="Select gender" />
            </FormField>
            <FormField label="Blood Group" required>
              <BloodGroupSelector value={form.bloodGroup} onChange={set("bloodGroup") as any} />
            </FormField>
          </div>
        )}

        {/* Step 2 — Credentials */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="bg-secondary rounded-lg p-4 flex gap-3 mb-1">
              <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/70 leading-relaxed">
                You'll use this email and password to log back in and see your dashboard and status at any time.
              </p>
            </div>
            <FormField label="Email Address" required>
              <TextInput type="email" placeholder="you@example.com" value={form.email} onChange={set("email")}
                icon={<Mail className="w-4 h-4" />} />
            </FormField>
            <FormField label="Password" required hint="Minimum 6 characters.">
              <TextInput type={showPw ? "text" : "password"} placeholder="Create a password"
                value={form.password} onChange={set("password")}
                icon={<Lock className="w-4 h-4" />}
                right={
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                } />
            </FormField>
            <FormField label="Confirm Password" required>
              <TextInput type={showCpw ? "text" : "password"} placeholder="Repeat your password"
                value={form.confirmPassword} onChange={set("confirmPassword")}
                icon={<Lock className="w-4 h-4" />}
                right={
                  <button type="button" onClick={() => setShowCpw(p => !p)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    {showCpw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                } />
            </FormField>
          </div>
        )}

        {/* Step 3 — Contact */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <FormField label="Phone Number" required>
              <TextInput type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")}
                icon={<Phone className="w-4 h-4" />} />
            </FormField>
            <FormField label="Street Address" required>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <textarea placeholder="12B, Shivaji Nagar..." value={form.address}
                  onChange={e => set("address")(e.target.value)} rows={2}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm resize-none" />
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="City" required>
                <TextInput placeholder="Mumbai" value={form.city} onChange={set("city")} />
              </FormField>
              <FormField label="State" required>
                <TextInput placeholder="Maharashtra" value={form.state} onChange={set("state")} />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 4 — Donor specific */}
        {step === 4 && isDonor && (
          <div className="flex flex-col gap-5">
            <FormField label="Last Donation Date" hint="Leave blank if this is your first donation.">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="date" value={form.lastDonationDate}
                  onChange={e => set("lastDonationDate")(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm" />
              </div>
            </FormField>
            <FormField label="Medical Conditions" hint="Any conditions that may affect eligibility.">
              <textarea placeholder="e.g., None / Hypertension (controlled)..." value={form.medicalConditions}
                onChange={e => set("medicalConditions")(e.target.value)} rows={3}
                className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm resize-none" />
            </FormField>
            <FormField label="Currently Available to Donate?">
              <div className="flex gap-3">
                {[true, false].map(val => (
                  <button key={String(val)} type="button" onClick={() => set("availableTodonate")(val)}
                    className={`flex-1 py-2.5 rounded-md text-sm font-semibold border-2 transition-all ${form.availableTodonate === val ? (val ? "bg-primary text-primary-foreground border-primary" : "bg-foreground text-background border-foreground") : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                    {val ? "Yes, available" : "Not right now"}
                  </button>
                ))}
              </div>
            </FormField>
            <div className="bg-accent border border-primary/20 rounded-md p-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/70 leading-relaxed">
                By registering, you consent to be contacted when your blood group is urgently needed. Update availability anytime.
              </p>
            </div>
          </div>
        )}

        {/* Step 4 — Taker specific */}
        {step === 4 && !isDonor && (
          <div className="flex flex-col gap-5">
            <FormField label="Urgency Level" required>
              <div className="grid grid-cols-2 gap-2">
                {URGENCY_LEVELS.map(u => (
                  <button key={u} type="button" onClick={() => set("urgency")(u)}
                    className={`py-2.5 rounded-md text-sm font-semibold border-2 transition-all ${form.urgency === u ? URGENCY_COLORS[u].badge + " border-current" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Hospital / Location" required>
              <TextInput placeholder="Apollo Hospital, Andheri West" value={form.hospital} onChange={set("hospital")} />
            </FormField>
            <FormField label="Units Required" required hint="1 unit ≈ 450 ml of whole blood.">
              <div className="flex gap-2">
                {["1", "2", "3", "4", "5+"].map(u => (
                  <button key={u} type="button" onClick={() => set("unitsRequired")(u)}
                    className={`flex-1 py-2.5 rounded-md text-sm font-bold border-2 transition-all ${form.unitsRequired === u ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Reason / Medical Notes">
              <textarea placeholder="e.g., Post-surgery recovery, accident trauma..." value={form.reason}
                onChange={e => set("reason")(e.target.value)} rows={3}
                className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm resize-none" />
            </FormField>
            <div className="bg-accent border border-primary/20 rounded-md p-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/70 leading-relaxed">
                Your request will be visible to compatible donors immediately after registration.
              </p>
            </div>
          </div>
        )}

        {error && <div className="mt-4"><ErrorBox message={error} /></div>}

        <div className="mt-10">
          {step < totalSteps ? (
            <PrimaryBtn onClick={() => { setError(""); setStep(s => s + 1); }}>
              Continue <ChevronRight className="w-4 h-4" />
            </PrimaryBtn>
          ) : (
            <PrimaryBtn loading={saving} onClick={handleSubmit}>
              <CheckCircle className="w-4 h-4" />
              {isDonor ? "Complete Registration" : "Submit & Post Request"}
            </PrimaryBtn>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Respond Modal ─────────────────────────────────────────────────────────
function RespondModal({ request, profile, onClose, onSuccess }: {
  request: BloodRequest; profile: Profile; onClose: () => void; onSuccess: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setSending(true); setError("");
    try {
      await api(`/requests/${request.id}/respond`, {
        method: "POST",
        body: JSON.stringify({
          donorId: profile.id, donorName: `${profile.firstName} ${profile.lastName}`,
          donorBloodGroup: profile.bloodGroup, donorPhone: profile.phone,
          donorEmail: profile.email, donorCity: profile.city, message,
        }),
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message === "Already responded" ? "You have already responded to this request." : (e.message ?? "Failed to send."));
    } finally { setSending(false); }
  };

  const uc = URGENCY_COLORS[request.urgency];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold text-foreground">Respond to Request</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className={`rounded-lg border p-4 mb-5 ${uc.card}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-extrabold text-xl text-primary">{request.bloodGroup}</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${uc.badge}`}>{request.urgency}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{request.takerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{request.hospital} · {request.city} · {request.unitsRequired} unit{request.unitsRequired > 1 ? "s" : ""}</p>
          </div>

          <div className="bg-secondary rounded-lg p-4 mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your info shared with taker</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-foreground"><User className="w-3.5 h-3.5 text-primary/60" />{profile.firstName} {profile.lastName} · {profile.bloodGroup}</div>
              <div className="flex items-center gap-2 text-foreground"><Phone className="w-3.5 h-3.5 text-primary/60" />{profile.phone}</div>
              <div className="flex items-center gap-2 text-foreground"><Mail className="w-3.5 h-3.5 text-primary/60" />{profile.email}</div>
              <div className="flex items-center gap-2 text-foreground"><MapPin className="w-3.5 h-3.5 text-primary/60" />{profile.city}</div>
            </div>
          </div>

          <FormField label="Message to taker (optional)">
            <textarea placeholder="e.g., I'm available today afternoon, please call me..."
              value={message} onChange={e => setMessage(e.target.value)} rows={3}
              className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm resize-none" />
          </FormField>

          {error && <div className="mt-3"><ErrorBox message={error} /></div>}

          <PrimaryBtn loading={sending} onClick={handleSend} className="mt-4">
            <Send className="w-4 h-4" /> Send Response
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ── Donor eligibility helpers ────────────────────────────────────────────
const DONATION_WAIT_DAYS = 56; // WHO recommended minimum between whole blood donations

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function donorEligibility(lastDonationDate?: string): { eligible: boolean; daysLeft: number; daysSinceLast: number } {
  if (!lastDonationDate) return { eligible: true, daysLeft: 0, daysSinceLast: Infinity };
  const days = daysSince(lastDonationDate);
  const daysLeft = Math.max(0, DONATION_WAIT_DAYS - days);
  return { eligible: daysLeft === 0, daysLeft, daysSinceLast: days };
}

// ── Donation Warning Modal ────────────────────────────────────────────────
function DonationWarningModal({ daysLeft, daysSinceLast, onProceed, onCancel }: {
  daysLeft: number; daysSinceLast: number; onProceed: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Donation Interval Warning
          </h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
            <p className="font-semibold text-amber-800 text-sm mb-1">You donated {daysSinceLast} day{daysSinceLast !== 1 ? "s" : ""} ago</p>
            <p className="text-sm text-amber-700">
              The WHO recommends waiting <strong>{DONATION_WAIT_DAYS} days</strong> between whole blood donations to allow your body to fully recover.
              You still have <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> remaining in the recommended rest period.
            </p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground mb-5">
            <div className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">⚠</span> Donating too soon may cause fatigue, dizziness, or iron deficiency.</div>
            <div className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">⚠</span> Your haemoglobin levels may not have fully recovered yet.</div>
            <div className="flex items-start gap-2"><span className="text-green-600 mt-0.5">✓</span> If this is a critical emergency and you feel healthy, you may still proceed.</div>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 py-2.5 rounded-md border-2 border-border text-foreground font-semibold text-sm hover:border-primary/30 transition-colors">
              Wait — Not yet
            </button>
            <button onClick={onProceed}
              className="flex-1 py-2.5 rounded-md bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
              <Heart className="w-4 h-4" /> Proceed Anyway
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">Please consult a doctor if you are unsure about your eligibility.</p>
        </div>
      </div>
    </div>
  );
}

// ── New Request Modal (for takers) ────────────────────────────────────────
function NewRequestModal({ profile, onClose, onSuccess }: {
  profile: Profile; onClose: () => void; onSuccess: (req: BloodRequest) => void;
}) {
  const [form, setForm] = useState({
    urgency: "Moderate" as UrgencyLevel,
    hospital: profile.hospital ?? "",
    city: profile.city,
    unitsRequired: "1",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.hospital || !form.city) { setError("Hospital and city are required."); return; }
    setSaving(true); setError("");
    try {
      const { request } = await api("/requests", {
        method: "POST",
        body: JSON.stringify({
          takerId: profile.id,
          takerName: `${profile.firstName} ${profile.lastName}`,
          bloodGroup: profile.bloodGroup,
          urgency: form.urgency,
          hospital: form.hospital,
          city: form.city,
          unitsRequired: parseInt(form.unitsRequired) || 1,
          reason: form.reason,
        }),
      });
      onSuccess(request);
    } catch (e: any) {
      setError(e.message ?? "Failed to post request.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="font-display font-bold text-foreground">New Blood Request</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Blood group: <span className="font-bold text-primary">{profile.bloodGroup}</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {error && <ErrorBox message={error} />}

          <FormField label="Urgency Level" required>
            <div className="grid grid-cols-2 gap-2">
              {URGENCY_LEVELS.map(u => (
                <button key={u} type="button" onClick={() => set("urgency")(u)}
                  className={`py-2.5 rounded-md text-sm font-semibold border-2 transition-all ${form.urgency === u ? URGENCY_COLORS[u].badge + " border-current" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                  {u}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Hospital / Location" required>
            <TextInput placeholder="Apollo Hospital, Andheri West" value={form.hospital} onChange={set("hospital")} />
          </FormField>

          <FormField label="City" required>
            <TextInput placeholder="Mumbai" value={form.city} onChange={set("city")} />
          </FormField>

          <FormField label="Units Required" required hint="1 unit ≈ 450 ml of whole blood.">
            <div className="flex gap-2">
              {["1", "2", "3", "4", "5+"].map(u => (
                <button key={u} type="button" onClick={() => set("unitsRequired")(u)}
                  className={`flex-1 py-2.5 rounded-md text-sm font-bold border-2 transition-all ${form.unitsRequired === u ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/40"}`}>
                  {u}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Reason / Medical Notes">
            <textarea placeholder="e.g., Post-surgery, accident trauma, scheduled procedure…"
              value={form.reason} onChange={e => set("reason")(e.target.value)} rows={3}
              className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm resize-none" />
          </FormField>

          <PrimaryBtn loading={saving} onClick={handleSubmit}>
            <Plus className="w-4 h-4" /> Post Request
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ── Fulfill Modal ─────────────────────────────────────────────────────────
function FulfillModal({ response, requestId, onClose, onSuccess }: {
  response: DonorResponse; requestId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFulfill = async () => {
    setLoading(true); setError("");
    try {
      await api(`/requests/${requestId}/fulfill`, {
        method: "POST",
        body: JSON.stringify({ responseId: response.id, notes }),
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? "Failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md shadow-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold text-foreground">Confirm Donation Completed</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5 flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Mark donation as complete</p>
              <p className="text-xs text-green-700 mt-0.5">
                Confirming that <strong>{response.donorName}</strong> ({response.donorBloodGroup}) donated blood successfully. This will be recorded in both your and the donor's history.
              </p>
            </div>
          </div>

          <div className="bg-secondary rounded-lg p-3 mb-5 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-foreground"><User className="w-3.5 h-3.5 text-primary/60" />{response.donorName} · {response.donorBloodGroup}</div>
            <div className="flex items-center gap-2 text-foreground"><Phone className="w-3.5 h-3.5 text-primary/60" />{response.donorPhone}</div>
            <div className="flex items-center gap-2 text-foreground"><MapPin className="w-3.5 h-3.5 text-primary/60" />{response.donorCity}</div>
          </div>

          <FormField label="Add a note of thanks (optional)">
            <textarea placeholder="e.g., Thank you so much, your donation was life-saving…"
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full px-3.5 py-2.5 bg-input-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all text-sm resize-none" />
          </FormField>

          {error && <div className="mt-3"><ErrorBox message={error} /></div>}

          <PrimaryBtn loading={loading} onClick={handleFulfill} className="mt-4 bg-green-600 hover:bg-green-700">
            <CheckCircle className="w-4 h-4" /> Confirm Donation Complete
          </PrimaryBtn>
          <p className="text-xs text-muted-foreground text-center mt-2">The donor will be notified by email with your note.</p>
        </div>
      </div>
    </div>
  );
}

// ── Browser push notifications ────────────────────────────────────────────
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showBrowserNotification(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23c0152a' d='M12 2C12 2 4 9.5 4 14a8 8 0 0016 0C20 9.5 12 2 12 2z'/></svg>" });
}

// ── Edit Profile Modal ────────────────────────────────────────────────────
function EditProfileModal({ profile, onClose, onSuccess }: {
  profile: Profile; onClose: () => void; onSuccess: (updated: Profile) => void;
}) {
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    altPhone: profile.altPhone ?? "",
    address: profile.address,
    city: profile.city,
    state: profile.state,
    medicalConditions: profile.medicalConditions ?? "",
    availableTodonate: profile.availableTodonate ?? true,
    hospital: profile.hospital ?? "",
    unitsRequired: profile.unitsRequired ?? 1,
    urgency: profile.urgency ?? "Moderate",
    reason: profile.reason ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.state.trim()) {
      setError("Name, phone, and address fields are required."); return;
    }
    setLoading(true); setError("");
    try {
      const data = await api(`/profiles/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...form, unitsRequired: Number(form.unitsRequired) }),
      });
      if (data.error) { setError(data.error); return; }
      onSuccess(data.profile);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  const field = (label: string, key: string, type = "text", hint?: string) => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}{hint && <span className="ml-1 text-muted-foreground font-normal normal-case">{hint}</span>}</label>
      <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-display font-bold text-foreground">Edit Profile</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {/* Personal */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Personal Information</p>
          <div className="grid grid-cols-2 gap-3">
            {field("First Name", "firstName")}
            {field("Last Name", "lastName")}
          </div>

          {/* Contact */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">Contact</p>
          {field("Phone Number", "phone", "tel")}
          {field("Alternative Phone", "altPhone", "tel", "(optional)")}

          {/* Address */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">Address</p>
          {field("Street Address", "address")}
          <div className="grid grid-cols-2 gap-3">
            {field("City", "city")}
            {field("State / Province", "state")}
          </div>

          {/* Donor info */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">Donor Details</p>
          {field("Medical Conditions", "medicalConditions", "text", "(optional)")}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set("availableTodonate", !form.availableTodonate)}
              className={`w-10 h-6 rounded-full transition-colors ${form.availableTodonate ? "bg-primary" : "bg-border"} relative`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.availableTodonate ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className="text-sm text-foreground font-medium">Available to donate</span>
          </div>

          {/* Requester info */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">Request Details</p>
          {field("Hospital / Clinic", "hospital", "text", "(if requesting blood)")}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Units Required</label>
              <input type="number" min={1} max={10} value={form.unitsRequired} onChange={e => set("unitsRequired", e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Urgency</label>
              <select value={form.urgency} onChange={e => set("urgency", e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                {["Critical", "High", "Moderate", "Low"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {field("Reason / Medical Notes", "reason", "text", "(optional)")}
        </div>

        <div className="px-6 py-4 border-t border-border shrink-0 space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button onClick={handleSave} disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Spinner /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change Name Modal ─────────────────────────────────────────────────────
function ChangeNameModal({ profile, onClose, onSuccess }: {
  profile: Profile; onClose: () => void; onSuccess: (updated: Profile) => void;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError("Both fields are required."); return; }
    setLoading(true); setError("");
    try {
      const data = await api(`/profiles/${profile.id}/name`, {
        method: "PUT",
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (data.error) { setError(data.error); return; }
      onSuccess(data.profile);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-foreground">Change Name</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button onClick={handleSave} disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Spinner /> Saving…</> : "Save Name"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change Password Modal ──────────────────────────────────────────────────
function ChangePasswordModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!current || !next || !confirm) { setError("All fields are required."); return; }
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      const data = await api(`/profiles/${profile.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (data.error) { setError(data.error); return; }
      setDone(true);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-foreground">Change Password</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="font-semibold text-foreground">Password updated!</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Your new password is active.</p>
            <button onClick={onClose} className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { label: "Current Password", val: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent(p => !p) },
              { label: "New Password",     val: next,    set: setNext,    show: showNext,    toggle: () => setShowNext(p => !p) },
              { label: "Confirm New Password", val: confirm, set: setConfirm, show: showNext, toggle: () => setShowNext(p => !p) },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                <div className="relative mt-1">
                  <input type={f.show ? "text" : "password"} value={f.val} onChange={e => f.set(e.target.value)}
                    className="w-full px-3 py-2 pr-9 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button type="button" onClick={f.toggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {f.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button onClick={handleSave} disabled={loading}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Spinner /> Saving…</> : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function DashboardScreen({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const [tab, setTab] = useState<"profile" | "donate" | "request" | "activity" | "history">("profile");
  // Donate-side state (this user acting as donor)
  const [compatibleRequests, setCompatibleRequests] = useState<BloodRequest[]>([]);
  const [myDonationResponses, setMyDonationResponses] = useState<DonorResponse[]>([]);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [successId, setSuccessId] = useState<string | null>(null);
  // Request-side state (this user acting as taker)
  const [myRequests, setMyRequests] = useState<BloodRequest[]>([]);
  const [requestResponses, setRequestResponses] = useState<DonorResponse[]>([]);
  const [responseBadge, setResponseBadge] = useState(0);

  const [loading, setLoading] = useState(false);
  const [respondTarget, setRespondTarget] = useState<BloodRequest | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const prevResponseCount = useRef(0);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState<{ response: DonorResponse; requestId: string } | null>(null);
  const [fulfilledResponseIds, setFulfilledResponseIds] = useState<Set<string>>(new Set());
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showDonationWarning, setShowDonationWarning] = useState(false);
  const [pendingRespondTarget, setPendingRespondTarget] = useState<BloodRequest | null>(null);
  const [showChangeName, setShowChangeName] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState(profile);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, donorRes, takerRes] = await Promise.all([
        api("/requests"),
        api(`/donors/${profile.id}/responses`),
        api(`/takers/${profile.id}/requests`),
      ]);

      // Donate side
      const all: BloodRequest[] = reqRes.requests ?? [];
      setCompatibleRequests(all.filter(r =>
        r.status === "open" && isCompatible(profile.bloodGroup, r.bloodGroup) && r.takerId !== profile.id
      ));
      const donorResponses: DonorResponse[] = donorRes.responses ?? [];
      setMyDonationResponses(donorResponses);
      setRespondedIds(new Set(donorResponses.map(r => r.requestId)));

      // Request side
      const myReqs: BloodRequest[] = takerRes.requests ?? [];
      setMyRequests(myReqs);
      if (myReqs.length > 0) {
        const allRes = await Promise.all(myReqs.map(r => api(`/requests/${r.id}/responses`).then(d => d.responses ?? [])));
        const flat = allRes.flat() as DonorResponse[];
        setRequestResponses(flat);
        setResponseBadge(flat.length);
      }
    } finally { setLoading(false); }
  }, [profile.id, profile.bloodGroup]);

  useEffect(() => {
    if (tab !== "profile" && tab !== "history") loadAllData();
  }, [tab, loadAllData]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") setNotifEnabled(true);
  }, []);

  // Poll every 30s for new requests and response counts
  useEffect(() => {
    const poll = async () => {
      try {
        const [{ requests: all }, { count }] = await Promise.all([
          api("/requests"),
          api(`/takers/${profile.id}/response-count`),
        ]);
        const compatible = (all as BloodRequest[]).filter(
          r => r.status === "open" && isCompatible(profile.bloodGroup, r.bloodGroup) && r.takerId !== profile.id
        );
        setCompatibleRequests(compatible);
        if (count > prevResponseCount.current && prevResponseCount.current > 0) {
          const diff = count - prevResponseCount.current;
          setResponseBadge(count);
          showBrowserNotification("🩸 New donor response!", `${diff} new donor${diff > 1 ? "s have" : " has"} responded to your blood request.`);
        } else {
          setResponseBadge(count);
        }
        if (compatible.length > prevResponseCount.current && prevResponseCount.current > 0) {
          showBrowserNotification("🩸 New blood request!", `A ${compatible[0]?.bloodGroup} blood request in ${compatible[0]?.city} needs help.`);
        }
        prevResponseCount.current = count;
      } catch { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [profile.id, profile.bloodGroup]);

  const handleRespondSuccess = (requestId: string) => {
    setRespondTarget(null);
    setRespondedIds(prev => new Set([...prev, requestId]));
    setSuccessId(requestId);
    setTimeout(() => setSuccessId(null), 4000);
    loadAllData();
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { records } = await api(`/history/${profile.id}`);
      setHistory(records ?? []);
      setFulfilledResponseIds(new Set((records ?? []).map((r: HistoryRecord) => r.responseId)));
    } finally { setHistoryLoading(false); }
  }, [profile.id]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const tabs = [
    { key: "profile",  label: "My Profile",    badge: 0 },
    { key: "donate",   label: "Donate Blood",   badge: compatibleRequests.length },
    { key: "request",  label: "Request Blood",  badge: myRequests.length },
    { key: "activity", label: "Activity",       badge: responseBadge },
    { key: "history",  label: "History",        badge: history.length },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BloodDropIcon className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-foreground tracking-tight">LifeLink</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-foreground leading-none">{localProfile.firstName} {localProfile.lastName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{localProfile.bloodGroup} · Donor &amp; Recipient</p>
          </div>
          {!notifEnabled && "Notification" in window && Notification.permission !== "denied" && (
            <button
              onClick={async () => { const granted = await requestNotificationPermission(); setNotifEnabled(granted); }}
              className="text-xs bg-accent text-accent-foreground border border-primary/20 px-2.5 py-1.5 rounded-md hover:bg-primary hover:text-primary-foreground transition-colors font-medium flex items-center gap-1.5"
            >
              🔔 Enable alerts
            </button>
          )}
          {notifEnabled && (
            <span className="text-xs text-green-600 font-medium hidden sm:flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Alerts on
            </span>
          )}
          <button onClick={onLogout}
            className="text-sm bg-secondary text-foreground border border-border px-3 py-1.5 rounded-md hover:border-primary/30 transition-colors font-medium">
            Log out
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Status strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: <Heart className="w-4 h-4" />,       label: "Blood Group",     val: profile.bloodGroup },
            { icon: <Droplets className="w-4 h-4" />,    label: "Can Donate To",   val: `${compatibleRequests.length} request${compatibleRequests.length !== 1 ? "s" : ""}` },
            { icon: <MessageCircle className="w-4 h-4" />, label: "My Requests",   val: `${myRequests.length} posted` },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-3.5 text-center">
              <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-primary mx-auto mb-2">{s.icon}</div>
              <div className="font-display font-bold text-base text-foreground truncate">{s.val}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => {
              setTab(t.key as any);
              if (t.key === "activity") setResponseBadge(0);
            }}
              className={`px-3 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              {t.badge > 0 && (
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold leading-none ${tab === t.key ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground"}`}>
                  {t.badge > 99 ? "99+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === "profile" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shrink-0">
                  {localProfile.firstName[0]}{localProfile.lastName[0]}
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-xl font-bold text-foreground">{localProfile.firstName} {localProfile.lastName}</h2>
                  <p className="text-muted-foreground text-sm">Donor &amp; Recipient</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-display font-extrabold text-primary text-lg">{localProfile.bloodGroup}</span>
                    {localProfile.availableTodonate !== undefined && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${localProfile.availableTodonate ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-muted-foreground border-border"}`}>
                        {localProfile.availableTodonate ? "Available to donate" : "Not available"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4 space-y-2.5">
                {[
                  ["Full Name", `${localProfile.firstName} ${localProfile.lastName}`],
                  ["Date of Birth", formatDate(localProfile.dob)],
                  ["Gender", localProfile.gender],
                  ["Blood Group", localProfile.bloodGroup],
                  ["Email", localProfile.email],
                  ["Phone", localProfile.phone],
                  localProfile.altPhone ? ["Alternative Phone", localProfile.altPhone] : null,
                  ["Address", `${localProfile.address}, ${localProfile.city}, ${localProfile.state}`],
                  localProfile.lastDonationDate ? ["Last Donation", formatDate(localProfile.lastDonationDate)] : ["Donation Status", "First-time donor"],
                  localProfile.medicalConditions ? ["Medical Conditions", localProfile.medicalConditions] : null,
                  localProfile.hospital ? ["Hospital", localProfile.hospital] : null,
                  localProfile.unitsRequired ? ["Units Required", `${localProfile.unitsRequired}`] : null,
                  localProfile.urgency ? ["Urgency Level", localProfile.urgency] : null,
                  localProfile.reason ? ["Medical Notes", localProfile.reason] : null,
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 text-sm py-2 border-b border-border last:border-0">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="text-foreground font-medium text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Account settings */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h4 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Account Settings
              </h4>
              <div className="space-y-2">
                <button onClick={() => setShowEditProfile(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-secondary hover:bg-muted transition-colors text-sm">
                  <span className="font-medium text-foreground">Edit Profile Info</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => setShowChangeName(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-secondary hover:bg-muted transition-colors text-sm">
                  <span className="font-medium text-foreground">Change Name</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-secondary hover:bg-muted transition-colors text-sm">
                  <span className="font-medium text-foreground">Change Password</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Donate Blood tab */}
        {tab === "donate" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-foreground">Compatible Blood Requests</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Matching your <span className="font-semibold text-primary">{profile.bloodGroup}</span> blood group
                </p>
              </div>
              <button onClick={loadAllData} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Eligibility banner */}
            {(() => {
              const { eligible, daysLeft, daysSinceLast } = donorEligibility(localProfile.lastDonationDate);
              if (eligible || daysSinceLast === Infinity) return null;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mb-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{daysLeft} day{daysLeft !== 1 ? "s" : ""} until recommended donation window</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Last donation was {daysSinceLast} day{daysSinceLast !== 1 ? "s" : ""} ago. WHO recommends waiting {DONATION_WAIT_DAYS} days between donations.
                    </p>
                  </div>
                </div>
              );
            })()}

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading…</span></div>
            ) : compatibleRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Droplets className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No compatible requests right now.</p>
                <p className="text-xs mt-1 opacity-70">Check back soon — requests update in real time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {compatibleRequests.map(req => {
                  const uc = URGENCY_COLORS[req.urgency];
                  const responded = respondedIds.has(req.id);
                  const isSuccess = successId === req.id;
                  return (
                    <div key={req.id} className={`bg-card border rounded-lg p-4 transition-all ${isSuccess ? "border-green-300 bg-green-50" : "border-border hover:border-primary/30"}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-md flex items-center justify-center font-display font-extrabold text-sm ${uc.card} border`}>
                            <span className="text-primary">{req.bloodGroup}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{req.takerName}</p>
                            <p className="text-xs text-muted-foreground">{req.hospital}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${uc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${uc.dot} ${req.urgency === "Critical" ? "animate-pulse" : ""}`} />
                            {req.urgency}
                          </span>
                          <span className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req.city}</span>
                        <span className="flex items-center gap-1"><Plus className="w-3 h-3" />{req.unitsRequired} unit{req.unitsRequired > 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{req.responseCount} response{req.responseCount !== 1 ? "s" : ""}</span>
                      </div>
                      {req.reason && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{req.reason}</p>}
                      <div className="border-t border-border pt-3">
                        {isSuccess ? (
                          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                            <CheckCircle className="w-4 h-4" /> Response sent! They can now see your contact info.
                          </div>
                        ) : responded ? (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" /> You already responded.
                          </div>
                        ) : (
                          <button onClick={() => {
                            const { eligible } = donorEligibility(localProfile.lastDonationDate);
                            if (!eligible) { setPendingRespondTarget(req); setShowDonationWarning(true); }
                            else setRespondTarget(req);
                          }}
                            className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                            <Heart className="w-4 h-4" /> I can help — Respond
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Request Blood tab */}
        {tab === "request" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-foreground">Your Blood Requests</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Post requests when you need blood</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNewRequest(true)}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Request
                </button>
                <button onClick={loadAllData} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading…</span></div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Droplets className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No blood requests posted yet.</p>
                <p className="text-xs mt-1 opacity-70">Tap "+ New Request" to ask the community for help.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.map(req => {
                  const uc = URGENCY_COLORS[req.urgency];
                  return (
                    <div key={req.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-md flex items-center justify-center font-display font-extrabold text-sm ${uc.card} border`}>
                            <span className="text-primary">{req.bloodGroup}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{req.hospital || "No hospital"}</p>
                            <p className="text-xs text-muted-foreground">{req.city}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${uc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${uc.dot} ${req.urgency === "Critical" ? "animate-pulse" : ""}`} />
                            {req.urgency}
                          </span>
                          <span className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</span>
                        </div>
                      </div>
                      {req.reason && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{req.reason}</p>}
                      <div className="border-t border-border pt-3 flex items-center justify-between">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${req.status === "open" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                          {req.status === "open" ? "Active" : "Fulfilled"}
                        </span>
                        <span className="text-xs text-muted-foreground">{req.responseCount} donor{req.responseCount !== 1 ? "s" : ""} responded</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Activity tab — two sections */}
        {tab === "activity" && (
          <div className="space-y-8">
            <button onClick={loadAllData} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>

            {/* Section A: My donation activity */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-foreground text-sm">My Donation Responses</h3>
                <span className="text-xs text-muted-foreground">({myDonationResponses.length})</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading…</span></div>
              ) : myDonationResponses.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No donations yet. Go to Donate Blood to start helping.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myDonationResponses.map(r => (
                    <div key={r.id} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-accent border border-primary/20 flex items-center justify-center font-display font-extrabold text-xs text-primary">
                            {r.donorBloodGroup}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">Offered to donate to {r.takerName ?? "a recipient"}</p>
                            <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                      {r.message && <p className="text-xs text-foreground/60 italic bg-accent/50 rounded px-3 py-2">"{r.message}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section B: Donors who responded to my requests */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold text-foreground text-sm">Donors Responding to My Requests</h3>
                <span className="text-xs text-muted-foreground">({requestResponses.length})</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading…</span></div>
              ) : requestResponses.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No donors have responded to your requests yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requestResponses.map(r => {
                    const alreadyFulfilled = fulfilledResponseIds.has(r.id);
                    const parentRequest = myRequests.find(req => req.id === r.requestId);
                    return (
                      <div key={r.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-accent border border-primary/20 flex items-center justify-center font-display font-extrabold text-sm text-primary">
                              {r.donorBloodGroup}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{r.donorName}</p>
                              <p className="text-xs text-muted-foreground">{r.donorCity}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{timeAgo(r.createdAt)}</span>
                        </div>
                        <div className="bg-secondary rounded-md p-3 space-y-1.5 mb-3">
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Phone className="w-3.5 h-3.5 text-primary/60" />
                            <a href={`tel:${r.donorPhone}`} className="hover:text-primary transition-colors font-medium">{r.donorPhone}</a>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <Mail className="w-3.5 h-3.5 text-primary/60" />
                            <a href={`mailto:${r.donorEmail}`} className="hover:text-primary transition-colors font-medium">{r.donorEmail}</a>
                          </div>
                        </div>
                        {r.message && <p className="text-xs text-foreground/60 italic bg-accent/50 rounded px-3 py-2 mb-3">"{r.message}"</p>}
                        {parentRequest && parentRequest.status !== "fulfilled" && !alreadyFulfilled ? (
                          <button
                            onClick={() => setFulfillTarget({ response: r, requestId: r.requestId })}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-md text-sm font-semibold hover:bg-green-700 transition-colors">
                            <CheckCircle className="w-4 h-4" /> Mark Donation as Complete
                          </button>
                        ) : alreadyFulfilled ? (
                          <div className="flex items-center gap-2 text-green-700 text-xs font-semibold bg-green-50 border border-green-200 rounded-md px-3 py-2">
                            <CheckCircle className="w-3.5 h-3.5" /> Donation confirmed complete
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-bold text-foreground">Donation History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">All confirmed donations you were part of.</p>
              </div>
              <button onClick={loadHistory} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                <RefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading history…</span></div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No history yet.</p>
                <p className="text-xs mt-1 opacity-70">Completed donations will appear here once confirmed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(rec => {
                  const asDonor = rec.donorId === profile.id;
                  return (
                    <div key={rec.id} className="bg-card border border-green-200 rounded-lg overflow-hidden">
                      <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-semibold text-green-700">
                            {asDonor ? "You donated" : "You received"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(rec.completedAt)}</span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 rounded-md bg-accent border border-primary/20 flex items-center justify-center font-display font-extrabold text-lg text-primary shrink-0">
                            {rec.bloodGroup}
                          </div>
                          <div className="flex-1">
                            {asDonor ? (
                              <>
                                <p className="font-semibold text-foreground">Donated to <span className="text-primary">{rec.takerName}</span></p>
                                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5"><MapPin className="w-3 h-3" />{rec.hospital}, {rec.city}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-foreground">Received from <span className="text-primary">{rec.donorName}</span></p>
                                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5"><MapPin className="w-3 h-3" />{rec.hospital}, {rec.city}</p>
                              </>
                            )}
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${URGENCY_COLORS[rec.urgency].badge}`}>{rec.urgency}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div className="bg-secondary rounded-md p-3">
                            <p className="text-xs text-muted-foreground mb-1">Donor</p>
                            <p className="font-semibold text-foreground">{rec.donorName}</p>
                            <p className="text-xs text-muted-foreground">{rec.donorBloodGroup} · {rec.donorCity}</p>
                            <a href={`tel:${rec.donorPhone}`} className="text-xs text-primary hover:underline mt-0.5 block">{rec.donorPhone}</a>
                          </div>
                          <div className="bg-secondary rounded-md p-3">
                            <p className="text-xs text-muted-foreground mb-1">Request Details</p>
                            <p className="font-semibold text-foreground">{rec.unitsRequired} unit{rec.unitsRequired > 1 ? "s" : ""} of {rec.bloodGroup}</p>
                            <p className="text-xs text-muted-foreground">Requested {formatDate(rec.requestCreatedAt)}</p>
                            <p className="text-xs text-muted-foreground">Fulfilled {formatDate(rec.completedAt)}</p>
                          </div>
                        </div>
                        {rec.notes && (
                          <div className="bg-accent/60 rounded-md px-3 py-2 text-xs text-foreground/70 italic flex gap-2">
                            <MessageCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/50" />
                            "{rec.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {respondTarget && (
        <RespondModal request={respondTarget} profile={profile}
          onClose={() => setRespondTarget(null)}
          onSuccess={() => handleRespondSuccess(respondTarget.id)} />
      )}

      {fulfillTarget && (
        <FulfillModal
          response={fulfillTarget.response}
          requestId={fulfillTarget.requestId}
          onClose={() => setFulfillTarget(null)}
          onSuccess={() => {
            setFulfilledResponseIds(prev => new Set([...prev, fulfillTarget.response.id]));
            setFulfillTarget(null);
            loadAllData();
            loadHistory();
          }}
        />
      )}

      {showDonationWarning && pendingRespondTarget && (
        <DonationWarningModal
          daysLeft={donorEligibility(localProfile.lastDonationDate).daysLeft}
          daysSinceLast={donorEligibility(localProfile.lastDonationDate).daysSinceLast}
          onCancel={() => { setShowDonationWarning(false); setPendingRespondTarget(null); }}
          onProceed={() => { setShowDonationWarning(false); setRespondTarget(pendingRespondTarget); setPendingRespondTarget(null); }}
        />
      )}

      {showNewRequest && (
        <NewRequestModal
          profile={localProfile}
          onClose={() => setShowNewRequest(false)}
          onSuccess={(req) => { setMyRequests(prev => [req, ...prev]); setShowNewRequest(false); }}
        />
      )}

      {showEditProfile && (
        <EditProfileModal
          profile={localProfile}
          onClose={() => setShowEditProfile(false)}
          onSuccess={(updated) => { setLocalProfile(updated); setShowEditProfile(false); }}
        />
      )}

      {showChangeName && (
        <ChangeNameModal
          profile={localProfile}
          onClose={() => setShowChangeName(false)}
          onSuccess={(updated) => { setLocalProfile(updated); setShowChangeName(false); }}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          profile={localProfile}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </div>
  );
}

// ── Admin Login ───────────────────────────────────────────────────────────
function AdminLoginScreen({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username || !password) { setError("Enter username and password."); return; }
    setLoading(true); setError("");
    try {
      await api("/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onSuccess();
    } catch {
      setError("Invalid credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <BloodDropIcon className="w-5 h-5 text-primary" />
          <span className="font-display font-bold text-foreground">LifeLink Admin</span>
        </div>
        <div className="w-16" />
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center mb-6">
            <Shield className="w-5 h-5 text-background" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Admin Access</h1>
          <p className="text-muted-foreground text-sm mb-8">Restricted to administrators only.</p>
          {error && <div className="mb-4"><ErrorBox message={error} /></div>}
          <div className="flex flex-col gap-4">
            <FormField label="Username" required>
              <TextInput placeholder="admin" value={username} onChange={setUsername} icon={<User className="w-4 h-4" />} />
            </FormField>
            <FormField label="Password" required>
              <TextInput type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={setPassword}
                icon={<Lock className="w-4 h-4" />}
                right={
                  <button type="button" onClick={() => setShowPw(p => !p)} className="text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                } />
            </FormField>
            <PrimaryBtn loading={loading} onClick={handleLogin}>
              <Shield className="w-4 h-4" /> Enter Admin Panel
            </PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────
interface AdminStats {
  totalUsers: number; totalDonors: number; totalTakers: number;
  openRequests: number; fulfilledRequests: number; totalRequests: number; totalResponses: number;
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"overview" | "users" | "requests" | "responses">("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [responses, setResponses] = useState<DonorResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credForm, setCredForm] = useState({ currentPassword: "", newUsername: "", newPassword: "", confirmPassword: "" });
  const [credError, setCredError] = useState("");
  const [credDone, setCredDone] = useState(false);
  const [credLoading, setCredLoading] = useState(false);

  const loadStats = useCallback(async () => {
    const s = await api("/admin/stats");
    setStats(s);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/admin/users"); setUsers(d.users ?? []); }
    finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/admin/requests"); setRequests(d.requests ?? []); }
    finally { setLoading(false); }
  }, []);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    try { const d = await api("/admin/responses"); setResponses(d.responses ?? []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (tab === "users") loadUsers();
    else if (tab === "requests") loadRequests();
    else if (tab === "responses") loadResponses();
  }, [tab, loadUsers, loadRequests, loadResponses]);

  const deleteUser = async (id: string) => {
    await api(`/admin/users/${id}`, { method: "DELETE" });
    setUsers(u => u.filter(x => x.id !== id));
    setConfirmDelete(null);
    loadStats();
  };

  const updateRequestStatus = async (id: string, status: string) => {
    await api(`/admin/requests/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    setRequests(r => r.map(x => x.id === id ? { ...x, status: status as any } : x));
    loadStats();
  };

  const deleteRequest = async (id: string) => {
    await api(`/admin/requests/${id}`, { method: "DELETE" });
    setRequests(r => r.filter(x => x.id !== id));
    setConfirmDelete(null);
    loadStats();
  };

  const filteredUsers = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email} ${u.bloodGroup} ${u.city}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredRequests = requests.filter(r =>
    `${r.takerName} ${r.bloodGroup} ${r.hospital} ${r.city} ${r.urgency}`.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { key: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "requests", label: "Requests", icon: <ClipboardList className="w-4 h-4" /> },
    { key: "responses", label: "Responses", icon: <MessageCircle className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border bg-foreground flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BloodDropIcon className="w-6 h-6 text-primary" />
          <div>
            <span className="font-display font-bold text-background tracking-tight">LifeLink</span>
            <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-semibold">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowCredentials(true); setCredDone(false); setCredError(""); setCredForm({ currentPassword: "", newUsername: "", newPassword: "", confirmPassword: "" }); }}
            className="text-sm text-background/60 hover:text-background transition-colors font-medium flex items-center gap-1.5">
            <Lock className="w-4 h-4" /> Credentials
          </button>
          <button onClick={onLogout} className="text-sm text-background/60 hover:text-background transition-colors font-medium flex items-center gap-1.5">
            <LogIn className="w-4 h-4 rotate-180" /> Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1">
        {/* Sidebar */}
        <aside className="md:w-52 bg-card border-b md:border-b-0 md:border-r border-border flex md:flex-col flex-row md:py-6 px-3 md:px-4 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key as any); setSearch(""); }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors whitespace-nowrap ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 overflow-auto">

          {/* Overview */}
          {tab === "overview" && (
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">Platform Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Total Users", val: stats?.totalUsers ?? "—", color: "text-foreground" },
                  { label: "Donors", val: stats?.totalDonors ?? "—", color: "text-primary" },
                  { label: "Requesters", val: stats?.totalTakers ?? "—", color: "text-orange-600" },
                  { label: "Open Requests", val: stats?.openRequests ?? "—", color: "text-red-600" },
                  { label: "Fulfilled", val: stats?.fulfilledRequests ?? "—", color: "text-green-600" },
                  { label: "Total Requests", val: stats?.totalRequests ?? "—", color: "text-foreground" },
                  { label: "Total Responses", val: stats?.totalResponses ?? "—", color: "text-blue-600" },
                  { label: "Match Rate", val: stats ? `${stats.totalRequests ? Math.round((stats.fulfilledRequests / stats.totalRequests) * 100) : 0}%` : "—", color: "text-green-600" },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-lg p-4">
                    <div className={`font-display text-3xl font-extrabold ${s.color}`}>{s.val}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="font-semibold text-foreground mb-1">Admin Credentials</h3>
                <p className="text-sm text-muted-foreground">Username: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">admin</code> · Password: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">lifelink@admin</code></p>
                <p className="text-xs text-muted-foreground mt-2">Change these in <code className="bg-secondary px-1 rounded">supabase/functions/server/index.tsx</code> (ADMIN_USER / ADMIN_PASS constants).</p>
              </div>
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div>
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl font-bold text-foreground">Users <span className="text-muted-foreground text-lg font-normal">({filteredUsers.length})</span></h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)}
                      className="pl-3 pr-8 py-2 bg-input-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all w-52" />
                    {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                  <button onClick={loadUsers} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading users…</span></div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">No users found.</div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm shrink-0 ${u.role === "donor" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-display font-bold text-primary text-sm">{u.bloodGroup}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${u.role === "donor" ? "bg-primary/10 text-primary border-primary/20" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                            {u.role}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:block">{u.city}</span>
                          <button onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                            {expandedUser === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {confirmDelete === u.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => deleteUser(u.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold">Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-xs bg-secondary text-foreground px-2 py-1 rounded font-semibold">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(u.id)} className="p-1 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedUser === u.id && (
                        <div className="border-t border-border px-4 py-3 bg-secondary/40 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                          {[
                            ["Phone", u.phone], ["Gender", u.gender], ["DOB", u.dob ? formatDate(u.dob) : "—"],
                            ["City", u.city], ["State", u.state], ["Joined", formatDate(u.createdAt)],
                            ...(u.role === "donor" ? [
                              ["Last Donation", u.lastDonationDate ? formatDate(u.lastDonationDate) : "First-time"],
                              ["Available", u.availableTodonate ? "Yes" : "No"],
                              ["Conditions", u.medicalConditions || "None"],
                            ] : [
                              ["Hospital", u.hospital || "—"],
                              ["Units", String(u.unitsRequired ?? 1)],
                              ["Urgency", u.urgency ?? "—"],
                            ]),
                          ].map(([k, v]) => (
                            <div key={k}>
                              <span className="text-muted-foreground text-xs">{k}</span>
                              <p className="font-medium text-foreground truncate">{v}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Requests */}
          {tab === "requests" && (
            <div>
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <h2 className="font-display text-2xl font-bold text-foreground">Blood Requests <span className="text-muted-foreground text-lg font-normal">({filteredRequests.length})</span></h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input placeholder="Search requests…" value={search} onChange={e => setSearch(e.target.value)}
                      className="pl-3 pr-8 py-2 bg-input-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-all w-52" />
                    {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                  <button onClick={loadRequests} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading requests…</span></div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">No requests found.</div>
              ) : (
                <div className="space-y-2">
                  {filteredRequests.map(req => {
                    const uc = URGENCY_COLORS[req.urgency];
                    return (
                      <div key={req.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
                        <div className={`w-10 h-10 rounded-md flex items-center justify-center font-display font-extrabold text-sm text-primary border shrink-0 ${uc.card}`}>
                          {req.bloodGroup}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm">{req.takerName}</p>
                          <p className="text-xs text-muted-foreground truncate">{req.hospital} · {req.city} · {req.unitsRequired} unit{req.unitsRequired > 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${uc.badge}`}>{req.urgency}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${req.status === "open" ? "bg-blue-50 text-blue-700 border-blue-200" : req.status === "fulfilled" ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-muted-foreground border-border"}`}>
                            {req.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{req.responseCount} resp.</span>
                          <span className="text-xs text-muted-foreground hidden sm:block">{timeAgo(req.createdAt)}</span>

                          {req.status === "open" && (
                            <button onClick={() => updateRequestStatus(req.id, "fulfilled")}
                              title="Mark fulfilled"
                              className="p-1 text-muted-foreground hover:text-green-600 transition-colors">
                              <CircleCheck className="w-4 h-4" />
                            </button>
                          )}
                          {req.status !== "closed" && (
                            <button onClick={() => updateRequestStatus(req.id, "closed")}
                              title="Close request"
                              className="p-1 text-muted-foreground hover:text-orange-500 transition-colors">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {confirmDelete === req.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => deleteRequest(req.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold">Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-xs bg-secondary text-foreground px-2 py-1 rounded font-semibold">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(req.id)} className="p-1 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Responses */}
          {tab === "responses" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl font-bold text-foreground">Donor Responses <span className="text-muted-foreground text-lg font-normal">({responses.length})</span></h2>
                <button onClick={loadResponses} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Spinner /><span className="text-sm">Loading responses…</span></div>
              ) : responses.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">No responses yet.</div>
              ) : (
                <div className="space-y-2">
                  {responses.map(r => (
                    <div key={r.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-4 flex-wrap">
                      <div className="w-10 h-10 rounded-md bg-accent border border-primary/20 flex items-center justify-center font-display font-extrabold text-sm text-primary shrink-0">
                        {r.donorBloodGroup}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-foreground text-sm">{r.donorName}</p>
                          <span className="text-xs text-muted-foreground">→</span>
                          <p className="text-sm text-muted-foreground truncate">Request {r.requestId.slice(0, 8)}…</p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.donorPhone}</span>
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.donorEmail}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.donorCity}</span>
                          <span>{timeAgo(r.createdAt)}</span>
                        </div>
                        {r.message && <p className="text-xs text-foreground/60 italic mt-1">"{r.message}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Admin Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Admin Credentials
              </h3>
              <button onClick={() => setShowCredentials(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {credDone ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <p className="font-semibold text-foreground">Credentials updated!</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Use the new credentials next time you log in.</p>
                <button onClick={() => setShowCredentials(false)}
                  className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Password</label>
                  <div className="relative mt-1">
                    <input type="password" value={credForm.currentPassword}
                      onChange={e => setCredForm(f => ({ ...f, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Username <span className="text-muted-foreground font-normal normal-case">(leave blank to keep)</span></label>
                  <input value={credForm.newUsername}
                    onChange={e => setCredForm(f => ({ ...f, newUsername: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Password <span className="text-muted-foreground font-normal normal-case">(leave blank to keep)</span></label>
                  <input type="password" value={credForm.newPassword}
                    onChange={e => setCredForm(f => ({ ...f, newPassword: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {credForm.newPassword && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm New Password</label>
                    <input type="password" value={credForm.confirmPassword}
                      onChange={e => setCredForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-md bg-input-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                )}
                {credError && <p className="text-xs text-destructive">{credError}</p>}
                <button disabled={credLoading} onClick={async () => {
                  if (!credForm.currentPassword) { setCredError("Current password is required."); return; }
                  if (credForm.newPassword && credForm.newPassword !== credForm.confirmPassword) { setCredError("Passwords do not match."); return; }
                  if (credForm.newPassword && credForm.newPassword.length < 6) { setCredError("New password must be at least 6 characters."); return; }
                  setCredLoading(true); setCredError("");
                  try {
                    const data = await api("/admin/credentials", {
                      method: "PUT",
                      body: JSON.stringify({ currentPassword: credForm.currentPassword, newUsername: credForm.newUsername || undefined, newPassword: credForm.newPassword || undefined }),
                    });
                    if (data.error) { setCredError(data.error); return; }
                    setCredDone(true);
                  } catch { setCredError("Something went wrong."); }
                  finally { setCredLoading(false); }
                }}
                  className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {credLoading ? <><Spinner /> Saving…</> : "Update Credentials"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── API Status Banner ─────────────────────────────────────────────────────
function ApiStatusBanner() {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    api("/health")
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  if (status === "ok" || status === "checking") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm px-4 py-3 flex items-center justify-center gap-2 shadow-lg">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>
        <strong>Backend not reachable.</strong> Go to{" "}
        <strong>Make Settings → Supabase → Deploy Edge Function</strong>, then refresh this page.
      </span>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [profile, setProfile] = useState<Profile | null>(null);

  const goToDashboard = (p: Profile) => {
    setProfile(p);
    setScreen("dashboard");
  };

  return (
    <div>
      <style>{`
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
      `}</style>

      <ApiStatusBanner />

      {screen === "landing" && (
        <LandingScreen
          onLogin={() => setScreen("login")}
          onRegister={() => setScreen("register")}
          onAdmin={() => setScreen("admin-login")} />
      )}
      {screen === "login" && (
        <LoginScreen
          onBack={() => setScreen("landing")}
          onGoRegister={() => setScreen("register")}
          onSuccess={goToDashboard} />
      )}
      {screen === "register" && (
        <RegisterScreen
          onBack={() => setScreen("landing")}
          onGoLogin={() => setScreen("login")}
          onComplete={goToDashboard} />
      )}
      {screen === "dashboard" && profile && (
        <DashboardScreen
          profile={profile}
          onLogout={() => { setProfile(null); setScreen("landing"); }} />
      )}
      {screen === "admin-login" && (
        <AdminLoginScreen
          onBack={() => setScreen("landing")}
          onSuccess={() => setScreen("admin")} />
      )}
      {screen === "admin" && (
        <AdminPanel onLogout={() => setScreen("landing")} />
      )}
    </div>
  );
}
