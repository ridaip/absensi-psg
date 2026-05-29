// URL WEB APP GOOGLE APPS SCRIPT ANDA (GANTI SETELAH DEPLOY)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZYfk70rs-WOOHQeq4RR93VtdzcpvTIk4aMv2rKUgFqGJ6RiOReb2QNnMbNZUp5fkLwg/exec";

// DOM Elements
const sectionLogin = document.getElementById('loginSection');
const sectionAbsen = document.getElementById('absenSection');
const sectionSuccess = document.getElementById('successSection');

const inputNisn = document.getElementById('inputNisn');
const inputTglLahir = document.getElementById('inputTglLahir');
const btnLanjut = document.getElementById('btnLanjut');
const userProfile = document.getElementById('userProfile');
const navTabs = document.getElementById('navTabs');
const displayNisn = document.getElementById('displayNisn');

const video = document.getElementById('cameraFeed');
const canvas = document.getElementById('photoCanvas');
const photoPreview = document.getElementById('photoPreview');
const btnCapture = document.getElementById('btnCapture');
const btnRetake = document.getElementById('btnRetake');
const btnSubmit = document.getElementById('btnSubmit');
const locationStatus = document.getElementById('locationStatus');
const faceGuide = document.querySelector('.face-guide');
const loadingOverlay = document.getElementById('loadingOverlay');

// State
let userData = {
    nisn: '',
    lat: null,
    lng: null,
    photoBase64: null
};

let stream = null;

// On Load Check LocalStorage
window.onload = () => {
    const savedNisn = localStorage.getItem('nisn_pkl');
    const savedNama = localStorage.getItem('nama_pkl');

    if (savedNisn) {
        userData.nisn = savedNisn;
        displayNisn.innerText = savedNama || savedNisn;
        userProfile.style.display = 'flex';
        navTabs.style.display = 'flex';

        sectionLogin.style.display = 'none';
        sectionAbsen.style.display = 'flex';

        initCamera();
        getLocation();
    }
};

// --- Logic Status & Alasan ---
const radioStatus = document.querySelectorAll('input[name="statusAbsen"]');
const alasanContainer = document.getElementById('alasanContainer');
const inputAlasan = document.getElementById('inputAlasan');

radioStatus.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'Sakit' || e.target.value === 'Izin') {
            alasanContainer.style.display = 'block';
        } else {
            alasanContainer.style.display = 'none';
            inputAlasan.value = '';
        }
    });
});

