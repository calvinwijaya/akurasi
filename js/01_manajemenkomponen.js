// ==============================================================
// GLOBAL STATE & DATA
// ==============================================================
var isAdmin = false;
var masterData = {
    IABEE: [],
    S1: [],
    S2: [],
    S3: []
};
var mappingState = []; // [{ id_grup: 1, topik: "...", S2: [...ids], S3: [...ids], S1: [...ids], IABEE: [...ids] }]

// ==============================================================
// INISIALISASI
// ==============================================================
setTimeout(() => {
    checkAdminRole();
    initMappingEvents();
    loadAllMasterData();
}, 50);

function checkAdminRole() {
    const user = JSON.parse(sessionStorage.getItem("user"));
    // Cek Role (Sesuaikan dengan struktur session login Anda)
    if (user && user.role === "Admin") {
        isAdmin = true;
        // Munculkan semua tombol admin
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('d-none'));
    }
}

function initMappingEvents() {
    document.getElementById("btnBuatGrup").addEventListener("click", () => {
        document.getElementById("inputTopikGrup").value = "";
        new bootstrap.Modal(document.getElementById("modalBuatGrup")).show();
    });

    document.getElementById("btnSimpanGrupBaru").addEventListener("click", () => {
        const topik = document.getElementById("inputTopikGrup").value.trim();
        if(!topik) return Swal.fire('Kosong', 'Topik harus diisi!', 'warning');
        
        mappingState.push({
            id_grup: "grup_" + Date.now(), // PERBAIKAN: Memaksa ID menjadi tipe String
            topik: topik,
            S2: [], S3: [], S1: [], IABEE: []
        });
        
        renderMappingBoard();
        bootstrap.Modal.getInstance(document.getElementById("modalBuatGrup")).hide();
    });

    // Event Filter Utama (Search & Dropdowns)
    ['filterPrioritas', 'filterUnggul', 'filterTipe'].forEach(id => {
        document.getElementById(id).addEventListener("change", applyFiltersVisual);
    });
    document.getElementById("filterSearch").addEventListener("input", applyFiltersVisual);
    
    document.getElementById("btnResetFilter").addEventListener("click", () => {
        document.getElementById("filterPrioritas").value = "Semua";
        document.getElementById("filterUnggul").value = "Semua";
        document.getElementById("filterTipe").value = "Semua";
        document.getElementById("filterSearch").value = "";
        applyFiltersVisual();
    });

    document.getElementById("btnSimpanRelasi").addEventListener("click", saveMappingToGAS);
    document.getElementById("btnSimpanPrioritas").addEventListener("click", simpanPrioritasKeGAS);
}

