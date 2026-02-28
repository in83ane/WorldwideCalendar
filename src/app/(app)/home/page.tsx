"use client";

import React, { useMemo, useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    Search, X, CalendarDays, Clock, Briefcase, User,
    FileText, ArrowRight, Pencil, Trash2, Save, Maximize, Minimize, Info
} from 'lucide-react';

// ==============================================================================
// 1. TYPES & CONSTANTS
// ==============================================================================

type WorkScheduleItem = {
    id: string;
    work_date: string;
    end_date: string | null;
    work_time: string;
    work_shift: string;
    department: string;
    detail: string;
    worker_role: string;
    worker: string;
    user_id: string;
    created_at: string;
    status: 'pending' | 'inprogress' | 'complete' | null;
};

type WorkFormData = {
    work_date: string;
    end_date: string;
    work_time: string;
    department: string;
    detail: string;
    worker_role: string;
    worker_name: string;
};

const TECHNICIAN_ROLES = ["ช่างคอมพิวเตอร์", "ช่างพรินเตอร์", "ช่างเดินระบบ"];

const getColorClasses = (role: string | undefined) => {
    switch (role) {
        case "ช่างคอมพิวเตอร์":
            return { text: "text-blue-800", bg: "bg-blue-100/50", border: "border-blue-500", accent: "bg-blue-700", hex: "#1d4ed8" };
        case "ช่างพรินเตอร์":
            return { text: "text-emerald-800", bg: "bg-emerald-100/50", border: "border-emerald-500", accent: "bg-emerald-700", hex: "#047857" };
        case "ช่างเดินระบบ":
            return { text: "text-pink-800", bg: "bg-pink-100/50", border: "border-pink-500", accent: "bg-pink-700", hex: "#be185d" };
        default:
            return { text: "text-slate-800", bg: "bg-slate-100/50", border: "border-slate-500", accent: "bg-slate-700", hex: "#334155" };
    }
};

const getStatusClasses = (status: WorkScheduleItem['status']) => {
    switch (status) {
        case 'complete': return { bg: 'bg-emerald-200', text: 'text-emerald-900', label: 'เสร็จสิ้น' };
        case 'inprogress': return { bg: 'bg-amber-200', text: 'text-amber-900', label: 'กำลังทำ' };
        default: return { bg: 'bg-white', text: 'text-slate-800', label: 'รอรับงาน' };
    }
};

const customStyles = `
  @keyframes pulse-overdue {
    0%, 100% { background-color: #fee2e2; border-color: #dc2626; }
    50% { background-color: #fecaca; border-color: #dc2626; }
  }
  @keyframes pulse-inprogress {
    0%, 100% { background-color: #fef3c7; border-color: #d97706; }
    50% { background-color: #fde68a; border-color: #d97706; }
  }
  .animate-overdue { 
    animation: pulse-overdue 1.6s infinite ease-in-out; 
    border-left-width: 8px !important;
  }
  .animate-inprogress { 
    animation: pulse-inprogress 2s infinite ease-in-out; 
    border-left-width: 8px !important;
  }
`;

function getThaiShift(timeStr: string): string {
    const [h, m] = timeStr.split(":").map(Number);
    const minutes = h * 60 + m;
    if (minutes >= 300 && minutes < 720) return "เช้า";
    if (minutes >= 720 && minutes < 1080) return "บ่าย";
    return "ค่ำ/ดึก";
}

function formatDisplayDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}

// ==============================================================================
// 2. MAIN COMPONENT
// ==============================================================================

