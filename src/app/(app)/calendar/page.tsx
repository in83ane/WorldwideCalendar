// src/app/(app)/work-calendar/page.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Briefcase, Clock, CalendarDays, User, FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";


/**
 * ==============================================================================
 * 1. STYLES, TYPES, & HELPERS
 * ==============================================================================
 */

// *** NEW: แผนที่สำหรับแปลง Tailwind Class เป็นค่า Hex เพื่อใช้ใน CSS Animation Variable ***
// (เก็บไว้เฉพาะ Hex ที่จำเป็นสำหรับ Flashing Animation)
const colorMap: { [key: string]: string } = {
    // Hex Codes for the main colors (used for flashing/default daily view background)
    "blue": "#3B82F6",    // Corresponds to bg-blue-500
    "green": "#10B981",   // Corresponds to bg-green-500
    "purple": "#8B5CF6",  // Corresponds to bg-purple-500
    "gray": "#9CA3AF",    // Corresponds to bg-gray-400
    // *** MODIFIED: Add Yellow Hex for Flashing (bg-yellow-500) ***
    "yellow": "#F59E0B",  // NEW
};


/** Custom CSS for animations and flashing */
const customStyles = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.animate-fadeIn { animation: fadeIn 0.2s ease-out; }
.animate-slideUp { animation: slideUp 0.3s ease-out; }
.line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
.line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }


/* NEW: Flashing Animation Keyframes using CSS Variables */

