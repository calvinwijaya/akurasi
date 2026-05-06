// Daftarkan Plugin Datalabels ChartJS
Chart.register(ChartDataLabels);

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    window.location.href = 'index.html';
} else {
    document.addEventListener("DOMContentLoaded", () => {
        initUserProfile();
        fetchStatusAkreditasi();
        fetchDashboardData(); // Memanggil data untuk grafik & tabel
    });
}

// ==========================================
// INISIALISASI UI & PROFIL
// ==========================================
function initUserProfile() {
    document.getElementById("userNama").textContent = user.nama;
    document.getElementById("sidebarUserNama").textContent = user.nama;
    
    const badgeRole = document.getElementById("sidebarUserRole");
    badgeRole.textContent = user.role;
    badgeRole.className = "badge border border-light fw-normal"; 
    
    switch(user.role) {
        case "Admin": badgeRole.classList.add("bg-danger"); break;
        case "Dosen": badgeRole.classList.add("bg-secondary"); break;
        default: badgeRole.classList.add("bg-dark");
    }

    const userProfilePic = document.getElementById("userProfilePic");
    const nameForAvatar = user.nama.replace(/\s+/g, '+');
    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${nameForAvatar}&background=0d6efd&color=fff&rounded=true&bold=true`;

    if (user.picture) {
        userProfilePic.src = user.picture;
        userProfilePic.onerror = function() { this.onerror = null; this.src = defaultAvatarUrl; };
    } else { userProfilePic.src = defaultAvatarUrl; }
}

// ==========================================
// SCRIPT NAVIGASI & UTILITIES
// ==========================================
const Loading = { show: () => document.getElementById("loadingOverlay")?.classList.remove("d-none"), hide: () => document.getElementById("loadingOverlay")?.classList.add("d-none") };

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) toggleBtn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

    document.getElementById("btnLogout").addEventListener("click", (e) => {
        e.preventDefault();
        Swal.fire({
            title: 'Keluar dari AKURASI?', text: "Sesi Anda akan berakhir.", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#0d6efd', cancelButtonColor: '#dc3545', confirmButtonText: 'Ya, Keluar', reverseButtons: true
        }).then((result) => { if (result.isConfirmed) performLogout(); });
    });

    const params = new URLSearchParams(window.location.search);
    const pageKey = params.get("page");
    if (pageKey) {
        const routes = { 'manajemenkomponen': '01_manajemenkomponen.html', 'simulatoriabee': '02_simulatoriabee.html', 'simulatorlamtek': '03_simulatorlamtek.html', 'simulatorami': '04_simulatorami.html' };
        if (routes[pageKey]) loadPage(routes[pageKey], pageKey);
    }
});

function loadPage(eventOrPage, pagePath, key) {
    let finalPage, finalKey;
    if (typeof eventOrPage === 'object' && eventOrPage !== null) { eventOrPage.preventDefault(); finalPage = pagePath; finalKey = key; } 
    else { finalPage = eventOrPage; finalKey = pagePath; }

    if (!finalPage || !finalKey) return;
    Loading.show();
    fetch(finalPage).then(res => res.text()).then(html => {
        document.getElementById("mainContent").innerHTML = html;
        history.pushState({ page: finalPage, key: finalKey }, "", `${window.location.origin}${window.location.pathname}?page=${finalKey}`);
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`a[onclick*="'${finalKey}'"]`);
        if (activeLink) activeLink.classList.add('active');

        const scripts = { 'manajemenkomponen': 'js/01_manajemenkomponen.js', 'simulatoriabee': 'js/02_simulatoriabee.js', 'simulatorlamtek': 'js/03_simulatorlamtek.js', 'simulatorami': 'js/04_simulatorami.js' };
        if (scripts[finalKey]) loadScript(scripts[finalKey]);
    }).catch(err => {
        document.getElementById("mainContent").innerHTML = "<div class='text-center mt-5'><i class='bi bi-exclamation-circle text-danger fs-1'></i><p>Gagal memuat halaman.</p></div>";
    }).finally(() => Loading.hide());
}

function loadScript(src) {
    const oldScript = document.querySelector(`script[src="${src}"]`);
    if (oldScript) oldScript.remove();
    const script = document.createElement('script');
    script.src = src; script.async = true;
    document.body.appendChild(script);
}

function performLogout() { sessionStorage.clear(); localStorage.clear(); window.location.href = "index.html"; }

// ==========================================
// CARD STATUS AKREDITASI & HITUNG TS
// ==========================================
async function fetchStatusAkreditasi() {
    const container = document.getElementById("akreditasiContainer");
    if (!container) return;
    
    try {
        const response = await fetch(`${GAS_STATUSAKRE}?action=getStatusAkreditasi`);
        const data = await response.json();
        renderAkreditasiCards(data);
    } catch (error) {
        container.innerHTML = `<p class="text-danger text-center">Gagal memuat data akreditasi.</p>`;
    }
}

function parseIndonesianDate(dateString) {
    if (!dateString) return new Date("");
    const parts = dateString.split(/[-/]/); 
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; 
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    return new Date(dateString);
}

function calculateTS(targetDate) {
    if (isNaN(targetDate.getTime())) return null;
    
    // Logika TS: Jika berakhir bulan Agustus (index 7) ke atas, TS berakhir di tahun yg sama.
    // Jika sebelum Agustus, TS berakhir di tahun sebelumnya.
    let endYearTS = targetDate.getMonth() >= 7 ? targetDate.getFullYear() : targetDate.getFullYear() - 1;
    
    return {
        ts: `${endYearTS - 1}/${endYearTS}`,
        ts1: `${endYearTS - 2}/${endYearTS - 1}`,
        ts2: `${endYearTS - 3}/${endYearTS - 2}`
    };
}

function renderAkreditasiCards(data) {
    const container = document.getElementById("akreditasiContainer");
    if (!container) return;
    container.innerHTML = "";

    // Render masing-masing instrumen (tidak lagi di-group per prodi agar sebaris 4 kolom)
    data.forEach((item, index) => {
        let fileId = "";
        const match = item.link_google_drive_sertifikat.match(/[-\w]{25,}/);
        if (match) fileId = match[0];
        let thumbUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` : "assets/logo.png";
        
        const targetDate = parseIndonesianDate(item.tanggal_berakhir);
        const today = new Date();
        
        let countdownText = "Data Tidak Valid";
        let diffDays = 0;

        if (!isNaN(targetDate.getTime())) {
            const diffTime = targetDate - today;
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            countdownText = diffDays > 0 ? `${diffDays} Hari Lagi` : "EXPIRED";
        }

        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = isNaN(targetDate.getTime()) ? "-" : targetDate.toLocaleDateString('id-ID', options);
        
        // Logika warna & judul
        const isInternasional = item.level.toLowerCase().includes('internasional');
        const colorClass = isInternasional ? "text-success" : (item.program_studi === "S1" ? "text-primary" : (item.program_studi === "S2" ? "text-info" : "text-dark"));
        const borderColor = colorClass.replace('text-', 'border-');
        const instrumen = isInternasional ? "IABEE" : "LAMTEK";
        const titleText = `${instrumen} ${item.program_studi}`;

        // Komponen Tombol TS
        const tsData = calculateTS(targetDate);
        let tsHtml = "";
        if (tsData) {
            tsHtml = `
            <button class="btn btn-sm btn-outline-dark mt-2 w-100 fw-bold shadow-sm" type="button" data-bs-toggle="collapse" data-bs-target="#tsCollapse${index}">
                <i class="bi bi-calendar-range me-1"></i> Info TS
            </button>
            <div class="collapse mt-2" id="tsCollapse${index}">
                <div class="card card-body p-2 border-dark bg-light text-start small shadow-sm">
                    <ul class="mb-0 ps-3 fw-bold text-dark" style="list-style-type: square;">
                        <li>TS: ${tsData.ts}</li>
                        <li>TS-1: ${tsData.ts1}</li>
                        <li class="text-danger">TS-2: ${tsData.ts2}</li>
                    </ul>
                </div>
            </div>`;
        }

        const cardHtml = `
            <div class="col-md-6 col-lg-3 mb-4">
                <div class="card shadow h-100 border-0 border-top ${borderColor} border-4">
                    <div class="card-header bg-white border-0 pt-3 pb-1 text-center">
                        <h5 class="fw-bolder ${colorClass} mb-0">${titleText}</h5>
                    </div>
                    <div class="card-body text-center pt-2">
                        <img src="${thumbUrl}" class="img-fluid rounded mb-3 border shadow-sm cursor-pointer" 
                             style="height: 140px; width: 100%; object-fit: cover;" 
                             onclick="showSertifikat('${thumbUrl}', '${item.link_google_drive_sertifikat}', '${titleText} - ${item.status_akreditasi}')"
                             onerror="this.src='assets/logo.png'">
                        <div class="d-flex flex-column align-items-center">
                            <span class="badge ${isInternasional ? 'bg-success' : 'bg-primary'} fs-6 px-3 py-2 shadow-sm mb-2 w-100">
                                ${item.status_akreditasi.toUpperCase()}
                            </span>
                            <p class="text-muted small mb-0 fw-semibold">Berlaku s.d ${formattedDate}</p>
                            <strong class="${diffDays < 365 ? 'text-danger' : 'text-success'} fs-5 mt-1">${countdownText}</strong>
                            ${tsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function showSertifikat(imgUrl, driveUrl, title) {
    document.getElementById("modalSertifikatTitle").innerText = title;
    document.getElementById("modalSertifikatImg").src = imgUrl;
    document.getElementById("modalSertifikatDownload").href = driveUrl;
    new bootstrap.Modal(document.getElementById('modalSertifikat')).show();
}

// ==========================================
// FETCH MASTER DATA & RENDER CHARTS/TABLE
// ==========================================
let simulatedLinkDB = {};
async function fetchDashboardData() {
    try {
        const [resIabee, resS1, resS2, resS3, resLinks] = await Promise.all([
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=IABEE`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=LAMTEK_Sarjana`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=LAMTEK_Magister`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=LAMTEK_Doktor`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getLinkPrioritas`).then(r => r.json())
        ]);

        // Masukkan hasil fetch ke variabel global
        if (resLinks && resLinks.status === "success") {
            simulatedLinkDB = resLinks.data;
        }

        const dashboardExtrasEl = document.getElementById("dashboardExtras");
        if (dashboardExtrasEl) {
            dashboardExtrasEl.classList.remove("d-none");
            renderPieCharts(resS1, resS2, resS3);
            renderPriorityTable(resIabee, resS1, resS2, resS3);
        }
        
    } catch (e) {
        console.error("Gagal memuat data grafik/tabel:", e);
    }
}

