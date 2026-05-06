// ==============================================================
// STATE & VARIABEL GLOBAL
// ==============================================================
var rawIabeeData = [];
var groupedIabeeData = [];
var iabeeState = {}; 
var mappingData = [];
var currentIabeeId = null;

// ==============================================================
// INISIALISASI
// ==============================================================
setTimeout(() => {
    initIabeeEvents();
    loadIabeeMasterData(); 
}, 50);

function initIabeeEvents() {
    ['filterPrioritas', 'filterKelompok'].forEach(id => {
        document.getElementById(id).addEventListener("change", renderIabeeTable);
    });
    
    document.getElementById("filterSearch").addEventListener("input", renderIabeeTable);

    document.getElementById("btnResetFilter").addEventListener("click", () => {
        document.getElementById("filterPrioritas").value = "Semua";
        document.getElementById("filterKelompok").value = "Semua";
        document.getElementById("filterSearch").value = "";
        renderIabeeTable();
    });

    document.getElementById("btnSimpanNilaiIabee").addEventListener("click", saveModalIabeeToState);
    document.getElementById("btnExportCSVIabee").addEventListener("click", exportIabeeToCSV);
    document.getElementById("btnSimpanSimulasiIabee").addEventListener("click", saveSimulationToServerIabee);
    document.getElementById("btnRiwayatIabee").addEventListener("click", loadHistoryIabee);
    
    // Trik Hover Rowspan untuk IABEE
    const tbody = document.getElementById("tbodyIabee");
    tbody.addEventListener("mouseover", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const groupId = tr.getAttribute("data-group-kriteria");
        if (groupId) {
            document.querySelectorAll(`tr[data-group-kriteria="${groupId}"] td`).forEach(td => td.classList.add("table-active"));
        }
    });

    tbody.addEventListener("mouseout", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const groupId = tr.getAttribute("data-group-kriteria");
        if (groupId) {
            document.querySelectorAll(`tr[data-group-kriteria="${groupId}"] td`).forEach(td => td.classList.remove("table-active"));
        }
    });
}

