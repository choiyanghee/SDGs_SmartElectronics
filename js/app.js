/* ===============================
   SDGs Prosperity — Smart Electronics
   Google Sheets Connected Version
================================ */

// ⭐⭐⭐ 여기에 웹앱 URL 붙여넣기 ⭐⭐⭐
const API_URL = "https://script.google.com/u/0/home/projects/1YmgC246f3rK-WTVcJwgylngCzj0qjlt3yihh72xyHyq6gN5Pl3Nt-gJF/edit";

// ===== 상태 관리 =====
let currentUser = null;
let currentCertUser = null;
let currentFilter = 'all';
let portfolios = [];

// ===== 공통 API 호출 =====
async function api(action, payload = {}) {
    const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action, ...payload })
    });

    return await res.json();
}

// ===== 페이지 이동 =====
function navigateTo(section) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + section);
    if (page) page.classList.add('active');
}

// ===== 로그인 =====
async function loginStudent() {
    const name = document.getElementById('studentName').value.trim();
    if (!name) return alert("이름을 입력하세요");

    currentUser = name;
    localStorage.setItem("studentName", name);

    await api("addStudent", { name });

    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('portfolioSection').style.display = 'block';

    loadPortfolios();
}

// ===== 자동 로그인 =====
window.addEventListener("load", () => {
    const saved = localStorage.getItem("studentName");
    if (saved) {
        currentUser = saved;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('portfolioSection').style.display = 'block';
        loadPortfolios();
    }
});

// ===== 포트폴리오 불러오기 =====
async function loadPortfolios() {
    portfolios = await api("getPortfolios");

    const list = document.getElementById('portfolioList');
    list.innerHTML = '';

    portfolios
        .filter(p => p.student === currentUser)
        .forEach(p => {
            const div = document.createElement('div');
            div.className = "card";
            div.innerHTML = `
                <img src="${p.image}" width="120">
                <h3>${p.title}</h3>
                <p>${p.description}</p>
            `;
            list.appendChild(div);
        });
}

// ===== 이미지 업로드 처리 =====
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== 포트폴리오 저장 =====
async function savePortfolio() {
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const file = document.getElementById('image').files[0];

    if (!title || !description || !file) {
        return alert("모든 항목을 입력하세요");
    }

    const imageData = await toBase64(file);

    await api("addPortfolio", {
        student: currentUser,
        title,
        description,
        image: imageData
    });

    alert("저장되었습니다!");
    loadPortfolios();
}

// ===== 자격증 저장 =====
async function saveCertificate(certName) {
    await api("toggleCertificate", {
        student: currentCertUser,
        cert: certName
    });
}

// ===== 자격증 사용자 설정 =====
function setCertUser() {
    const name = document.getElementById('certUserName').value.trim();
    if (!name) return alert("이름 입력");

    currentCertUser = name;
    alert("설정되었습니다");
}

// ===== 관리자 로그인 =====
function adminLogin() {
    const pass = prompt("관리자 비밀번호 입력");
    if (pass === "admin1234") {
        loadAdmin();
        navigateTo('admin');
    } else {
        alert("비밀번호 오류");
    }
}

// ===== 관리자 데이터 =====
async function loadAdmin() {
    const data = await api("getAll");

    const list = document.getElementById('adminList');
    list.innerHTML = '';

    data.portfolios.forEach(p => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <strong>${p.student}</strong>
            <p>${p.title}</p>
        `;
        list.appendChild(div);
    });
}