// --- Flow 1: Login / Masukkan NISN ---
btnLanjut.addEventListener('click', async () => {
    const nisn = inputNisn.value.trim();
    const tglLahirRaw = inputTglLahir.value; // format HTML date YYYY-MM-DD

    if (!nisn || !tglLahirRaw) {
        showToast("Mohon masukkan NISN dan Tanggal Lahir", "error");
        return;
    }

    // Format YYYY-MM-DD menjadi DD/MM/YYYY
    const [year, month, day] = tglLahirRaw.split('-');
    const tglLahirFormatted = `${day}/${month}/${year}`;

    // Tampilkan loading di tombol
    const originalText = btnLanjut.innerHTML;
    btnLanjut.innerHTML = `<div class="spinner w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> Memverifikasi...`;
    btnLanjut.disabled = true;

    try {
        const payload = {
            action: "login",
            nisn: nisn,
            tglLahir: tglLahirFormatted
        };

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        const result = await res.json();

        if (result.status === 'success') {
            userData.nisn = nisn;
            displayNisn.innerText = result.nama || nisn;
            userProfile.style.display = 'flex';
            navTabs.style.display = 'flex';
            
            // Save to cache
            localStorage.setItem('nisn_pkl', nisn);
            if (result.nama) localStorage.setItem('nama_pkl', result.nama);

            // Pindah ke halaman absen
            sectionLogin.style.display = 'none';
            sectionAbsen.style.display = 'flex';

            // Mulai GPS dan Kamera
            initCamera();
            getLocation();
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

// --- Logic Logout & Navigasi ---
document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.removeItem('nisn_pkl');
    localStorage.removeItem('nama_pkl');
    window.location.reload();
});

const sectionRekap = document.getElementById('rekapSection');
const btnNavAbsen = document.getElementById('btnNavAbsen');
const btnNavRekap = document.getElementById('btnNavRekap');

const ACTIVE_TAB = ['text-white', 'bg-primary', 'font-semibold', 'shadow-sm'];
const INACTIVE_TAB = ['text-slate-500', 'font-medium', 'hover:text-slate-800', 'bg-transparent', 'shadow-none'];

function setTabActive(activeBtn, inactiveBtn) {
    activeBtn.classList.remove(...INACTIVE_TAB);
    activeBtn.classList.add(...ACTIVE_TAB);
    
    inactiveBtn.classList.remove(...ACTIVE_TAB);
    inactiveBtn.classList.add(...INACTIVE_TAB);
}

btnNavAbsen.addEventListener('click', () => {
    sectionRekap.style.display = 'none';
    sectionSuccess.style.display = 'none';
    sectionAbsen.style.display = 'flex';
    setTabActive(btnNavAbsen, btnNavRekap);
});

btnNavRekap.addEventListener('click', () => {
    sectionAbsen.style.display = 'none';
    sectionSuccess.style.display = 'none';
    sectionRekap.style.display = 'flex';
    setTabActive(btnNavRekap, btnNavAbsen);
    loadRekap();
});

// --- Flow 2: Kamera (Ambil Foto) ---
async function initCamera() {
    try {
        // Minta akses kamera depan (user)
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error akses kamera:", err);
        showToast("Gagal mengakses kamera. Pastikan izin diberikan.", "error");
        locationStatus.innerText = "Kamera diblokir!";
    }
}

btnCapture.addEventListener('click', () => {
    // KOMPRESI 1: Perkecil resolusi (Max Width 480px)
    const MAX_WIDTH = 480;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > MAX_WIDTH) {
        const ratio = MAX_WIDTH / width;
        width = MAX_WIDTH;
        height = height * ratio;
    }

    // Set ukuran canvas dengan resolusi yang sudah diperkecil
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    // KOMPRESI 2: Turunkan kualitas JPEG menjadi 30% (0.3) agar Base64 sangat kecil
    userData.photoBase64 = canvas.toDataURL('image/jpeg', 0.3);

    // Ubah Tampilan UI
    video.style.display = 'none';
    faceGuide.style.display = 'none';
    photoPreview.src = userData.photoBase64;
    photoPreview.style.display = 'block';

    btnCapture.style.display = 'none';
    btnRetake.style.display = 'flex';
    btnSubmit.style.display = 'flex';
});

btnRetake.addEventListener('click', () => {
    userData.photoBase64 = null;

    photoPreview.style.display = 'none';
    video.style.display = 'block';
    faceGuide.style.display = 'block';

    btnRetake.style.display = 'none';
    btnSubmit.style.display = 'none';
    btnCapture.style.display = 'flex';
});

// --- Flow 3: Geolocation (GPS) ---
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userData.lat = position.coords.latitude;
                userData.lng = position.coords.longitude;
                locationStatus.innerHTML = `<span class="text-emerald-600 font-bold text-xs uppercase tracking-wider">Akurat (${position.coords.accuracy.toFixed(0)}m)</span><br><span class="text-slate-600 text-xs font-medium">${userData.lat.toFixed(5)}, ${userData.lng.toFixed(5)}</span>`;
            },
            (error) => {
                let msg = "Gagal mengambil lokasi.";
                if (error.code == 1) msg = "Akses GPS ditolak.";
                locationStatus.innerHTML = `<span class="text-rose-600 font-bold text-xs uppercase tracking-wider">${msg}</span>`;
                showToast(msg, "error");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        locationStatus.innerText = "Browser tidak mendukung GPS.";
    }
}

// --- Flow 4: Submit Data ke Google Apps Script ---
btnSubmit.addEventListener('click', async () => {
    if (!userData.lat || !userData.lng) {
        showToast("Tunggu! Lokasi GPS belum didapatkan.", "error");
        return;
    }

    if (GOOGLE_SCRIPT_URL.includes("YOUR_SCRIPT_ID_HERE")) {
        showToast("DEVELOPER: Masukkan URL Web App Anda di app.js", "error");
        return;
    }

    const selectedStatus = document.querySelector('input[name="statusAbsen"]:checked').value;
    const alasan = inputAlasan.value.trim();

    if ((selectedStatus === 'Sakit' || selectedStatus === 'Izin') && !alasan) {
        showToast("Mohon tuliskan alasan Anda!", "error");
        return;
    }

    // Tampilkan Loading
    loadingOverlay.style.display = 'flex';

    const payload = {
        nisn: userData.nisn,
        lat: userData.lat,
        lng: userData.lng,
        photoBase64: userData.photoBase64,
        status: selectedStatus,
        alasan: alasan
    };

    try {
        // Harus menggunakan Content-Type text/plain agar tidak terkena CORS Preflight (OPTIONS) di GAS
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            }
        });

        const result = await response.json();

        if (result.status === "success") {
            // Matikan stream kamera
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // Pindah halaman
            sectionAbsen.style.display = 'none';
            sectionSuccess.style.display = 'flex';

            // Tampilkan waktu berhasil
            const now = new Date();
            document.getElementById('timeStampDisplay').innerText =
                `${now.toLocaleDateString('id-ID')} - ${now.toLocaleTimeString('id-ID')}`;

            showToast("Berhasil Absen!");
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error("Error submit:", error);
        showToast("Gagal mengirim data. Cek koneksi internet.", "error");
    } finally {
        loadingOverlay.style.display = 'none';
    }
});

