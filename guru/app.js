// URL WEB APP GOOGLE APPS SCRIPT ANDA (GANTI SETELAH DEPLOY JIKA PERLU)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZYfk70rs-WOOHQeq4RR93VtdzcpvTIk4aMv2rKUgFqGJ6RiOReb2QNnMbNZUp5fkLwg/exec";

const sectionLogin = document.getElementById('loginSection');
const sectionRekap = document.getElementById('rekapSection');

const inputIdGuru = document.getElementById('inputIdGuru');
const inputSecret = document.getElementById('inputSecret');
const btnLanjut = document.getElementById('btnLanjut');

const userProfile = document.getElementById('userProfile');
const displayNamaGuru = document.getElementById('displayNamaGuru');
const btnProfileMenu = document.getElementById('btnProfileMenu');
const dropdownMenu = document.getElementById('dropdownMenu');

const rekapContainer = document.getElementById('rekapContainer');
const filterWaktu = document.getElementById('filterWaktu');
const inputSearch = document.getElementById('inputSearch');
let rekapDataCache = [];
let daftarSiswaCache = [];

// Init
window.onload = () => {
    const savedNamaGuru = localStorage.getItem('nama_guru');

    if (savedNamaGuru) {
        displayNamaGuru.innerText = savedNamaGuru;
        userProfile.style.display = 'flex';
        sectionLogin.style.display = 'none';
        sectionRekap.style.display = 'flex';
        loadRekap(savedNamaGuru);
    }
};

// Login Guru
btnLanjut.addEventListener('click', async () => {
    const idGuru = inputIdGuru.value.trim();
    const secret = inputSecret.value.trim();

    if (!idGuru || !secret) {
        showToast("Mohon masukkan ID dan Kata Sandi", "error");
        return;
    }

    const originalText = btnLanjut.innerHTML;
    btnLanjut.innerHTML = `<div class="spinner w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> Memverifikasi...`;
    btnLanjut.disabled = true;

    try {
        const payload = {
            action: "login_guru",
            idGuru: idGuru,
            secret: secret
        };

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        const result = await res.json();

        if (result.status === 'success') {
            localStorage.setItem('nama_guru', result.nama);
            displayNamaGuru.innerText = result.nama;

            userProfile.style.display = 'flex';
            sectionLogin.style.display = 'none';
            sectionRekap.style.display = 'flex';

            showToast("Login Berhasil!");
            loadRekap(result.nama);
        } else {
            showToast(result.message, "error");
        }
    } catch (e) {
        showToast("Koneksi gagal saat memverifikasi.", "error");
    } finally {
        btnLanjut.innerHTML = originalText;
        btnLanjut.disabled = false;
    }
});

// Dropdown Logout
if (btnProfileMenu && dropdownMenu) {
    btnProfileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!btnProfileMenu.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });
}

document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('nama_guru');
    window.location.reload();
});

// Load Rekap
async function loadRekap(namaGuru) {
    rekapContainer.innerHTML = `
        <div class="text-center text-slate-400 text-sm py-10 flex flex-col items-center gap-2">
            <div class="spinner w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full"></div>
            Mengambil data absensi siswa...
        </div>
    `;

    try {
        // Ambil semua data (bulan=all), lalu filter secara lokal untuk performa dan kecepatan
        const url = `${GOOGLE_SCRIPT_URL}?action=getRekapGuru&namaGuru=${encodeURIComponent(namaGuru)}&bulan=all`;

        const res = await fetch(url);
        const result = await res.json();

        if (result.status === 'success') {
            rekapDataCache = result.data;
            daftarSiswaCache = result.siswa || [];
            applyFilters();
        } else {
            rekapContainer.innerHTML = `<div class="text-center text-rose-500 text-sm py-10 font-medium">${result.message}</div>`;
        }
    } catch (e) {
        rekapContainer.innerHTML = `<div class="text-center text-rose-500 text-sm py-10 font-medium">Gagal mengambil data rekap. Periksa koneksi.</div>`;
    }
}