// ==============================================================
// PENGAMBILAN & PENGELOMPOKAN DATA
// ==============================================================
// ==============================================================
// PENGAMBILAN & PENGELOMPOKAN DATA
// ==============================================================
async function loadIabeeMasterData() {
    Loading.show();
    try {
        // Ambil sheet IABEE dan IABEExLAMTEK secara paralel
        const [resIabee, resMapping] = await Promise.all([
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=IABEE`).then(r => r.json()),
            fetch(`${GAS_AKURASI}?action=getMaster&sheetName=IABEExLAMTEK`).then(r => r.json())
        ]);
        
        rawIabeeData = resIabee;
        mappingData = resMapping;
        
        // Inisialisasi state default jika kosong
        rawIabeeData.forEach(item => {
            if (!iabeeState[item.ID_Kriteria]) {
                iabeeState[item.ID_Kriteria] = { nilai: "", deskripsi: "", link: "" };
            }
        });

        groupIabeeData();
        renderIabeeTable();
    } catch (e) {
        Swal.fire('Error', 'Gagal memuat data master IABEE: ' + e.message, 'error');
    } finally {
        Loading.hide();
    }
}

function groupIabeeData() {
    groupedIabeeData = [];
    const kriteriaMap = new Map();

    rawIabeeData.forEach(item => {
        if (!kriteriaMap.has(item.Kriteria)) {
            kriteriaMap.set(item.Kriteria, { kriteriaName: item.Kriteria, subKriterias: new Map() });
        }
        
        const subMap = kriteriaMap.get(item.Kriteria).subKriterias;
        if (!subMap.has(item.Sub_Kriteria)) {
            subMap.set(item.Sub_Kriteria, { subKriteriaName: item.Sub_Kriteria, items: [] });
        }
        
        subMap.get(item.Sub_Kriteria).items.push(item);
    });

    // Convert Maps back to arrays for easier looping
    kriteriaMap.forEach(k => {
        const subArr = [];
        k.subKriterias.forEach(s => subArr.push(s));
        groupedIabeeData.push({ kriteriaName: k.kriteriaName, subKriterias: subArr });
    });
}

// ==============================================================
// RENDER TABEL & LOGIKA AKREDITASI
// ==============================================================
function renderIabeeTable() {
    const tbody = document.getElementById("tbodyIabee");
    tbody.innerHTML = "";

    const fPrioritas = document.getElementById("filterPrioritas").value;
    const fKelompok = document.getElementById("filterKelompok").value;
    const fSearch = document.getElementById("filterSearch").value.toLowerCase();

    groupedIabeeData.forEach((kGroup, kIndex) => {
        // Filter di level item
        const filteredSubKriterias = [];
        kGroup.subKriterias.forEach(sub => {
            const filteredItems = sub.items.filter(item => {
                let pass = true;
                if (fPrioritas !== "Semua" && item.Bobot_Perhatian !== fPrioritas) pass = false;
                if (fKelompok !== "Semua" && !kGroup.kriteriaName.startsWith(fKelompok.charAt(0))) pass = false;
                if (fSearch) {
                    const gabungan = `${item.Kriteria} ${item.Sub_Kriteria} ${item.Kriteria_Evaluasi}`.toLowerCase();
                    if (!gabungan.includes(fSearch)) pass = false;
                }
                return pass;
            });
            if (filteredItems.length > 0) {
                filteredSubKriterias.push({ subKriteriaName: sub.subKriteriaName, items: filteredItems });
            }
        });

        if (filteredSubKriterias.length === 0) return;

        // Hitung total rowspan untuk Kriteria ini
        let kriteriaRowspan = 0;
        filteredSubKriterias.forEach(sub => kriteriaRowspan += sub.items.length);

        filteredSubKriterias.forEach((sub, sIndex) => {
            const subRowspan = sub.items.length;
            
            sub.items.forEach((item, iIndex) => {
                const state = iabeeState[item.ID_Kriteria];
                
                // Styling Badge Hasil
                let badgeHtml = `<span class="badge bg-secondary">Belum Dinilai</span>`;
                if (state.nilai === "A") badgeHtml = `<span class="badge bg-success fs-6 w-100 py-2">A</span>`;
                else if (state.nilai === "C") badgeHtml = `<span class="badge bg-warning text-dark fs-6 w-100 py-2">C</span>`;
                else if (state.nilai === "W") badgeHtml = `<span class="badge fs-6 w-100 py-2" style="background-color:#fd7e14;">W</span>`;
                else if (state.nilai === "D") badgeHtml = `<span class="badge bg-danger fs-6 w-100 py-2">D</span>`;

                const btnLinkClass = state.link ? "btn-success" : "btn-outline-secondary";

                let tr = `<tr data-group-kriteria="k-${kIndex}" data-group-sub="s-${kIndex}-${sIndex}">`;
                
                if (sIndex === 0 && iIndex === 0) {
                    tr += `<td rowspan="${kriteriaRowspan}" class="fw-bold align-top">${item.Kriteria}</td>`;
                }
                if (iIndex === 0) {
                    tr += `<td rowspan="${subRowspan}" class="align-top">
                             <strong>${item.Sub_Kriteria}</strong>
                             ${item.Sub_Sub_Kriteria ? `<br><small class="text-muted fst-italic mt-1 d-block">${item.Sub_Sub_Kriteria}</small>` : ''}
                           </td>`;
                }
                
                tr += `<td><div style="white-space: pre-line;">${item.Kriteria_Evaluasi}</div></td>`;
                // Logika Referensi Tabel Suplemen (Direct Sheet Link)
                let refHtml = '-';
                if (item.Referensi_Tabel_Suplemen) {
                    let refs = item.Referensi_Tabel_Suplemen.split(',');
                    refHtml = `<div class="d-flex flex-wrap justify-content-center gap-1">` + 
                              refs.map(r => {
                                  let text = r.trim();
                                  let label = text;
                                  let url = "#";
                                  
                                  if (text.includes('|')) {
                                      let parts = text.split('|');
                                      label = parts[0].trim();
                                      url = parts[1].trim();
                                  } else if (text.toLowerCase().startsWith("http")) {
                                      label = "Buka Tabel";
                                      url = text;
                                  }

                                  return `<a href="${url}" target="_blank" class="badge border border-dark text-dark text-wrap text-decoration-none shadow-sm" style="line-height: 1.4;" title="Buka Referensi"><i class="bi bi-file-earmark-spreadsheet me-1"></i>${label}</a>`;
                              }).join('') + 
                              `</div>`;
                }
                tr += `<td class="text-center align-middle">${refHtml}</td>`;
                tr += `<td class="text-center align-middle">${badgeHtml}</td>`;
                
                tr += `<td class="text-center align-middle">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-primary" onclick="openIabeeModal('${item.ID_Kriteria}')" title="Isi Nilai/Edit">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="btn btn-sm ${btnLinkClass}" onclick="bukaLinkBuktiIabee('${item.ID_Kriteria}')" title="Buka Link Bukti">
                                <i class="bi bi-box-arrow-up-right"></i>
                            </button>
                        </div>
                       </td>`;
                tr += `</tr>`;
                
                tbody.innerHTML += tr;
            });
        });
    });

    calculateAkreditasiIabee();
}

function calculateAkreditasiIabee() {
    let hasD = false;
    let hasW = false;
    let hasEmpty = false;
    let hasAorC = false;

    // Cek seluruh state yang ada di raw data
    rawIabeeData.forEach(item => {
        const val = iabeeState[item.ID_Kriteria].nilai;
        if (val === "D") hasD = true;
        else if (val === "W") hasW = true;
        else if (val === "A" || val === "C") hasAorC = true;
        else hasEmpty = true;
    });

    const statusDisp = document.getElementById("hasilAkreditasiIabee");
    
    if (hasD) {
        statusDisp.innerHTML = `<span class="badge bg-danger fs-5 px-4 py-2">NOT ACCREDITED (Deficiency Found)</span>`;
    } else if (hasW) {
        statusDisp.innerHTML = `<span class="badge fs-5 px-4 py-2" style="background-color:#fd7e14;">ACCREDITED - 2 YEARS (Interim Required)</span>`;
    } else if (hasAorC) {
        // Jika semua terisi A/C
        if (hasEmpty) {
             statusDisp.innerHTML = `<span class="badge bg-success fs-5 px-4 py-2">ACCREDITED - 5 YEARS (Proyeksi)</span>
                                     <br><small class="text-light fw-normal mt-1 d-block">*Masih ada item yang belum dievaluasi.</small>`;
        } else {
             statusDisp.innerHTML = `<span class="badge bg-success fs-5 px-4 py-2">ACCREDITED - FULL 5 YEARS</span>`;
        }
    } else {
        statusDisp.innerHTML = `<span class="badge bg-secondary fs-5 px-4 py-2">BELUM ADA PENILAIAN</span>`;
    }
}

// ==============================================================
// MODAL & INTERAKSI
// ==============================================================
function openIabeeModal(id_kriteria) {
    currentIabeeId = id_kriteria;
    const itemData = rawIabeeData.find(r => r.ID_Kriteria === id_kriteria);
    const state = iabeeState[id_kriteria];

    document.getElementById("modalIabeeKriteria").innerText = itemData.Kriteria;
    document.getElementById("modalIabeeSubKriteria").innerText = itemData.Sub_Kriteria;
    document.getElementById("modalIabeeSubSub").innerText = itemData.Sub_Sub_Kriteria || "-";
    document.getElementById("modalIabeeInstruksi").innerText = itemData.Kriteria_Evaluasi;

    let refHtmlModal = '-';
    if (itemData.Referensi_Tabel_Suplemen) {
        let refs = itemData.Referensi_Tabel_Suplemen.split(',');
        refHtmlModal = `<div class="d-flex flex-wrap gap-2">` + 
                       refs.map(r => {
                           let text = r.trim();
                           let label = text;
                           let url = "#";
                           
                           if (text.includes('|')) {
                               let parts = text.split('|');
                               label = parts[0].trim();
                               url = parts[1].trim();
                           } else if (text.toLowerCase().startsWith("http")) {
                               label = "Buka Tabel";
                               url = text;
                           }

                           return `<a href="${url}" target="_blank" class="badge bg-secondary fs-6 text-wrap text-decoration-none shadow-sm" style="line-height: 1.5; text-align: left;"><i class="bi bi-box-arrow-up-right me-2"></i>${label}</a>`;
                       }).join('') + 
                       `</div>`;
    }
    document.getElementById("modalIabeeRef").innerHTML = refHtmlModal;

    // Reset Radio Buttons
    document.querySelectorAll('input[name="radioACWD"]').forEach(r => r.checked = false);
    if (state.nilai) {
        const radioToSelect = document.getElementById(`radio${state.nilai}`);
        if(radioToSelect) radioToSelect.checked = true;
    }

    document.getElementById("modalIabeeDeskripsi").value = state.deskripsi || "";
    document.getElementById("modalIabeeLink").value = state.link || "";

    // Set Helper Text untuk Relasi LAMTEK
    document.getElementById("lamtekHelperText").innerHTML = `Integrasi otomatis untuk mengaitkan item <strong>${itemData.ID_Kriteria}</strong> dengan rekam jejak LAMTEK Anda siap diaktifkan.`;

    new bootstrap.Modal(document.getElementById('modalInputIabee')).show();
}

function saveModalIabeeToState() {
    if (!currentIabeeId) return;
    
    const state = iabeeState[currentIabeeId];
    
    // Ambil nilai radio button yang aktif
    const activeRadio = document.querySelector('input[name="radioACWD"]:checked');
    state.nilai = activeRadio ? activeRadio.value : "";
    
    state.deskripsi = document.getElementById("modalIabeeDeskripsi").value;
    state.link = document.getElementById("modalIabeeLink").value;

    bootstrap.Modal.getInstance(document.getElementById('modalInputIabee')).hide();
    
    Swal.fire({
        icon: 'success',
        title: 'Evaluasi Disimpan',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
    });
    
    renderIabeeTable();
}

function bukaLinkBuktiIabee(id_kriteria) {
    const state = iabeeState[id_kriteria];
    if (state && state.link && state.link.trim() !== "") {
        window.open(state.link, '_blank');
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Link Bukti Belum Ada',
            text: 'Tautan dokumen/Tabel Suplemen tidak ditemukan. Silakan isi melalui form evaluasi.',
            confirmButtonColor: '#198754'
        });
    }
}

// ==============================================================
// EXPORT CSV
// ==============================================================
function exportIabeeToCSV() {
    let csvContent = "Kriteria,Sub-Kriteria,Kriteria Evaluasi,Referensi Tabel,Hasil Evaluasi\n";
    const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

    let dataToExport = [...groupedIabeeData];
    
    dataToExport.forEach(kGroup => {
        kGroup.subKriterias.forEach(sub => {
            sub.items.forEach((item, iIndex) => {
                const state = iabeeState[item.ID_Kriteria];
                
                const kriteria = iIndex === 0 ? escapeCSV(item.Kriteria) : '""';
                const subKriteria = iIndex === 0 ? escapeCSV(item.Sub_Kriteria) : '""';
                const evaluasi = escapeCSV(item.Kriteria_Evaluasi);
                const ref = escapeCSV(item.Referensi_Tabel_Suplemen || '-');
                const nilai = state.nilai || "Belum Dinilai";

                csvContent += `${kriteria},${subKriteria},${evaluasi},${ref},${nilai}\n`;
            });
        });
    });

    // Ambil prediksi (bersihkan HTML tags)
    const rawStatusHtml = document.getElementById("hasilAkreditasiIabee").innerHTML;
    // Trik simpel mengekstrak teks dari string HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawStatusHtml;
    const statusText = tempDiv.innerText || tempDiv.textContent;

    csvContent += `\n"","","","PREDIKSI AKREDITASI:",${escapeCSV(statusText)}\n`;

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0,10);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Simulasi_IABEE_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==============================================================
// RIWAYAT & RESTORE SIMULASI IABEE
// ==============================================================
async function loadHistoryIabee() {
    Loading.show();
    try {
        const response = await fetch(`${GAS_AKURASI}?action=getHistory`);
        const data = await response.json();
        
        const tbody = document.getElementById("tbodyRiwayatIabee");
        tbody.innerHTML = "";
        
        // Filter: Hanya tampilkan simulasi dengan Jenis_Akreditasi === "IABEE"
        const iabeeData = data.filter(row => row.Jenis_Akreditasi === "IABEE");

        iabeeData.reverse().forEach((row, i) => {
            if (!row.ID_Simulasi) return;

            const tgl = new Date(row.Timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
            // Ubah tanda kutip satu agar tidak merusak inline HTML onClick
            const safeJson = (row.Data_Detail).replace(/'/g, "&#39;"); 

            // Pewarnaan Badge sesuai standar IABEE
            let hasilClass = "bg-secondary";
            const hasil = row.Hasil_Akreditasi || "";
            if (hasil.includes("FULL") || hasil.includes("Proyeksi")) hasilClass = "bg-success";
            else if (hasil.includes("NOT")) hasilClass = "bg-danger";
            else if (hasil.includes("INTERIM") || hasil.includes("YEARS")) hasilClass = "bg-warning text-dark"; 

            tbody.innerHTML += `
                <tr>
                    <td>${i+1}</td>
                    <td>${tgl}</td>
                    <td>${row.Email_User.split('@')[0]}</td>
                    <td class="fw-bold">${row.Nama_Simulasi}</td>
                    <td><span class="badge ${hasilClass}">${hasil}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary fw-bold" onclick='restoreSimulationIabee("${row.Jenis_Akreditasi}", ${safeJson})'>
                            <i class="bi bi-cloud-download me-1"></i> Load
                        </button>
                    </td>
                </tr>
            `;
        });
        
        new bootstrap.Modal(document.getElementById('modalRiwayatIabee')).show();
    } catch (error) {
        Swal.fire('Error', 'Gagal memuat riwayat IABEE: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

function restoreSimulationIabee(jenis, jsonData) {
    // Keamanan ekstra (Safeguard)
    if (jenis && jenis !== "IABEE") {
        Swal.fire({
            title: 'Format Tidak Sesuai', 
            text: `Anda mencoba memuat data simulasi ${jenis} ke dalam Simulator IABEE. Ditolak!`, 
            icon: 'error',
            confirmButtonColor: '#d33'
        });
        return;
    }

    try {
        iabeeState = jsonData;
        
        // Cek dan lengkapi state jika di database master ada penambahan kriteria baru
        rawIabeeData.forEach(item => {
            if (!iabeeState[item.ID_Kriteria]) {
                iabeeState[item.ID_Kriteria] = { nilai: "", deskripsi: "", link: "" };
            }
        });

        renderIabeeTable();
        bootstrap.Modal.getInstance(document.getElementById('modalRiwayatIabee')).hide();
        
        Swal.fire({
            icon: 'success', 
            title: 'Berhasil Dimuat', 
            text: 'Data evaluasi IABEE berhasil di-restore.', 
            timer: 1500, 
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Gagal', 'Format data JSON rusak.', 'error');
    }
}

// ==============================================================
// SIMPAN KE SERVER
// ==============================================================
async function saveSimulationToServerIabee() {
    const { value: namaSimulasi } = await Swal.fire({
        title: 'Simpan Simulasi IABEE',
        input: 'text',
        inputLabel: 'Beri nama untuk simulasi ini (Misal: Draft LED IABEE 2026)',
        inputPlaceholder: 'Ketik nama simulasi...',
        showCancelButton: true,
        inputValidator: (value) => { if (!value) return 'Nama simulasi tidak boleh kosong!' }
    });

    if (!namaSimulasi) return;

    // Ambil info user
    const userSession = JSON.parse(sessionStorage.getItem("user")) || { email: "admin@ugm.ac.id" };
    
    // Ambil teks status dari Prediksi Akreditasi
    const rawStatusHtml = document.getElementById("hasilAkreditasiIabee").innerHTML;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawStatusHtml;
    const statusText = tempDiv.innerText || tempDiv.textContent;

    const payload = {
        email: userSession.email,
        namaSimulasi: namaSimulasi,
        totalSkor: 0, // Set 0 karena IABEE menggunakan A/C/W/D
        hasilAkreditasi: statusText, 
        jenisAkreditasi: "IABEE", 
        jenjang: "S1", // Karena saat ini fokus IABEE hanya untuk S1
        detail: iabeeState
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

// ==============================================================
// INTEGRASI DATA LAMTEK KE IABEE
// ==============================================================
async function cekRelasiLAMTEK() {
    if (!currentIabeeId) return;

    // 1. Cek apakah ID IABEE ini ada di dalam tabel mapping
    const barisRelasi = mappingData.find(row => {
        if (!row.ID_IABEE) return false;
        // Pisahkan koma jika satu baris memuat banyak ID
        const arrIdIabee = row.ID_IABEE.toString().split(',').map(s => s.trim());
        return arrIdIabee.includes(currentIabeeId);
    });

    // 2. Jika tidak ditemukan relasi, munculkan peringatan
    if (!barisRelasi || (!barisRelasi.ID_LAMTEK_S1 && !barisRelasi.ID_LAMTEK_S2 && !barisRelasi.ID_LAMTEK_S3)) {
        Swal.fire({
            icon: 'info',
            title: 'Relasi Tidak Ditemukan',
            text: 'Kriteria Evaluasi ini tidak memiliki relasi/hubungan dengan indikator LAMTEK, atau hubungan belum didefinisikan. Definisikan terlebih dahulu di page Manajemen Komponen.',
            confirmButtonColor: '#198754'
        });
        return;
    }

    // 3. Jika ada relasi, load History Transaksi LAMTEK
    Loading.show();
    try {
        const response = await fetch(`${GAS_AKURASI}?action=getHistory`);
        const data = await response.json();
        
        const lamtekData = data.filter(row => row.Jenis_Akreditasi === "LAMTEK");
        const tbody = document.getElementById("tbodyPilihLamtek");
        tbody.innerHTML = "";

        if (lamtekData.length === 0) {
            Swal.fire('Data Kosong', 'Anda belum memiliki riwayat simulasi LAMTEK yang tersimpan.', 'warning');
            return;
        }

        // Tampilkan daftar ke dalam Modal
        lamtekData.reverse().forEach((row) => {
            if (!row.ID_Simulasi) return;
            const tgl = new Date(row.Timestamp).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
            
            let namaJenjang = row.Jenjang || "-";
            if (namaJenjang.includes("Sarjana")) namaJenjang = "S1";
            else if (namaJenjang.includes("Magister")) namaJenjang = "S2";
            else if (namaJenjang.includes("Doktor")) namaJenjang = "S3";

            // Encode data agar aman disisipkan ke dalam atribut onclick
            const safeJson = encodeURIComponent(row.Data_Detail);
            const safeRelasi = encodeURIComponent(JSON.stringify(barisRelasi));

            tbody.innerHTML += `
                <tr>
                    <td>${tgl}</td>
                    <td><span class="badge bg-secondary">${namaJenjang}</span></td>
                    <td class="fw-bold">${row.Nama_Simulasi}</td>
                    <td>
                        <button class="btn btn-sm btn-primary fw-bold" onclick="ekstrakDataLamtek('${namaJenjang}', '${safeJson}', '${safeRelasi}')">
                            <i class="bi bi-box-arrow-in-down me-1"></i> Tarik
                        </button>
                    </td>
                </tr>
            `;
        });

        // Sembunyikan modal IABEE sementara dan munculkan modal Pilih LAMTEK
        bootstrap.Modal.getInstance(document.getElementById('modalInputIabee')).hide();
        new bootstrap.Modal(document.getElementById('modalPilihSimulasiLamtek')).show();

    } catch (e) {
        Swal.fire('Error', 'Gagal memuat riwayat LAMTEK: ' + e.message, 'error');
    } finally {
        Loading.hide();
    }
}

async function ekstrakDataLamtek(jenjang, encodedJson, encodedRelasi) {
    // Tampilkan loading karena kita akan memanggil Master Data LAMTEK
    Loading.show(); 
    
    try {
        const lamtekState = JSON.parse(decodeURIComponent(encodedJson));
        const relasi = JSON.parse(decodeURIComponent(encodedRelasi));
        
        // 1. Tentukan sheet Master LAMTEK mana yang harus ditarik berdasarkan jenjang
        let targetIdsString = "";
        let sheetName = "";
        if (jenjang === "S1") {
            targetIdsString = relasi.ID_LAMTEK_S1;
            sheetName = "LAMTEK_Sarjana";
        } else if (jenjang === "S2") {
            targetIdsString = relasi.ID_LAMTEK_S2;
            sheetName = "LAMTEK_Magister";
        } else if (jenjang === "S3") {
            targetIdsString = relasi.ID_LAMTEK_S3;
            sheetName = "LAMTEK_Doktor";
        }

        if (!targetIdsString) {
            Swal.fire('Tidak Relevan', `Grup mapping ini tidak mendefinisikan relasi untuk LAMTEK ${jenjang}.`, 'error');
            Loading.hide();
            return;
        }

        // 2. Fetch data Master LAMTEK untuk mendapatkan Deskripsi_Skor_4 (Kolom K)
        const response = await fetch(`${GAS_AKURASI}?action=getMaster&sheetName=${sheetName}`);
        const masterLamtek = await response.json();

        // 3. Ekstrak data dan buat HTML-nya
        const targetIds = targetIdsString.toString().split(',').map(s => s.trim());
        let hasilEkstraksiHTML = `<ul class="mb-0 ps-3">`;
        let ditemukan = false;

        targetIds.forEach(id => {
            if (lamtekState[id]) {
                ditemukan = true;
                const dataIndikator = lamtekState[id];
                
                // Cari data master dari ID ini untuk mengambil deskripsi
                const masterInfo = masterLamtek.find(m => m.ID_Indikator === id);
                const deskripsi4 = (masterInfo && masterInfo.Deskripsi_Skor_4) 
                                    ? masterInfo.Deskripsi_Skor_4.replace(/\n/g, '<br>') 
                                    : "";

                hasilEkstraksiHTML += `<li class="mb-3">
                    <strong>[${id}]</strong> Nilai Simulasi: <span class="text-primary fw-bold">${dataIndikator.nilai.toFixed(2)}</span>`;
                
                // Ekstrak nilai variabel (NDTPS, NM, dll)
                if (dataIndikator.vars && Object.keys(dataIndikator.vars).length > 0) {
                    let varArr = [];
                    for (const [key, val] of Object.entries(dataIndikator.vars)) {
                        varArr.push(`<strong>${key}</strong> = ${val}`);
                    }
                    hasilEkstraksiHTML += `<br><span class="text-dark small">Data Pendukung: ${varArr.join(' | ')}</span>`;
                }

                // Tampilkan Kotak Keterangan Variabel (Deskripsi Skor 4)
                if (deskripsi4) {
                    hasilEkstraksiHTML += `
                    <div class="p-2 mt-1 mb-1 bg-white border border-info rounded text-muted shadow-sm" style="font-size: 0.8rem; line-height: 1.4;">
                        <strong class="text-info"><i class="bi bi-info-circle me-1"></i>Keterangan Kondisi & Variabel:</strong><br>
                        ${deskripsi4}
                    </div>`;
                }

                if (dataIndikator.link) {
                    hasilEkstraksiHTML += `<a href="${dataIndikator.link}" target="_blank" class="small text-success fw-bold text-decoration-none"><i class="bi bi-link-45deg"></i> Buka Bukti Dokumen Asli</a>`;
                }
                hasilEkstraksiHTML += `</li>`;
            }
        });
        hasilEkstraksiHTML += `</ul>`;

        if (!ditemukan) {
            hasilEkstraksiHTML = `<span class="text-danger">Indikator terkait tidak diisi/dinilai pada riwayat simulasi LAMTEK yang Anda pilih.</span>`;
        }

        // 4. Suntikkan hasil ke helper text di modal IABEE
        document.getElementById("lamtekHelperText").innerHTML = `
            Terdapat dukungan data dari simulasi LAMTEK (${jenjang}) untuk Topik: <strong class="text-dark">${relasi.Topik_Universal}</strong><br>
            <div class="mt-2">${hasilEkstraksiHTML}</div>
        `;

        // 5. Tutup modal pilihan dan buka kembali modal IABEE
        bootstrap.Modal.getInstance(document.getElementById('modalPilihSimulasiLamtek')).hide();
        new bootstrap.Modal(document.getElementById('modalInputIabee')).show();

    } catch (e) {
        Swal.fire('Error Fetch Data', 'Gagal memuat deskripsi indikator dari Master LAMTEK: ' + e.message, 'error');
    } finally {
        Loading.hide();
    }
}