import React, { useEffect, useState } from "react";
import {
  User,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

/**
 * ─── HELPER COMPONENTS ───────────────────────────────────────────────
 */
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md ${className}`}
  >
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => <div className={`p-4 ${className}`}>{children}</div>;

const Badge = ({ children, variant = "outline", className = "" }) => {
  const styles =
    variant === "outline"
      ? "border-amber-300 text-amber-600 bg-amber-50/50"
      : "bg-slate-100 text-slate-600 border-transparent";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles} ${className}`}>{children}</span>
  );
};

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

/* ─── MAIN COMPONENT ────────────────────────────────────────────────── */

export default function TeamStudentsPage() {
  const [isRtl, setIsRtl] = useState(false);

  // State management
  const [students, setStudents] = useState([]);
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

  // ─── INIT FETCH: LOAD EXISTING STUDENTS ─────────────────────────────
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // TODO: REAL API CALL HERE to fetch existing students on page load
        // const { data, error } = await supabase.from('students').select('*');
        // if (data) setStudents(data);
      } catch (error) {
        console.error("Failed to fetch students", error);
      }
    };
    fetchStudents();
  }, []);

  // ─── DEBOUNCED LIVE SEARCH ──────────────────────────────────────────
  useEffect(() => {
    const currentFullName = [firstName, middleName, familyName].filter(Boolean).join(" ").trim();

    // Prevent fetching if we just clicked a case to auto-fill
    if (selectedCase && selectedCase.full_name.toLowerCase() === currentFullName.toLowerCase()) {
      return;
    }

    if (currentFullName.length < 2) {
      setMatchedCases([]);
      return;
    }

    const searchCases = async () => {
      setSearching(true);
      try {
        // TODO: REAL API CALL HERE to search cases by name or phone
        // Example Supabase query:
        // const { data, error } = await supabase
        //   .from('cases')
        //   .select('id, full_name, phone_number, city, status')
        //   .ilike('full_name', `%${currentFullName}%`);
        // if (data) setMatchedCases(data);

        // Temporarily empty until you plug in your API
        setMatchedCases([]);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setSearching(false);
      }
    };

    // Debounce the fetch so it doesn't spam your database on every keystroke
    const debounceTimer = setTimeout(searchCases, 400);
    return () => clearTimeout(debounceTimer);
  }, [firstName, middleName, familyName, selectedCase]);

  // Handle when a case is clicked
  const handleCaseSelect = (c) => {
    setSelectedCase(c);

    const nameParts = c.full_name.split(" ");
    if (nameParts.length >= 3) {
      setFirstName(nameParts[0]);
      setMiddleName(nameParts[1]);
      setFamilyName(nameParts.slice(2).join(" "));
    } else if (nameParts.length === 2) {
      setFirstName(nameParts[0]);
      setMiddleName("");
      setFamilyName(nameParts[1]);
    } else {
      setFirstName(c.full_name);
      setMiddleName("");
      setFamilyName("");
    }
  };

  const resetWizard = () => {
    setWizardStep("search");
    setFirstName("");
    setMiddleName("");
    setFamilyName("");
    setMatchedCases([]);
    setSelectedCase(null);
    setStudentEmail("");
  };

  // ─── CREATE ACCOUNT SUBMISSION ──────────────────────────────────────
  const handleCreateAccount = async () => {
    setCreating(true);
    try {
      const generatedPassword = Math.random().toString(36).slice(-8).toUpperCase();

      // TODO: REAL API CALL HERE to create the user auth and insert student record
      // 1. Create Auth User:
      // await supabase.auth.admin.createUser({ email: studentEmail, password: generatedPassword })
      // 2. Insert into DB:
      // const { data } = await supabase.from('students').insert({ case_id: selectedCase.id, email: studentEmail, ... })

      // Data to pass to the success modal
      const newCreds = {
        full_name: selectedCase.full_name,
        email: studentEmail,
        password: generatedPassword, // Show only once
        case_id: selectedCase.id,
        phone: selectedCase.phone_number,
      };

      setTempCreds(newCreds);

      // Optimistically update the UI list with the new student
      setStudents([{ ...newCreds, id: Date.now(), created_at: new Date().toISOString() }, ...students]);
      setShowModal(false);
    } catch (error) {
      console.error("Failed to create account:", error);
      // Handle error state here (e.g., show a toast notification)
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={`p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen ${isRtl ? "rtl" : "ltr"}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
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
          <Button
            onClick={() => {
              resetWizard();
              setShowModal(true);
            }}
          >
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
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> {s.email}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3" /> Linked to {s.case_id}
                    </p>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[500px] overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Create Student Account
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step Indicators */}
              <div className="flex items-center text-sm font-medium text-slate-500 mb-4">
                <span className={wizardStep === "search" ? "text-indigo-600 font-bold" : ""}>1. Find Case</span>
                <ChevronRight className="h-4 w-4 mx-2 opacity-50" />
                <span className={wizardStep === "email" ? "text-indigo-600 font-bold" : ""}>2. Set Email</span>
              </div>

              {wizardStep === "search" ? (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Enter the student's name to search for a matching case. Selecting a case will import all profile
                    data automatically.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">First Name *</label>
                      <input
                        className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          setSelectedCase(null);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Middle Name</label>
                      <input
                        className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={middleName}
                        onChange={(e) => {
                          setMiddleName(e.target.value);
                          setSelectedCase(null);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Family Name *</label>
                      <input
                        className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={familyName}
                        onChange={(e) => {
                          setFamilyName(e.target.value);
                          setSelectedCase(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {searching ? (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <Loader2 className="h-3 w-3 animate-spin" /> Searching cases...
                        </span>
                      ) : matchedCases.length > 0 ? (
                        <span>🔍 {matchedCases.length} matching case(s) — select to link:</span>
                      ) : firstName.length > 1 ? (
                        <span>Type to search existing cases...</span>
                      ) : null}
                    </div>

                    {matchedCases.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {matchedCases.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleCaseSelect(c)}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                              selectedCase?.id === c.id
                                ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-slate-900">{c.full_name}</span>
                              <span className="text-xs text-slate-500">{c.phone_number}</span>
                              <Badge variant={c.status === "submitted" ? "default" : "outline"}>{c.status}</Badge>
                            </div>
                            {selectedCase?.id === c.id && <Check className="h-4 w-4 text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedCase && (
                      <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-2">
                        <Check className="h-3 w-3" /> Case selected — profile data will be imported
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t mt-6">
                    <Button variant="ghost" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button disabled={!selectedCase} onClick={() => setWizardStep("email")}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-1">
                    <p className="text-xs text-indigo-600 font-bold uppercase">Linked to Case: {selectedCase?.id}</p>
                    <p className="text-sm font-semibold text-indigo-900">{selectedCase?.full_name}</p>
                    <p className="text-xs text-indigo-500">
                      {selectedCase?.phone_number} • {selectedCase?.city}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Student Email Address *</label>
                    <input
                      className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="student@example.com"
                      type="email"
                    />
                    <p className="text-xs text-slate-400 mt-1">This will be their username to log in.</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t mt-6">
                    <Button variant="ghost" onClick={() => setWizardStep("search")}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleCreateAccount}
                      disabled={creating || !studentEmail.includes("@")}
                    >
                      {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {creating ? "Creating..." : "Create Account"}
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
              <p className="text-sm text-slate-500">Share these credentials with the student.</p>
            </div>

            <div className="space-y-2 text-left">
              <div className="p-3 bg-slate-50 rounded-xl border text-sm relative">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Username</p>
                <p className="font-medium pr-8 truncate">{tempCreds.email}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(tempCreds.email)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm relative">
                <p className="text-[10px] font-bold text-amber-600 uppercase">Temp Password</p>
                <p className="font-bold text-amber-900 pr-8 tracking-wider">{tempCreds.password}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempCreds.password);
                    setCopiedPw(true);
                    setTimeout(() => setCopiedPw(false), 2000);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700"
                >
                  {copiedPw ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="success"
                className="w-full"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `مرحبا ${tempCreds.full_name},\nبيانات تسجيل الدخول:\n🔗 darb.agency/student-auth\n📧 ${tempCreds.email}\n🔑 ${tempCreds.password}\nيرجى تغيير كلمة المرور عند أول دخول.`,
                  );
                  // Default to empty string if phone is missing to prevent crash
                  const safePhone = tempCreds.phone ? tempCreds.phone.replace(/[^0-9]/g, "") : "";
                  window.open(`https://wa.me/${safePhone}?text=${msg}`, "_blank");
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> Send WhatsApp
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setTempCreds(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