/* MODIFIED: Flashing Green (In Progress): สลับระหว่างสีฝ่ายช่าง (var(--dept-color)) กับ สีเหลือง (#F59E0B) */
@keyframes flash-green-to-dept {
    0%, 100% { background-color: var(--dept-color); } 
    50% { background-color: #F59E0B; } /* MODIFIED: Use bg-yellow-500 for In Progress flash */
}
.flash-green-on {
    animation: flash-green-to-dept 1s infinite alternate;
}

/* Flashing Red (Past Due Pending): สลับระหว่างสีฝ่ายช่าง (var(--dept-color)) กับ สีแดง */
@keyframes flash-red-to-dept {
    0%, 100% { background-color: var(--dept-color); }
    50% { background-color: #EF4444; } /* bg-red-500 */
}
.flash-red-on {
    animation: flash-red-to-dept 1s infinite alternate;
}
`;

// *** UPDATED: สถานะงานใหม่ ***
type WorkStatus = "pending" | "inprogress" | "complete"; 

/** Type definition for data from the work_schedule table (UPDATED NAMES) */
type WorkScheduleRow = {
    id: string; // uuid
    work_date: string; 
    work_time: string; 
    work_shift: string; 
    department: string;
    detail: string; 
    worker: string; 
    worker_role: string; // <<< ADDED
    created_at: string; 
    user_id: string; 
    status: WorkStatus | null; 
};

/** Type definition for the data displayed in the component (UPDATED) */
type DisplayWork = {
    id: string;
    title: string;
    worker: string; 
    department: string;
    details: string; 
    startTime: Date; 
    startDate: Date; 
    color: string;      // Tailwind Class for BG (e.g., bg-blue-100)
    status: WorkStatus; 
    work_shift: string; 
    borderColor: string; // Tailwind Class for Border (e.g., border-blue-500)
    textColor: string;   // Tailwind Class for Text (e.g., text-blue-700)
    workerRole: string;  // <<< ADDED
    hexColor: string;    // <<< ADDED (Hex code for flashing)
    // *** NEW FIELDS FOR TIMELINE GRID ***
    estimatedEndTime: Date; // Calculated 60 minutes after start time
    track: number; // For collision resolution (column/row index in grid)
};


/** * *** NEW: Helper function to get color classes based on worker role ***
 * (แทนที่ colorFromDepartment เดิม)
 */
const getColorClasses = (workerRole: string | undefined) => {
    switch(workerRole) {
        case "ช่างคอมพิวเตอร์":
            return { 
                bgColor: "bg-blue-100", 
                borderColor: "border-blue-500", 
                textColor: "text-blue-700",
                hexColor: colorMap["blue"] // For flashing
            }; 
        case "ช่างพรินเตอร์":
            return { 
                bgColor: "bg-green-100", 
                borderColor: "border-green-500", 
                textColor: "text-green-700",
                hexColor: colorMap["green"] // For flashing (i.e., #10B981)
            }; 
        case "ช่างเดินระบบ":
            return { 
                bgColor: "bg-purple-100", 
                borderColor: "border-purple-500", 
                textColor: "text-purple-700",
                hexColor: colorMap["purple"] // For flashing
            }; 
        default:
            return { 
                bgColor: "bg-gray-100", 
                borderColor: "border-gray-500", 
                textColor: "text-gray-700",
                hexColor: colorMap["gray"] // For flashing
            }; 
    }
};

/** Helper function to combine date (YYYY-MM-DD) and time (HH:MM) */
const combineDateTime = (dateStr: string, timeStr: string): Date => {
    // ใช้ new Date(dateStr + 'T' + timeStr) เพื่อให้ได้ Date object ที่ถูกต้องตาม UTC หรือ Local Time
    const datePart = new Date(dateStr + 'T00:00:00'); 
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // สร้าง Date object โดยใช้ YYYY, MM, DD จาก datePart และ H, M จาก timeStr
    const combined = new Date(
        datePart.getFullYear(),
        datePart.getMonth(),
        datePart.getDate(),
        hours,
        minutes,
        0 // seconds
    );
    return combined;
};

/** Helper to parse DD/MM/YYYY into a Date object (for comparison) */
const parseThaiDateToDate = (dateString: string): Date | null => {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        
        if (year >= 2300) { 
            year = year - 543;
        }

        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                date.setHours(0, 0, 0, 0); 
                return date;
            }
        }
    }
    return null;
};


/**
 * *** HELPER: Collision Detection and Track Assignment ***
 * Helper to calculate collision tracks for events in the Daily View.
 * It assigns a 'track' index (row/lane) to each event to avoid drawing overlapping events on top of each other.
 */
const calculateTracks = (works: DisplayWork[]): DisplayWork[] => {
    // 1. Sort by start time (already done, but re-sort for safety)
    const sortedWorks = [...works].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Tracks: Stores the END TIME (timestamp) of the last event in that track
    const tracks: Map<number, number> = new Map(); 

    // Result array to store events with assigned tracks
    const trackedWorks: DisplayWork[] = [];

    sortedWorks.forEach(work => {
        let assignedTrack = -1;

        // Try to find an existing track that is free (lastEndTime <= current startTime)
        // Iterate through existing tracks (0, 1, 2, ...)
        for (let i = 0; i < tracks.size; i++) {
            const lastEndTime = tracks.get(i) || 0;
            // Check if the current work can start after the last work in this track finished
            if (work.startTime.getTime() >= lastEndTime) {
                assignedTrack = i;
                break;
            }
        }

        if (assignedTrack === -1) {
            // No free track found, assign a new track
            assignedTrack = tracks.size; // New index
        }

        // Update the track with the end time of the current work
        tracks.set(assignedTrack, work.estimatedEndTime.getTime());

        trackedWorks.push({ ...work, track: assignedTrack });
    });

    return trackedWorks;
};


/**
 * ==============================================================================
 * 2. MAIN COMPONENT
 * ==============================================================================
 */

export default function WorkCalendar() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [userId, setUserId] = useState<string | null>(null);
    const [hasSession, setHasSession] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [workSchedules, setWorkSchedules] = useState<DisplayWork[]>([]);
    
    const [timeTicker, setTimeTicker] = useState(Date.now()); 
    
    const [searchTerm, setSearchTerm] = useState('');
    const [pastWorkResults, setPastWorkResults] = useState<DisplayWork[]>([]);

    const [selectedWork, setSelectedWork] = useState<DisplayWork | null>(null);
    const [showWorkModal, setShowWorkModal] = useState(false);
    
    // State for View Switching (Calendar vs. Daily)
    const [currentView, setCurrentView] = useState<'calendar' | 'daily'>('calendar');
    const [dailyViewData, setDailyViewData] = useState<{ 
        dateString: string; 
        works: DisplayWork[]; 
        dateKey: number; 
    } | null>(null);

    /**
     * Helper function to check if a pending work is past its start time (Past Due).
     * @param work The DisplayWork object.
     * @returns boolean
     */
    const isPastDuePending = (work: DisplayWork): boolean => {
        if (work.status !== 'pending') return false;
        const now = new Date();
        return work.startTime < now;
    };
    
    /**
     * ----------------------------------------------------------------------------
     * Effect: Real-time ticker for status check (e.g., pending -> past due)
     * ----------------------------------------------------------------------------
     */
    useEffect(() => {
        const intervalId = setInterval(() => {
            setTimeTicker(Date.now());
        }, 60000); // 60 seconds

        return () => clearInterval(intervalId);
    }, []); 


    /**
     * ----------------------------------------------------------------------------
     * Effect: Session Check (Auth)
     * ----------------------------------------------------------------------------
     */
    useEffect(() => {
        let cancel = false;
        (async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (cancel) return;
            if (error || !session) {
                setError(error?.message ?? "Auth session missing! กรุณาเข้าสู่ระบบอีกครั้ง");
                setHasSession(false);
                setLoading(false);
                return;
            }
            setHasSession(true);
            setUserId(session.user.id);
        })();
        const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
            setHasSession(!!session);
            setUserId(session?.user?.id ?? null);
        });
        return () => {
            cancel = true;
            sub.subscription.unsubscribe();
        };
    }, [supabase]);


    /**
     * ----------------------------------------------------------------------------
     * Function: Fetch Work Schedules (ตารางงาน) (UPDATED to include worker_role)
     * ----------------------------------------------------------------------------
     */
    const fetchWorkSchedules = async () => {
        if (!hasSession) return;

        try {
            setLoading(true);
            setError(null);

            const { data, error: workErr } = await supabase
                .from("work_schedule") 
                .select(`
                    id, work_date, work_time, work_shift, department, detail, worker, created_at, status, worker_role
                `); // <<< ADDED: worker_role

            if (workErr) throw workErr;

            // *** FIX: แก้ไขโดยการ Explicitly Cast ข้อมูลที่ได้มาให้เป็น WorkScheduleRow[] ***
            const schedulesData: WorkScheduleRow[] = (data || []) as WorkScheduleRow[];

            if (schedulesData.length === 0) {
                setWorkSchedules([]);
                setLoading(false);
                return;
            }

            const display: DisplayWork[] = schedulesData.map((w) => {
                
                const startDate = new Date(w.work_date + 'T00:00:00'); 
                startDate.setHours(0, 0, 0, 0); // Normalize date only to midnight

                const startTime = combineDateTime(w.work_date, w.work_time); // Date + Time
                
                // *** NEW: Calculate estimatedEndTime (ASSUMING 60 MINUTES DURATION) ***
                const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000); // + 1 hour 
                // *******************************************************************
                
                const workStatus: WorkStatus = w.status as WorkStatus || 'pending';
                
                // *** UPDATED: Use new getColorClasses based on worker_role ***
                const colorInfo = getColorClasses(w.worker_role); 
                
                return {
                    id: w.id,
                    title: w.detail.substring(0, 30) + (w.detail.length > 30 ? '...' : ''), 
                    worker: w.worker,
                    department: w.department,
                    details: w.detail,
                    startTime: startTime,
                    startDate: startDate, // Use normalized date for easier comparison
                    estimatedEndTime: estimatedEndTime, // <<< ADDED
                    color: colorInfo.bgColor, // bg-*-100
                    status: workStatus, 
                    work_shift: w.work_shift,
                    borderColor: colorInfo.borderColor, // border-*-500
                    textColor: colorInfo.textColor, // text-*-700
                    workerRole: w.worker_role, // <<< ADDED
                    hexColor: colorInfo.hexColor, // <<< ADDED
                    track: 0, // Initial value, will be calculated later in daily view
                };
            }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

            setWorkSchedules(display);
        } catch (e) {
            console.error("Error fetching work schedules:", e);
            setError(
                e && typeof e === "object" && "message" in e
                    ? (e as { message: string }).message
                    : "เกิดข้อผิดพลาดในการดึงข้อมูลตารางงาน"
            );
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * ----------------------------------------------------------------------------
     * Function: Update Work Status in Supabase
     * ----------------------------------------------------------------------------
     */
    const updateWorkStatus = async (workId: string, newStatus: WorkStatus) => {
        try {
            setLoading(true);
            
            const { error: updateErr } = await supabase
                .from("work_schedule")
                .update({ status: newStatus })
                .eq("id", workId);
            
            if (updateErr) throw updateErr;

            // Refetch data เพื่ออัพเดท UI ทั้งหมด
            await fetchWorkSchedules();

            // อัปเดทสถานะของงานที่กำลังแสดงใน Modal ด้วย
            if (selectedWork && selectedWork.id === workId) {
                setSelectedWork(prev => prev ? { ...prev, status: newStatus } : null);
            }
            
            // อัปเดท Daily View Data ถ้ามีการแสดงอยู่
            if (dailyViewData) {
                const updatedWorks = dailyViewData.works.map(w => 
                    w.id === workId ? { ...w, status: newStatus } : w
                );
                setDailyViewData({ 
                    ...dailyViewData, 
                    works: updatedWorks 
                });
            }

            if (newStatus === 'complete') {
                handleSearch(searchTerm);
            }

        } catch (e) {
            console.error("Error updating work status:", e);
            setError("เกิดข้อผิดพลาดในการอัพเดทสถานะงาน");
        } finally {
            setLoading(false);
        }
    };


    /**
     * ----------------------------------------------------------------------------
     * Function: Handle Search for Complete Works (UPDATED)
     * ----------------------------------------------------------------------------
     */
    const handleSearch = (term: string) => {
        setSearchTerm(term);
        
        const completeWorks = workSchedules.filter(w => w.status === 'complete');

        if (!term.trim()) {
            // Show top 5 latest complete works if no search term
            const latestComplete = completeWorks
                .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
                .slice(0, 5);
            setPastWorkResults(latestComplete); 
            return;
        }

        const lowerCaseTerm = term.trim().toLowerCase();
        let results: DisplayWork[] = [];
        
        // --- 1. Attempt Date Search Logic (DD/MM/YYYY) ---
        const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const dateMatch = lowerCaseTerm.match(dateRegex);

        if (dateMatch) {
            const searchDate = parseThaiDateToDate(lowerCaseTerm);
            
            if (searchDate) {
                results = completeWorks.filter(work => {
                    return work.startDate.getTime() === searchDate.getTime();
                });
            }
        } 
        
        // --- 2. Fallback to Text Search Logic ---
        if (results.length === 0 || !dateMatch) {
            results = completeWorks.filter(work => 
                work.details.toLowerCase().includes(lowerCaseTerm) || 
                work.worker.toLowerCase().includes(lowerCaseTerm) ||
                work.department.toLowerCase().includes(lowerCaseTerm)
            );
        }

        setPastWorkResults(results);
    };

    useEffect(() => {
        if (workSchedules.length > 0 && searchTerm === '') {
            handleSearch('');
        }
    }, [workSchedules]); // eslint-disable-line react-hooks/exhaustive-deps


    /**
     * ----------------------------------------------------------------------------
     * Effect: Trigger Fetch Work Schedules when Auth/Session is available
     * ----------------------------------------------------------------------------
     */
    useEffect(() => { 
        if (hasSession) {
            fetchWorkSchedules(); 
        }
    }, [hasSession]); // eslint-disable-line react-hooks/exhaustive-deps


    /**
     * ----------------------------------------------------------------------------
     * Helper Functions for Calendar Logic and UI
     * ----------------------------------------------------------------------------
     */
    const getDaysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (d: Date) => { 
        // Note: getDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
        return new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    };
    const navigateMonth = (dir: number) => { 
        setCurrentView('calendar'); // กลับไปที่ Calendar View เมื่อเปลี่ยนเดือน
        const nd = new Date(currentDate); 
        nd.setMonth(currentDate.getMonth() + dir); 
        setCurrentDate(nd); 
    };
    const isToday = (date: number) => {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), date);
        const today = new Date();
        return checkDate.getFullYear() === today.getFullYear() &&
                checkDate.getMonth() === today.getMonth() &&
                checkDate.getDate() === today.getDate();
    };
    
    const isDateInWork = (date: number, w: DisplayWork) => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), date);
        d.setHours(0, 0, 0, 0);
        const start = new Date(w.startDate); 
        start.setHours(0, 0, 0, 0);
        
        return d.toDateString() === start.toDateString(); 
    };
    
    const getWorkForDate = (date: number) => workSchedules.filter((w) => isDateInWork(date, w));

    /**
     * ----------------------------------------------------------------------------
     * Function: Render Calendar Days
     * ----------------------------------------------------------------------------
     */
    const renderCalendarDays = () => {
        const _ = timeTicker; 
        
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate); 
        const days: React.ReactNode[] = [];
        
        // Add empty divs for the days before the 1st of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 border border-gray-200 bg-gray-50" />);
        }
        
        // Render days of the month
        for (let date = 1; date <= daysInMonth; date++) {
            const allDayWorks = getWorkForDate(date); 
            
            // กรองเฉพาะงานที่มีสถานะ 'pending' หรือ 'inprogress'
            const dayWorks = allDayWorks.filter(w => w.status === 'pending' || w.status === 'inprogress'); 

            const today = isToday(date);
            
            // --- NEW CLICK HANDLER ON DAY CELL ---
            const handleClickDayCell = () => {
                const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), date);
                const dateStr = dateObj
                    .toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
                
                setDailyViewData({ 
                    dateString: dateStr, 
                    works: allDayWorks,
                    dateKey: dateObj.getTime(),
                }); 
                setCurrentView('daily');
            };

            days.push(
                <div 
                    key={date} 
                    className={`h-24 border border-gray-200 p-1 relative overflow-hidden ${
                        allDayWorks.length > 0 ? "cursor-pointer hover:bg-gray-100 transition-colors" : ""
                    } ${
                        today ? "bg-blue-50 border-blue-300" : "bg-white"
                    }`}
                    onClick={allDayWorks.length > 0 ? handleClickDayCell : undefined} 
                >
                    <div className={`text-sm font-medium ${today ? "text-blue-600" : "text-gray-900"}`}>
                        {date}
                    </div>
                    {dayWorks.length > 0 && (
                        <div className="mt-1 space-y-1">
                            {/* Show up to 2 work items */}
                            {dayWorks.slice(0, 2).map((work, idx) => {
                                
                                const isFlashingGreen = work.status === 'inprogress';
                                const isFlashingRed = isPastDuePending(work); 

                                // Use work.color (bg-*-100), work.borderColor (border-*-500), work.textColor (text-*-700)
                                const itemClass = `text-xs px-1 py-0.5 rounded border-l-4 ${work.borderColor} ${work.textColor} truncate cursor-pointer hover:opacity-80 transition-opacity`;

                                let flashClass = '';
                                if (isFlashingGreen) {
                                    flashClass = 'flash-green-on'; 
                                } else if (isFlashingRed) {
                                    flashClass = 'flash-red-on';
                                }

                                const baseColorClass = flashClass ? '' : work.color;

                                // *** UPDATED: ใช้ work.hexColor สำหรับ Flashing CSS Variable ***
                                const baseBgColor = work.hexColor; 

                                return (
                                    <div
                                        key={`${work.id}-${idx}`}
                                        className={`${itemClass} ${baseColorClass} ${flashClass}`}
                                        style={isFlashingGreen || isFlashingRed ? { '--dept-color': baseBgColor } as React.CSSProperties : undefined}
                                        title={work.details}
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setSelectedWork(work); 
                                            setShowWorkModal(true); 
                                        }}
                                    >
                                        {work.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - {work.title}
                                    </div>
                                );
                            })}
                            {/* Show 'more' link if there are more than 2 work items */}
                            {dayWorks.length > 2 && (
                                <div
                                    className="text-xs text-blue-600 font-medium px-1 mt-1"
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        handleClickDayCell(); 
                                    }}
                                >
                                    <span className="hover:underline">+{dayWorks.length - 2} รายการเพิ่มเติม</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };


    /**
     * ----------------------------------------------------------------------------
     * Component: Daily Work Schedule View (ตารางงานประจำวัน) (Horizontal Timeline Grid)
     * ----------------------------------------------------------------------------
     */
    const DailyWorkSchedule = () => {
        if (!dailyViewData) return null; 

        const { dateString, works } = dailyViewData;
        
        // Sort all works chronologically by startTime (which is Date + Time)
        const sortedWorks = [...works].sort((a, b) => 
            a.startTime.getTime() - b.startTime.getTime()
        );

        // 1. Calculate tracks (Collision Logic)
        const worksWithTracks = calculateTracks(sortedWorks);
        // Get max number of simultaneous events (tracks) for grid row definition
        const maxTracks = worksWithTracks.reduce((max, work) => Math.max(max, work.track + 1), 1); 
        
        // 2. Define the timeline grid settings
        const START_HOUR = 8;
        const END_HOUR = 20; // Show timeline up to 20:00 (8 PM)
        const TIME_SLOT_MINUTES = 30;
        const totalDurationHours = END_HOUR - START_HOUR; 
        const TOTAL_SLOTS = (totalDurationHours * 60) / TIME_SLOT_MINUTES; // 24 slots (8:00 - 20:00)
        
        // Fixed dimensions for the horizontal view
        const COLUMN_WIDTH_PX = 80; // Fixed width for 30 minutes slot
        const TRACK_HEIGHT_PX = 100; // Fixed height for each track/row
        const TRACK_LABEL_WIDTH_PX = 70; // Width for the first column (Track label)

        return (
            <div className="lg:col-span-4 bg-white rounded-lg shadow-xl p-6 animate-fadeIn">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                        🗓️ ตารางงานประจำวัน (แนวนอน): {dateString}
                    </h2>
                    <button
                        onClick={() => setCurrentView('calendar')}
                        className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <ChevronLeft className="w-4 h-4" /> กลับสู่ปฏิทิน
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <div 
                        className="grid relative"
                        style={{
                            // Track Label (70px) + TOTAL_SLOTS columns (80px each)
                            gridTemplateColumns: `${TRACK_LABEL_WIDTH_PX}px repeat(${TOTAL_SLOTS}, ${COLUMN_WIDTH_PX}px)`,
                            // Define rows: Row 1 for Time Header, then maxTracks rows for events
                            gridTemplateRows: `auto repeat(${maxTracks}, ${TRACK_HEIGHT_PX}px)`, 
                            // Ensure minimum width for scrolling
                            width: `${TRACK_LABEL_WIDTH_PX + (TOTAL_SLOTS * COLUMN_WIDTH_PX)}px`
                        }} 
                    >
                        {/* 1. Track Labels (First Column - Side Header) */}
                        <div className="p-2 text-xs font-medium text-gray-500 flex items-center justify-center border-r border-b border-gray-300" style={{gridRow: 1, gridColumn: 1}}> Tracks </div>
                        {Array.from({ length: maxTracks }).map((_, trackIndex) => (
                            <div 
                                key={`track-label-${trackIndex}`} 
                                className="text-sm font-semibold text-gray-600 border-r border-gray-300 flex items-center justify-center" 
                                style={{ 
                                    gridRow: trackIndex + 2, // Start from row 2 (after Time header)
                                    gridColumn: 1 
                                }} 
                            >
                                {trackIndex + 1}
                            </div>
                        ))}

                        {/* 2. Time Labels (Header Row) & Vertical Grid Lines */}
                        {Array.from({ length: TOTAL_SLOTS + 1 }).map((_, index) => { 
                            // TOTAL_SLOTS + 1 for the end mark
                            const hour = START_HOUR + Math.floor(index / 2);
                            const minute = (index % 2) * TIME_SLOT_MINUTES;
                            const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                            const isHour = minute === 0;
                            const gridColStart = index + 2; // Col 1 is Track label

                            // Time Label (Only draw labels for the start of the hour)
                            if (isHour && index < TOTAL_SLOTS) {
                                return (
                                    <div 
                                        key={`time-header-${index}`} 
                                        className="text-xs text-center font-semibold text-gray-700 pt-2 border-b border-gray-300"
                                        style={{ 
                                            gridRow: 1, 
                                            gridColumn: gridColStart, 
                                            // Span 2 columns to center the label over the hour block (30 min + 30 min)
                                            gridColumnEnd: `span 2` 
                                        }} 
                                    >
                                        {timeLabel}
                                    </div>
                                );
                            }

                            // Vertical Grid Line (for all slots)
                            // Skip the last line since it's the end of the total duration
                            if (index < TOTAL_SLOTS) { 
                                return (
                                    <div 
                                        key={`v-line-${index}`}
                                        className={`absolute top-0 bottom-0 ${isHour ? 'border-r border-gray-300' : 'border-r border-dashed border-gray-200'}`}
                                        style={{ 
                                            gridRowStart: 2, 
                                            gridRowEnd: maxTracks + 2, 
                                            gridColumn: gridColStart,
                                            width: '100%',
                                        }}
                                    ></div>
                                );
                            }
                            return null;
                        })}

                        {/* 3. Render Work Events on the Grid */}
                        {worksWithTracks.map((work) => {
                            // Calculate work's start/end in minutes from midnight
                            const workStartMinutes = work.startTime.getHours() * 60 + work.startTime.getMinutes();
                            const workEndMinutes = work.estimatedEndTime.getHours() * 60 + work.estimatedEndTime.getMinutes();

                            // Timeline range in minutes from midnight
                            const timelineStartMinutes = START_HOUR * 60;
                            const timelineEndMinutes = END_HOUR * 60;

                            // Clip event to timeline range if needed
                            const startMinutes = Math.max(workStartMinutes, timelineStartMinutes);
                            const endMinutes = Math.min(workEndMinutes, timelineEndMinutes);
                            const startOffsetMinutes = startMinutes - timelineStartMinutes;
                            const workDurationMinutes = endMinutes - startMinutes;

                            if (workDurationMinutes <= 0) return null; // Event is outside the visible timeline range

                            // Convert minutes to grid column/span properties (based on 30-minute slot size)
                            const startColumn = Math.floor(startOffsetMinutes / TIME_SLOT_MINUTES) + 2; // +2: Col 1 is Track label, Col 2 is 8:00 slot
                            const columnSpan = Math.max(1, Math.ceil(workDurationMinutes / TIME_SLOT_MINUTES));
                            
                            // The track (row index) is calculated from the collision logic.
                            const gridRow = work.track + 2; // Row 1 is Time labels

                            // Flashing logic
                            const isFlashingGreen = work.status === 'inprogress';
                            const isFlashingRed = work.status === 'pending' && isPastDuePending(work);
                            let flashClass = '';
                            if (isFlashingGreen) {
                                flashClass = 'flash-green-on';
                            } else if (isFlashingRed) {
                                flashClass = 'flash-red-on';
                            }

                            // *** UPDATED: baseBgColor is now the hex color for flashing ***
                            const baseBgColor = work.hexColor; 

                            return (
                                <div 
                                    key={work.id}
                                    // The item is positioned using grid row/column properties
                                    // *** UPDATED: Added work.color class (bg-*-100) and removed explicit backgroundColor style ***
                                    className={`p-1 rounded-lg border-l-4 shadow-md z-10 hover:shadow-xl transition-all m-1 ${work.borderColor} ${work.color} cursor-pointer`}
                                    style={{ 
                                        gridRow: gridRow,
                                        gridColumnStart: startColumn,
                                        gridColumnEnd: `span ${columnSpan}`,
                                        // Set CSS Variable for flashing background
                                        '--dept-color': baseBgColor,
                                        // Adjusted height to fit within the track row with margin
                                        height: `${TRACK_HEIGHT_PX - 8}px`,
                                    } as React.CSSProperties}
                                    onClick={() => { setSelectedWork(work); setShowWorkModal(true); }}
                                >
                                    <div // Inner div for flashing effect
                                        className={`${flashClass} h-full p-1 rounded-r-lg`} 
                                        // *** UPDATED: Inner div uses hex color for flashing background ***
                                        style={flashClass ? {backgroundColor: baseBgColor} : undefined}
                                    >
                                        {/* *** UPDATED: Use work.textColor (text-*-700) *** */}
                                        <p className={`text-sm font-bold ${work.textColor} line-clamp-1`}>{work.workerRole}</p>
                                        <p className={`text-xs ${work.textColor} line-clamp-1`}>ช่าง: {work.worker}</p>
                                        {columnSpan >= 4 && ( // Show department/time if enough space (2 hours or more)
                                            <p className={`text-xs ${work.textColor} line-clamp-1`}>
                                                {work.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {work.department}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend for Daily View */}
                <div className="mt-6 border-t pt-4">
                    <h3 className="text-md font-semibold mb-2">คำอธิบายสีตามฝ่ายช่าง</h3>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border border-blue-500 bg-blue-100"></div>
                            <span className="text-blue-700">ช่างคอมพิวเตอร์</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border border-green-500 bg-green-100"></div>
                            <span className="text-green-700">ช่างพรินเตอร์</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border border-purple-500 bg-purple-100"></div>
                            <span className="text-purple-700">ช่างเดินระบบ</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border border-gray-500 bg-gray-100"></div>
                            <span className="text-gray-700">อื่นๆ/ไม่ระบุ</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    /**
     * ----------------------------------------------------------------------------
     * 3. RENDER LAYOUT
     * ----------------------------------------------------------------------------
     */

    return (
        <React.Fragment>
            {/* *** ใส่ CSS Animation ที่นี่ *** */}
            <style dangerouslySetInnerHTML={{ __html: customStyles }} />

            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">ปฏิทินตารางงานบริษัท</h1>
                                <p className="text-gray-600 mt-1">ติดตามตารางงานทั้งหมด</p>
                            </div>
                            {/* NEW: Back button for Daily View in Header */}
                            {currentView === 'daily' && (
                                <button
                                    onClick={() => setCurrentView('calendar')}
                                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <ChevronLeft className="w-4 h-4" /> กลับสู่ปฏิทิน
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                            <p className="font-medium">เกิดข้อผิดพลาด:</p>
                            <p className="text-sm">{error}</p>
                            {hasSession === false && (
                                <button 
                                    onClick={() => router.push("/auth/login")} 
                                    className="mt-3 text-sm px-3 py-2 rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                                >
                                    เข้าสู่ระบบอีกครั้ง
                                </button>
                            )}
                        </div>
                    )}

                    {/* Main Layout (Calendar + Sidebar OR Daily View) */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                        {/* Conditional Rendering for Main Content */}
                        {currentView === 'calendar' ? (
                            <>
                                {/* Calendar View */}
                                <div className="lg:col-span-3">
                                    <div className="bg-white rounded-lg shadow-sm">
                                        {/* Calendar Navigation */}
                                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                            <h2 className="text-xl font-semibold text-gray-900">
                                                {currentDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
                                            </h2>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => navigateMonth(-1)} 
                                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors" 
                                                    aria-label="เดือนก่อนหน้า"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => setCurrentDate(new Date())} 
                                                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                >
                                                    วันนี้
                                                </button>
                                                <button 
                                                    onClick={() => navigateMonth(1)} 
                                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors" 
                                                    aria-label="เดือนถัดไป"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4">
                                            {/* Day Names */}
                                            <div className="grid grid-cols-7 text-center font-medium text-gray-500 mb-2">
                                                {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map(day => (
                                                    <div key={day} className="text-sm">{day}</div>
                                                ))}
                                            </div>

                                            {/* Days Grid */}
                                            <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                                                {loading ? (
                                                    <div className="col-span-7 h-96 flex items-center justify-center">
                                                        <p className="text-gray-500">กำลังโหลดข้อมูลตารางงาน...</p>
                                                    </div>
                                                ) : (
                                                    renderCalendarDays()
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar */}
                                <div className="space-y-6">
                                    {/* Work Statistics */}
                                    <div className="bg-white rounded-lg shadow-sm p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">สถิติตารางงาน</h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-600">รวมทั้งหมด</span>
                                                <span className="font-semibold text-lg">{workSchedules.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-600">กำลังดำเนินการ</span>
                                                <span className="font-semibold text-lg text-blue-600">{workSchedules.filter(t=>t.status==='inprogress').length}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-600">เสร็จสมบูรณ์</span>
                                                <span className="font-semibold text-lg text-green-600">{workSchedules.filter(t=>t.status==='complete').length}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* History Search (ค้นหางานที่เสร็จสมบูรณ์) */}
                                    <div className="bg-white rounded-lg shadow-sm p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            📜 History Search (งานที่เสร็จสมบูรณ์)
                                        </h3>
                                        <input
                                            type="text"
                                            placeholder="ค้นหารายละเอียดงาน, ช่าง, หน่วยงาน, หรือ DD/MM/YYYY (พ.ศ. หรือ ค.ศ.)..."
                                            value={searchTerm}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4 text-sm"
                                        />

                                        {(searchTerm.trim() === '' && workSchedules.filter(w => w.status === 'complete').length === 0) ? (
                                            <p className="text-gray-500 text-sm">ไม่พบงานที่เสร็จสมบูรณ์ในระบบ</p>
                                        ) : (
                                            <>
                                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                                    {pastWorkResults.map((work) => (
                                                        <div
                                                            key={work.id}
                                                            className={`p-3 border-l-4 ${ work.borderColor } bg-gray-50 rounded-r-lg cursor-pointer hover:bg-gray-100 transition`}
                                                            onClick={() => { setSelectedWork(work); setShowWorkModal(true); }}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="font-semibold text-gray-900 text-sm break-words">
                                                                        {work.title}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {work.department} | ช่าง: {work.worker}
                                                                    </p>
                                                                    {/* FIX FOR RED SQUIGGLY LINE */}
                                                                    <p className="text-xs text-gray-400">
                                                                        {`${work.startTime.toLocaleDateString("th-TH", { day: "numeric", month: "short", })} ${work.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                                                                    </p>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Work Status Legend */}
                                    <div className="bg-white rounded-lg shadow-sm p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            สถานะงาน
                                        </h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                                                <span className="text-gray-700">Pending (รอดำเนินการ)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                                <span className="text-gray-700">In Progress (กำลังดำเนินการ)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-green-600"></div>
                                                <span className="text-gray-700">Complete (เสร็จสมบูรณ์)</span>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 border-t mt-2">
                                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                <span className="text-red-700 font-medium">⚠️ Past Due (งานล่าช้า)</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </>
                        ) : (
                            // Daily View takes up all 4 columns on large screens
                            <DailyWorkSchedule />
                        )}

                        {/* ------------------------------------------------------------------ */}
                        {/* Work Detail Modal (ยังคงอยู่) */}
                        {/* ------------------------------------------------------------------ */}
                        {showWorkModal && selectedWork && (
                            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" onClick={() => setShowWorkModal(false)}>
                                <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 transform animate-slideUp max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                    
                                    <div className="flex justify-between items-center p-6 border-b">
                                        <h3 className="text-xl font-bold text-gray-900">รายละเอียดงาน</h3>
                                        <button onClick={() => setShowWorkModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-140px)]">
                                        {/* Date and Time */}
                                        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                                            <CalendarDays className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    วันที่: {selectedWork.startDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </p>
                                                <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                                                    <Clock className="w-4 h-4" />
                                                    เวลา: {selectedWork.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} ({selectedWork.work_shift})
                                                </p>
                                            </div>
                                        </div>

                                        {/* Department and Worker */}
                                        <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                                            <div className="flex items-center gap-3">
                                                <Briefcase className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                <p className="font-medium text-gray-900">หน่วยงาน: {selectedWork.department}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <User className="w-5 h-5 text-gray-600 flex-shrink-0" />
                                                <p className="font-medium text-gray-900">
                                                    ช่าง: {selectedWork.worker} 
                                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${selectedWork.color} ${selectedWork.textColor} ${selectedWork.borderColor} border-l-4`}>
                                                        {selectedWork.workerRole}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="p-3 bg-yellow-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    selectedWork.status === 'pending' ? 'bg-yellow-600' : 
                                                    selectedWork.status === 'inprogress' ? 'bg-blue-600' : 
                                                    'bg-green-600'
                                                }`}></div>
                                                <p className="font-semibold text-gray-900 text-sm">สถานะ:
                                                    {selectedWork.status === 'pending' && ' รอดำเนินการ (Pending)'}
                                                    {selectedWork.status === 'inprogress' && ' กำลังดำเนินการ (In Progress)'}
                                                    {selectedWork.status === 'complete' && ' เสร็จสมบูรณ์ (Complete)'}
                                                    {selectedWork.status === 'pending' && isPastDuePending(selectedWork) && ' (ล่าช้า)'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-orange-100 rounded-full flex-shrink-0"><FileText className="w-5 h-5 text-orange-600" /></div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 mb-1">รายละเอียด:</p>
                                                    <p className="text-gray-700 whitespace-pre-wrap">{selectedWork.details}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Footer / Action Buttons */}
                                    <div className="p-6 border-t bg-white">
                                        <div className="space-y-3">
                                            {selectedWork.status === 'pending' && (
                                                <button 
                                                    onClick={() => updateWorkStatus(selectedWork.id, 'inprogress')} 
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                                                >
                                                    กดยืนยันว่าเริ่มงานแล้ว (In Progress)
                                                </button>
                                            )}
                                            
                                            {selectedWork.status === 'inprogress' && (
                                                <button 
                                                    onClick={() => updateWorkStatus(selectedWork.id, 'complete')} 
                                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                                                >
                                                    กดยืนยันว่าเสร็จงานแล้ว (Complete)
                                                </button>
                                            )}
                                            
                                            <button 
                                                onClick={() => setShowWorkModal(false)} 
                                                className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                                            >
                                                ปิด
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}