// ==========================================
// RENDER PIE CHARTS
// ==========================================
function renderPieCharts(s1, s2, s3) {
    const pieOptions = {
        responsive: true,
        plugins: {
            legend: { display: false }, 
            datalabels: {
                color: '#fff',
                font: { weight: 'bold', size: 14 },
                formatter: (value, ctx) => {
                    let sum = 0;
                    let dataArr = ctx.chart.data.datasets[0].data;
                    dataArr.map(data => { sum += data; });
                    if (sum === 0) return "";
                    let percentage = (value * 100 / sum).toFixed(0) + "%";
                    return percentage + "\n(" + value + ")";
                }
            }
        }
    };

    const colors = ['#0d6efd', '#20c997']; // Kualitatif (Biru), Kuantitatif (Teal)

    // Fungsi baru: Saring data berdasarkan "No" unik sebelum menghitung Tipenya
    const countUniqueData = (arr) => {
        const uniqueMap = new Map();
        
        arr.forEach(item => {
            const no = parseInt(item.No, 10);
            // Masukkan ke Map hanya jika Nomor tersebut belum ada
            if (!isNaN(no) && !uniqueMap.has(no)) {
                uniqueMap.set(no, item.Tipe);
            }
        });

        let kualitatif = 0;
        let kuantitatif = 0;
        
        // Hitung dari data yang sudah unik
        uniqueMap.forEach((tipe) => {
            if (tipe === 'Kualitatif') kualitatif++;
            else if (tipe === 'Kuantitatif') kuantitatif++;
        });

        return [kualitatif, kuantitatif];
    };

    const dS1 = countUniqueData(s1);
    const dS2 = countUniqueData(s2);
    const dS3 = countUniqueData(s3);

    const getMaxNo = (arr) => {
        const nos = arr.map(item => parseInt(item.No, 10)).filter(n => !isNaN(n));
        return nos.length > 0 ? Math.max(...nos) : 0;
    };

    // Tulis Total Indikator berdasarkan nilai maksimum kolom No
    document.getElementById('totalS1').innerText = `Total Indikator: ${getMaxNo(s1)}`;
    document.getElementById('totalS2').innerText = `Total Indikator: ${getMaxNo(s2)}`;
    document.getElementById('totalS3').innerText = `Total Indikator: ${getMaxNo(s3)}`;

    new Chart(document.getElementById('chartS1'), { type: 'pie', data: { labels: ['Kualitatif', 'Kuantitatif'], datasets: [{ data: dS1, backgroundColor: colors }] }, options: pieOptions });
    new Chart(document.getElementById('chartS2'), { type: 'pie', data: { labels: ['Kualitatif', 'Kuantitatif'], datasets: [{ data: dS2, backgroundColor: colors }] }, options: pieOptions });
    new Chart(document.getElementById('chartS3'), { type: 'pie', data: { labels: ['Kualitatif', 'Kuantitatif'], datasets: [{ data: dS3, backgroundColor: colors }] }, options: pieOptions });
}

