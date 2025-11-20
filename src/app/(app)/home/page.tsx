"use client"; 

import React, { useMemo, useState } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, X, CalendarDays, Clock, Briefcase, User, FileText } from 'lucide-react'; // เพิ่ม Icon ที่จำเป็น

// ==============================================================================
// 1. TYPES & CONSTANTS
// ==============================================================================

// Type สำหรับข้อมูลที่ดึงมา
type WorkScheduleItem = {
    id: string; 
    work_date: string; // YYYY-MM-DD
    work_time: string; // HH:MM
    work_shift: string;
    department: string;
    detail: string;
    worker_role: string;
    worker: string;
    user_id: string;
    created_at: string;
    status: 'pending' | 'inprogress' | 'complete' | null; 
};

// Type สำหรับ Form Data
type WorkFormData = {
    work_date: string;
    work_time: string;
    department: string;
    detail: string;
    worker_role: string;
    worker_name: string;
};

// รายการฝ่ายช่างสำหรับ Dropdown
const TECHNICIAN_ROLES = [
    "ช่างคอมพิวเตอร์",
    "ช่างพรินเตอร์",
    "ช่างเดินระบบ",
];

// Map Tech Role to Color Classes (Tailwind)
const getColorClasses = (role: string | undefined) => {
    switch(role) {
        case "ช่างคอมพิวเตอร์":
            return { text: "text-blue-700", bg: "bg-blue-100", border: "border-blue-500" }; 
        case "ช่างพรินเตอร์":
            return { text: "text-green-700", bg: "bg-green-100", border: "border-green-500" }; 
        case "ช่างเดินระบบ":
            return { text: "text-purple-700", bg: "bg-purple-100", border: "border-purple-500" }; 
        default:
            return { text: "text-gray-700", bg: "bg-gray-100", border: "border-gray-500" }; 
    }
};

// NEW: Helper function to get status badge colors
const getStatusClasses = (status: WorkScheduleItem['status']) => {
    switch (status) {
        case 'pending':
            return { text: "text-red-700", bg: "bg-red-100", label: "รอรับงาน" };
        case 'inprogress':
            return { text: "text-yellow-700", bg: "bg-yellow-100", label: "กำลังดำเนินการ" };
        case 'complete':
            return { text: "text-green-700", bg: "bg-green-100", label: "เสร็จสมบูรณ์" };
        default:
            return { text: "text-gray-500", bg: "bg-gray-100", label: "ไม่ระบุ" };
    }
}

// ฟังก์ชันคำนวณช่วงเวลาไทย
function getThaiShift(timeStr: string): string {
    const [h, m] = timeStr.split(":").map(Number);
    const minutes = h * 60 + m;

    if (minutes >= 300 && minutes < 720) return "morning"; // 05:00–11:59
    if (minutes >= 720 && minutes < 1080) return "afternoon"; // 12:00–17:59
    if (minutes >= 1080 && minutes < 1440) return "evening"; // 18:00–23:59
    return "night"; // 00:00–04:59
}


// ==============================================================================
// 2. MAIN CLIENT COMPONENT
// ==============================================================================

