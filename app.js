// URL WEB APP GOOGLE APPS SCRIPT ANDA (GANTI SETELAH DEPLOY)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZYfk70rs-WOOHQeq4RR93VtdzcpvTIk4aMv2rKUgFqGJ6RiOReb2QNnMbNZUp5fkLwg/exec";

// DOM Elements
const sectionLogin = document.getElementById('loginSection');
const sectionAbsen = document.getElementById('absenSection');
const sectionSuccess = document.getElementById('successSection');

const inputNisn = document.getElementById('inputNisn');
const btnLanjut = document.getElementById('btnLanjut');
const userBadge = document.getElementById('userBadge');
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

// --- Flow 1: Login / Masukkan NISN ---
btnLanjut.addEventListener('click', () => {
    const nisn = inputNisn.value.trim();
    if (!nisn) {
        showToast("Mohon masukkan NISN Anda", "error");
        return;
    }

    userData.nisn = nisn;
    displayNisn.innerText = nisn;
    userBadge.style.display = 'flex';

    // Pindah ke halaman absen
    sectionLogin.style.display = 'none';
    sectionAbsen.style.display = 'flex';

    // Mulai GPS dan Kamera
    initCamera();
    getLocation();
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
                locationStatus.innerHTML = `<span style="color:var(--success)">Akurat (${position.coords.accuracy.toFixed(0)}m)</span><br><small>${userData.lat.toFixed(5)}, ${userData.lng.toFixed(5)}</small>`;
            },
            (error) => {
                let msg = "Gagal mengambil lokasi.";
                if (error.code == 1) msg = "Akses GPS ditolak.";
                locationStatus.innerHTML = `<span style="color:#EF4444">${msg}</span>`;
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

    // Tampilkan Loading
    loadingOverlay.style.display = 'flex';

    const payload = {
        nisn: userData.nisn,
        lat: userData.lat,
        lng: userData.lng,
        photoBase64: userData.photoBase64,
        status: "Sesuai" // Di sini nanti bisa tambahkan logika hitung jarak Geofence jika mau
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
    window.location.reload();
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