// ==========================================
// TABEL PRIORITAS (DENGAN FILTER, PAGINATION, & LINK)
// ==========================================
let globalPriorityData = [];
let currentPriorityPage = 1;
const priorityPerPage = 5;

function renderPriorityTable(iabee, s1, s2, s3) {
    globalPriorityData = [];

    // Kumpulkan IABEE (Tinggi)
    // Mengambil Referensi dari kolom G: Referensi_Tabel_Suplemen
    iabee.filter(x => x.Bobot_Perhatian === 'Tinggi').forEach(item => {
        globalPriorityData.push({ 
            id_komponen: item.ID_Kriteria, 
            instrumen: 'IABEE', 
            badge: 'bg-success', 
            search: `${item.Sub_Kriteria} ${item.Kriteria_Evaluasi}`.toLowerCase(), 
            title: `[${item.ID_Kriteria}] ${item.Sub_Kriteria}`, 
            desc: item.Kriteria_Evaluasi,
            referensi: item.Referensi_Tabel_Suplemen || "" // <== Tambahan Referensi
        });
    });

    // Kumpulkan LAMTEK (Prioritas 'Ya')
    // Mengambil Referensi dari kolom J: No_Tabel_LKPS
    const processLamtek = (data, badgeClass, title) => {
        data.filter(x => x.Prioritas === 'Ya').forEach(item => {
            globalPriorityData.push({ 
                id_komponen: item.ID_Indikator, 
                instrumen: title, 
                badge: badgeClass, 
                search: `${item.Kriteria} ${item.Indikator}`.toLowerCase(), 
                title: `[${item.ID_Indikator}] ${item.Kriteria}`, 
                desc: item.Indikator,
                referensi: item.No_Tabel_LKPS || "" // <== Tambahan Referensi
            });
        });
    };

    processLamtek(s1, "bg-primary", "LAMTEK S1");
    processLamtek(s2, "bg-info text-dark", "LAMTEK S2");
    processLamtek(s3, "bg-dark", "LAMTEK S3");

    document.getElementById('filterPriorityInstrumen').addEventListener('change', () => { currentPriorityPage = 1; updatePriorityView(); });
    document.getElementById('searchPriority').addEventListener('input', () => { currentPriorityPage = 1; updatePriorityView(); });

    updatePriorityView();
}