// Render Rekap dengan Search Filter
// Render Rekap dengan Search Filter
function renderRekap(data, format = 'list', waktu = 'today') {
    if ((!data || data.length === 0) && format === 'list') {
        rekapContainer.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 font-medium">Tidak ada data rekap ditemukan.</div>`;
        return;
    }

    let html = '';

    if (format === 'summary') {
        // --- FORMAT SUMMARY (TOTAL KESELURUHAN) ---
        let stats = {};
        // Inisialisasi semua siswa
        daftarSiswaCache.forEach(s => {
            stats[s.nisn] = { nama: s.nama, H: 0, I: 0, S: 0, A: 0 };
        });
        // Hitung
        data.forEach(item => {
            if (stats[item.nisn]) {
                if (item.status === 'Hadir') stats[item.nisn].H++;
                else if (item.status === 'Izin') stats[item.nisn].I++;
                else if (item.status === 'Sakit') stats[item.nisn].S++;
                else if (item.status === 'Belum Absen' || item.status === 'Alpha') stats[item.nisn].A++;
            }
        });

        html += `
        <div class="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm w-full">
            <table class="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                    <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th class="p-3 font-semibold text-center w-10">No</th>
                        <th class="p-3 font-semibold">Nama Siswa</th>
                        <th class="p-3 font-semibold text-center text-emerald-600">Hadir</th>
                        <th class="p-3 font-semibold text-center text-amber-600">Izin</th>
                        <th class="p-3 font-semibold text-center text-rose-600">Sakit</th>
                        <th class="p-3 font-semibold text-center text-slate-500">Alpha</th>
                    </tr>
                </thead>
                <tbody class="text-sm divide-y divide-slate-100">
        `;

        Object.values(stats).forEach((row, index) => {
            html += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3 text-center text-slate-400 text-xs">${index + 1}</td>
                    <td class="p-3 font-semibold text-slate-800">${row.nama}</td>
                    <td class="p-3 text-center font-bold text-emerald-600 bg-emerald-50/50">${row.H}</td>
                    <td class="p-3 text-center font-bold text-amber-600 bg-amber-50/50">${row.I}</td>
                    <td class="p-3 text-center font-bold text-rose-600 bg-rose-50/50">${row.S}</td>
                    <td class="p-3 text-center font-bold text-slate-500">${row.A}</td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;

    } else if (format === 'matrix') {
        // --- FORMAT MATRIX (MINGGUAN / BULANAN) ---
        let dates = [];
        const now = new Date();
        
        if (waktu === 'week') {
            // Dapatkan Senin minggu ini
            let day = now.getDay();
            let diff = now.getDate() - day + (day === 0 ? -6 : 1); 
            const monday = new Date(now.setDate(diff));
            for(let i=0; i<6; i++) { // Senin - Sabtu
                let d = new Date(monday);
                d.setDate(d.getDate() + i);
                dates.push(`${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`);
            }
        } else if (waktu === 'month') {
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for(let i=1; i<=daysInMonth; i++) {
                dates.push(`${i.toString().padStart(2,'0')}/${(month+1).toString().padStart(2,'0')}/${year}`);
            }
        }

        let matrix = {};
        daftarSiswaCache.forEach(s => {
            matrix[s.nisn] = { nama: s.nama, records: {} };
            dates.forEach(d => matrix[s.nisn].records[d] = '-');
        });

        data.forEach(item => {
            if (matrix[item.nisn] && matrix[item.nisn].records[item.tanggal] !== undefined) {
                let stat = item.status === 'Hadir' ? 'H' : 
                           item.status === 'Izin' ? 'I' : 
                           item.status === 'Sakit' ? 'S' : '-';
                matrix[item.nisn].records[item.tanggal] = stat;
            }
        });

        // Header Table
        html += `
        <div class="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm w-full relative">
            <table class="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                    <tr class="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                        <th class="p-2 font-semibold text-center sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[30px]">No</th>
                        <th class="p-2 font-semibold sticky left-[30px] bg-slate-50 z-10 border-r border-slate-200 min-w-[120px]">Siswa</th>`;
        
        dates.forEach((d, i) => {
            let dayLabel = waktu === 'week' ? `Hari ${i+1}` : d.split('/')[0];
            html += `<th class="p-1 font-semibold text-center min-w-[30px]" title="${d}">${dayLabel}</th>`;
        });
        html += `</tr></thead><tbody class="text-xs divide-y divide-slate-100">`;

        Object.values(matrix).forEach((row, index) => {
            html += `<tr class="hover:bg-slate-50 transition-colors">
                <td class="p-2 text-center text-slate-400 sticky left-0 bg-white z-10 border-r border-slate-100">${index + 1}</td>
                <td class="p-2 font-semibold text-slate-800 sticky left-[30px] bg-white z-10 border-r border-slate-100 truncate max-w-[120px]" title="${row.nama}">${row.nama}</td>`;
            
            dates.forEach(d => {
                let stat = row.records[d];
                let colorClass = stat === 'H' ? 'text-emerald-600 bg-emerald-50' : 
                                 stat === 'I' ? 'text-amber-600 bg-amber-50' : 
                                 stat === 'S' ? 'text-rose-600 bg-rose-50' : 'text-slate-300';
                html += `<td class="p-1 text-center font-bold border-l border-slate-100 ${colorClass}" title="${d}: ${stat}">${stat}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;

    } else {
        // --- FORMAT LIST (HARI INI) ---
        data.forEach(item => {
            let badgeColor = item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                item.status === 'Izin' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                item.status === 'Belum Absen' ? 'bg-slate-100 text-slate-500 border-slate-300' :
                    'bg-rose-50 text-rose-700 border-rose-200';

            let fotoUrl = item.foto;
            if (fotoUrl && fotoUrl.includes('drive.google.com/file/d/')) {
                const match = fotoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    fotoUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w120`;
                }
            }

            html += `
            <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-3 flex gap-3 items-center mb-3">
                ${fotoUrl ? `<img src="${fotoUrl}" class="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQ3NTU2OSIgZD0iTTEyIDJDMiAyIDIgMTIgMiAxMnMyIDEwIDEwIDEwIDEwLTEwIDEwLTEwUzIyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6Ii8+PC9zdmc+'" />` : '<div class="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"><i class="ph ph-image text-slate-400"></i></div>'}
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-0.5">
                        <span class="text-slate-800 font-semibold text-sm truncate">${item.nama}</span>
                        <span class="text-[10px] border px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badgeColor}">${item.status}</span>
                    </div>
                    <div class="text-slate-500 text-xs font-medium truncate">${item.tanggal} • ${item.waktu} ${item.alasan ? '• ' + item.alasan : ''}</div>
                </div>
            </div>
            `;
        });
    }

    rekapContainer.innerHTML = html;
}

// Logika Filter Berlapis (Pencarian & Waktu)
function applyFilters() {
    const keyword = inputSearch.value.toLowerCase();
    const waktu = filterWaktu.value;
    
    // Fungsi pembantu untuk mem-parsing DD/MM/YYYY
    const parseDate = (str) => {
        const parts = str.split('/');
        if (parts.length !== 3) return new Date();
        return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    const now = new Date();
    const todayStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    
    let filtered = rekapDataCache.filter(item => {
        // Filter Waktu
        if (waktu === 'all') return true;
        
        if (waktu === 'today') {
            const itemDate = parseDate(item.tanggal);
            return itemDate.getDate() === now.getDate() && 
                   itemDate.getMonth() === now.getMonth() && 
                   itemDate.getFullYear() === now.getFullYear();
        }
        
        if (waktu === 'week') {
            // Cek apakah tanggal ada di minggu yang sama (maksimal 7 hari ke belakang dari start of week)
            const itemDate = parseDate(item.tanggal);
            const firstDay = new Date(now.setDate(now.getDate() - now.getDay())); // Minggu
            const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 6)); // Sabtu
            firstDay.setHours(0,0,0,0);
            lastDay.setHours(23,59,59,999);
            return itemDate >= firstDay && itemDate <= lastDay;
        }
        
        if (waktu === 'month') {
            const itemDate = parseDate(item.tanggal);
            const currentNow = new Date(); // Reset object since we manipulated it above
            return itemDate.getMonth() === currentNow.getMonth() && 
                   itemDate.getFullYear() === currentNow.getFullYear();
        }

        return true;
    });

    // Fitur Khusus: Tampilkan Siswa "Belum Absen" KHUSUS JIKA filter Hari Ini dipilih
    // (Untuk Summary dan Matrix, kita gunakan daftarSiswaCache saat render)
    if (waktu === 'today' && daftarSiswaCache.length > 0) {
        const sudahAbsenNisn = filtered.map(item => item.nisn);
        const belumAbsen = daftarSiswaCache.filter(s => !sudahAbsenNisn.includes(s.nisn));
        
        belumAbsen.forEach(s => {
            filtered.push({
                nisn: s.nisn,
                nama: s.nama,
                tanggal: todayStr,
                waktu: '--:--',
                status: 'Belum Absen',
                foto: null,
                alasan: ''
            });
        });
    }

    // Terapkan Filter Pencarian setelah digabung dengan yang Belum Absen
    filtered = filtered.filter(item => {
        return item.nama.toLowerCase().includes(keyword) || item.nisn.toLowerCase().includes(keyword);
    });

    // Urutkan: Yang belum absen di atas
    filtered.sort((a, b) => {
        if (a.status === 'Belum Absen' && b.status !== 'Belum Absen') return -1;
        if (a.status !== 'Belum Absen' && b.status === 'Belum Absen') return 1;
        return a.nama.localeCompare(b.nama);
    });

    let formatView = 'list';
    if (waktu === 'all') formatView = 'summary';
    else if (waktu === 'week' || waktu === 'month') formatView = 'matrix';
    
    renderRekap(filtered, formatView, waktu);
}

// Event Listeners for Filters
filterWaktu.addEventListener('change', applyFilters);
inputSearch.addEventListener('input', applyFilters);

// Cetak PDF
document.getElementById('btnExportPdf').addEventListener('click', () => {
    window.print();
});
