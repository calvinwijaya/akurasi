// ==============================================================
// KONFIGURASI & STATE
// ==============================================================
let rawMasterData = [];      // Data asli dari GAS
let groupedData = [];        // Data yang sudah dikelompokkan berdasar Kriteria
let simulationState = {};    // State menyimpan input user: { ID_Indikator: { nilai: 0, link: "", vars: {} } }
let currentModalId = null;   // Menyimpan ID indikator yang sedang dibuka di modal
let isSortedByBobotDesc = false;

initEvents();
loadMasterData("LAMTEK_Sarjana");

// ==============================================================
// INISIALISASI EVENT LISTENER
// ==============================================================
function initEvents() {
    
    // --- 1. FILTER & NAVIGASI ---
    
    // Event Tombol Radio Jenjang Program (S1, S2, S3)
    document.querySelectorAll('input[name="btnjenjang"]').forEach(radio => {
        radio.addEventListener('change', (e) => loadMasterData(e.target.value));
    });

    // Event Filter Dropdown
    ['filterUnggul', 'filterPrioritas', 'filterTipe', 'filterKelompok'].forEach(id => {
        document.getElementById(id).addEventListener("change", renderTable);
    });

    // Event Live Search
    document.getElementById("filterSearch").addEventListener("input", renderTable);

    // Event Tombol Sortir Bobot
    document.getElementById("btnSortBobot").addEventListener("click", function() {
        isSortedByBobotDesc = !isSortedByBobotDesc; // Balikkan status
        
        if (isSortedByBobotDesc) {
            this.classList.replace("btn-outline-primary", "btn-primary");
            this.innerHTML = '<i class="bi bi-sort-numeric-up"></i> Asli';
            this.title = "Kembalikan ke Urutan Asli";
        } else {
            this.classList.replace("btn-primary", "btn-outline-primary");
            this.innerHTML = '<i class="bi bi-sort-numeric-down-alt"></i> Bobot';
            this.title = "Urutkan Bobot Terbesar";
        }
        renderTable(); // Gambar ulang tabel
    });

    // Event Tombol Reset Filter
    document.getElementById("btnResetFilter").addEventListener("click", () => {
        document.getElementById("filterUnggul").value = "Semua";
        document.getElementById("filterPrioritas").value = "Semua";
        document.getElementById("filterTipe").value = "Semua";
        document.getElementById("filterKelompok").value = "Semua";
        document.getElementById("filterSearch").value = "";

        // Reset juga status sortir bobot jika sedang aktif
        isSortedByBobotDesc = false;
        const btnSort = document.getElementById("btnSortBobot");
        btnSort.classList.replace("btn-primary", "btn-outline-primary");
        btnSort.innerHTML = '<i class="bi bi-sort-numeric-down-alt"></i> Bobot';
        
        renderTable();
    });


    // --- 2. VARIABEL GLOBAL (NDTPS, NM, SLIDER KUALITATIF) ---

    document.getElementById("globalNDTPS").addEventListener("input", () => {
        recalculateAllQuantitative();
        updateTableUI();
    });

    document.getElementById("globalNM").addEventListener("input", () => {
        recalculateAllQuantitative();
        updateTableUI();
    });

    const sliderQual = document.getElementById("sliderGlobalKualitatif");
    const valQual = document.getElementById("valGlobalKualitatif");
    sliderQual.addEventListener("input", (e) => valQual.innerText = parseFloat(e.target.value).toFixed(1));
    document.getElementById("btnSetGlobalKualitatif").addEventListener("click", setAllQualitativeScores);


    // --- 3. AKSI UTAMA (SIMPAN, EXPORT, LOAD) ---

    document.getElementById("btnSimpanNilaiIndikator").addEventListener("click", saveModalInputToState);
    document.getElementById("btnSimpanSimulasi").addEventListener("click", saveSimulationToServer);
    document.getElementById("btnExportCSV").addEventListener("click", exportToCSV);
    document.getElementById("btnRiwayat").addEventListener("click", loadHistory);


    // --- 4. TRIK UI / TAMPILAN TABEL (HOVER ROWSPAN) ---

    const tbody = document.getElementById("tbodySimulator");
    
    tbody.addEventListener("mouseover", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const groupId = tr.getAttribute("data-group");
        if (groupId) {
            document.querySelectorAll(`tr[data-group="${groupId}"] td`).forEach(td => {
                td.classList.add("table-active");
            });
        }
    });

    tbody.addEventListener("mouseout", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const groupId = tr.getAttribute("data-group");
        if (groupId) {
            document.querySelectorAll(`tr[data-group="${groupId}"] td`).forEach(td => {
                td.classList.remove("table-active");
            });
        }
    });
}