// Kembali ke Awal
document.getElementById('btnKembali').addEventListener('click', () => {
    sectionSuccess.style.display = 'none';
    sectionAbsen.style.display = 'flex';

    // Reset form & ui
    inputAlasan.value = '';
    document.querySelector('input[name="statusAbsen"][value="Hadir"]').checked = true;
    alasanContainer.style.display = 'none';
    btnRetake.click();
});

// --- Utility: Load Rekap Bulanan ---
let allRekapData = [];
async function loadRekap() {
    const container = document.getElementById('rekapContainer');
    const selectBulan = document.getElementById('bulanRekap');

    container.innerHTML = `<div class="text-center text-slate-400 text-sm py-10 flex flex-col items-center gap-2"><div class="spinner w-6 h-6 border-2 border-white/10 border-t-primary rounded-full"></div>Memuat data...</div>`;

    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getRekap&nisn=${userData.nisn}`);
        const result = await res.json();

        if (result.status === 'success') {
            allRekapData = result.data;
            populateBulanDropdown(allRekapData, selectBulan);
            renderRekap(allRekapData);

            selectBulan.onchange = (e) => {
                if (e.target.value === 'all') {
                    renderRekap(allRekapData);
                } else {
                    const filtered = allRekapData.filter(item => {
                        const parts = item.tanggal.split('/');
                        // Support format MM/DD/YYYY atau DD/MM/YYYY dari Google Sheet (sesuaikan format locale browser)
                        // Biasanya Date local akan ambil angka bulan, mari kita pakai regex atau index
                        const isMonth = parts[0].length > 2 ? false : true;
                        // Simplified approach: just check if month-year matches substring
                        const [, month, year] = parts;
                        return `${month}-${year}` === e.target.value || `${parts[1]}-${parts[2]}` === e.target.value || `${parts[0]}-${parts[2]}` === e.target.value; // very loose matching depending on spreadsheet locale
                    });
                    renderRekap(filtered);
                }
            };
        } else {
            container.innerHTML = `<div class="text-center text-rose-400 py-4">Gagal memuat rekap.</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="text-center text-rose-400 py-4">Error koneksi.</div>`;
    }
}

function populateBulanDropdown(data, selectElement) {
    const uniqueMonths = new Set();
    data.forEach(item => {
        const parts = item.tanggal.split('/');
        if (parts.length === 3) {
            // Assume format id-ID -> DD/MM/YYYY
            uniqueMonths.add(`${parts[1]}-${parts[2]}`);
        }
    });

    let html = '<option value="all">Semua Bulan</option>';
    uniqueMonths.forEach(m => {
        const [month, year] = m.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long' });
        html += `<option value="${m}">${monthName} ${year}</option>`;
    });
    selectElement.innerHTML = html;
}

function renderRekap(data) {
    const container = document.getElementById('rekapContainer');
    if (data.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-10">Belum ada riwayat absen.</div>`;
        return;
    }

    let html = '';
    data.forEach(item => {
        let badgeColor = item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            item.status === 'Izin' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-rose-50 text-rose-700 border-rose-200';
                
        // Ubah URL Google Drive standar (Viewer) menjadi URL Thumbnail agar bisa tampil di tag <img>
        let fotoUrl = item.foto;
        if (fotoUrl && fotoUrl.includes('drive.google.com/file/d/')) {
            const match = fotoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                fotoUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w120`;
            }
        }

        html += `
        <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-3 flex gap-3 items-center">
            ${fotoUrl ? `<img src="${fotoUrl}" class="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQ3NTU2OSIgZD0iTTEyIDJDMiAyIDIgMTIgMiAxMnMyIDEwIDEwIDEwIDEwLTEwIDEwLTEwUzIyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6Ii8+PC9zdmc+'" />` : '<div class="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center"><i class="ph ph-image text-slate-400"></i></div>'}
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-0.5">
                    <span class="text-slate-800 font-semibold text-sm truncate">${item.tanggal}</span>
                    <span class="text-[10px] border px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badgeColor}">${item.status}</span>
                </div>
                <div class="text-slate-500 text-xs font-medium truncate">${item.waktu} ${item.alasan ? '• ' + item.alasan : ''}</div>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
}

// Ekspor PDF (Print)
document.getElementById('btnExportPdf').addEventListener('click', () => {
    window.print();
});

// --- Utility: Toast Notification ---
function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    toast.innerText = message;

    if (type === "error") {
        toast.classList.add("error");
    } else {
        toast.classList.remove("error");
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