// ==============================================================
// MEMUAT DATA PARALEL (4 SHEET MASTER + 1 SHEET MAPPING)
// ==============================================================
async function loadAllMasterData() {
    Loading.show();
    try {
        // Ambil data secara bersamaan agar cepat
        const [resIABEE, resS1, resS2, resS3, resMapping] = await Promise.all([
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=IABEE`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=LAMTEK_Sarjana`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=LAMTEK_Magister`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=LAMTEK_Doktor`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=IABEExLAMTEK`).then(r => r.json())
        ]);

        masterData.IABEE = resIABEE;
        masterData.S1 = resS1;
        masterData.S2 = resS2;
        masterData.S3 = resS3;

        // Parse Sheet IABEExLAMTEK menjadi State Array
        mappingState = [];
        resMapping.forEach((row, index) => {
            if(!row.Topik_Universal) return;
            
            // Konversi teks CSV dari cell menjadi array. Jika kosong, array kosong.
            const parseCell = (str) => str ? str.toString().split(',').map(s => s.trim()).filter(s => s) : [];

            mappingState.push({
                id_grup: `grup_${index}_${Date.now()}`,
                topik: row.Topik_Universal,
                IABEE: parseCell(row.ID_IABEE),
                S1: parseCell(row.ID_LAMTEK_S1),
                S2: parseCell(row.ID_LAMTEK_S2),
                S3: parseCell(row.ID_LAMTEK_S3),
                tipe: row.Tipe_Dukungan || "Kuantitatif",
                ket: row.Keterangan_Mapping || ""
            });
        });

        renderMappingBoard();
    } catch (e) {
        Swal.fire('Error', 'Gagal memuat matriks data.', 'error');
    } finally {
        Loading.hide();
    }
}

// ==============================================================
// RENDER KANBAN / SWIMLANES (MATRIKS RELASI)
// ==============================================================
function renderMappingBoard() {
    const board = document.getElementById("mappingBoardArea");
    board.innerHTML = "";

    if (mappingState.length === 0) {
        board.innerHTML = `<div class="alert alert-info text-center">Belum ada grup pemetaan. Silakan buat grup baru.</div>`;
        return;
    }

    mappingState.forEach((grup, gIndex) => {
        // UI Swimlane Card
        let html = `
        <div class="card border-0 shadow-sm mapping-grup">
            <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2">
                <h5 class="mb-0 fw-bold"><i class="bi bi-bookmarks me-2"></i>${grup.topik}</h5>
                ${isAdmin ? `<button class="btn btn-sm btn-danger px-2" onclick="hapusGrup(${gIndex})" title="Hapus Grup"><i class="bi bi-trash"></i></button>` : ''}
            </div>
            <div class="card-body p-2 bg-light">
                <div class="row g-2">
                    ${renderKolom('S2', 'LAMTEK Magister (Master)', grup, gIndex, 'primary')}
                    ${renderKolom('S3', 'LAMTEK Doktor', grup, gIndex, 'primary')}
                    ${renderKolom('S1', 'LAMTEK Sarjana', grup, gIndex, 'primary')}
                    ${renderKolom('IABEE', 'IABEE Sarjana', grup, gIndex, 'success')}
                </div>
            </div>
        </div>`;
        board.innerHTML += html;
    });

    applyFiltersVisual(); // Terapkan filter ke item yang baru dirender
}

function renderKolom(idKolom, judulKolom, grupData, gIndex, colorTheme) {
    let cardsHtml = '';
    const itemIds = grupData[idKolom]; 

    itemIds.forEach((itemId, iIndex) => {
        const dataDetail = masterData[idKolom].find(d => 
            (idKolom === 'IABEE' ? d.ID_Kriteria : d.ID_Indikator) === itemId
        );
        
        if (!dataDetail) return;

        let titleText = idKolom === 'IABEE' ? dataDetail.Kriteria : dataDetail.Indikator;
        let badgeRef = idKolom === 'IABEE' ? dataDetail.Referensi_Tabel_Suplemen : dataDetail.No_Tabel_LKPS;
        
        // Ambil data untuk keperluan filter
        let prioritas = dataDetail.Prioritas || dataDetail.Bobot_Perhatian || "Sedang"; 
        let unggul = dataDetail.Syarat_Unggul || "Tidak";
        let tipe = dataDetail.Tipe || "Kualitatif";

        cardsHtml += `
        <div class="card border border-${colorTheme} border-start border-4 mb-2 item-card shadow-sm" 
             style="cursor: pointer;"
             onclick="bukaDetailKomponen('${idKolom}', '${itemId}')"
             data-search="${titleText.toLowerCase()} ${itemId.toLowerCase()}"
             data-prioritas="${prioritas}"
             data-unggul="${unggul}"
             data-tipe="${tipe}">
            <div class="card-body p-2 position-relative">
                ${isAdmin ? `<button class="btn btn-sm text-danger position-absolute top-0 end-0 p-1" onclick="event.stopPropagation(); hapusItemGrup(${gIndex}, '${idKolom}', ${iIndex})" style="z-index: 10;"><i class="bi bi-x-circle-fill"></i></button>` : ''}
                <div class="fw-bold small text-truncate pe-3" style="max-width: 90%;" title="${titleText}">${titleText}</div>
                <div class="d-flex justify-content-between align-items-end mt-1">
                    <span class="badge bg-secondary" style="font-size: 0.65rem;">${itemId}</span>
                    <span class="badge border border-dark text-dark" style="font-size: 0.65rem;">${badgeRef || '-'}</span>
                </div>
            </div>
        </div>`;
    });

    const addBtn = isAdmin ? `<button class="btn btn-sm btn-outline-${colorTheme} w-100 fw-bold mt-1" onclick="bukaModalTambah('${grupData.id_grup}', '${idKolom}')"><i class="bi bi-plus-lg"></i> Tambah</button>` : '';

    return `
    <div class="col-md-3">
        <div class="p-2 bg-white border rounded h-100">
            <h6 class="fw-bold text-center text-${colorTheme} border-bottom pb-2 mb-2" style="font-size: 0.85rem;">${judulKolom}</h6>
            <div class="item-container" style="min-height: 50px;">
                ${cardsHtml}
            </div>
            ${addBtn}
        </div>
    </div>`;
}

// ==============================================================
// FILTER VISUAL
// ==============================================================
function applyFiltersVisual() {
    const fPrioritas = document.getElementById("filterPrioritas").value;
    const fUnggul = document.getElementById("filterUnggul").value;
    const fTipe = document.getElementById("filterTipe").value;
    const fSearch = document.getElementById("filterSearch").value.toLowerCase();

    document.querySelectorAll('.item-card').forEach(card => {
        let pass = true;
        const cPrio = card.getAttribute('data-prioritas');
        const cUnggul = card.getAttribute('data-unggul');
        const cTipe = card.getAttribute('data-tipe');
        const cSearch = card.getAttribute('data-search');

        if (fPrioritas !== "Semua" && !cPrio.includes(fPrioritas) && cPrio !== (fPrioritas === "Tinggi" ? "Ya" : "Tidak")) pass = false;
        if (fUnggul !== "Semua" && cUnggul !== fUnggul) pass = false;
        if (fTipe !== "Semua" && cTipe !== fTipe) pass = false;
        if (fSearch && !cSearch.includes(fSearch)) pass = false;

        card.style.display = pass ? "block" : "none";
    });
}

// ==============================================================
// MODAL CASCADING DROPDOWN & TAMBAH ITEM
// ==============================================================
function bukaModalTambah(grupId, idKolom) {
    document.getElementById("targetGrupId").value = grupId;
    document.getElementById("targetKolomId").value = idKolom;

    // PERBAIKAN: Pastikan keduanya dibaca sebagai String saat proses pencarian (find)
    const grup = mappingState.find(g => String(g.id_grup) === String(grupId));
    document.getElementById("displayTargetGrup").value = grup.topik;

    const namaKolom = idKolom === 'IABEE' ? 'IABEE Sarjana' : (idKolom === 'S1' ? 'LAMTEK Sarjana' : (idKolom === 'S2' ? 'LAMTEK Magister' : 'LAMTEK Doktor'));
    document.getElementById("displayTargetKolom").value = namaKolom;

    renderCascadingFilters(idKolom);
    new bootstrap.Modal(document.getElementById("modalTambahItem")).show();
}

function renderCascadingFilters(idKolom) {
    const area = document.getElementById("cascadingFiltersArea");
    
    if (idKolom === 'IABEE') {
        area.innerHTML = `
            <div class="mb-3">
                <label class="form-label small fw-bold">1. Pilih Kriteria IABEE</label>
                <select class="form-select" id="cbIabeeKriteria" onchange="updateCbIabeeSub()"><option value="">-- Pilih --</option></select>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-bold">2. Pilih Sub-Kriteria</label>
                <select class="form-select" id="cbIabeeSub" onchange="updateCbIabeeItem()"><option value="">-- Pilih Kriteria Dulu --</option></select>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-bold text-success">3. Pilih Item Evaluasi (Final)</label>
                <select class="form-select border-success fw-bold" id="cbIabeeFinal"><option value="">-- Pilih Sub-Kriteria Dulu --</option></select>
            </div>
        `;
        const kriteriaSet = [...new Set(masterData.IABEE.map(item => item.Kriteria))];
        const cb = document.getElementById("cbIabeeKriteria");
        kriteriaSet.forEach(k => {
            let displayText = k.length > 90 ? k.substring(0, 90) + '...' : k;
            cb.innerHTML += `<option value="${k}">${displayText}</option>`;
        });

    } else {
        area.innerHTML = `
            <div class="mb-3">
                <label class="form-label small fw-bold">1. Pilih Kelompok Penilaian</label>
                <select class="form-select" id="cbLamtekKelompok" onchange="updateCbLamtekKriteria('${idKolom}')"><option value="">-- Pilih --</option></select>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-bold">2. Pilih Kriteria</label>
                <select class="form-select" id="cbLamtekKriteria" onchange="updateCbLamtekIndikator('${idKolom}')"><option value="">-- Pilih Kelompok Dulu --</option></select>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-bold text-primary">3. Pilih Indikator (Final)</label>
                <select class="form-select border-primary fw-bold" id="cbLamtekFinal"><option value="">-- Pilih Kriteria Dulu --</option></select>
            </div>
        `;
        const kelompokSet = [...new Set(masterData[idKolom].map(item => item.Kelompok))];
        const cb = document.getElementById("cbLamtekKelompok");
        kelompokSet.forEach(k => cb.innerHTML += `<option value="${k}">${k}</option>`);
    }
}

// -- Cascading Logic IABEE --
function updateCbIabeeSub() {
    const kriteria = document.getElementById("cbIabeeKriteria").value;
    const cbSub = document.getElementById("cbIabeeSub");
    cbSub.innerHTML = '<option value="">-- Pilih --</option>';
    document.getElementById("cbIabeeFinal").innerHTML = '<option value="">-- Pilih Sub-Kriteria Dulu --</option>';
    
    if(!kriteria) return;
    const subSet = [...new Set(masterData.IABEE.filter(i => i.Kriteria === kriteria).map(i => i.Sub_Kriteria))];
    
    // Potong teks jika lebih dari 90 karakter agar tidak melebar
    subSet.forEach(s => {
        let displayText = s;
        if (s.length > 90) {
            displayText = s.substring(0, 90) + '...';
        }
        cbSub.innerHTML += `<option value="${s}">${displayText}</option>`;
    });
}

function updateCbIabeeItem() {
    const sub = document.getElementById("cbIabeeSub").value;
    const cbFinal = document.getElementById("cbIabeeFinal");
    cbFinal.innerHTML = '<option value="">-- Pilih --</option>';
    
    if(!sub) return;
    const items = masterData.IABEE.filter(i => i.Sub_Kriteria === sub);
    items.forEach(i => cbFinal.innerHTML += `<option value="${i.ID_Kriteria}">[${i.ID_Kriteria}] ${i.Kriteria_Evaluasi.substring(0,80)}...</option>`);
}

// -- Cascading Logic LAMTEK --
function updateCbLamtekKriteria(idKolom) {
    const kelompok = document.getElementById("cbLamtekKelompok").value;
    const cbKriteria = document.getElementById("cbLamtekKriteria");
    cbKriteria.innerHTML = '<option value="">-- Pilih --</option>';
    document.getElementById("cbLamtekFinal").innerHTML = '<option value="">-- Pilih Kriteria Dulu --</option>';
    
    if(!kelompok) return;
    const kritSet = [...new Set(masterData[idKolom].filter(i => i.Kelompok === kelompok).map(i => i.Kriteria))];
    kritSet.forEach(k => cbKriteria.innerHTML += `<option value="${k}">${k}</option>`);
}

function updateCbLamtekIndikator(idKolom) {
    const kriteria = document.getElementById("cbLamtekKriteria").value;
    const cbFinal = document.getElementById("cbLamtekFinal");
    cbFinal.innerHTML = '<option value="">-- Pilih --</option>';
    
    if(!kriteria) return;
    const items = masterData[idKolom].filter(i => i.Kriteria === kriteria);
    items.forEach(i => cbFinal.innerHTML += `<option value="${i.ID_Indikator}">[${i.ID_Indikator}] ${i.Indikator.substring(0,80)}...</option>`);
}

// -- Eksekusi Tombol Tambah --
document.getElementById("btnPilihItem").addEventListener("click", () => {
    const idKolom = document.getElementById("targetKolomId").value;
    const grupId = document.getElementById("targetGrupId").value;
    
    const selectedId = idKolom === 'IABEE' ? document.getElementById("cbIabeeFinal").value : document.getElementById("cbLamtekFinal").value;

    if (!selectedId) {
        return Swal.fire('Pilih Item', 'Anda harus memilih item final di dropdown ke-3!', 'warning');
    }

    const grupIndex = mappingState.findIndex(g => g.id_grup === grupId);
    if (!mappingState[grupIndex][idKolom].includes(selectedId)) {
        mappingState[grupIndex][idKolom].push(selectedId);
        renderMappingBoard();
        bootstrap.Modal.getInstance(document.getElementById("modalTambahItem")).hide();
    } else {
        Swal.fire('Sudah Ada', 'Item ini sudah ada di dalam grup tersebut.', 'info');
    }
});

// ==============================================================
// AKSI HAPUS ITEM / GRUP
// ==============================================================
function hapusItemGrup(grupIndex, idKolom, itemIndex) {
    mappingState[grupIndex][idKolom].splice(itemIndex, 1);
    renderMappingBoard();
}

function hapusGrup(grupIndex) {
    Swal.fire({
        title: 'Hapus Grup Permanen?', 
        text: "Grup pemetaan beserta seluruh relasinya akan dihapus dari layar dan database Master secara permanen.", 
        icon: 'warning',
        showCancelButton: true, 
        confirmButtonText: 'Ya, Hapus', 
        confirmButtonColor: '#dc3545'
    }).then((result) => {
        if (result.isConfirmed) {
            mappingState.splice(grupIndex, 1);
            renderMappingBoard();
            saveMappingToGAS(); 
        }
    });
}

// ==============================================================
// SIMPAN KE GOOGLE APPS SCRIPT
// ==============================================================
async function saveMappingToGAS() {
    Swal.fire({
        title: 'Menyimpan Matriks...',
        text: 'Mohon tunggu, ini akan menimpa data relasi lama di database master.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const payload = {
            action: "saveMapping", // Flag baru untuk dibaca oleh GAS
            data: mappingState
        };

        const response = await fetch(GAS_AKURASI, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        
        if (res.status === "success") {
            Swal.fire('Tersimpan!', 'Matriks relasi universal berhasil diperbarui.', 'success');
        } else {
            throw new Error(res.message);
        }
    } catch (e) {
        Swal.fire('Gagal Menyimpan', 'Terjadi kesalahan: ' + e.message, 'error');
    }
}

// ==============================================================
// DETAIL KOMPONEN & EDIT PRIORITAS (CMS)
// ==============================================================
function bukaDetailKomponen(idKolom, itemId) {
    const dataDetail = masterData[idKolom].find(d => (idKolom === 'IABEE' ? d.ID_Kriteria : d.ID_Indikator) === itemId);
    if (!dataDetail) return;

    document.getElementById("detailIdKolom").value = idKolom;
    document.getElementById("detailItemId").value = itemId;

    let html = '';
    let prioritasAktif = dataDetail.Prioritas || dataDetail.Bobot_Perhatian || (idKolom === 'IABEE' ? "Sedang" : "Tidak");

    if (idKolom === 'IABEE') {
        html = `
            <div class="mb-2"><strong class="text-success">Kriteria:</strong><br>${dataDetail.Kriteria}</div>
            <div class="mb-2"><strong class="text-success">Sub-Kriteria:</strong><br>${dataDetail.Sub_Kriteria}</div>
            <div class="mb-2"><strong class="text-success">Sub-Sub-Kriteria:</strong><br>${dataDetail.Sub_Sub_Kriteria || '-'}</div>
            <div class="mb-2"><strong class="text-success">Kriteria Evaluasi:</strong><br><div class="p-2 bg-light border rounded small">${dataDetail.Kriteria_Evaluasi}</div></div>
            <div class="mb-3"><strong class="text-success">Referensi Tabel:</strong> <span class="badge bg-dark">${dataDetail.Referensi_Tabel_Suplemen || '-'}</span></div>
        `;
    } else {
        const formattedDesc = dataDetail.Deskripsi_Skor_4 ? dataDetail.Deskripsi_Skor_4.replace(/\n/g, '<br>') : "-";
        html = `
            <div class="mb-2"><strong class="text-primary">Kriteria:</strong><br>${dataDetail.Kriteria}</div>
            <div class="mb-2"><strong class="text-primary">Indikator (${dataDetail.Simbol || '-'}):</strong><br>${dataDetail.Indikator}</div>
            <div class="mb-2"><strong class="text-primary">Kondisi Skor 4:</strong><br><div class="p-2 bg-light border rounded small">${formattedDesc}</div></div>
            <div class="mb-3"><strong class="text-primary">Referensi Tabel LKPS:</strong> <span class="badge bg-dark">${dataDetail.No_Tabel_LKPS || '-'}</span></div>
        `;
    }

    // Jika Admin, tampilkan form edit Prioritas
    if (isAdmin) {
        html += `<hr><div class="mb-2">
                    <label class="form-label fw-bold text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i> Edit Prioritas / Bobot Perhatian (Master Data)</label>
                    <select class="form-select border-danger" id="editPrioritas">
                        ${idKolom === 'IABEE' 
                            ? `<option value="Tinggi" ${prioritasAktif==="Tinggi"?"selected":""}>Tinggi</option>
                               <option value="Sedang" ${prioritasAktif==="Sedang"?"selected":""}>Sedang</option>
                               <option value="Rendah" ${prioritasAktif==="Rendah"?"selected":""}>Rendah</option>` 
                            : `<option value="Ya" ${prioritasAktif==="Ya"?"selected":""}>Ya (Prioritas)</option>
                               <option value="Tidak" ${prioritasAktif==="Tidak"?"selected":""}>Tidak</option>`
                        }
                    </select>
                    <small class="text-muted fst-italic">Perubahan ini akan langsung disimpan ke Spreadsheet Master.</small>
                 </div>`;
    } else {
        html += `<hr><div class="mb-2"><strong class="text-secondary">Status Prioritas:</strong> <span class="badge bg-danger">${prioritasAktif}</span></div>`;
    }

    document.getElementById("detailKomponenBody").innerHTML = html;
    new bootstrap.Modal(document.getElementById("modalDetailKomponen")).show();
}

async function simpanPrioritasKeGAS() {
    const idKolom = document.getElementById("detailIdKolom").value;
    const itemId = document.getElementById("detailItemId").value;
    const prioritasBaru = document.getElementById("editPrioritas").value;

    Swal.fire({
        title: 'Menyimpan ke Master...',
        text: 'Sedang memperbarui prioritas di database...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const payload = {
            action: "updatePriority",
            idKolom: idKolom,
            itemId: itemId,
            prioritas: prioritasBaru
        };

        const response = await fetch(GAS_AKURASI, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        
        if (res.status === "success") {
            // Update State Data Lokal (tanpa perlu fetch ulang)
            const dataDetail = masterData[idKolom].find(d => (idKolom === 'IABEE' ? d.ID_Kriteria : d.ID_Indikator) === itemId);
            if (idKolom === 'IABEE') dataDetail.Bobot_Perhatian = prioritasBaru;
            else dataDetail.Prioritas = prioritasBaru;

            renderMappingBoard(); // Render ulang agar badge/filter visual terupdate
            bootstrap.Modal.getInstance(document.getElementById("modalDetailKomponen")).hide();
            Swal.fire('Berhasil!', 'Prioritas telah diperbarui di Spreadsheet Master.', 'success');
        } else throw new Error(res.message);
    } catch (e) {
        Swal.fire('Gagal Menyimpan', e.message, 'error');
    }
}