// ==============================================================
// LOAD & PARSE DATA MASTER
// ==============================================================
async function loadMasterData(sheetName) {
    Loading.show(); // Asumsi Anda masih pakai utility Loading dari home.js
    try {
        const response = await fetch(`${GAS_AKURASI}?action=getMaster&sheetName=${sheetName}`);
        rawMasterData = await response.json();
        
        // Reset state
        simulationState = {};
        
        // Buat struktur Grouping berdasarkan ID_Kriteria
        // Agar kita bisa melakukan rowspan di tabel
        groupedData = [];
        let currentKriteriaId = null;
        let currentGroup = null;

        // Isi filter kelompok dinamis
        const kelompokSet = new Set();

        rawMasterData.forEach(row => {
            kelompokSet.add(row.Kelompok);

            // Inisialisasi state default untuk indikator ini
            simulationState[row.ID_Indikator] = { nilai: 0, link: "", vars: {} };

            if (row.ID_Kriteria !== currentKriteriaId) {
                if (currentGroup) groupedData.push(currentGroup);
                currentKriteriaId = row.ID_Kriteria;
                currentGroup = {
                    id_kriteria: row.ID_Kriteria,
                    no: row.No,
                    kelompok: row.Kelompok,
                    bagian: row.Bagian,
                    kriteria: row.Kriteria,
                    bobot: parseFloat(row.Bobot) || 0,
                    rumus_kriteria: row.Rumus_Kriteria,
                    indikators: []
                };
            }
            currentGroup.indikators.push(row);
        });
        if (currentGroup) groupedData.push(currentGroup); // push the last one

        // Render Dropdown Kelompok
        const filterK = document.getElementById("filterKelompok");
        filterK.innerHTML = '<option value="Semua">Semua Kelompok</option>';
        kelompokSet.forEach(k => {
            if(k) filterK.innerHTML += `<option value="${k}">${k}</option>`;
        });

        renderTable();
    } catch (error) {
        Swal.fire('Error', 'Gagal memuat data master: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

// ==============================================================
// RENDER TABEL & HITUNGAN
// ==============================================================
function renderTable() {
    const tbody = document.getElementById("tbodySimulator");
    tbody.innerHTML = "";

    const fUnggul = document.getElementById("filterUnggul").value;
    const fPrioritas = document.getElementById("filterPrioritas").value;
    const fTipe = document.getElementById("filterTipe").value;
    const fKelompok = document.getElementById("filterKelompok").value;
    // Tangkap nilai pencarian dan jadikan huruf kecil
    const fSearch = document.getElementById("filterSearch") ? document.getElementById("filterSearch").value.toLowerCase() : "";

    let totalSkorSimulasi = 0;

    // Buat salinan (clone) array agar tidak merusak urutan asli saat di-reset
    let dataToRender = [...groupedData];

    // Jika tombol sortir aktif, urutkan berdasarkan bobot (dari besar ke kecil)
    if (isSortedByBobotDesc) {
        dataToRender.sort((a, b) => b.bobot - a.bobot);
    }

    // Ganti groupedData menjadi dataToRender
    dataToRender.forEach(group => {
        // Filter Indikator yang lolos kriteria
        const filteredIndikators = group.indikators.filter(ind => {
            let pass = true;
            if (fUnggul !== "Semua" && ind.Syarat_Unggul !== fUnggul) pass = false;
            if (fPrioritas !== "Semua" && ind.Prioritas !== fPrioritas) pass = false;
            if (fTipe !== "Semua" && ind.Tipe !== fTipe) pass = false;
            if (fKelompok !== "Semua" && group.kelompok !== fKelompok) pass = false;
            
            // Logika Pencarian Kata Kunci
            if (fSearch) {
                const teksGabungan = `${group.kelompok} ${group.bagian} ${group.kriteria} ${ind.Indikator}`.toLowerCase();
                if (!teksGabungan.includes(fSearch)) pass = false;
            }

            return pass;
        });

        if (filteredIndikators.length === 0) return;

        const rowspan = filteredIndikators.length;
        
        let nilaiKriteria = 0;
        if (group.rumus_kriteria) {
            try {
                let rumus = group.rumus_kriteria;
                group.indikators.forEach(ind => {
                    const regex = new RegExp(`\\b${ind.Simbol}\\b`, 'g');
                    const val = simulationState[ind.ID_Indikator].nilai || 0;
                    rumus = rumus.replace(regex, val);
                });
                nilaiKriteria = new Function(`return ${rumus}`)();
            } catch(e) { console.error("Error evaluasi:", group.id_kriteria, e); }
        } else {
            nilaiKriteria = simulationState[filteredIndikators[0].ID_Indikator].nilai || 0;
        }
        
        if(nilaiKriteria > 4) nilaiKriteria = 4;
        const skorKriteriaAkhir = nilaiKriteria * group.bobot;
        totalSkorSimulasi += skorKriteriaAkhir;

        filteredIndikators.forEach((ind, index) => {
            const state = simulationState[ind.ID_Indikator];
            const isFirst = index === 0;
            
            const highlightClass = ind.Prioritas === "Ya" ? "bg-warning bg-opacity-10" : "";
            const iconUnggul = ind.Syarat_Unggul === "Ya" ? `<i class="bi bi-trophy-fill text-warning ms-1" title="Syarat Unggul"></i>` : "";
            // Badge Kual/Kuant sudah dihapus dari sini (Poin 6)
            
            const btnLinkClass = state.link ? "btn-success" : "btn-outline-secondary";

            let tr = `<tr class="${highlightClass}" data-group="g-${group.id_kriteria}">`;
            
            if (isFirst) {
                tr += `<td rowspan="${rowspan}" class="text-center fw-bold">${group.no}</td>`;
                tr += `<td rowspan="${rowspan}"><strong>${group.kelompok}</strong><br><small class="text-muted">${group.bagian}</small></td>`;
                tr += `<td rowspan="${rowspan}" class="fw-bold">${group.kriteria}</td>`;
            }

            tr += `<td>${ind.Indikator} ${iconUnggul}</td>`;
            
            // Logika pemisahan badge Referensi LKPS
            let refLkpsHtml = '-';
            if (ind.No_Tabel_LKPS) {
                // Diubah menjadi string dulu untuk jaga-jaga jika isinya angka murni, lalu split
                let refs = ind.No_Tabel_LKPS.toString().split(',');
                refLkpsHtml = `<div class="d-flex flex-wrap justify-content-center gap-1">` + 
                              refs.map(r => `<span class="badge bg-dark text-wrap" style="line-height: 1.4;">${r.trim()}</span>`).join('') + 
                              `</div>`;
            }
            tr += `<td class="text-center align-middle">${refLkpsHtml}</td>`;
            
            tr += `<td class="text-center fw-bold fs-6 text-primary align-middle">${state.nilai.toFixed(2)}</td>`;
            
            if (isFirst) {
                tr += `<td rowspan="${rowspan}" class="text-center align-middle">${group.bobot.toFixed(2)}</td>`;
                tr += `<td rowspan="${rowspan}" class="text-center align-middle fw-bolder fs-5 text-success">${skorKriteriaAkhir.toFixed(2)}</td>`;
            }

            tr += `<td class="text-center align-middle">
                    <div class="d-flex justify-content-center gap-1">
                        <!-- Tombol Pensil untuk Isi Nilai -->
                        <button class="btn btn-sm btn-primary" onclick="openModal('${ind.ID_Indikator}')" title="Isi Nilai/Edit">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <!-- Tombol Panah Keluar untuk Bukti -->
                        <button class="btn btn-sm ${state.link ? 'btn-success' : 'btn-outline-secondary'}" onclick="bukaLinkBukti('${ind.ID_Indikator}')" title="Buka Link Bukti">
                            <i class="bi bi-box-arrow-up-right"></i>
                        </button>
                    </div>
                   </td>`;
            tr += `</tr>`;
            
            tbody.innerHTML += tr;
        });
    });

    document.getElementById("totalSkorDisplay").innerText = totalSkorSimulasi.toFixed(2);
    
    // Logika Akreditasi Terbaru (Poin 8)
    const statusDisp = document.getElementById("hasilAkreditasiDisplay");
    if (totalSkorSimulasi >= 361) {
        statusDisp.innerHTML = `<span class="badge bg-success fs-5 px-3 py-2">UNGGUL 5 TAHUN</span>`;
    } else if(totalSkorSimulasi >= 331) {
        statusDisp.innerHTML = `<span class="badge bg-info text-dark fs-5 px-3 py-2">UNGGUL 3 TAHUN</span>`;
    } else if(totalSkorSimulasi >= 200) {
        statusDisp.innerHTML = `<span class="badge bg-primary fs-5 px-3 py-2">TERAKREDITASI</span>`;
    } else {
        statusDisp.innerHTML = `<span class="badge bg-danger fs-5 px-3 py-2">TIDAK TERAKREDITASI</span>`;
    }
}

// ==============================================================
// LOGIKA MODAL & PERHITUNGAN DINAMIS
// ==============================================================
function openModal(id_indikator) {
    currentModalId = id_indikator;
    const indData = rawMasterData.find(r => r.ID_Indikator === id_indikator);
    const state = simulationState[id_indikator];

    document.getElementById("modalKriteria").innerText = indData.Kriteria;
    
    // Logika menyembunyikan tanda () jika indikator tunggal (tidak punya Simbol seperti I, II, III)
    if (indData.Simbol && indData.Simbol.trim() !== "") {
        document.getElementById("modalSimbolLabel").innerHTML = `Indikator (${indData.Simbol}):`;
    } else {
        document.getElementById("modalSimbolLabel").innerHTML = `Indikator:`;
    }
    
    document.getElementById("modalIndikator").innerText = indData.Indikator;

    const formattedDesc = indData.Deskripsi_Skor_4 ? indData.Deskripsi_Skor_4.replace(/\n/g, '<br>') : "-";
    document.getElementById("modalDeskripsi4").innerHTML = `<strong>Kondisi Skor 4:</strong><br>${formattedDesc}`;

    // Logika render Referensi Tabel LKPS ke dalam Modal
    let refHtmlModal = '-';
    if (indData.No_Tabel_LKPS) {
        let refs = indData.No_Tabel_LKPS.toString().split(',');
        refHtmlModal = `<div class="d-flex flex-wrap gap-2">` + 
                       refs.map(r => `<span class="badge bg-dark fs-6 text-wrap shadow-sm" style="line-height: 1.5;">${r.trim()}</span>`).join('') + 
                       `</div>`;
    }
    document.getElementById("modalRefLKPSContainer").innerHTML = refHtmlModal;

    document.getElementById("modalTipe").value = indData.Tipe;
    document.getElementById("modalLinkBukti").value = state.link || "";
    
    const dynamicArea = document.getElementById("dynamicInputArea");
    dynamicArea.innerHTML = ""; // Bersihkan

    if (indData.Tipe === "Kualitatif") {
        // Render Slider
        let val = state.nilai || 0;
        dynamicArea.innerHTML = `
            <label class="form-label fw-bold">Skor (0 - 4):</label>
            <div class="d-flex align-items-center gap-3">
                <input type="range" id="modalInputKualitatif" class="form-range flex-grow-1" min="0" max="4" step="0.5" value="${val}" oninput="document.getElementById('modalPreviewNilai').value = parseFloat(this.value).toFixed(2)">
                <span class="fs-4 fw-bold text-primary" id="sliderValDisplay">${val.toFixed(1)}</span>
            </div>
        `;
        document.getElementById("modalPreviewNilai").value = val.toFixed(2);
        // Event sync teks sebelah slider
        document.getElementById("modalInputKualitatif").addEventListener("input", function() {
            document.getElementById("sliderValDisplay").innerText = parseFloat(this.value).toFixed(1);
        });

    } else if (indData.Tipe === "Kuantitatif") {
        // Render Input Box untuk setiap Variabel
        const vars = indData.Var_Kuantitatif ? indData.Var_Kuantitatif.split(",") : [];
        let html = `<div class="row g-2">`;
        
        vars.forEach(v => {
            const varName = v.trim();
            if(!varName) return;
            
            // Jika variabel adalah NDTPS, jangan buat input, cukup tampilkan Global
            if (varName === "NDTPS") {
                const globalVal = document.getElementById("globalNDTPS").value;
                html += `
                <div class="col-6">
                    <label class="form-label small fw-bold text-danger">${varName} (Dari Global)</label>
                    <input type="text" class="form-control bg-light" readonly value="${globalVal}">
                </div>`;
                // Simpan NDTPS global ke state variabel lokal ini agar rumus JS bisa jalan
                state.vars["NDTPS"] = parseFloat(globalVal) || 0;
            } else if (varName === "NM") {
                const globalVal = document.getElementById("globalNM").value;
                html += `
                <div class="col-6">
                    <label class="form-label small fw-bold text-success">${varName} (Dari Global)</label>
                    <input type="text" class="form-control bg-light fw-bold text-center" readonly value="${globalVal}">
                </div>`;
                state.vars["NM"] = parseFloat(globalVal) || 0;
            } else {
                const savedVal = state.vars[varName] !== undefined ? state.vars[varName] : "";
                html += `
                <div class="col-6">
                    <label class="form-label small fw-bold">${varName}</label>
                    <input type="number" class="form-control dynamic-var-input" data-varname="${varName}" value="${savedVal}" placeholder="Masukkan angka...">
                </div>`;
            }
        });
        html += `</div>`;
        dynamicArea.innerHTML = html;

        // Pasang Event Listener agar saat ngetik, Preview Skor langsung hitung
        document.querySelectorAll('.dynamic-var-input').forEach(input => {
            input.addEventListener('input', () => {
                evaluateQuantitativeScore(indData);
            });
        });

        // Hitung awal saat modal dibuka
        evaluateQuantitativeScore(indData);
    }

    new bootstrap.Modal(document.getElementById('modalInput')).show();
}

function evaluateQuantitativeScore(indData) {
    const state = simulationState[indData.ID_Indikator];
    let evalVars = { ...state.vars }; // Clone
    
    // Pastikan NDTPS selalu update terbaru dari global
    evalVars["NDTPS"] = parseFloat(document.getElementById("globalNDTPS").value) || 0;
    evalVars["NM"] = parseFloat(document.getElementById("globalNM").value) || 0;

    // Ambil nilai dari input box yang sedang diketik user di modal
    document.querySelectorAll('.dynamic-var-input').forEach(input => {
        evalVars[input.dataset.varname] = parseFloat(input.value) || 0;
    });

    try {
        // Konstruksi Fungsi Eksekusi
        // "variabel" adalah argumen yang dikirim, isinya object evalVars
        const hitung = new Function("variabel", indData.Rumus_Indikator);
        let hasil = hitung(evalVars);
        
        // Sanitasi hasil
        if(isNaN(hasil) || !isFinite(hasil)) hasil = 0;
        if(hasil > 4) hasil = 4;
        if(hasil < 0) hasil = 0;

        document.getElementById("modalPreviewNilai").value = hasil.toFixed(2);
    } catch(e) {
        console.error("Formula error:", e);
        document.getElementById("modalPreviewNilai").value = "Error";
    }
}

function saveModalInputToState() {
    if (!currentModalId) return;
    
    const indData = rawMasterData.find(r => r.ID_Indikator === currentModalId);
    const state = simulationState[currentModalId];
    const tipe = document.getElementById("modalTipe").value;
    
    // Simpan Nilai
    state.nilai = parseFloat(document.getElementById("modalPreviewNilai").value) || 0;
    // Simpan Link Bukti
    state.link = document.getElementById("modalLinkBukti").value;

    if (tipe === "Kuantitatif") {
        // Simpan input user ke state.vars
        document.querySelectorAll('.dynamic-var-input').forEach(input => {
            state.vars[input.dataset.varname] = parseFloat(input.value) || 0;
        });
        // Update NDTPS ke dalam state vars agar tersimpan di json
        state.vars["NDTPS"] = parseFloat(document.getElementById("globalNDTPS").value) || 0;
        state.vars["NM"] = parseFloat(document.getElementById("globalNM").value) || 0;
    }

    // Refresh Tabel UI untuk update perhitungan Kriteria (I+II)/3 dsb.
    updateTableUI();
    bootstrap.Modal.getInstance(document.getElementById('modalInput')).hide();

    Swal.fire({
        icon: 'success',
        title: 'Nilai Disimpan',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
    });
}

// Dipanggil saat NDTPS Global diketik
function recalculateAllQuantitative() {
    const globalVal = parseFloat(document.getElementById("globalNDTPS").value) || 0;
    const globalNM = parseFloat(document.getElementById("globalNM").value) || 0;
    
    rawMasterData.forEach(ind => {
        if(ind.Tipe === "Kuantitatif") {
            const state = simulationState[ind.ID_Indikator];
            let needsRecalc = false;
            
            if (ind.Var_Kuantitatif.includes("NDTPS")) {
                state.vars["NDTPS"] = globalNDTPS;
                needsRecalc = true;
            }
            if (ind.Var_Kuantitatif.includes("NM")) {
                state.vars["NM"] = globalNM;
                needsRecalc = true;
            }
            
            if (needsRecalc) {
                try {
                    const hitung = new Function("variabel", ind.Rumus_Indikator);
                    let hasil = hitung(state.vars);
                    if(isNaN(hasil) || !isFinite(hasil)) hasil = 0;
                    if(hasil > 4) hasil = 4;
                    if(hasil < 0) hasil = 0;
                    state.nilai = hasil;
                } catch(e) { }
            }
        }
    });
}

function updateTableUI() {
    renderTable(); // Re-render dari state terbaru
}

// ==============================================================
// UTILITIES: SET ALL KUALITATIF & SAVE/LOAD
// ==============================================================
function setAllQualitativeScores() {
    const val = parseFloat(document.getElementById("sliderGlobalKualitatif").value);
    rawMasterData.forEach(ind => {
        if (ind.Tipe === "Kualitatif") {
            simulationState[ind.ID_Indikator].nilai = val;
        }
    });
    updateTableUI();
    Swal.fire({icon: 'success', title: 'Berhasil', text: `Semua indikator kualitatif diset ke skor ${val}`, timer: 1500, showConfirmButton: false});
}

async function saveSimulationToServer() {
    const { value: namaSimulasi } = await Swal.fire({
        title: 'Simpan Simulasi',
        input: 'text',
        inputLabel: 'Beri nama untuk simulasi ini (Misal: Borang Awal S1 2026)',
        inputPlaceholder: 'Ketik nama simulasi...',
        showCancelButton: true,
        inputValidator: (value) => { if (!value) return 'Nama simulasi tidak boleh kosong!' }
    });

    if (!namaSimulasi) return;

    // Ambil info user
    const userSession = JSON.parse(sessionStorage.getItem("user")) || { email: "admin@ugm.ac.id" };
    const totalSkor = parseFloat(document.getElementById("totalSkorDisplay").innerText);
    
    // MENGAMBIL HASIL AKREDITASI LANGSUNG DARI TEKS DISPLAY
    const statusText = document.getElementById("hasilAkreditasiDisplay").innerText;
    
    // MENGAMBIL JENJANG YANG SEDANG AKTIF
    const currentJenjang = document.querySelector('input[name="btnjenjang"]:checked').value;

    const payload = {
        email: userSession.email,
        namaSimulasi: namaSimulasi,
        totalSkor: totalSkor,
        hasilAkreditasi: statusText, 
        jenisAkreditasi: "LAMTEK", // Hardcode karena ini halaman LAMTEK
        jenjang: currentJenjang,
        detail: simulationState
    };

    Loading.show();
    try {
        const response = await fetch(GAS_AKURASI, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if(res.status === "success") {
            Swal.fire('Tersimpan!', `Simulasi berhasil disimpan dengan ID: ${res.id}`, 'success');
        } else throw new Error(res.message);
    } catch (e) {
        Swal.fire('Gagal Menyimpan', e.message, 'error');
    } finally {
        Loading.hide();
    }
}

async function loadHistory() {
    Loading.show();
    try {
        const response = await fetch(`${GAS_AKURASI}?action=getHistory`);
        const data = await response.json();
        
        const tbody = document.getElementById("tbodyRiwayat");
        tbody.innerHTML = "";
        
        const lamtekData = data.filter(row => row.Jenis_Akreditasi === "LAMTEK");
        
        lamtekData.reverse().forEach((row, i) => {
            if (!row.ID_Simulasi) return;

            const tgl = new Date(row.Timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
            const safeJson = (row.Data_Detail).replace(/'/g, "&#39;"); 

            // Format Jenjang agar lebih enak dibaca di tabel
            let namaJenjang = row.Jenjang || "-";
            if (namaJenjang.includes("Sarjana")) namaJenjang = "S1";
            else if (namaJenjang.includes("Magister")) namaJenjang = "S2";
            else if (namaJenjang.includes("Doktor")) namaJenjang = "S3";

            // Warnai badge hasil
            let hasilClass = "bg-secondary";
            const hasil = row.Hasil_Akreditasi || "";
            if (hasil.includes("UNGGUL")) hasilClass = "bg-success";
            else if (hasil.includes("TIDAK")) hasilClass = "bg-danger";
            else if (hasil.includes("TERAKREDITASI") || hasil.includes("BAIK")) hasilClass = "bg-primary";

            // Kolom Jenis (<td> yang berisi badge dark) sudah dihapus dari sini
            tbody.innerHTML += `
                <tr>
                    <td>${i+1}</td>
                    <td>${tgl}</td>
                    <td>${row.Email_User.split('@')[0]}</td>
                    <td><span class="badge bg-secondary">${namaJenjang}</span></td>
                    <td class="fw-bold">${row.Nama_Simulasi}</td>
                    <td class="text-primary fw-bold">${parseFloat(row.Total_Skor).toFixed(2)}</td>
                    <td><span class="badge ${hasilClass}">${hasil}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary fw-bold" onclick='restoreSimulation("${row.Jenis_Akreditasi}", "${row.Jenjang}", ${safeJson})'>
                            <i class="bi bi-cloud-download me-1"></i> Load
                        </button>
                    </td>
                </tr>
            `;
        });
        
        new bootstrap.Modal(document.getElementById('modalRiwayat')).show();
    } catch (error) {
        Swal.fire('Error', 'Gagal memuat riwayat: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

function restoreSimulation(jenis, jenjang, jsonData) {
    // 1. Validasi Jenis Akreditasi
    if (jenis && jenis !== "LAMTEK") {
        Swal.fire({
            title: 'Format Tidak Sesuai', 
            text: `Anda mencoba memuat simulasi ${jenis} di dalam halaman LAMTEK. Silakan berpindah ke halaman simulator ${jenis}.`, 
            icon: 'error',
            confirmButtonColor: '#d33'
        });
        return;
    }

    // 2. Validasi Jenjang Program Studi
    const currentJenjang = document.querySelector('input[name="btnjenjang"]:checked').value;
    if (jenjang && jenjang !== currentJenjang) {
        // Terjemahkan nama untuk ditampilkan di alert
        const namaAsal = jenjang.includes("Sarjana") ? "S1" : (jenjang.includes("Magister") ? "S2" : "S3");
        const namaTujuan = currentJenjang.includes("Sarjana") ? "S1" : (currentJenjang.includes("Magister") ? "S2" : "S3");
        
        Swal.fire({
            title: 'Jenjang Berbeda',
            text: `Data ini adalah simulasi untuk program ${namaAsal}, sedangkan Anda sedang berada di halaman simulator ${namaTujuan}. Format Kriteria tidak cocok!`,
            icon: 'warning',
            confirmButtonText: 'Mengerti',
            confirmButtonColor: '#f8bb86'
        });
        return;
    }

    // Jika lolos validasi, lakukan load data
    try {
        simulationState = jsonData;
        
        let foundNDTPS = 0;
        let foundNM = 0;
        for (const key in simulationState) {
            if (simulationState[key].vars) {
                if (simulationState[key].vars["NDTPS"] !== undefined) foundNDTPS = simulationState[key].vars["NDTPS"];
                if (simulationState[key].vars["NM"] !== undefined) foundNM = simulationState[key].vars["NM"];
            }
        }
        document.getElementById("globalNDTPS").value = foundNDTPS;
        document.getElementById("globalNM").value = foundNM;

        updateTableUI();
        bootstrap.Modal.getInstance(document.getElementById('modalRiwayat')).hide();
        Swal.fire({icon: 'success', title: 'Berhasil Dimuat', text: 'Data simulasi berhasil di-load.', timer: 1500, showConfirmButton: false});
    } catch (e) {
        Swal.fire('Gagal', 'Format data JSON rusak.', 'error');
    }
}

// ==============================================================
// FUNGSI BUKA LINK BUKTI & ALERT
// ==============================================================
function bukaLinkBukti(id_indikator) {
    const state = simulationState[id_indikator];
    
    // Cek apakah state ada dan link tidak kosong (termasuk hanya spasi)
    if (state && state.link && state.link.trim() !== "") {
        // Buka link di tab baru
        window.open(state.link, '_blank');
    } else {
        // Munculkan peringatan jika kosong
        Swal.fire({
            icon: 'warning',
            title: 'Link Bukti Belum Ada',
            text: 'Link bukti tidak ditemukan. Pastikan Anda sudah mengisi link bukti terlebih dahulu melalui tombol Isi Nilai (Pensil).',
            confirmButtonText: 'Mengerti',
            confirmButtonColor: '#0d6efd'
        });
    }
}

// ==============================================================
// FUNGSI EXPORT KE CSV
// ==============================================================
function exportToCSV() {
    // 1. Siapkan Header CSV
    let csvContent = "No,Kelompok & Bagian,Kriteria,Indikator,Referensi Tabel LKPS,Nilai Indikator,Bobot,Skor Kriteria\n";
    
    // Fungsi bantu untuk mencegah error pada teks yang mengandung koma (,) atau tanda kutip (")
    const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

    // 2. Ambil nilai filter saat ini agar data yang di-export = data yang tampil
    const fUnggul = document.getElementById("filterUnggul").value;
    const fPrioritas = document.getElementById("filterPrioritas").value;
    const fTipe = document.getElementById("filterTipe").value;
    const fKelompok = document.getElementById("filterKelompok").value;
    const fSearch = document.getElementById("filterSearch") ? document.getElementById("filterSearch").value.toLowerCase() : "";

    // 3. Siapkan data yang akan di-looping (Sama persis dengan logika renderTable)
    let dataToExport = [...groupedData];
    if (typeof isSortedByBobotDesc !== 'undefined' && isSortedByBobotDesc) {
        dataToExport.sort((a, b) => b.bobot - a.bobot);
    }

    dataToExport.forEach(group => {
        const filteredIndikators = group.indikators.filter(ind => {
            let pass = true;
            if (fUnggul !== "Semua" && ind.Syarat_Unggul !== fUnggul) pass = false;
            if (fPrioritas !== "Semua" && ind.Prioritas !== fPrioritas) pass = false;
            if (fTipe !== "Semua" && ind.Tipe !== fTipe) pass = false;
            if (fKelompok !== "Semua" && group.kelompok !== fKelompok) pass = false;
            if (fSearch) {
                const teksGabungan = `${group.kelompok} ${group.bagian} ${group.kriteria} ${ind.Indikator}`.toLowerCase();
                if (!teksGabungan.includes(fSearch)) pass = false;
            }
            return pass;
        });

        if (filteredIndikators.length === 0) return;

        // Hitung Skor Kriteria
        let nilaiKriteria = 0;
        if (group.rumus_kriteria) {
            try {
                let rumus = group.rumus_kriteria;
                group.indikators.forEach(ind => {
                    const regex = new RegExp(`\\b${ind.Simbol}\\b`, 'g');
                    const val = simulationState[ind.ID_Indikator].nilai || 0;
                    rumus = rumus.replace(regex, val);
                });
                nilaiKriteria = new Function(`return ${rumus}`)();
            } catch(e) {}
        } else {
            nilaiKriteria = simulationState[filteredIndikators[0].ID_Indikator].nilai || 0;
        }
        if(nilaiKriteria > 4) nilaiKriteria = 4;
        const skorKriteriaAkhir = nilaiKriteria * group.bobot;

        // Looping Indikator ke dalam baris CSV
        filteredIndikators.forEach((ind, index) => {
            const state = simulationState[ind.ID_Indikator];
            const isFirst = index === 0;

            const no = isFirst ? escapeCSV(group.no) : '""';
            const kelompokBagian = isFirst ? escapeCSV(`${group.kelompok} - ${group.bagian}`) : '""';
            const kriteria = isFirst ? escapeCSV(group.kriteria) : '""';
            const indikator = escapeCSV(ind.Indikator);
            const refLKPS = escapeCSV(ind.No_Tabel_LKPS || '-');
            const nilaiInd = state.nilai.toFixed(2);
            const bobot = isFirst ? group.bobot.toFixed(2) : '""';
            const skorKriteria = isFirst ? skorKriteriaAkhir.toFixed(2) : '""';

            csvContent += `${no},${kelompokBagian},${kriteria},${indikator},${refLKPS},${nilaiInd},${bobot},${skorKriteria}\n`;
        });
    });

    // 4. Tambahkan Baris Total dan Prediksi di bawah tabel
    const totalSkor = document.getElementById("totalSkorDisplay").innerText;
    const hasilAkreditasi = document.getElementById("hasilAkreditasiDisplay").innerText;

    csvContent += `\n"","","","","","","TOTAL SKOR SIMULASI:",${escapeCSV(totalSkor)}\n`;
    csvContent += `"","","","","","","PREDIKSI AKREDITASI:",${escapeCSV(hasilAkreditasi)}\n`;

    // 5. Eksekusi Download File
    // Tambahkan \uFEFF (Byte Order Mark) agar karakter khusus terbaca sempurna saat dibuka di MS Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    // Nama file disesuaikan dengan jenjang yang sedang dibuka
    const activeRadio = document.querySelector('input[name="btnjenjang"]:checked');
    const namaJenjang = document.querySelector(`label[for="${activeRadio.id}"]`).innerText;
    const cleanJenjang = namaJenjang.replace(/[^a-zA-Z0-9]/g, "_"); // Bersihkan karakter aneh
    const today = new Date().toISOString().slice(0,10);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Simulasi_${cleanJenjang}_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}