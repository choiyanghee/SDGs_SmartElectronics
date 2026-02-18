/* ===================================
   SDGs Prosperity — Smart Electronics
   Application Logic (Google Sheets Backend)
   =================================== */

/**
 * ✅ A기준 (권장): Google Apps Script + Google Sheets
 * - 학생/포트폴리오/자격증: Sheets에 영구 저장
 * - 사진: Drive 폴더에 저장 + 공개보기 링크로 표시
 * - 로그인 유지: localStorage
 * - 교사 관리자: 전체 목록/CSV 다운로드
 *
 * ⚠️ 설정 필요:
 * 1) 아래 API_URL을 본인 Apps Script Web App URL로 바꾸세요.
 * 2) Apps Script의 ADMIN_PASSWORD를 본인 비밀번호로 설정하세요.
 */
const API_URL = "https://script.google.com/u/0/home/projects/1YmgC246f3rK-WTVcJwgylngCzj0qjlt3yihh72xyHyq6gN5Pl3Nt-gJF/edit";

// ===== State Management =====
let currentUser = null;
let currentCertUser = null;
let currentFilter = "all";
let portfolios = [];
let adminAuthed = false;

// ===== API Helper (avoid CORS preflight by using text/plain) =====
async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes("PASTE_YOUR_APPS_SCRIPT")) {
    throw new Error("API_URL not set");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json();
  if (!data || data.ok !== true) {
    const msg = (data && data.error) ? data.error : "Unknown error";
    throw new Error(msg);
  }
  return data;
}

// ===== Navigation =====
function navigateTo(section) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const targetPage = document.getElementById("page-" + section);
  if (targetPage) targetPage.classList.add("active");

  document.querySelectorAll(".nav-links a").forEach((a) => a.classList.remove("active"));
  const activeLink = document.querySelector(`.nav-links a[data-section="${section}"]`);
  if (activeLink) activeLink.classList.add("active");

  document.getElementById("navLinks").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (section === "portfolio") loadStudentList();
  if (section === "admin") adminRestore();
}

function toggleNav() {
  document.getElementById("navLinks").classList.toggle("open");
}

window.addEventListener("scroll", () => {
  const nav = document.getElementById("mainNav");
  if (window.scrollY > 20) nav.classList.add("scrolled");
  else nav.classList.remove("scrolled");
});

// ===== Particles Animation =====
function initParticles() {
  const field = document.getElementById("particleField");
  if (!field) return;
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.animationDelay = Math.random() * 8 + "s";
    particle.style.animationDuration = 6 + Math.random() * 6 + "s";
    particle.style.width = 2 + Math.random() * 3 + "px";
    particle.style.height = particle.style.width;
    field.appendChild(particle);
  }
}