export default function HomePage() {
    const supabase = useMemo(() => createClient(), []);

    const [user, setUser] = useState<{ id: string, email: string, role: string } | null>(null);
    const [workSchedule, setWorkSchedule] = useState<WorkScheduleItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isTableZoomed, setIsTableZoomed] = useState(false);
    const [now, setNow] = useState(new Date());

    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedWork, setSelectedWork] = useState<WorkScheduleItem | null>(null);
    const [showWorkModal, setShowWorkModal] = useState(false);

    const initialFormState: WorkFormData = {
        work_date: new Date().toISOString().split('T')[0],
        end_date: '',
        work_time: '08:30',
        department: '',
        detail: '',
        worker_role: '',
        worker_name: '',
    };
    const [formData, setFormData] = useState<WorkFormData>(initialFormState);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const refreshSchedule = async () => {
        const { data: schedule } = await supabase
            .from("work_schedule")
            .select("*")
            .order("work_date", { ascending: true })
            .order("work_time", { ascending: true });
        setWorkSchedule((schedule || []) as WorkScheduleItem[]);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            refreshSchedule();
        }, 3 * 60 * 1000); // 3 minutes
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        async function fetchData() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return redirect("/auth/login");
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
            setUser({ id: authUser.id, email: authUser.email || 'N/A', role: profile?.role || 'user' });
            await refreshSchedule();
            setLoading(false);
        }
        fetchData();
    }, []);

    const getJobAnimationClass = (item: WorkScheduleItem) => {
        if (item.status === 'complete') return "";
        const [h, m] = item.work_time.split(':').map(Number);
        const workDate = new Date(item.work_date + 'T00:00:00');
        workDate.setHours(h, m, 0, 0);

        if (item.status === 'inprogress') return "animate-inprogress shadow-amber-300 shadow-md";
        if (item.status === 'pending' && workDate < now) return "animate-overdue shadow-rose-300 shadow-md";
        return "";
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!isAdmin) return;
        try {
            setLoading(true);
            const payload = {
                work_date: formData.work_date,
                end_date: formData.end_date || formData.work_date,
                work_time: formData.work_time,
                work_shift: getThaiShift(formData.work_time),
                department: formData.department,
                detail: formData.detail,
                worker_role: formData.worker_role,
                worker: formData.worker_name,
                user_id: user?.id,
            };

            if (editingId) {
                const { error } = await supabase.from("work_schedule").update(payload).eq("id", editingId);
                if (error) throw error;
                setEditingId(null);
            } else {
                const { error } = await supabase.from("work_schedule").insert({ ...payload, status: 'pending' });
                if (error) throw error;
            }

            setFormData(initialFormState);
            await refreshSchedule();
        } catch (err) {
            console.error(err);
            alert("บันทึกข้อมูลไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(id: string, newStatus: string) {
        const { error } = await supabase.from("work_schedule").update({ status: newStatus }).eq("id", id);
        if (!error) {
            await refreshSchedule();
            setShowWorkModal(false);
        }
    }

    const filteredWork = useMemo(() => {
        return workSchedule.filter(item => {
            const lowerSearch = searchTerm.toLowerCase();
            const matchSearch = item.department.toLowerCase().includes(lowerSearch) ||
                item.detail.toLowerCase().includes(lowerSearch) ||
                item.worker.toLowerCase().includes(lowerSearch);
            if (!searchTerm && item.status === 'complete') return false;
            return matchSearch;
        });
    }, [workSchedule, searchTerm]);

    return (
        <main className={`transition-all duration-300 ${isTableZoomed ? 'fixed inset-0 bg-slate-50 z-50 p-4 overflow-y-auto' : 'max-w-7xl mx-auto p-4 md:p-8'}`}>
            <style dangerouslySetInnerHTML={{ __html: customStyles }} />

            <header className={`mb-8 flex justify-between items-end ${isTableZoomed ? 'hidden' : ''}`}>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-xl text-white shadow-lg"><Briefcase size={24} /></div>
                        ระบบจัดการตารางงาน
                    </h1>
                </div>
            </header>

            {/* Form Section - ปรับสีปุ่มให้เข้มขึ้น */}
            {isAdmin && !isTableZoomed && (
                <section className={`bg-white rounded-3xl shadow-sm border-2 p-6 mb-10 transition-all ${editingId ? 'border-orange-500 shadow-orange-100' : 'border-slate-200'}`}>
                    <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-slate-900">
                        {editingId ? '📝 แก้ไขข้อมูลงาน' : 'สร้างแผนงานใหม่'}
                    </h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input name="work_date" type="date" required className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.work_date} onChange={(e) => setFormData({ ...formData, work_date: e.target.value })} />
                            <input name="end_date" type="date" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} min={formData.work_date} />
                        </div>
                        <input name="work_time" type="time" required className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.work_time} onChange={(e) => setFormData({ ...formData, work_time: e.target.value })} />
                        <input name="department" placeholder="หน่วยงาน..." required className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
                        <select name="worker_role" required className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.worker_role} onChange={(e) => setFormData({ ...formData, worker_role: e.target.value })}>
                            <option value="">เลือกสายงาน</option>
                            {TECHNICIAN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input name="worker_name" placeholder="ชื่อช่าง..." required className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.worker_name} onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })} />
                        <textarea name="detail" rows={2} placeholder="รายละเอียดงาน..." required className="md:col-span-3 w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-slate-900 outline-none transition-all" value={formData.detail} onChange={(e) => setFormData({ ...formData, detail: e.target.value })} />

                        <div className="md:col-span-3 flex gap-3">
                            <button
                                type="submit"
                                className={`flex-grow py-4 text-white rounded-2xl font-black shadow-lg transition-all active:scale-[0.97] 
                                    ${editingId
                                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
                                        : 'bg-slate-900 hover:bg-black shadow-slate-300'}`}
                            >
                                {editingId ? 'บันทึกการแก้ไข' : 'บันทึกลงตารางงาน'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={() => { setEditingId(null); setFormData(initialFormState); }}
                                    className="px-8 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-2xl font-bold transition-all active:scale-[0.97]"
                                >
                                    ยกเลิก
                                </button>
                            )}
                        </div>
                    </form>
                </section>
            )}

            {/* List Section */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input type="text" placeholder="ค้นหา..." className="w-full pl-11 pr-4 py-2.5 border-2 border-slate-300 rounded-2xl text-sm font-bold outline-none focus:border-slate-900 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <button
                        onClick={() => setIsTableZoomed(!isTableZoomed)}
                        className="ml-2 p-3 bg-white border-2 border-slate-300 rounded-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-90"
                    >
                        {isTableZoomed ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredWork.map(item => {
                        const colors = getColorClasses(item.worker_role);
                        const status = getStatusClasses(item.status);
                        const animationClass = getJobAnimationClass(item);
                        const isMultiDay = item.end_date && item.end_date !== item.work_date;

                        return (
                            <div
                                key={item.id}
                                className={`group ${colors.bg} border-l-[8px] rounded-3xl shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-6 transition-all hover:scale-[1.01] hover:shadow-md ${animationClass || colors.border}`}
                            >
                                {/* Date Box */}
                                <div className="flex-shrink-0 w-full md:w-52 cursor-pointer" onClick={() => { setSelectedWork(item); setShowWorkModal(true); }}>
                                    <div className={`rounded-2xl py-3 px-4 text-center border-2 border-white shadow-sm transition-colors ${animationClass ? 'bg-white' : 'bg-white/70'}`}>
                                        <div className="text-[10px] font-black uppercase text-slate-600 mb-1 tracking-widest">
                                            {isMultiDay ? 'ช่วงวันที่' : 'วันที่นัดหมาย'}
                                        </div>
                                        <div className="text-[15px] font-black text-slate-900">
                                            {formatDisplayDate(item.work_date)}
                                            {isMultiDay && <span className="block text-xs text-slate-500">ถึง {formatDisplayDate(item.end_date)}</span>}
                                        </div>
                                        <div className={`mt-2 flex items-center justify-center gap-1.5 font-black text-xs py-1.5 rounded-lg bg-white border-2 ${colors.text} ${colors.border}`}>
                                            <Clock size={14} /> {item.work_time} น.
                                        </div>
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="flex-grow cursor-pointer" onClick={() => { setSelectedWork(item); setShowWorkModal(true); }}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`text-[11px] font-black px-3 py-1 rounded-lg uppercase tracking-wider border-2 ${status.bg} ${status.text} border-current/20`}>
                                            {animationClass.includes('overdue') ? '⚠️ เลยกำหนด' : status.label}
                                        </span>
                                        <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                            {item.department}
                                        </span>
                                    </div>
                                    <h3 className="font-black text-slate-900 text-xl leading-tight mb-2">
                                        {item.detail}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white shadow-lg" style={{ backgroundColor: colors.hex }}>
                                            {item.worker.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 leading-none">{item.worker}</p>
                                            <p className={`text-[12px] font-black ${colors.text} uppercase`}>{item.worker_role}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Admin Actions - เข้มขึ้น */}
                                {isAdmin && (
                                    <div className="flex md:flex-col lg:flex-row gap-2 md:pl-6 border-t md:border-t-0 md:border-l border-slate-300 pt-4 md:pt-0">
                                        <button onClick={() => {
                                            setEditingId(item.id);
                                            setFormData({
                                                work_date: item.work_date, end_date: item.end_date || '', work_time: item.work_time,
                                                department: item.department, detail: item.detail, worker_role: item.worker_role, worker_name: item.worker
                                            });
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }} className="p-3 text-orange-600 hover:bg-orange-100 rounded-xl transition-all active:scale-90"><Pencil size={18} /></button>
                                        <button onClick={async () => {
                                            if (confirm("ลบงานนี้?")) {
                                                const { error } = await supabase.from("work_schedule").delete().eq("id", item.id);
                                                if (!error) refreshSchedule();
                                            }
                                        }} className="p-3 text-rose-700 hover:bg-rose-100 rounded-xl transition-all active:scale-90"><Trash2 size={18} /></button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Modal หน้ารายละเอียด - สีเข้มขึ้น */}
            {showWorkModal && selectedWork && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowWorkModal(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border-4 border-white" onClick={e => e.stopPropagation()}>
                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl" style={{ backgroundColor: getColorClasses(selectedWork.worker_role).hex }}>
                                        {selectedWork.worker.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-2xl">{selectedWork.worker}</h3>
                                        <p className={`text-[12px] font-black uppercase px-3 py-1 rounded-md inline-block mt-1 ${getColorClasses(selectedWork.worker_role).bg} ${getColorClasses(selectedWork.worker_role).text}`}>
                                            {selectedWork.worker_role}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowWorkModal(false)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all active:scale-90">
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-5 bg-slate-100 rounded-2xl flex items-center gap-4 border-2 border-transparent hover:border-slate-300 transition-all">
                                    <CalendarDays className="text-slate-900" size={24} />
                                    <span className="font-black text-slate-900 text-lg">{selectedWork.department}</span>
                                </div>
                                <div className="p-5 bg-slate-100 rounded-2xl flex items-center gap-4 border-2 border-transparent hover:border-slate-300 transition-all">
                                    <Clock className="text-slate-900" size={24} />
                                    <span className="font-black text-slate-900 text-lg">{selectedWork.work_time} น. ({formatDisplayDate(selectedWork.work_date)})</span>
                                </div>
                                <div className="p-8 bg-slate-900 rounded-[2rem] border-2 border-slate-800 italic font-bold text-white shadow-inner text-lg leading-relaxed">
                                    {`"${selectedWork.detail}"`}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                {selectedWork.status === 'pending' && (
                                    <button
                                        onClick={() => updateStatus(selectedWork.id, 'inprogress')}
                                        className="flex-grow bg-blue-700 hover:bg-blue-800 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 transition-all active:scale-[0.96]"
                                    >
                                        เริ่มงานเลย
                                    </button>
                                )}
                                {selectedWork.status === 'inprogress' && (
                                    <button
                                        onClick={() => updateStatus(selectedWork.id, 'complete')}
                                        className="flex-grow bg-emerald-800 hover:bg-emerald-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 transition-all active:scale-[0.96]"
                                    >
                                        บันทึกว่าเสร็จแล้ว
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowWorkModal(false)}
                                    className="px-10 bg-slate-200 hover:bg-slate-300 text-slate-900 py-5 rounded-2xl font-black text-lg transition-all active:scale-[0.96]"
                                >
                                    ปิด
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