function updatePriorityView() {
    const filterInst = document.getElementById('filterPriorityInstrumen').value;
    const search = document.getElementById('searchPriority').value.toLowerCase();

    // 1. Saring Data
    let filtered = globalPriorityData.filter(item => {
        if (filterInst !== 'Semua' && item.instrumen !== filterInst) return false;
        if (search && !item.search.includes(search)) return false;
        return true;
    });

    // 2. Hitung Paginasi
    const totalPages = Math.ceil(filtered.length / priorityPerPage) || 1;
    if (currentPriorityPage > totalPages) currentPriorityPage = totalPages;

    const startIdx = (currentPriorityPage - 1) * priorityPerPage;
    const paginated = filtered.slice(startIdx, startIdx + priorityPerPage);

    // 3. Render HTML Tabel
    const tbody = document.getElementById("tbodyPriorityTable");
    const isAdmin = user.role === "Admin"; // Cek Role
    let html = "";
    
    paginated.forEach(item => {
        const existingUrl = simulatedLinkDB[item.id_komponen] || "";
        
        // Render Tombol Data Bukti
        let btnBukaHtml = "";
        if (existingUrl) {
            btnBukaHtml = `<a href="${existingUrl}" target="_blank" class="btn btn-sm btn-success shadow-sm mb-1 fw-bold w-100"><i class="bi bi-box-arrow-up-right me-1"></i>Buka Data</a>`;
        } else {
            btnBukaHtml = `<span class="badge bg-secondary mb-1 w-100 py-2">Belum Tersedia</span>`;
        }

        // Render Tombol Set Link (Khusus Admin)
        let btnAdminHtml = "";
        if (isAdmin) {
            btnAdminHtml = `<button class="btn btn-sm btn-outline-primary mt-1 w-100" onclick="openModalLinkPrioritas('${item.id_komponen}', '${existingUrl}')"><i class="bi bi-pencil-square me-1"></i>Set Link</button>`;
        }

        // =====================================
        // LOGIKA RENDER KOLOM REFERENSI (BARU)
        // =====================================
        let refHtml = '<span class="text-muted small fst-italic">-</span>';
        if (item.referensi) {
            let refs = item.referensi.toString().split(',');
            refHtml = `<div class="d-flex flex-column gap-1 align-items-center">` + 
                      refs.map(r => {
                          let text = r.trim();
                          let label = text;
                          let url = "#";
                          
                          if (text.includes('|')) {
                              let parts = text.split('|');
                              label = parts[0].trim();
                              url = parts[1].trim();
                          } else if (text.toLowerCase().startsWith("http")) {
                              label = "Buka Referensi";
                              url = text;
                          }

                          if (url !== "#") {
                              return `<a href="${url}" target="_blank" class="badge bg-secondary text-wrap text-decoration-none shadow-sm" style="line-height: 1.4;" title="Buka Spreadsheet"><i class="bi bi-file-earmark-spreadsheet me-1"></i>${label}</a>`;
                          } else {
                              return `<span class="badge bg-secondary text-wrap shadow-sm" style="line-height: 1.4;">${label}</span>`;
                          }
                      }).join('') + 
                      `</div>`;
        }

        // Tambahkan kolom refHtml ke dalam baris tabel
        html += `<tr>
            <td class="text-center align-middle"><span class="badge ${item.badge} w-100 shadow-sm py-2">${item.instrumen}</span></td>
            <td><strong class="d-block text-dark">${item.title}</strong><span class="text-muted small">${item.desc}</span></td>
            <td class="align-middle text-center">${refHtml}</td>
            <td class="align-middle">
                <div class="d-flex flex-column align-items-center">
                    ${btnBukaHtml}
                    ${btnAdminHtml}
                </div>
            </td>
        </tr>`;
    });
    
    // Perhatikan colspan diubah dari 3 menjadi 4
    if (html === "") html = `<tr><td colspan="4" class="text-center text-muted py-4">Tidak ada data ditemukan.</td></tr>`;
    tbody.innerHTML = html;

    // 4. Render HTML Navigasi Paginasi
    const pagUl = document.getElementById("priorityPagination");
    let pagHtml = "";
    
    pagHtml += `<li class="page-item ${currentPriorityPage === 1 ? 'disabled' : ''}">
                    <a class="page-link shadow-sm" href="#" onclick="changePriorityPage(${currentPriorityPage - 1}, event)">&laquo;</a>
                </li>`;
    
    for (let i = 1; i <= totalPages; i++) {
        pagHtml += `<li class="page-item ${currentPriorityPage === i ? 'active' : ''}">
                        <a class="page-link shadow-sm" href="#" onclick="changePriorityPage(${i}, event)">${i}</a>
                    </li>`;
    }

    pagHtml += `<li class="page-item ${currentPriorityPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link shadow-sm" href="#" onclick="changePriorityPage(${currentPriorityPage + 1}, event)">&raquo;</a>
                </li>`;
    
    pagUl.innerHTML = pagHtml;
}