// ===== Toast Notification =====
function showToast(message) {
  const toast = document.getElementById("toast");
  document.getElementById("toastMessage").textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ===== Login persistence (Students) =====
function persistStudent(name) {
  localStorage.setItem("sdgs_student_name", name);
}
function clearPersistStudent() {
  localStorage.removeItem("sdgs_student_name");
}
function restoreStudent() {
  const name = localStorage.getItem("sdgs_student_name");
  if (name) {
    document.getElementById("studentNameInput").value = name;
    loginStudent(true).catch(() => {});
  }
}

// ===== Student List (Portfolio Section) =====
async function loadStudentList() {
  try {
    const data = await api("students.list", { limit: 100 });
    const list = document.getElementById("studentList");
    const container = document.getElementById("registeredStudents");

    if (data.students && data.students.length > 0) {
      container.style.display = "block";
      list.innerHTML = data.students
        .map(
          (s) =>
            `<span class="student-chip" onclick="quickLogin('${escapeHtml(s.name)}')">${escapeHtml(
              s.name
            )}</span>`
        )
        .join("");
    } else {
      container.style.display = "none";
    }
  } catch (e) {
    console.log("학생 목록 로드 실패:", e);
  }
}

function quickLogin(name) {
  document.getElementById("studentNameInput").value = name;
  loginStudent();
}

// ===== Portfolio Login/Logout =====
async function loginStudent(isRestore = false) {
  const name = document.getElementById("studentNameInput").value.trim();
  if (!name) {
    showToast("이름을 입력해주세요!");
    return;
  }

  currentUser = name;
  persistStudent(name);

  try {
    await api("students.ensure", { name });
  } catch (e) {
    console.log("학생 등록/확인 오류:", e);
  }

  document.getElementById("portfolioLogin").style.display = "none";
  document.getElementById("portfolioDashboard").style.display = "block";
  document.getElementById("dashboardUserName").textContent = name + "님";

  const colors = ["#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6", "#ec4899"];
  const colorIdx = name.charCodeAt(0) % colors.length;
  document.getElementById("userAvatar").style.background = `linear-gradient(135deg, ${
    colors[colorIdx]
  }, ${colors[(colorIdx + 1) % colors.length]})`;

  await loadPortfolios();
  if (!isRestore) showToast(`${name}님, 환영합니다! 🎉`);
}

function logoutStudent() {
  currentUser = null;
  currentFilter = "all";
  clearPersistStudent();
  document.getElementById("portfolioLogin").style.display = "flex";
  document.getElementById("portfolioDashboard").style.display = "none";
  document.getElementById("studentNameInput").value = "";
  loadStudentList();
}

// ===== Portfolio CRUD =====
async function loadPortfolios() {
  if (!currentUser) return;

  try {
    const data = await api("portfolios.listByStudent", { student_name: currentUser, limit: 100 });
    portfolios = data.portfolios || [];
    renderPortfolios();
  } catch (e) {
    console.log("포트폴리오 로드 실패:", e);
    portfolios = [];
    renderPortfolios();
  }
}

function renderPortfolios() {
  const grid = document.getElementById("portfolioGrid");
  const empty = document.getElementById("emptyPortfolio");

  let filtered = portfolios;
  if (currentFilter !== "all") {
    filtered = portfolios.filter((p) => p.category === currentFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = filtered
    .map((p) => {
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : "";
      const hasImage = !!p.image_url;
      return `
        <div class="portfolio-item" onclick="viewPortfolio('${p.id}')">
          <div class="portfolio-image">
            ${
              hasImage
                ? `<img src="${p.image_url}" alt="${escapeHtml(p.title)}" loading="lazy">`
                : '<i class="fas fa-image no-image"></i>'
            }
          </div>
          <div class="portfolio-info">
            <span class="portfolio-category">${escapeHtml(p.category || "")}</span>
            <h3>${escapeHtml(p.title || "제목 없음")}</h3>
            <p>${escapeHtml(p.description || "")}</p>
            <span class="portfolio-date">${dateStr}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function filterPortfolio(category, el) {
  currentFilter = category;
  document.querySelectorAll(".cat-tab").forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderPortfolios();
}

// ===== Portfolio Modal =====
function openPortfolioModal(editId) {
  const modal = document.getElementById("portfolioModal");
  modal.classList.add("show");

  if (editId) {
    const item = portfolios.find((p) => p.id === editId);
    if (item) {
      document.getElementById("modalTitle").innerHTML = '<i class="fas fa-edit"></i> 프로젝트 수정';
      document.getElementById("editPortfolioId").value = editId;
      document.getElementById("portfolioCategory").value = item.category || "";
      document.getElementById("portfolioTitle").value = item.title || "";
      document.getElementById("portfolioDescription").value = item.description || "";
      if (item.image_url) {
        document.getElementById("imagePreview").src = item.image_url;
        document.getElementById("imagePreview").style.display = "block";
        document.getElementById("uploadPlaceholder").style.display = "none";
      } else {
        document.getElementById("imagePreview").style.display = "none";
        document.getElementById("uploadPlaceholder").style.display = "block";
      }
      document.getElementById("imageInput").value = "";
    }
  } else {
    document.getElementById("modalTitle").innerHTML =
      '<i class="fas fa-plus-circle"></i> 새 프로젝트 등록';
    document.getElementById("editPortfolioId").value = "";
    document.getElementById("portfolioCategory").value = "";
    document.getElementById("portfolioTitle").value = "";
    document.getElementById("portfolioDescription").value = "";
    document.getElementById("imagePreview").style.display = "none";
    document.getElementById("uploadPlaceholder").style.display = "block";
    document.getElementById("imageInput").value = "";
  }
}

function closePortfolioModal() {
  document.getElementById("portfolioModal").classList.remove("show");
}

function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast("파일 크기는 5MB 이하여야 합니다.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const maxW = 800;
      const maxH = 600;
      let w = img.width;
      let h = img.height;

      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const resizedData = canvas.toDataURL("image/jpeg", 0.7);
      document.getElementById("imagePreview").src = resizedData;
      document.getElementById("imagePreview").style.display = "block";
      document.getElementById("uploadPlaceholder").style.display = "none";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function savePortfolio() {
  const category = document.getElementById("portfolioCategory").value;
  const title = document.getElementById("portfolioTitle").value.trim();
  const description = document.getElementById("portfolioDescription").value.trim();
  const imagePreview = document.getElementById("imagePreview");
  const editId = document.getElementById("editPortfolioId").value;

  if (!category) return showToast("카테고리를 선택해주세요!");
  if (!title) return showToast("프로젝트 제목을 입력해주세요!");
  if (!description) return showToast("진행과정을 작성해주세요!");

  const imgValue = imagePreview.style.display !== "none" ? imagePreview.src : "";

  try {
    if (editId) {
      await api("portfolios.update", {
        id: editId,
        student_name: currentUser,
        category,
        title,
        description,
        image_any: imgValue,
      });
      showToast("프로젝트가 수정되었습니다! ✏️");
    } else {
      await api("portfolios.create", {
        student_name: currentUser,
        category,
        title,
        description,
        image_any: imgValue,
      });
      showToast("프로젝트가 등록되었습니다! 🎉");
    }

    closePortfolioModal();
    await loadPortfolios();
  } catch (e) {
    if (String(e.message || "").includes("API_URL not set")) {
      showToast("API_URL 설정이 필요합니다 (app.js 상단).");
    } else {
      showToast("저장 중 오류가 발생했습니다.");
    }
    console.error(e);
  }
}

// ===== Portfolio Detail View =====
function viewPortfolio(id) {
  const item = portfolios.find((p) => p.id === id);
  if (!item) return;

  const modal = document.getElementById("detailModal");
  const title = document.getElementById("detailTitle");
  const body = document.getElementById("detailBody");
  const footer = document.getElementById("detailFooter");

  title.textContent = item.title || "제목 없음";

  const dateStr = item.created_at
    ? new Date(item.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : "";

  body.innerHTML = `
    ${item.image_url ? `<img src="${item.image_url}" alt="${escapeHtml(item.title)}" class="detail-image">` : ""}
    <div class="detail-content">
      <span class="detail-category-badge">${escapeHtml(item.category || "")}</span>
      <h3>${escapeHtml(item.title || "")}</h3>
      <div class="description">${escapeHtml(item.description || "")}</div>
      <span class="date">📅 작성일: ${dateStr}</span>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn-danger" onclick="deletePortfolio('${id}')">
      <i class="fas fa-trash-alt"></i> 삭제
    </button>
    <button class="btn-edit" onclick="closeDetailModal(); openPortfolioModal('${id}')">
      <i class="fas fa-edit"></i> 수정
    </button>
  `;

  modal.classList.add("show");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.remove("show");
}

async function deletePortfolio(id) {
  if (!confirm("정말 이 프로젝트를 삭제하시겠습니까?")) return;
  try {
    await api("portfolios.delete", { id });
    showToast("프로젝트가 삭제되었습니다.");
    closeDetailModal();
    await loadPortfolios();
  } catch (e) {
    showToast("삭제 중 오류가 발생했습니다.");
  }
}

// ===== Certificate Section =====
const CERT_LIST = [
  { name: "전자캐드기능사", icon: "fas fa-drafting-compass", desc: "전자회로 CAD 설계 능력 인증" },
  { name: "전자기능사", icon: "fas fa-bolt", desc: "전자부품 및 회로 기초 실무 능력" },
  { name: "임베디드기능사", icon: "fas fa-microchip", desc: "임베디드 시스템 개발 능력 인증" },
  { name: "전기기능사", icon: "fas fa-plug", desc: "전기설비 시공 및 유지보수 능력" },
  { name: "프로그래밍기능사", icon: "fas fa-code", desc: "소프트웨어 프로그래밍 능력 인증" },
  { name: "컴퓨터활용능력", icon: "fas fa-laptop", desc: "컴퓨터 활용 및 데이터 처리 능력" },
  { name: "ITQ", icon: "fas fa-file-alt", desc: "정보기술 자격 (한글/엑셀/파워포인트)" },
];

function persistCert(name){ localStorage.setItem("sdgs_cert_name", name); }
function clearPersistCert(){ localStorage.removeItem("sdgs_cert_name"); }
function restoreCert(){
  const name = localStorage.getItem("sdgs_cert_name");
  if(name){
    document.getElementById("certNameInput").value = name;
    loginCert(true).catch(()=>{});
  }
}

async function loginCert(isRestore=false) {
  const name = document.getElementById("certNameInput").value.trim();
  if (!name) return showToast("이름을 입력해주세요!");

  currentCertUser = name;
  persistCert(name);

  document.getElementById("certLogin").style.display = "none";
  document.getElementById("certDashboard").style.display = "block";
  document.getElementById("certUserName").textContent = name;

  await loadCertificates();
  if(!isRestore) showToast(`${name}님의 자격증 현황을 불러왔습니다.`);
}

function logoutCert() {
  currentCertUser = null;
  clearPersistCert();
  document.getElementById("certLogin").style.display = "flex";
  document.getElementById("certDashboard").style.display = "none";
  document.getElementById("certNameInput").value = "";
}

async function loadCertificates() {
  if (!currentCertUser) return;

  let userCerts = [];
  try {
    const data = await api("certs.listByStudent", { student_name: currentCertUser });
    userCerts = data.certificates || [];
  } catch (e) {
    console.log("자격증 로드 실패:", e);
  }
  renderCertificates(userCerts);
}

function renderCertificates(userCerts) {
  const grid = document.getElementById("certGrid");
  let obtainedCount = 0;

  grid.innerHTML = CERT_LIST.map((cert) => {
    const userCert = userCerts.find((c) => c.cert_name === cert.name);
    const isObtained = !!(userCert && userCert.obtained);
    const obtainedDate = userCert ? userCert.obtained_date || "" : "";
    const certId = userCert ? userCert.id : null;

    if (isObtained) obtainedCount++;

    return `
      <div class="cert-card ${isObtained ? "obtained" : ""}"
           onclick="toggleCert('${cert.name}', ${isObtained ? "true" : "false"}, '${certId || ""}')">
        <div class="cert-checkbox"><i class="fas fa-check"></i></div>
        <div class="cert-details">
          <h3><i class="${cert.icon}" style="margin-right:6px; opacity:0.6;"></i>${cert.name}</h3>
          <p>${cert.desc}</p>
          ${
            isObtained && obtainedDate
              ? `<p style="color: #4ade80; margin-top: 4px; font-size: 0.78rem;">📅 취득일: ${obtainedDate}</p>`
              : ""
          }
          ${
            !isObtained
              ? `<input type="text" class="cert-date-input" placeholder="취득일 (예: 2026-03-15)"
                 onclick="event.stopPropagation()" id="date-${cert.name.replace(/\\s/g, "")}">`
              : ""
          }
        </div>
      </div>
    `;
  }).join("");

  const total = CERT_LIST.length;
  document.getElementById("certObtained").textContent = obtainedCount;
  document.getElementById("certRemaining").textContent = total - obtainedCount;
  const pct = Math.round((obtainedCount / total) * 100);
  document.getElementById("certProgress").style.width = pct + "%";
  document.getElementById("certPercentage").textContent = pct + "%";
}

async function toggleCert(certName, isCurrentlyObtained, certId) {
  if (!currentCertUser) return;

  try {
    if (isCurrentlyObtained && certId) {
      await api("certs.delete", { id: certId });
      showToast(`${certName} 취득이 취소되었습니다.`);
    } else {
      const dateInput = document.getElementById("date-" + certName.replace(/\\s/g, ""));
      const dateVal = dateInput ? dateInput.value.trim() : "";
      await api("certs.upsert", {
        student_name: currentCertUser,
        cert_name: certName,
        obtained: true,
        obtained_date: dateVal || new Date().toISOString().split("T")[0],
      });
      showToast(`🎉 ${certName} 취득을 축하합니다!`);
    }
    await loadCertificates();
  } catch (e) {
    showToast("처리 중 오류가 발생했습니다.");
    console.error(e);
  }
}

// ===== Admin =====
function persistAdmin(token){ localStorage.setItem("sdgs_admin_token", token); }
function clearPersistAdmin(){ localStorage.removeItem("sdgs_admin_token"); }
function getPersistAdmin(){ return localStorage.getItem("sdgs_admin_token"); }

async function adminLogin(){
  const pass = document.getElementById("adminPassInput").value;
  if(!pass) return showToast("비밀번호를 입력해주세요!");
  try{
    const data = await api("admin.login", { password: pass });
    adminAuthed = true;
    persistAdmin(data.token || "ok");
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    showToast("관리자 로그인 성공");
    await adminRefresh();
  }catch(e){
    showToast("비밀번호가 올바르지 않습니다.");
  }
}

function adminLogout(){
  adminAuthed = false;
  clearPersistAdmin();
  document.getElementById("adminPassInput").value = "";
  document.getElementById("adminLogin").style.display = "flex";
  document.getElementById("adminDashboard").style.display = "none";
  showToast("로그아웃");
}

async function adminRestore(){
  const token = getPersistAdmin();
  if(token){
    adminAuthed = true;
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    await adminRefresh().catch(()=>{});
  }else{
    document.getElementById("adminLogin").style.display = "flex";
    document.getElementById("adminDashboard").style.display = "none";
  }
}

async function adminRefresh(){
  if(!adminAuthed) return;
  try{
    const [pData, cData] = await Promise.all([
      api("admin.portfolios.list", {}),
      api("admin.certs.list", {}),
    ]);

    const pb = document.getElementById("adminPortfolioBody");
    pb.innerHTML = (pData.portfolios || []).map(p=>{
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString("ko-KR") : "";
      const imgCell = p.image_url ? `<a class="admin-link" href="${p.image_url}" target="_blank">보기</a>` : '<span class="admin-mini">없음</span>';
      return `
        <tr>
          <td>${escapeHtml(p.student_name || "")}</td>
          <td>${escapeHtml(p.category || "")}</td>
          <td>
            <div>${escapeHtml(p.title || "")}</div>
            <div class="admin-mini">${escapeHtml((p.description || "").slice(0, 80))}${(p.description||"").length>80?"…":""}</div>
          </td>
          <td>${dateStr}</td>
          <td>${imgCell}</td>
          <td>
            <button class="btn-danger btn-small" onclick="adminDeletePortfolio('${p.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join("");

    const cb = document.getElementById("adminCertBody");
    cb.innerHTML = (cData.certificates || []).map(c=>{
      const status = c.obtained ? '<span class="admin-badge"><i class="fas fa-check"></i>취득</span>' : '<span class="admin-mini">미취득</span>';
      return `
        <tr>
          <td>${escapeHtml(c.student_name || "")}</td>
          <td>${escapeHtml(c.cert_name || "")}</td>
          <td>${escapeHtml(c.obtained_date || "")}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join("");

  }catch(e){
    console.error(e);
    showToast("관리자 데이터 로드 실패");
  }
}

async function adminDeletePortfolio(id){
  if(!confirm("이 포트폴리오를 삭제할까요?")) return;
  try{
    await api("admin.portfolios.delete", { id });
    showToast("삭제 완료");
    await adminRefresh();
  }catch(e){
    showToast("삭제 실패");
  }
}

async function adminDownload(kind){
  // kind: portfolios | certificates
  try{
    const data = await api("admin.export", { kind });
    const b64 = data.csv_base64 || "";
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(e){
    showToast("CSV 다운로드 실패");
  }
}

// ===== Utility =====
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== Close modals on overlay click =====
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("modal-overlay") && e.target.classList.contains("show")) {
    e.target.classList.remove("show");
  }
});

// ===== Keyboard shortcuts =====
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.show").forEach((m) => m.classList.remove("show"));
  }
});

// ===== Init =====
document.addEventListener("DOMContentLoaded", function () {
  initParticles();
  restoreStudent();
  restoreCert();
});
