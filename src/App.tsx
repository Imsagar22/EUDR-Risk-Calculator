/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Download, 
  TrendingDown, 
  ShieldCheck, 
  Users, 
  Clock, 
  Euro, 
  Search,
  ChevronRight,
  TrendingUp,
  Lock,
  LogOut,
  ChevronDown,
  Activity,
  Zap
} from 'lucide-react';

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

import { 
  db, 
  auth, 
  googleProvider, 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  getDocs, 
  signInWithPopup,
  Timestamp
} from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

// --- Types ---
type Commodity = 'Cattle' | 'Cocoa' | 'Coffee' | 'Palm Oil' | 'Soya' | 'Wood' | 'Rubber' | 'Mixed';
type CompanySize = 'SME (<250 employees)' | 'Large Enterprise (250–999)' | 'Major Enterprise (1000+)';

interface Lead {
  id?: string;
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  turnover: number;
  commodity: string;
  companySize: string;
  createdAt: Timestamp | Date;
}

// --- Components ---

const RiskComparisonChart = ({ withoutVal, withVal, colorRisk, colorSafe }: { withoutVal: number; withVal: number; colorRisk: string; colorSafe: string }) => {
  const data = [
    { name: 'Without TraceX', value: withoutVal, color: colorRisk },
    { name: 'With TraceX', value: withVal, color: colorSafe }
  ];

  return (
    <div className="h-24 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" hide />
          <RechartsTooltip 
            cursor={{ fill: 'transparent' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-xl font-mono">
                    €{payload[0].value.toLocaleString()}
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const AuditReadinessGauge = ({ score, label, color }: { score: number; label: string; color: string }) => {
  const data = [
    { name: 'Score', value: score, color: color },
    { name: 'Remaining', value: 100 - score, color: '#f3f4f6' }
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="h-24 w-24 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={42}
              paddingAngle={2}
              dataKey="value"
              startAngle={180}
              endAngle={-180}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-sm font-black font-mono leading-none">{score}%</span>
        </div>
      </div>
      <span className="text-[8px] font-bold uppercase tracking-widest mt-1" style={{ color }}>{label}</span>
    </div>
  );
};

const ValidationError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="text-red-500 text-[9px] font-bold uppercase mt-1 flex items-center gap-1"
    >
      <AlertTriangle size={10} />
      {message}
    </motion.div>
  );
};

const Tooltip = ({ text }: { text: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button 
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Info size={14} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div 
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl pointer-events-none text-center"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="tabular-nums font-bold"
    >
      {prefix}{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}{suffix}
    </motion.span>
  );
};

export default function App() {
  // --- State ---
  const [turnover, setTurnover] = useState<number>(25000000);
  const [riskShipments, setRiskShipments] = useState<number>(1200000);
  const [staffHours, setStaffHours] = useState<number>(160);
  const [hourlyRate, setHourlyRate] = useState<number>(65);
  const [auditsPerYear, setAuditsPerYear] = useState<number>(4);
  const [commodity, setCommodity] = useState<Commodity>('Coffee');
  const [companySize, setCompanySize] = useState<CompanySize>('Large Enterprise (250–999)');
  const [isRegistered, setIsRegistered] = useState(() => {
    return localStorage.getItem('eudr_registered') === 'true';
  });
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', countryCode: '+1' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Admin State
  const [user, setUser] = useState<User | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const isAdmin = user?.email === 'marketingtracextech@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const fetchLeads = async () => {
    if (!isAdmin) return;
    setIsLoadingLeads(true);
    setAdminError(null);
    try {
      const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const leadsData: Lead[] = [];
      querySnapshot.forEach((doc) => {
        leadsData.push({ id: doc.id, ...doc.data() } as Lead);
      });
      setLeads(leadsData);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      setAdminError("Access Denied: You do not have permission to view this list.");
    } finally {
      setIsLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (showAdmin && isAdmin) {
      fetchLeads();
    }
  }, [showAdmin, isAdmin]);

  // --- Calculations ---
  const calculations = useMemo(() => {
    // 1. Financial Penalty Risk
    const penaltyRiskWithout = turnover * 0.04;
    const penaltyRiskWith = 0;

    // 2. Revenue at Risk
    const revenueRiskWithout = riskShipments;
    const revenueRiskWith = 0;

    // 3. Operational Cost
    const opCostWithout = (staffHours * 12) * hourlyRate;
    const opCostWith = opCostWithout * 0.1; // 90% reduction

    // 4. Audit Readiness Score calculation
    let baseScore = 85;
    if (staffHours > 200) baseScore -= 25;
    else if (staffHours > 100) baseScore -= 15;
    
    if (auditsPerYear > 6) baseScore -= 20;
    else if (auditsPerYear > 3) baseScore -= 10;
    
    if (companySize === 'Major Enterprise (1000+)') baseScore -= 15;
    else if (companySize === 'Large Enterprise (250–999)') baseScore -= 5;

    const auditScoreWithout = Math.max(15, baseScore);
    const auditScoreWith = 98;

    // 5. Totals
    const totalExposureWithout = penaltyRiskWithout + revenueRiskWithout + opCostWithout;
    const totalExposureWith = penaltyRiskWith + revenueRiskWith + opCostWith;
    const savings = totalExposureWithout - totalExposureWith;

    // Risk Severity
    const exposureRatio = totalExposureWithout / turnover;
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (exposureRatio > 0.1) severity = 'CRITICAL';
    else if (exposureRatio > 0.05) severity = 'HIGH';
    else if (exposureRatio > 0.02) severity = 'MEDIUM';

    return {
      penaltyRiskWithout, penaltyRiskWith,
      revenueRiskWithout, revenueRiskWith,
      opCostWithout, opCostWith,
      auditScoreWithout, auditScoreWith,
      totalExposureWithout, totalExposureWith,
      savings,
      severity
    };
  }, [turnover, riskShipments, staffHours, hourlyRate, auditsPerYear, companySize]);

  const handleDownload = () => {
    const report = `
EUDR COMPLIANCE RISK REPORT
---------------------------
Timestamp: ${new Date().toLocaleString()}
User: ${formData.name} (${formData.email})
Phone: ${formData.countryCode} ${formData.phone}
Company Size: ${companySize}
Commodity Category: ${commodity}

INPUT SUMMARY:
Annual Turnover: €${turnover.toLocaleString()}
Value of Goods at Risk of Prohibition: €${riskShipments.toLocaleString()}
Manual Data Collection & Reporting: ${staffHours} hrs/month @ €${hourlyRate}/hr

RISK ANALYSIS (WITHOUT TRACEX):
- Potential Penalty Risk (4% cap): €${calculations.penaltyRiskWithout.toLocaleString()}
- Potential Revenue Loss (Prohibition): €${calculations.revenueRiskWithout.toLocaleString()}
- Annual Operational Cost: €${calculations.opCostWithout.toLocaleString()}
- Audit Readiness Score: ${calculations.auditScoreWithout}/100 
---------------------------
TOTAL ANNUAL EXPOSURE: €${calculations.totalExposureWithout.toLocaleString()}

WITH TRACEX:
- Total Annual Cost: €${calculations.totalExposureWith.toLocaleString()}
- Guaranteed Compliance Savings: €${calculations.savings.toLocaleString()}
- Audit Readiness: 98/100

Notes: Calculations based on EU Deforestation Regulation (EU) 2023/1115 penalty framework.
    `;
    const element = document.createElement("a");
    const file = new Blob([report], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "EUDR_Risk_Report.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // --- Validation Helpers ---
  const validateField = (name: string, value: any) => {
    let error = "";
    switch (name) {
      case "name":
        if (value.length < 2) error = "Name must be at least 2 characters";
        break;
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) error = "Invalid professional email format";
        break;
      case "phone":
        const phoneRegex = /^\d{7,15}$/;
        if (!phoneRegex.test(value.replace(/\s/g, ""))) error = "Invalid phone format (7-15 digits)";
        break;
      case "turnover":
        if (value < 0) error = "Turnover cannot be negative";
        if (value > 1000000000000) error = "Value exceeds logical bounds";
        break;
      case "riskShipments":
        if (value < 0) error = "Value cannot be negative";
        if (value > turnover) error = "Risk cannot exceed total turnover";
        break;
      case "staffHours":
        if (value < 0) error = "Hours cannot be negative";
        if (value > 744) error = "Exceeds total hours in a month";
        break;
      case "hourlyRate":
        if (value < 0) error = "Rate cannot be negative";
        if (value > 10000) error = "Exceeds expected rate bounds";
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return !error;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isNameValid = validateField("name", formData.name);
    const isEmailValid = validateField("email", formData.email);
    const isPhoneValid = validateField("phone", formData.phone);

    if (isNameValid && isEmailValid && isPhoneValid) {
      setIsSubmitting(true);
      try {
        await addDoc(collection(db, 'leads'), {
          ...formData,
          turnover,
          commodity,
          companySize,
          createdAt: serverTimestamp()
        });
        setIsRegistered(true);
        localStorage.setItem('eudr_registered', 'true');
      } catch (error) {
        console.error("Error saving lead:", error);
        // Fallback to allow them to use the tool anyway if DB fails for some reason
        setIsRegistered(true);
        localStorage.setItem('eudr_registered', 'true');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAdminLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAdmin(true);
    } catch (error) {
      console.error("Admin login error:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowAdmin(false);
  };

  const exportLeadsToCSV = () => {
    if (leads.length === 0) return;
    
    const headers = ['Date', 'Name', 'Email', 'Phone', 'Company Size', 'Turnover', 'Commodity'];
    const rows = leads.map(l => [
      l.createdAt instanceof Timestamp ? l.createdAt.toDate().toISOString() : new Date(l.createdAt).toISOString(),
      l.name,
      l.email,
      `="${l.countryCode} ${l.phone}"`, // Excel formatting for phone
      l.companySize,
      l.turnover,
      l.commodity
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'bg-risk text-white';
      case 'HIGH': return 'bg-risk text-white';
      default: return 'bg-[#f39c12] text-white';
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-ink font-sans w-full max-w-full overflow-x-hidden relative">
      <AnimatePresence>
        {!isRegistered && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-forest/40 backdrop-blur-md overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white max-w-md w-full p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-100 my-auto"
            >
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-forest rounded-2xl flex items-center justify-center text-white">
                  <ShieldCheck size={28} className="md:w-8 md:h-8" />
                </div>
              </div>
              
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-black text-forest">Executive Access</h2>
                <p className="text-xs md:text-sm text-gray-500 mt-2">
                  Verify your identity to access the EUDR Compliance Risk Calculator.
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({...formData, name: val});
                      validateField("name", val);
                    }}
                    className={`w-full p-3 bg-gray-50 border ${errors.name ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-forest outline-none transition-all`}
                  />
                  <ValidationError message={errors.name} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Work Email</label>
                  <input 
                    required
                    type="email" 
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({...formData, email: val});
                      validateField("email", val);
                    }}
                    className={`w-full p-3 bg-gray-50 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-forest outline-none transition-all`}
                  />
                  <ValidationError message={errors.email} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                  <div className="flex gap-2">
                    <select 
                      className="p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none w-24"
                      value={formData.countryCode}
                      onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
                    >
                      <option value="+1">+1 (US)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+49">+49 (DE)</option>
                      <option value="+33">+33 (FR)</option>
                      <option value="+91">+91 (IN)</option>
                      <option value="+65">+65 (SG)</option>
                      <option value="+61">+61 (AU)</option>
                    </select>
                    <input 
                      required
                      type="tel" 
                      placeholder="123 456 789"
                      value={formData.phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({...formData, phone: val});
                        validateField("phone", val);
                      }}
                      className={`flex-1 p-3 bg-gray-50 border ${errors.phone ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-forest outline-none transition-all`}
                    />
                  </div>
                  <ValidationError message={errors.phone} />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-forest text-white rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-forest/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>Generate Analysis Access <ChevronRight size={18} /></>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                  By accessing this tool, you agree to our Terms of Use. Data collected is used strictly for generating the regulatory risk report.
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-forest text-white px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 shadow-lg sticky top-0 z-40">
        <div className="text-center sm:text-left">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">EUDR Compliance Risk Calculator</h1>
          <p className="text-[10px] md:text-xs opacity-80 uppercase tracking-widest font-semibold">Senior Regulatory Analysis Framework v1.4</p>
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 md:gap-4 w-full sm:w-auto">
          <button 
            onClick={isAdmin ? () => setShowAdmin(true) : handleAdminLogin}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-md text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/10"
          >
            {isAdmin ? <Users size={14} /> : <Lock size={14} />}
            {isAdmin ? 'View Leads' : 'Owner Portal'}
          </button>
          
          <div className="bg-[#e9eceb] text-ink px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-bold flex items-center gap-2 md:gap-3 border border-gray-200">
            <div className="flex flex-col items-center sm:items-start leading-none">
              <span className="text-[7px] md:text-[8px] uppercase tracking-[0.2em] text-gray-500 mb-1 flex items-center gap-1">
                <div className="w-1 h-1 bg-risk rounded-full animate-pulse" /> Live Analysis
              </span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-ink/60">Risk Profile:</span>
            </div>
            <div className={`px-2 md:px-3 py-1 rounded md:rounded-md text-[9px] md:text-[10px] uppercase font-black tracking-widest shadow-sm ${getSeverityStyle(calculations.severity)}`}>
              {calculations.severity}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-10 flex flex-col gap-10 pb-40 w-full items-stretch">
        
        {/* Horizontal Top Inputs */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm w-full">
          <div className="border-b border-gray-200 pb-2 mb-6">
            <h2 className="text-sm font-black text-forest uppercase tracking-[0.2em]">
              Operational Inputs
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 w-full">
            <div className="input-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Annual Turnover (€)</label>
                <Tooltip text="Your total annual global turnover. Used to calculate Article 25 fines (capped at 4%)." />
              </div>
              <input 
                type="number" 
                value={turnover} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTurnover(val);
                  validateField("turnover", val);
                }}
                className={`w-full p-2 border ${errors.turnover ? 'border-red-500 text-red-500' : 'border-gray-200'} rounded bg-gray-50/50 font-mono text-sm focus:ring-1 focus:ring-forest outline-none transition-all`}
              />
              <ValidationError message={errors.turnover} />
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Non-Geolocated Goods (€)</label>
                <Tooltip text="Annual value of EU imports lacking precise GPS coordinates or land-plot verification." />
              </div>
              <input 
                type="number" 
                value={riskShipments} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRiskShipments(val);
                  validateField("riskShipments", val);
                }}
                className={`w-full p-2 border ${errors.riskShipments ? 'border-red-500 text-red-500' : 'border-gray-200'} rounded bg-gray-50/50 font-mono text-sm focus:ring-1 focus:ring-forest outline-none transition-all`}
              />
              <ValidationError message={errors.riskShipments} />
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Manual Geolocation & Data Collection (Hrs/Month)</label>
                <Tooltip text="Total monthly hours your team spends manually collecting geolocation data, verifying suppliers, and preparing due diligence statements." />
              </div>
              <input 
                type="number" 
                value={staffHours} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setStaffHours(val);
                  validateField("staffHours", val);
                }}
                className={`w-full p-2 border ${errors.staffHours ? 'border-red-500 text-red-500' : 'border-gray-200'} rounded bg-gray-50/50 font-mono text-sm focus:ring-1 focus:ring-forest outline-none transition-all`}
              />
              <ValidationError message={errors.staffHours} />
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Staff Hourly Rate (€)</label>
                <Tooltip text="Average fully-loaded hourly cost of staff dedicated to compliance and data verification." />
              </div>
              <input 
                type="number" 
                value={hourlyRate} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHourlyRate(val);
                  validateField("hourlyRate", val);
                }}
                className={`w-full p-2 border ${errors.hourlyRate ? 'border-red-500 text-red-500' : 'border-gray-200'} rounded bg-gray-50/50 font-mono text-sm focus:ring-1 focus:ring-forest outline-none transition-all`}
              />
              <ValidationError message={errors.hourlyRate} />
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Commodity Category</label>
                <Tooltip text="Primary commodity traded. Different goods have varying traceability requirements." />
              </div>
              <select 
                value={commodity}
                onChange={(e) => setCommodity(e.target.value as Commodity)}
                className="w-full p-2 border border-gray-200 rounded bg-gray-50/50 font-semibold text-xs focus:ring-1 focus:ring-forest outline-none transition-all h-[38px]"
              >
                <option>Coffee</option>
                <option>Cocoa</option>
                <option>Palm Oil</option>
                <option>Soya</option>
                <option>Wood</option>
                <option>Rubber</option>
                <option>Cattle</option>
              </select>
            </div>

            <div className="input-group">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Enterprise Scale</label>
                <Tooltip text="Affects enforcement timelines and reporting complexity under EUDR guidelines." />
              </div>
              <select 
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value as CompanySize)}
                className="w-full p-2 border border-gray-200 rounded bg-gray-50/50 font-semibold text-xs focus:ring-1 focus:ring-forest outline-none transition-all h-[38px]"
              >
                <option>SME (&lt;250 employees)</option>
                <option>Large Enterprise (250–999)</option>
                <option>Major Enterprise (1000+)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Output Cards */}
        <section className="space-y-6 w-full max-w-full">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-sm font-black text-forest uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity size={18} />
              Risk Analysis Matrix
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase shrink-0">
              <div className="w-2 h-2 rounded-full bg-risk opacity-80" /> Without TraceX
              <div className="w-2 h-2 rounded-full bg-safe opacity-80 ml-2" /> With TraceX
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            
            {/* Card: Financial Penalty Risk */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Euro size={80} />
                </div>
              </div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Article 25 Exposure</span>
                  <span className="text-xs font-bold text-ink uppercase tracking-tight">Financial Penalty Risk</span>
                </div>
                <Tooltip text="EU 2023/1115 Art. 25: Maximum fine of at least 4% of total annual Union turnover" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4 font-mono">
                <div>
                  <div className="text-[9px] font-bold text-risk uppercase mb-1">Without TraceX</div>
                  <div className="text-xl font-bold text-risk tracking-tighter">
                    <AnimatedNumber value={calculations.penaltyRiskWithout} prefix="€" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold text-safe uppercase mb-1">With TraceX</div>
                  <div className="text-xl font-bold text-safe tracking-tighter">€0</div>
                </div>
              </div>
              
              <RiskComparisonChart 
                withoutVal={calculations.penaltyRiskWithout} 
                withVal={calculations.penaltyRiskWith} 
                colorRisk="#BC4749" 
                colorSafe="#386641" 
              />

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-safe" />
                <span className="text-[10px] font-semibold text-safe">Implementing TraceX eliminates this risk entirely</span>
              </div>
            </div>

            {/* Card: Revenue Risk */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
               <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingDown size={80} />
                </div>
              </div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Market Prohibition</span>
                  <span className="text-xs font-bold text-ink uppercase tracking-tight">Revenue at Risk</span>
                </div>
                <Tooltip text="Potential loss of market access for non-compliant shipments under EUDR Article 3." />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4 font-mono">
                <div>
                  <div className="text-[9px] font-bold text-risk uppercase mb-1">Without TraceX</div>
                  <div className="text-xl font-bold text-risk tracking-tighter">
                    <AnimatedNumber value={calculations.revenueRiskWithout} prefix="€" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold text-safe uppercase mb-1">With TraceX</div>
                  <div className="text-xl font-bold text-safe tracking-tighter">€0</div>
                </div>
              </div>
              
              <RiskComparisonChart 
                withoutVal={calculations.revenueRiskWithout} 
                withVal={calculations.revenueRiskWith} 
                colorRisk="#BC4749" 
                colorSafe="#386641" 
              />

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-safe" />
                <span className="text-[10px] font-semibold text-safe">Implementing TraceX eliminates this risk entirely</span>
              </div>
            </div>

            {/* Card: Operational Cost */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
               <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Clock size={80} />
                </div>
              </div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Annual Resource Spend</span>
                  <span className="text-xs font-bold text-ink uppercase tracking-tight">Compliance Ops Cost</span>
                </div>
                <Tooltip text="Labor costs associated with manual geolocation and due diligence collection" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4 font-mono">
                <div>
                  <div className="text-[9px] font-bold text-risk uppercase mb-1">Without TraceX</div>
                  <div className="text-xl font-bold text-risk tracking-tighter">
                    <AnimatedNumber value={calculations.opCostWithout} prefix="€" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold text-safe uppercase mb-1">With TraceX</div>
                  <div className="text-xl font-bold text-safe tracking-tighter">
                    <AnimatedNumber value={calculations.opCostWith} prefix="€" />
                  </div>
                </div>
              </div>
              
              <RiskComparisonChart 
                withoutVal={calculations.opCostWithout} 
                withVal={calculations.opCostWith} 
                colorRisk="#BC4749" 
                colorSafe="#386641" 
              />

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-safe" />
                <span className="text-[10px] font-semibold text-safe">TraceX reduces this cost by 90%</span>
              </div>
            </div>

            {/* Card: Audit Readiness */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
               <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ShieldCheck size={80} />
                </div>
              </div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Verification Probability</span>
                  <span className="text-xs font-bold text-ink uppercase tracking-tight">Audit Readiness Score</span>
                </div>
                <Tooltip text="Weighted probability of passing a Competent Authority inspection" />
              </div>
              
              <div className="flex justify-around items-center pt-2">
                <AuditReadinessGauge 
                  score={calculations.auditScoreWithout} 
                  label="Without TraceX" 
                  color="#BC4749" 
                />
                <div className="h-12 w-px bg-gray-100" />
                <AuditReadinessGauge 
                  score={calculations.auditScoreWith} 
                  label="With TraceX" 
                  color="#386641" 
                />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-safe" />
                <span className="text-[10px] font-semibold text-safe">TraceX secures a 98% audit readiness score</span>
              </div>
            </div>
          </div>
        </section>

        {/* Summary Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-forest p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden w-full"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap size={140} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
            <div className="max-w-2xl text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-black mb-4 leading-tight uppercase tracking-tight">
                EUDR Compliance Impact Summary
              </h3>
              <p className="text-sm md:text-base text-white/90 font-medium italic leading-relaxed">
                "By implementing the TraceX EUDR Compliance Solution, your total exposure 
                of <span className="text-white font-bold underline decoration-risk decoration-2 underline-offset-4">€{calculations.totalExposureWithout.toLocaleString()}</span> reduces to near 
                zero — saving you <span className="text-safe-light bg-safe/30 px-2 py-0.5 rounded font-bold uppercase tracking-tight">€{calculations.savings.toLocaleString()}</span> annually."
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 bg-white/5 p-6 rounded-2xl border border-white/10 shrink-0 w-full md:w-auto">
              <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Calculated ROI</div>
              <div className="text-5xl font-black text-safe-light tracking-tighter">90%<span className="text-sm ml-1 font-normal opacity-60">Effort Reduction</span></div>
              <div className="text-[9px] text-white/40 uppercase font-bold tracking-widest mt-1">Audit-Ready in Days</div>
            </div>
          </div>
        </motion.div>

        {/* Padding Spacer to prevent footer overlap */}
        <div className="h-48 w-full shrink-0" />
      </div>

      {/* Footer Summary Bar */}
      <footer className="fixed bottom-0 left-0 right-0 w-full min-h-[80px] md:h-[120px] bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 flex flex-col md:flex-row items-center px-4 md:px-20 py-4 md:py-0 gap-4 md:gap-10 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] max-w-full overflow-hidden">
        <div className="flex w-full md:flex-1 gap-3 md:gap-6">
          <div className="bg-[#fdf2f2] border-l-4 border-risk p-2 md:p-3 flex-1">
            <div className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <AlertTriangle size={10} />
              <span className="hidden sm:inline">Total Exposure</span>
              <span className="sm:hidden">Exposure</span>
            </div>
            <div className="text-lg md:text-2xl font-black text-risk leading-none mt-1">
              <AnimatedNumber value={calculations.totalExposureWithout} prefix="€" />
            </div>
          </div>

          <div className="bg-[#f2fdf5] border-l-4 border-safe p-2 md:p-3 flex-1">
            <div className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <ShieldCheck size={10} />
              <span className="hidden sm:inline">Compliance Savings</span>
              <span className="sm:hidden">Savings</span>
            </div>
            <div className="text-lg md:text-2xl font-black text-safe leading-none mt-1">
              <AnimatedNumber value={calculations.savings} prefix="€" />
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col items-center md:items-end gap-1 md:gap-2 md:pr-10">
          <button 
            onClick={handleDownload}
            className="w-full md:w-auto bg-forest text-white px-8 py-3 rounded font-black text-[10px] md:text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-md"
          >
            Download Report
          </button>
          <p className="text-[7px] md:text-[8px] text-gray-400 uppercase tracking-tighter">Powered by TraceX Regulatory Engine</p>
        </div>
      </footer>

      {/* Admin Dashboard Overlay */}
      <AnimatePresence>
        {showAdmin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-app-bg overflow-auto p-4 md:p-8"
          >
            <div className="max-w-6xl mx-auto">
              <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b pb-6 gap-6">
                <div className="text-center md:text-left">
                  <h1 className="text-2xl md:text-3xl font-black text-forest flex flex-col md:flex-row items-center gap-2 md:gap-3">
                    <Lock size={28} className="text-forest/60" />
                    Leads Dashboard
                  </h1>
                  <p className="text-gray-500 text-xs md:text-sm mt-1">Regulatory Calculator Data Collection</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="text-center md:text-right hidden sm:block">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Admin Access</div>
                    <div className="text-sm font-semibold truncate max-w-[200px]">{user?.email}</div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button 
                      onClick={exportLeadsToCSV}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-forest text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-forest/90 transition-colors shadow-sm"
                    >
                      <Download size={16} />
                      Export CSV
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-risk transition-colors shadow-sm flex items-center justify-center"
                      title="Logout"
                    >
                      <LogOut size={20} />
                    </button>
                    <button 
                      onClick={() => setShowAdmin(false)}
                      className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-forest transition-colors shadow-sm font-bold text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </header>

              {adminError ? (
                <div className="bg-risk/10 border border-risk/20 p-6 rounded-2xl text-risk flex items-center gap-4">
                  <AlertTriangle size={24} />
                  <div>
                    <h3 className="font-bold">Access Error</h3>
                    <p className="text-sm opacity-80">{adminError}</p>
                    <button onClick={handleLogout} className="mt-4 px-6 py-2 bg-risk text-white rounded-lg text-xs font-bold uppercase tracking-widest">
                      Switch Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <th className="px-6 py-4">Submission Date</th>
                          <th className="px-6 py-4">Lead Name</th>
                          <th className="px-6 py-4">Contact Info</th>
                          <th className="px-6 py-4">Enterprise Data</th>
                          <th className="px-6 py-4 text-right">Calculator Context</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {isLoadingLeads ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                              <div className="flex flex-col items-center gap-4">
                                <motion.div 
                                  animate={{ rotate: 360 }}
                                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                  className="w-8 h-8 border-4 border-gray-100 border-t-forest rounded-full"
                                />
                                <span className="text-xs uppercase tracking-widest font-bold">Synchronizing Database...</span>
                              </div>
                            </td>
                          </tr>
                        ) : leads.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-gray-400 uppercase tracking-widest text-xs font-bold">
                              No leads recorded yet.
                            </td>
                          </tr>
                        ) : (
                          leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 text-xs">
                                <div className="font-semibold">
                                  {lead.createdAt instanceof Timestamp 
                                    ? lead.createdAt.toDate().toLocaleDateString()
                                    : new Date(lead.createdAt).toLocaleDateString()}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {lead.createdAt instanceof Timestamp 
                                    ? lead.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : new Date(lead.createdAt).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-bold text-forest">{lead.name}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium">{lead.email}</div>
                                <div className="text-[10px] text-gray-500 font-mono">{lead.countryCode} {lead.phone}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-xs font-bold text-gray-600">{lead.companySize}</div>
                                <div className="text-[10px] text-gray-400 uppercase tracking-tighter">Turnover: €{lead.turnover?.toLocaleString()}</div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="inline-block px-2 py-1 bg-forest/10 text-forest text-[10px] font-black rounded uppercase tracking-widest">
                                  {lead.commodity}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {isLoadingLeads ? (
                      <div className="px-6 py-20 text-center text-gray-400">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          className="w-8 h-8 border-4 border-gray-100 border-t-forest rounded-full mx-auto mb-4"
                        />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Synchronizing...</span>
                      </div>
                    ) : leads.length === 0 ? (
                      <div className="px-6 py-20 text-center text-gray-400 uppercase tracking-widest text-[10px] font-bold">
                        No leads recorded.
                      </div>
                    ) : (
                      leads.map((lead) => (
                        <div key={lead.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-bold text-forest">{lead.name}</div>
                              <div className="text-[10px] text-gray-500">{lead.email}</div>
                            </div>
                            <span className="px-2 py-1 bg-forest/10 text-forest text-[8px] font-black rounded uppercase tracking-widest">
                              {lead.commodity}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                            <div>
                              <div className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Contact</div>
                              <div className="text-[10px] font-mono">{lead.countryCode} {lead.phone}</div>
                            </div>
                            <div>
                              <div className="text-[8px] text-gray-400 uppercase font-black tracking-widest mb-1">Enterprise</div>
                              <div className="text-[10px]">{lead.companySize}</div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2 text-[9px] text-gray-400 italic">
                            <span>
                              {lead.createdAt instanceof Timestamp 
                                ? lead.createdAt.toDate().toLocaleString()
                                : new Date(lead.createdAt).toLocaleString()}
                            </span>
                            <span>€{lead.turnover?.toLocaleString()} turnover</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Download - visible only on small screens */}
      <div className="lg:hidden fixed bottom-[120px] right-4 z-50">
        <button 
          onClick={handleDownload}
          className="bg-forest text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-transform"
        >
          <Download size={20} />
        </button>
      </div>
    </div>
  );
}