function changePriorityPage(page, e) {
    e.preventDefault();
    currentPriorityPage = page;
    updatePriorityView();
}

// ==========================================
// KELOLA LINK PRIORITAS (HANYA ADMIN)
// ==========================================
window.openModalLinkPrioritas = function(idKomponen, currentUrl) {
    document.getElementById("displayIdKomponen").innerText = idKomponen;
    document.getElementById("inputIdKomponen").value = idKomponen;
    document.getElementById("inputUrlData").value = currentUrl || "";
    
    new bootstrap.Modal(document.getElementById('modalLinkPrioritas')).show();
};

window.saveLinkPrioritas = async function() {
    const idKomponen = document.getElementById("inputIdKomponen").value;
    const urlBaru = document.getElementById("inputUrlData").value.trim();
    const currentUser = JSON.parse(sessionStorage.getItem("user")) || { email: "admin" };

    Swal.fire({ title: 'Menyimpan Tautan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const payload = {
            action: "saveLinkPrioritas",
            idKomponen: idKomponen,
            urlData: urlBaru,
            emailUser: currentUser.email
        };

        const response = await fetch(GAS_AKURASI, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.status === "success") {
            if (urlBaru === "") {
                delete simulatedLinkDB[idKomponen];
            } else {
                simulatedLinkDB[idKomponen] = urlBaru;
            }
            
            bootstrap.Modal.getInstance(document.getElementById('modalLinkPrioritas')).hide();
            updatePriorityView();
            
            Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Tautan data bukti berhasil diperbarui.', timer: 1500, showConfirmButton: false });
        } else {
            throw new Error("Respon server gagal.");
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: 'Terjadi kesalahan saat menghubungi server.' });
    }
};