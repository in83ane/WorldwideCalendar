"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
    ChevronLeft, ChevronRight, Clock, CalendarDays,
    X, Search, Building2, User, FileText, Info
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// --- Interfaces ---
interface WorkSchedule {
    id: string;
    work_date: string;
    work_time: string;
    worker: string;
    worker_role: string;
    detail: string;
    department: string;
    status: 'pending' | 'inprogress' | 'complete';
    startTime: Date;
    startDate: Date;
    color: string;
    borderColor: string;
    textColor: string;
    hexColor: string;
    fullDateString: string;
}

interface WorkScheduleRaw {
    id: string;
    work_date: string;
    work_time: string;
    worker: string;
    worker_role: string;
    detail: string;
    department: string;
    status: 'pending' | 'inprogress' | 'complete';
}

const colorMap: { [key: string]: string } = {
    "blue": "#1d4ed8",
    "emerald": "#047857",
    "pink": "#be185d",
    "gray": "#334155",
};

// --- Styles ---
const customStyles = `
  .main-timeline-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
  .main-timeline-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
  .main-timeline-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  
  .btn-hover { 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
    cursor: pointer; 
  }
  .btn-hover:hover { 
    transform: translateY(-2px); 
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  
  @keyframes pulse-overdue {
    0%, 100% { background-color: var(--job-color); border-color: var(--job-color); color: white; opacity: 1; }
    50% { background-color: #dc2626; border-color: #dc2626; color: white; opacity: 0.8; }
  }

  @keyframes pulse-inprogress {
    0%, 100% { background-color: var(--job-color); border-color: var(--job-color); color: white; opacity: 1; }
    50% { background-color: #d97706; border-color: #d97706; color: white; opacity: 0.8; }
  }

  .animate-overdue { 
    animation: pulse-overdue 1.6s infinite ease-in-out; 
    border-left-width: 8px !important;
  }

  .animate-inprogress { 
    animation: pulse-inprogress 2s infinite ease-in-out; 
    border-left-width: 8px !important;
  }

  .thai-font { line-height: 1.6 !important; }
`;