export default function HomePage() {
    const supabase = createClient();
    
    const [user, setUser] = useState<{ id: string, email: string, role: string } | null>(null);
    const [workSchedule, setWorkSchedule] = useState<WorkScheduleItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const isAdmin = user?.role === 'admin';

    // State สำหรับการแก้ไขในตาราง
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<WorkFormData & { id: string }>>({});

    // *** NEW: State สำหรับ Modal แสดงรายละเอียด ***
    const [selectedWork, setSelectedWork] = useState<WorkScheduleItem | null>(null);
    const [showWorkModal, setShowWorkModal] = useState(false);
    // ---------------------------------------------
    
    // State สำหรับควบคุมฟอร์ม
    const initialFormState: WorkFormData = {
        work_date: new Date().toISOString().split('T')[0], // Default to today
        work_time: '',
        department: '',
        detail: '',
        worker_role: '',
        worker_name: '',
    };
    const [formData, setFormData] = useState<WorkFormData>(initialFormState);
    
    // Helper function สำหรับจัดการการเปลี่ยนแปลงในฟอร์ม
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Helper: Function to refresh the schedule data
    const refreshSchedule = async () => {
        const { data: schedule } = await supabase
            .from("work_schedule")
            .select("*")
            .order("created_at", { ascending: false });

        setWorkSchedule((schedule || []) as WorkScheduleItem[]);
    };

    // *** NEW: Handler for row click to show details ***
    const handleRowClick = (item: WorkScheduleItem) => {
        if (editingId) return; // ไม่อนุญาตให้เปิด Modal หากกำลังแก้ไข
        setSelectedWork(item);
        setShowWorkModal(true);
    };

    // *** NEW: ฟังก์ชันสำหรับอัปเดตสถานะงาน (ใช้ใน Modal) ***
    async function updateWorkStatus(workId: string, newStatus: WorkScheduleItem['status']) {
        if (!newStatus || !isAdmin) return;
        try {
            setLoading(true);
            const { error: updateErr } = await supabase
                .from("work_schedule")
                .update({ status: newStatus })
                .eq("id", workId);
            
            if (updateErr) throw updateErr;

            // Update local state and refresh
            setSelectedWork(prev => prev ? { ...prev, status: newStatus } : null);
            await refreshSchedule(); // Refresh data

        } catch (e) {
            console.error("Error updating work status:", e);
        } finally {
            setLoading(false);
        }
    }


    // ฟังก์ชันสำหรับเริ่มต้นการแก้ไข (Inline Edit)
    const startEdit = (item: WorkScheduleItem) => {
        setEditFormData({
            id: item.id,
            work_date: item.work_date,
            work_time: item.work_time,
            department: item.department,
            detail: item.detail,
            worker_role: item.worker_role,
            worker_name: item.worker,
        });
        setEditingId(item.id);
    };

    // ฟังก์ชันสำหรับจัดการการเปลี่ยนแปลงข้อมูลในแถวที่แก้ไข
    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev!, [name]: value }));
    };

    // ฟังก์ชันสำหรับบันทึกการแก้ไขไปยัง Supabase
    async function updateWork() {
        if (!isAdmin || !editingId || !editFormData.id) return;
        
        const { id, work_date, work_time, department, detail, worker_role, worker_name } = editFormData;
        
        // Basic validation
        if (!work_date || !work_time || !department || !detail || !worker_role || !worker_name) {
            alert("กรุณากรอกข้อมูลให้ครบถ้วนก่อนบันทึก!");
            return;
        }

        const work_shift = getThaiShift(work_time!); 

        try {
            setLoading(true);
            const { error: updateError } = await supabase
                .from("work_schedule")
                .update({
                    work_date,
                    work_time,
                    work_shift,
                    department,
                    detail,
                    worker: worker_name, 
                    worker_role: worker_role,
                })
                .eq("id", id);
            
            if (updateError) throw updateError;

            setEditingId(null); 
            await refreshSchedule(); // Refresh data

        } catch (e) {
            console.error("Error updating work schedule:", e);
            // *** FIX: แก้ไขบรรทัดนี้เพื่อไม่ให้ใช้ any ***
            alert(
                "เกิดข้อผิดพลาดในการอัปเดตข้อมูล: " + 
                ((e as { message?: string })?.message || String(e))
            );
        } finally {
            setLoading(false);
        }
    }


    // Client-side Data Fetching
    React.useEffect(() => {
        async function fetchData() {
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (!authUser) {
                    return redirect("/auth/login");
                }
                
                const { data: profile } = await supabase.from("profiles").select("role").eq("id", authUser.id).single();
                const userRole = profile?.role || 'user';
                
                setUser({ id: authUser.id, email: authUser.email || 'N/A', role: userRole }); 

                // ดึงข้อมูล work_schedule
                const { data: schedule, error: fetchError } = await supabase
                    .from("work_schedule")
                    .select("*")
                    .order("created_at", { ascending: false });

                if (fetchError) {
                    console.error("Error fetching work schedule:", fetchError);
                }
                setWorkSchedule((schedule || []) as WorkScheduleItem[]);
            } catch(e) {
                console.error("Error during initial fetch:", e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [supabase]);


    // Server Action สำหรับเพิ่มตารางงาน (ใช้ข้อมูลจาก State)
    async function addWork(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!isAdmin) {
            return;
        }

        const { work_date, work_time, department, detail, worker_role, worker_name } = formData;
        
        if (!work_date || !work_time || !department || !detail || !worker_role || !worker_name || !user?.id) {
            console.error("Missing required form data or User ID.");
            return;
        }

        const work_shift = getThaiShift(work_time);
        
        try {
            setLoading(true);
            const { error: insertError } = await supabase
                .from("work_schedule")
                .insert({
                    work_date,
                    work_time,
                    work_shift,
                    department,
                    detail,
                    worker: worker_name,
                    worker_role: worker_role,
                    user_id: user?.id,
                    status: 'pending' // กำหนดสถานะเริ่มต้น
                });
                
            if (insertError) {
                console.error("Error inserting work schedule:", insertError);
                console.error("Error details:", insertError.message || insertError);
                return;
            }

            setFormData(initialFormState); 
            await refreshSchedule();

        } catch (e) {
            console.error("Error inserting work schedule:", e);
        } finally {
            setLoading(false);
        }
    }


    // ==============================================================================
    // 3. FILTERING AND SORTING LOGIC
    // ==============================================================================

    const filteredAndSortedWork = useMemo(() => {
        let data = [...workSchedule]; 
        const lowerCaseSearch = searchTerm.toLowerCase();
        const isSearching = lowerCaseSearch.length > 0;

        data = data.filter(item => {
            if (!isSearching && item.status === 'complete') {
                return false;
            }

            if (isSearching) {
                return (
                    item.department.toLowerCase().includes(lowerCaseSearch) ||
                    item.detail.toLowerCase().includes(lowerCaseSearch) ||
                    item.worker.toLowerCase().includes(lowerCaseSearch) ||
                    item.worker_role.toLowerCase().includes(lowerCaseSearch)
                );
            }
            
            return true;
        });
        
        data.sort((a, b) => {
            const dateA = new Date(`${a.work_date}T${a.work_time}`).getTime();
            const dateB = new Date(`${b.work_date}T${b.work_time}`).getTime(); 
            return dateA - dateB;
        });

        return data;
    }, [workSchedule, searchTerm]);

    if (loading) {
        return (
            <main className="p-6 max-w-4xl mx-auto">
                <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
            </main>
        );
    }

    return (
        <main className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">📅 ระบบจัดการตารางงาน</h1>
            <p className="mb-6 text-gray-600">
                สวัสดี **{user?.email}** (Role: **{user?.role}**)
            </p>

            {/* Admin Section: Form */}
            {isAdmin && (
                <>
                    <h2 className="text-xl font-semibold mb-4 text-blue-600">
                        ➕ เพิ่มตารางงานใหม่ (Admin Panel)
                    </h2>
                    <form onSubmit={addWork} className="space-y-4 bg-gray-100 p-6 rounded-lg shadow-md mb-8">

                        {/* 1. Input สำหรับ 'วันที่' */}
                        <div>
                            <label className="block mb-1 font-medium">วันที่</label>
                            <input 
                                name="work_date" 
                                type="date" 
                                className="w-full p-3 border rounded-lg" 
                                required 
                                value={formData.work_date}
                                onChange={handleFormChange}
                            />
                        </div>

                        {/* 2. Input 'เวลา' และ 'หน่วยงาน' */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1 font-medium">เวลา</label>
                                <input 
                                    name="work_time" 
                                    type="time" 
                                    className="w-full p-3 border rounded-lg" 
                                    required 
                                    value={formData.work_time}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div>
                                <label className="block mb-1 font-medium">หน่วยงาน</label>
                                <input 
                                    name="department" 
                                    type="text" 
                                    placeholder="ชื่อแผนก" 
                                    className="w-full p-3 border rounded-lg" 
                                    required 
                                    value={formData.department}
                                    onChange={handleFormChange}
                                />
                            </div>
                        </div>

                        {/* 3. Input สำหรับ 'รายละเอียดงาน' */}
                        <div>
                            <label className="block mb-1 font-medium">รายละเอียดงาน</label>
                            <textarea 
                                name="detail" 
                                rows={3} 
                                placeholder="รายละเอียดของงาน" 
                                className="w-full p-3 border rounded-lg" 
                                required 
                                value={formData.detail}
                                onChange={handleFormChange}
                            />
                        </div>

                        {/* 4. Input 'ฝ่ายช่าง' และ 'ชื่อช่าง' */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* ฝ่ายช่าง (Dropdown) */}
                            <div>
                                <label className="block mb-1 font-medium">ฝ่ายช่าง</label>
                                <select
                                    name="worker_role"
                                    className="w-full p-3 border rounded-lg"
                                    required
                                    value={formData.worker_role}
                                    onChange={handleFormChange}
                                >
                                    <option value="" disabled>--- เลือกฝ่ายช่าง ---</option>
                                    {TECHNICIAN_ROLES.map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>
                            {/* ชื่อช่าง (Input Text) */}
                            <div>
                                <label className="block mb-1 font-medium">ชื่อช่าง</label>
                                <input 
                                    name="worker_name" 
                                    type="text" 
                                    placeholder="ชื่อผู้รับผิดชอบ" 
                                    className="w-full p-3 border rounded-lg" 
                                    required 
                                    value={formData.worker_name}
                                    onChange={handleFormChange}
                                />
                            </div>
                        </div>

                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                            บันทึกตารางงานใหม่
                        </button>
                    </form>
                </>
            )}

            {/* Schedule Display Section */}
            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4 text-green-700">
                    📋 ตารางงานทั้งหมด
                    <span className="text-sm font-normal text-gray-500 ml-3">
                        {!searchTerm && "(ซ่อนงานที่เสร็จสมบูรณ์ไปแล้ว)"}
                    </span>
                </h2>

                {/* Search Input */}
                <div className="relative mb-4">
                    <Search className="w-4 h-4 absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหางาน (ฝ่าย, รายละเอียด, ช่าง) เพื่อแสดงงานทั้งหมด"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                    />
                </div>

                {(workSchedule.length > 0) ? (
                    <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เวลา / กะ</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หน่วยงาน</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายละเอียด</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ฝ่ายช่าง</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อช่าง</th>
                                    {/* Action Column for Admin */}
                                    {isAdmin && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAndSortedWork.map((item) => {
                                    const roleColor = getColorClasses(item.worker_role);
                                    const statusColor = getStatusClasses(item.status);
                                    const isEditing = editingId === item.id;

                                    return (
                                        <tr 
                                            key={item.id} 
                                            // *** ADDED cursor-pointer and onClick handler ***
                                            className={`${isEditing ? 'bg-yellow-50' : roleColor.bg} border-l-4 ${roleColor.border} ${isEditing ? 'hover:bg-yellow-50' : 'hover:bg-gray-100 cursor-pointer'} transition-colors`}
                                            onClick={isEditing ? undefined : () => handleRowClick(item)}
                                        >
                                            {/* ------------------------------------------------------------- */}
                                            {/* 1. วันที่ (Date) - Editable */}
                                            {/* ------------------------------------------------------------- */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {isEditing ? (
                                                    <input
                                                        name="work_date"
                                                        type="date"
                                                        className="w-32 p-1 border rounded-md"
                                                        value={editFormData.work_date || ''}
                                                        onChange={handleEditChange}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    item.work_date
                                                )}
                                            </td>
                                            
                                            {/* 2. เวลา / กะ (Time / Shift) - Editable */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isEditing ? (
                                                    <input
                                                        name="work_time"
                                                        type="time"
                                                        className="w-24 p-1 border rounded-md"
                                                        value={editFormData.work_time || ''}
                                                        onChange={handleEditChange}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="text-sm font-medium">{item.work_time}</div>
                                                        <div className="text-xs text-gray-500 capitalize">{item.work_shift}</div>
                                                    </>
                                                )}
                                            </td>

                                            {/* 3. สถานะ (Status) - Not Editable for now */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor.bg} ${statusColor.text}`}>
                                                    {statusColor.label}
                                                </span>
                                            </td>
                                            
                                            {/* 4. หน่วยงาน (Department) - Editable */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {isEditing ? (
                                                    <input
                                                        name="department"
                                                        type="text"
                                                        className="w-32 p-1 border rounded-md"
                                                        value={editFormData.department || ''}
                                                        onChange={handleEditChange}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    item.department
                                                )}
                                            </td>
                                            
                                            {/* 5. รายละเอียด (Detail) - Editable */}
                                            <td className="px-6 py-4 text-sm max-w-xs">
                                                {isEditing ? (
                                                    <textarea
                                                        name="detail"
                                                        rows={2}
                                                        className="w-48 p-1 border rounded-md resize-none"
                                                        value={editFormData.detail || ''}
                                                        onChange={handleEditChange}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <span className="truncate block">{item.detail}</span>
                                                )}
                                            </td>

                                            {/* 6. ฝ่ายช่าง (Worker Role) - Editable */}
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${roleColor.text}`}>
                                                {isEditing ? (
                                                    <select
                                                        name="worker_role"
                                                        className="w-32 p-1 border rounded-md"
                                                        value={editFormData.worker_role || ''}
                                                        onChange={handleEditChange}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {TECHNICIAN_ROLES.map((role) => (
                                                            <option key={role} value={role}>{role}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    item.worker_role
                                                )}
                                            </td>
                                            
                                            {/* 7. ชื่อช่าง (Worker Name) - Editable */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {isEditing ? (
                                                    <input
                                                        name="worker_name"
                                                        type="text"
                                                        className="w-24 p-1 border rounded-md"
                                                        value={editFormData.worker_name || ''}
                                                        onChange={handleEditChange}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    item.worker
                                                )}
                                            </td>

                                            {/* 8. Action Button (Admin Only) */}
                                            {isAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {isEditing ? (
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); updateWork(); }}
                                                                disabled={loading}
                                                                className="text-white bg-green-500 hover:bg-green-600 px-3 py-1 rounded-lg disabled:opacity-50"
                                                            >
                                                                {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                                                                disabled={loading}
                                                                className="text-gray-700 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-lg disabled:opacity-50"
                                                            >
                                                                ยกเลิก
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                                                            className="text-blue-600 hover:text-blue-900"
                                                        >
                                                            แก้ไข/เลื่อน
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        {searchTerm 
                            ? `ไม่พบงานที่ตรงกับ "${searchTerm}"` 
                            : 'ยังไม่มีตารางงานที่ถูกบันทึกไว้ (หรือมีแตเป็นงานที่เสร็จสมบูรณ์แล้ว)'}
                    </p>
                )}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* *** NEW: Work Detail Modal *** */}
            {/* ------------------------------------------------------------------ */}
            {showWorkModal && selectedWork && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowWorkModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 transform transition-all max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        
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
                                        วันที่: {new Date(selectedWork.work_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                    <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                                        <Clock className="w-4 h-4" />
                                        เวลา: {selectedWork.work_time} ({selectedWork.work_shift})
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
                                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${getColorClasses(selectedWork.worker_role).bg} ${getColorClasses(selectedWork.worker_role).text} ${getColorClasses(selectedWork.worker_role).border} border-l-4`}>
                                            {selectedWork.worker_role}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="p-3 bg-yellow-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                        selectedWork.status === 'pending' ? 'bg-red-600' : 
                                        selectedWork.status === 'inprogress' ? 'bg-yellow-600' : 
                                        'bg-green-600'
                                    }`}></div>
                                    <p className="font-semibold text-gray-900 text-sm">สถานะ:
                                        {getStatusClasses(selectedWork.status).label}
                                    </p>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-orange-100 rounded-full flex-shrink-0"><FileText className="w-5 h-5 text-orange-600" /></div>
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-1">รายละเอียด:</p>
                                        <p className="text-gray-700 whitespace-pre-wrap">{selectedWork.detail}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Footer / Action Buttons (Admin only can change status) */}
                        {isAdmin && (
                            <div className="p-6 border-t bg-white">
                                <div className="space-y-3">
                                    {selectedWork.status === 'pending' && (
                                        <button 
                                            onClick={() => updateWorkStatus(selectedWork.id, 'inprogress')} 
                                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
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
                        )}

                        {!isAdmin && (
                            <div className="p-6 border-t bg-white">
                                <button 
                                    onClick={() => setShowWorkModal(false)} 
                                    className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                                >
                                    ปิด
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}