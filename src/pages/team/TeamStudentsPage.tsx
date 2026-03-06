import React, { useEffect, useState, useCallback } from "react";
import { 
  User, RefreshCw, UserPlus, Copy, Check, Loader2,
  Mail, MessageCircle, Phone, ChevronRight, ChevronLeft, Search, X 
} from "lucide-react";

/**
 * ─── HELPER COMPONENTS ───────────────────────────────────────────────
 * These mimic the shadcn/ui components used in your project 
 * to ensure the file is runnable and copy-paste ready.
 * ──────────────────────────────────────────────────────────────────────
 */

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

const Badge = ({ children, variant = "outline", className = "" }) => {
  const styles = variant === "outline" 
    ? "border-amber-300 text-amber-600 bg-amber-50/50" 
    : "bg-slate-100 text-slate-600 border-transparent";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles} ${className}`}>
      {children}
    </span>
  );
};

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    success: "bg-green-600 text-white hover:bg-green-700"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm"
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

/* ─── MAIN COMPONENT ────────────────────────────────────────────────── */

export default function TeamStudentsPage() {
  // Localization Mock (Replace with useTranslation in your environment)
  const [isRtl, setIsRtl] = useState(false);
  
  // State management
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [wizardStep, setWizardStep] = useState("search");

  // Step 1: Search State
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [matchedCases, setMatchedCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [searching, setSearching] = useState(false);

  // Step 2: Account Details
  const [studentEmail, setStudentEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [tempCreds, setTempCreds] = useState(null);
  const [copiedPw, setCopiedPw] = useState(false);

  // Mock Data for Demo
  const MOCK_CASES = [
    { id: "C-101", full_name: "Ahmad Ali Hassan", phone_number: "+971 50 123 4567", city: "Dubai", status: "Active" },
    { id: "C-202", full_name: "Sara Mohammed Al-Farsi", phone_number: "+971 55 987 6543", city: "Abu Dhabi", status: "Pending" },
  ];

  // Search Logic
  useEffect(() => {
    const fullName = [firstName, middleName, familyName].filter(Boolean).join(" ").trim();
    if (fullName.length < 2) { setMatchedCases([]); return; }
    
    setSearching(true);
    const t = setTimeout(() => {
      const results = MOCK_CASES.filter(c => 
        c.full_name.toLowerCase().includes(fullName.toLowerCase())
      );
      setMatchedCases(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [firstName, middleName, familyName]);

  const resetWizard = () => {
    setWizardStep("search");
    setFirstName(""); setMiddleName(""); setFamilyName("");
    setMatchedCases([]); setSelectedCase(null);
    setStudentEmail("");
  };

  const handleCreateAccount = () => {
    setCreating(true);
    setTimeout(() => {
      const fullName = [firstName, middleName, familyName].filter(Boolean).join(" ");
      const newCreds = {
        full_name: fullName,
        email: studentEmail,
        password: Math.random().toString(36).slice(-8).toUpperCase()
      };
      setTempCreds(newCreds);
      setStudents([ { ...newCreds, id: Date.now(), created_at: new Date().toISOString() }, ...students ]);
      setCreating(false);
      setShowModal(false);
    }, 1200);
  };

  return (
    <div className={`p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isRtl ? "الطلاب" : "Students"}</h1>
          <p className="text-sm text-slate-500">Manage student access and link to cases.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsRtl(!isRtl)}>
            {isRtl ? "English" : "العربية"}
          </Button>
          <Button onClick={() => { resetWizard(); setShowModal(true); }}>
            <UserPlus className="h-4 w-4 me-2" />
            {isRtl ? "إنشاء حساب طالب" : "Create Student Account"}
          </Button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No student accounts yet</h3>
          <p className="text-slate-500 text-sm mt-1">Start by creating an account and linking it to a case file.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-start gap-4">
                <div className="bg-indigo-50 h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 truncate">{s.full_name}</h4>
                  <div className="text-xs text-slate-500 space-y-1 mt-1">
                    <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {s.email}</p>
                    <p className="flex items-center gap-1.5"><RefreshCw className="h-3 w-3" /> Created {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge className="mt-2">Temp Password</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Wizard Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                {wizardStep === "search" ? "Step 1: Find Case" : "Step 2: Account Email"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5"/></button>
            </div>

            <div className="p-6 space-y-6">
              {wizardStep === "search" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                      <input className="w-full p-2 border rounded-lg text-sm" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ahmad" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Family Name</label>
                      <input className="w-full p-2 border rounded-lg text-sm" value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Hassan" />
                    </div>
                  </div>

                  {searching ? (
                    <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium animate-pulse"><Loader2 className="h-3 w-3 animate-spin"/> Searching cases...</div>
                  ) : matchedCases.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Matched Cases</label>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {matchedCases.map(c => (
                          <button key={c.id} onClick={() => setSelectedCase(c)} 
                            className={`w-full text-left p-3 rounded-xl border transition-all ${selectedCase?.id === c.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-300'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold">{c.full_name}</span>
                              {selectedCase?.id === c.id && <Check className="h-4 w-4 text-indigo-600" />}
                            </div>
                            <span className="text-xs text-slate-500">{c.id} • {c.phone_number}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                    <Button disabled={!firstName || !familyName} onClick={() => setWizardStep("email")}>Next <ChevronRight className="h-4 w-4 ml-1"/></Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-xs text-indigo-600 font-bold uppercase mb-1">Student Selected</p>
                    <p className="text-sm font-semibold text-indigo-900">{firstName} {familyName}</p>
                    {selectedCase && <p className="text-xs text-indigo-500 mt-1">Linked to Case {selectedCase.id}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Login Email Address</label>
                    <input className="w-full p-3 border rounded-xl text-sm" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="student@example.com" type="email" />
                  </div>

                  <div className="flex justify-between gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setWizardStep("search")}><ChevronLeft className="h-4 w-4 mr-1"/> Back</Button>
                    <Button variant="primary" className="px-8" onClick={handleCreateAccount} disabled={creating || !studentEmail.includes("@")}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin"/> : "Finish & Create"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {tempCreds && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-6 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Account Created!</h3>
              <p className="text-sm text-slate-500">Share these temporary details with the student.</p>
            </div>

            <div className="space-y-2 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border text-sm relative">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Username</p>
                <p className="font-medium pr-8 truncate">{tempCreds.email}</p>
                <button onClick={() => navigator.clipboard.writeText(tempCreds.email)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><Copy className="h-4 w-4"/></button>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm relative">
                <p className="text-[10px] font-bold text-amber-600 uppercase">Temp Password</p>
                <p className="font-bold text-amber-900 pr-8 tracking-wider">{tempCreds.password}</p>
                <button onClick={() => { navigator.clipboard.writeText(tempCreds.password); setCopiedPw(true); setTimeout(() => setCopiedPw(false), 2000); }} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400">
                  {copiedPw ? <Check className="h-4 w-4 text-green-600"/> : <Copy className="h-4 w-4"/>}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Button variant="success" className="w-full" onClick={() => {
                const msg = encodeURIComponent(`Hi ${tempCreds.full_name},\nYour student account is ready.\nUser: ${tempCreds.email}\nPass: ${tempCreds.password}`);
                window.open(`https://wa.me/?text=${msg}`, "_blank");
              }}>
                <MessageCircle className="h-4 w-4 mr-2"/> Send WhatsApp
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setTempCreds(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

      {/* ── Temp credentials result ── */}
      <Dialog open={!!tempCreds} onOpenChange={() => setTempCreds(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Student Account Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials with the student. The password will <strong>not</strong> be shown again. The
              student must change it on first login.
            </p>
            {tempCreds && (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-muted text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Student</p>
                  <p className="font-semibold">{tempCreds.full_name}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted font-mono text-sm space-y-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 break-all">{tempCreds.email}</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(tempCreds.email)}
                      className="shrink-0 p-1 rounded hover:bg-border"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 font-mono text-sm space-y-1">
                  <p className="text-xs text-amber-700">Temporary Password (show once)</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 break-all select-all text-amber-900 font-bold">{tempCreds.password}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tempCreds.password);
                        setCopiedPw(true);
                        setTimeout(() => setCopiedPw(false), 2000);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-amber-100"
                    >
                      {copiedPw ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-amber-700" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (tempCreds)
                    navigator.clipboard.writeText(`Email: ${tempCreds.email}\nPassword: ${tempCreds.password}`);
                }}
              >
                <Copy className="h-4 w-4 me-1" /> Copy Both
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (!tempCreds) return;
                  const msg = encodeURIComponent(
                    `مرحبا ${tempCreds.full_name},\nبيانات تسجيل الدخول:\n🔗 darb.agency/student-auth\n📧 ${tempCreds.email}\n🔑 ${tempCreds.password}\nيرجى تغيير كلمة المرور عند أول دخول.`,
                  );
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }}
              >
                <MessageCircle className="h-4 w-4 me-1" /> WhatsApp
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempCreds(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