export default function WorkCalendar() {
    const supabase = useMemo(() => createClient(), []);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWork, setSelectedWork] = useState<WorkSchedule | null>(null);
    const [showWorkModal, setShowWorkModal] = useState(false);
    const [currentView, setCurrentView] = useState<'calendar' | 'daily'>('calendar');
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchWorkSchedules = async () => {
        const { data, error } = await supabase.from("work_schedule").select("*");
        if (error) return;

        const mappedData: WorkSchedule[] = (data || []).map((w: WorkScheduleRaw): WorkSchedule => {
            const datePart = new Date(w.work_date + 'T00:00:00');
            const timeParts = w.work_time ? w.work_time.split(':') : ["00", "00"];
            const startTime = new Date(datePart.getFullYear(), datePart.getMonth(), datePart.getDate(), parseInt(timeParts[0]), parseInt(timeParts[1]));

            let colorInfo = { bgColor: "bg-slate-100", borderColor: "border-slate-700", textColor: "text-slate-900", hexColor: colorMap["gray"] };
            
            if (w.worker_role === "ช่างคอมพิวเตอร์") {
                colorInfo = { bgColor: "bg-blue-50", borderColor: "border-blue-700", textColor: "text-blue-900", hexColor: colorMap["blue"] };
            } 
            else if (w.worker_role === "ช่างพรินเตอร์") {
                colorInfo = { 
                    bgColor: "bg-emerald-100/50", 
                    borderColor: "border-emerald-500", 
                    textColor: "text-emerald-800", 
                    hexColor: "#047857" 
                };
            } 
            else if (w.worker_role === "ช่างเดินระบบ") {
                colorInfo = { bgColor: "bg-pink-50", borderColor: "border-pink-700", textColor: "text-pink-900", hexColor: colorMap["pink"] };
            }

            return {
                ...w,
                startTime,
                startDate: datePart,
                color: colorInfo.bgColor,
                borderColor: colorInfo.borderColor,
                textColor: colorInfo.textColor,
                hexColor: colorInfo.hexColor,
                fullDateString: datePart.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
            };
        });
        setWorkSchedules(mappedData);
    };

    useEffect(() => { fetchWorkSchedules(); }, [supabase]);

    const getJobStatusClass = (work: WorkSchedule) => {
        if (work.status === 'inprogress') return "animate-inprogress shadow-lg";
        if (work.status === 'pending' && work.startTime < now) return "animate-overdue shadow-lg";
        return `${work.borderColor} ${work.color} ${work.textColor}`;
    };

    const updateWorkStatus = async (id: string, status: string) => {
        const { error } = await supabase.from("work_schedule").update({ status }).eq("id", id);
        if (!error) { fetchWorkSchedules(); setShowWorkModal(false); }
    };

    const filteredHistory = useMemo(() => {
        return workSchedules
            .filter((w: WorkSchedule) => {
                if (w.status !== 'complete') return false;
                const searchLower = searchTerm.trim().toLowerCase();
                
                if (!searchLower) {
                    return w.startDate.getMonth() === currentDate.getMonth() &&
                        w.startDate.getFullYear() === currentDate.getFullYear();
                }

                const matchesText =
                    w.worker.toLowerCase().includes(searchLower) ||
                    w.detail.toLowerCase().includes(searchLower) ||
                    w.department.toLowerCase().includes(searchLower);

                const day = String(w.startDate.getDate()).padStart(2, '0');
                const month = String(w.startDate.getMonth() + 1).padStart(2, '0');
                const yearThai = w.startDate.getFullYear() + 543;
                const dateThaiString = `${day}/${month}/${yearThai}`;
                return matchesText || dateThaiString.includes(searchLower);
            })
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }, [workSchedules, searchTerm, currentDate]);

    const renderDailyTimeline = () => {
        if (!selectedDate) return null;
        const hours = Array.from({ length: 11 }, (_, i) => i + 8);
        const dayWorks = workSchedules.filter((w: WorkSchedule) => 
            w.startDate.toDateString() === selectedDate.toDateString() && 
            w.status !== 'complete'
        );
        const workers = Array.from(new Set(dayWorks.map((w: WorkSchedule) => w.worker)));
        const hourWidth = 180;
        const workerColWidth = 160;

        return (
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden mt-4">
                <div className="overflow-x-auto main-timeline-scroll">
                    <div style={{ width: `${(hours.length * hourWidth) + workerColWidth}px` }}>
                        <div className="flex border-b-2 border-gray-200 bg-gray-100 sticky top-0 z-30">
                            <div className="sticky left-0 z-40 w-[160px] flex-shrink-0 bg-gray-200 border-r-2 border-gray-300 p-4 text-xs font-black text-gray-600 uppercase text-center">รายชื่อช่าง</div>
                            {hours.map((h: number) => (
                                <div key={h} style={{ width: `${hourWidth}px` }} className="flex-shrink-0 p-4 text-center border-r border-gray-200 text-sm font-black text-gray-500">{h}:00</div>
                            ))}
                        </div>
                        <div className="flex flex-col divide-y-2 divide-gray-100">
                            {workers.length === 0 ? (
                                <div className="p-20 text-center text-slate-400 font-black text-xl w-full">ไม่มีรายการงานค้างในวันนี้</div>
                            ) : workers.map((workerName: string) => {
                                const workerWorks = dayWorks.filter((w: WorkSchedule) => w.worker === workerName).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                                const layers: WorkSchedule[][] = [];
                                workerWorks.forEach((work: WorkSchedule) => {
                                    let placed = false;
                                    for (const layer of layers) {
                                        const lastWorkInLayer = layer[layer.length - 1];
                                        if (work.startTime.getTime() >= lastWorkInLayer.startTime.getTime() + 5400000) {
                                            layer.push(work);
                                            placed = true;
                                            break;
                                        }
                                    }
                                    if (!placed) layers.push([work]);
                                });
                                const rowHeight = Math.max(120, layers.length * 90 + 20);

                                return (
                                    <div key={workerName} className="flex relative hover:bg-slate-50" style={{ height: `${rowHeight}px` }}>
                                        <div className="sticky left-0 z-20 w-[160px] flex-shrink-0 bg-white border-r-2 border-gray-200 flex flex-col items-center justify-center shadow-sm">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-2 shadow-md" style={{ backgroundColor: workerWorks[0]?.hexColor }}>{workerName.charAt(0)}</div>
                                            <span className="text-sm font-black text-gray-800 text-center px-2">{workerName}</span>
                                        </div>
                                        <div className="relative flex-grow">
                                            {layers.map((layer: WorkSchedule[], lIdx: number) => layer.map((work: WorkSchedule) => {
                                                const left = ((work.startTime.getHours() - 8) * hourWidth) + (work.startTime.getMinutes() / 60 * hourWidth);
                                                const statusClass = getJobStatusClass(work);
                                                const isOverdue = work.status === 'pending' && work.startTime < now;
                                                const statusLabel = isOverdue ? '⚠️ เลยกำหนด' : (work.status === 'inprogress' ? '⚙️ กำลังทำ' : '⏳ รอรับงาน');
                                                
                                                const statusBadgeColor = isOverdue ? 'bg-red-700' : 
                                                    (work.status === 'inprogress' ? (work.worker_role === 'ช่างพรินเตอร์' ? 'bg-emerald-700' : 'bg-amber-600') : 
                                                    (work.worker_role === 'ช่างพรินเตอร์' ? 'bg-emerald-600' : 'bg-blue-700'));

                                                return (
                                                    <div
                                                        key={work.id}
                                                        onClick={() => { setSelectedWork(work); setShowWorkModal(true); }}
                                                        style={{
                                                            left: `${left + 10}px`,
                                                            width: `260px`,
                                                            top: `${lIdx * 85 + 10}px`,
                                                            "--job-color": work.hexColor
                                                        } as React.CSSProperties}
                                                        className={`absolute h-[75px] rounded-xl border-l-[8px] shadow-md p-3 btn-hover flex flex-col justify-center thai-font border ${statusClass.includes('animate') ? statusClass : `${work.color} ${work.borderColor} ${work.textColor}`}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <div className="flex items-center gap-1 opacity-90 text-[10px] font-black uppercase tracking-tight">
                                                                <Clock size={12} /> {work.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} | {work.department}
                                                            </div>
                                                            <span className={`${statusBadgeColor} text-white text-[8px] px-1.5 py-0.5 rounded font-black whitespace-nowrap`}>
                                                                {statusLabel}
                                                            </span>
                                                        </div>
                                                        <p className="text-[14px] font-black truncate leading-tight">{work.detail}</p>
                                                    </div>
                                                );
                                            }))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCalendarDays = () => {
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const firstDayRaw = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
        const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-32 bg-gray-50/20 border-r border-b border-gray-100" />);

        for (let date = 1; date <= daysInMonth; date++) {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), date);
            const dayWorks = workSchedules
                .filter((w: WorkSchedule) => w.startDate.toDateString() === dateObj.toDateString() && w.status !== 'complete')
                .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            const isToday = new Date().toDateString() === dateObj.toDateString();

            days.push(
                <div key={date}
                    className="h-32 border-r border-b border-gray-100 p-2 bg-white hover:bg-blue-50/30 transition-all flex flex-col cursor-pointer group"
                    onClick={() => { setSelectedDate(dateObj); setCurrentView('daily'); }}
                >
                    <span className={`text-xs font-black mb-2 px-2 py-1 rounded-lg w-fit transition-colors ${isToday ? 'bg-blue-700 text-white shadow-md' : 'text-gray-400 group-hover:text-blue-700'}`}>
                        {date}
                    </span>
                    <div className="space-y-1 overflow-hidden">
                        {dayWorks.slice(0, 2).map((work: WorkSchedule) => (
                            <div
                                key={work.id}
                                style={{ "--job-color": work.hexColor } as React.CSSProperties}
                                onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowWorkModal(true); }}
                                className={`text-[10px] px-2 py-1 rounded-lg border-l-4 truncate font-black shadow-sm btn-hover ${getJobStatusClass(work)}`}
                            >
                                {work.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} {work.worker.split(' ')[0]}
                            </div>
                        ))}
                        {dayWorks.length > 2 && <div className="text-[10px] text-center text-gray-500 font-black bg-gray-100 rounded py-0.5">+{dayWorks.length - 2} งาน</div>}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <React.Fragment>
            <style dangerouslySetInnerHTML={{ __html: customStyles }} />
            <main className="min-h-screen bg-slate-100 p-6 font-sans text-gray-900">
                <div className="max-w-[1700px] mx-auto space-y-6">
                    <header className="flex flex-col md:flex-row items-center justify-between bg-white px-8 py-5 rounded-2xl shadow-md border border-gray-200 gap-4">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-blue-700 rounded-2xl text-white shadow-lg shadow-blue-200"><CalendarDays size={28} /></div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">{currentView === 'calendar' ? 'ระบบปฏิทินตารางงาน' : 'รายละเอียดงานประจำวัน'}</h1>
                                <p className="text-[11px] text-gray-400 font-black uppercase tracking-[0.2em]">MANAGEMENT SYSTEM</p>
                            </div>
                        </div>
                        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            <button onClick={() => {
                                if (currentView === 'calendar') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
                                else if (selectedDate) setSelectedDate(new Date(selectedDate.getTime() - 86400000));
                            }} className="p-2 bg-white rounded-xl shadow-sm text-blue-700 btn-hover"><ChevronLeft size={24} /></button>
                            <span className="px-10 text-lg font-black text-gray-800 min-w-[220px] text-center italic">
                                {currentView === 'calendar' ? currentDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" }) : selectedDate?.toLocaleDateString("th-TH", { day: 'numeric', month: "long", year: 'numeric' })}
                            </span>
                            <button onClick={() => {
                                if (currentView === 'calendar') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                                else if (selectedDate) setSelectedDate(new Date(selectedDate.getTime() + 86400000));
                            }} className="p-2 bg-white rounded-xl shadow-sm text-blue-700 btn-hover"><ChevronRight size={24} /></button>
                        </div>
                        {currentView === 'daily' && (
                            <button onClick={() => setCurrentView('calendar')} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider btn-hover">กลับหน้าปฏิทิน</button>
                        )}
                    </header>

                    {currentView === 'calendar' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                            <div className="xl:col-span-3 bg-white p-6 rounded-3xl shadow-md border border-gray-200">
                                <div className="grid grid-cols-7 mb-4 text-center text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
                                    {['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'].map(d => <div key={d}>{d}</div>)}
                                </div>
                                <div className="grid grid-cols-7 border-t border-l border-gray-200 rounded-2xl overflow-hidden bg-slate-50/30">
                                    {renderCalendarDays()}
                                </div>
                            </div>
                            <aside className="bg-white p-6 rounded-3xl shadow-md border border-gray-200 flex flex-col h-[calc(100vh-180px)]">
                                <div className="mb-6">
                                    <div className="flex items-center gap-3 mb-4 text-gray-800 font-black text-lg border-b pb-2"><Search size={22} className="text-blue-700" /> ประวัติงานที่เสร็จแล้ว</div>
                                    <input
                                        type="text"
                                        placeholder="ค้นหา ช่าง/งาน/หน่วยงาน..."
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-700 outline-none transition-all shadow-inner"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex-grow overflow-y-auto pr-2 space-y-4 main-timeline-scroll">
                                    {filteredHistory.map((work: WorkSchedule) => (
                                        <div key={work.id} onClick={() => { setSelectedWork(work); setShowWorkModal(true); }}
                                            className={`p-4 rounded-2xl border-l-[6px] shadow-sm btn-hover ${work.color} ${work.borderColor}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-black text-blue-800 bg-white px-2 py-1 rounded-lg border border-blue-100">{work.fullDateString}</span>
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg shadow-sm text-white ${work.worker_role === 'ช่างพรินเตอร์' ? 'bg-emerald-700' : 'bg-emerald-600'}`}>สำเร็จ</span>
                                            </div>
                                            <p className={`text-sm font-black ${work.textColor} flex items-center gap-2 mb-1`}><User size={16} /> {work.worker}</p>
                                            
                                            {/* --- แสดงหน่วยงานในประวัติ --- */}
                                            <p className="text-[11px] text-slate-500 font-bold flex items-center gap-2 mb-1">
                                                <Building2 size={14} className="opacity-70" /> {work.department}
                                            </p>

                                            <p className="text-xs text-gray-600 font-bold truncate italic flex items-center gap-2"><FileText size={14} /> {work.detail}</p>
                                        </div>
                                    ))}
                                    {filteredHistory.length === 0 && <div className="text-center py-10 text-gray-400 font-black opacity-30">ไม่พบข้อมูลประวัติ</div>}
                                </div>
                            </aside>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            {renderDailyTimeline()}
                        </div>
                    )}
                </div>

                {/* --- Modal --- */}
                {showWorkModal && selectedWork && (
                    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6" onClick={() => setShowWorkModal(false)}>
                        <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border-4 border-white" onClick={e => e.stopPropagation()}>
                            <div className="p-8 md:p-10 space-y-8">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-5">
                                        <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white font-black text-3xl shadow-xl" style={{ backgroundColor: selectedWork.hexColor }}>{selectedWork.worker.charAt(0)}</div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-2xl mb-1">{selectedWork.worker}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black uppercase tracking-[0.1em] text-xs py-1 px-3 rounded-full border ${selectedWork.worker_role === 'ช่างพรินเตอร์' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-blue-50 text-blue-800 border-blue-100'}`}>{selectedWork.worker_role}</span>
                                                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${selectedWork.status === 'complete' ? 'bg-emerald-100 text-emerald-800' :
                                                    selectedWork.status === 'inprogress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {selectedWork.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowWorkModal(false)} className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-full btn-hover"><X size={32} /></button>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center gap-4">
                                        <div className={`p-3 bg-white rounded-xl shadow-sm ${selectedWork.worker_role === 'ช่างพรินเตอร์' ? 'text-emerald-700' : 'text-blue-700'}`}><Building2 size={24} /></div>
                                        <div>
                                            <span className="text-gray-400 uppercase font-black text-[10px] tracking-widest block">หน่วยงาน</span>
                                            <p className="font-black text-gray-900 text-lg">{selectedWork.department}</p>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center gap-4">
                                        <div className={`p-3 bg-white rounded-xl shadow-sm ${selectedWork.worker_role === 'ช่างพรินเตอร์' ? 'text-emerald-700' : 'text-blue-700'}`}><Clock size={24} /></div>
                                        <div>
                                            <span className="text-gray-400 uppercase font-black text-[10px] tracking-widest block">เวลานัดหมาย</span>
                                            <p className="font-black text-gray-900 text-lg">{selectedWork.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className={`p-8 rounded-3xl text-xl text-white font-black italic thai-font relative shadow-inner ${selectedWork.worker_role === 'ช่างพรินเตอร์' ? 'bg-emerald-900' : 'bg-slate-900'}`}>
                                    <Info className={`absolute -top-3 -left-3 bg-white rounded-full p-1 shadow-md ${selectedWork.worker_role === 'ช่างพรินเตอร์' ? 'text-emerald-600' : 'text-blue-500'}`} size={32} />
                                    &ldquo;{selectedWork.detail}&rdquo;
                                </div>
                                <div className="flex gap-4 pt-2">
                                    {selectedWork.status === 'pending' && (
                                        <button onClick={() => updateWorkStatus(selectedWork.id, 'inprogress')}
                                            className={`flex-[2] text-white py-5 rounded-2xl text-base font-black shadow-lg btn-hover ${selectedWork.worker_role === 'ช่างพรินเตอร์' ? 'bg-emerald-700 shadow-emerald-100' : 'bg-blue-700 shadow-blue-200'}`}>
                                            เริ่มงานทันที
                                        </button>
                                    )}
                                    {selectedWork.status === 'inprogress' && (
                                        <button onClick={() => updateWorkStatus(selectedWork.id, 'complete')}
                                            className="flex-[2] bg-emerald-800 text-white py-5 rounded-2xl text-base font-black shadow-lg shadow-emerald-200 btn-hover">
                                            บันทึกว่าเสร็จสิ้น
                                        </button>
                                    )}
                                    <button onClick={() => setShowWorkModal(false)}
                                        className="flex-1 bg-slate-100 text-slate-800 py-5 rounded-2xl text-base font-black btn-hover">
                                        ปิด
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </React.Fragment>
    );
}
