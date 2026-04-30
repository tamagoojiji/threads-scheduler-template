/* threadsschedule auth gate
 * - localStorage にJWTがあるか確認
 * - 無効/未認証ならログイン画面（オーバーレイ）を表示
 * - 有効ならbodyを表示
 */
(function () {
  const BACKEND = "https://threadsschedule.tamago-ai-world.com";
  const STORAGE_KEY = "tss_auth_token";
  const VERIFY_PATH = "/auth/verify";
  const LOGIN_PATH = "/auth/discord";
  const NOTE_URL = "https://note.com/tamago_app";

  function show(el) {
    el.style.display = "";
  }
  function hide(el) {
    el.style.display = "none";
  }

  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      body.tss-locked > *:not(#tss-gate) { display: none !important; }
      #tss-gate {
        position: fixed; inset: 0; z-index: 99999;
        background: linear-gradient(135deg,#fafbff 0%,#eef0f8 100%);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Inter',system-ui,sans-serif;
      }
      #tss-gate .card {
        background:#fff; border-radius:24px; padding:48px 40px; max-width:440px;
        width: calc(100% - 32px);
        box-shadow: 0 24px 60px rgba(15,23,51,.12);
        text-align:center;
      }
      #tss-gate h1 { font-size: 22px; font-weight: 800; color:#0f1733; margin: 0 0 8px; }
      #tss-gate p { font-size: 14px; color:#3b4566; line-height:1.7; margin: 0 0 24px; }
      #tss-gate .badge { display:inline-block; padding:4px 12px; border-radius:999px;
        background:#fff5e6; color:#c65a14; font-size:11px; font-weight:700; margin-bottom:16px; letter-spacing:.04em; }
      #tss-gate .btn {
        display:inline-flex; align-items:center; justify-content:center;
        gap:8px; padding:14px 24px; border-radius:14px;
        background:#5865F2; color:#fff; font-weight:700; font-size:15px;
        text-decoration:none; transition: transform .15s ease, box-shadow .15s ease;
        width:100%; box-sizing:border-box; border:none; cursor:pointer;
      }
      #tss-gate .btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(88,101,242,.3); }
      #tss-gate .sub { margin-top:16px; font-size:12px; color:#6b7493; }
      #tss-gate .sub a { color:#1f3a6e; text-decoration:underline; }
      #tss-gate .loading { width:36px; height:36px; border:3px solid #e6e9f4; border-top-color:#5865F2;
        border-radius:50%; animation: tss-spin .8s linear infinite; margin: 0 auto 16px; }
      @keyframes tss-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  function gateHTML(state) {
    if (state === "loading") {
      return `<div class="card"><div class="loading"></div><h1>認証中...</h1><p>少々お待ちください</p></div>`;
    }
    return `
      <div class="card">
        <span class="badge">購入者限定コンテンツ</span>
        <h1>セットアップ手順書を表示するには<br>Discord認証が必要です</h1>
        <p>note でご購入後、Discordサーバーに参加し、<br>「購入者」ロール付与を受けてからログインしてください。</p>
        <button class="btn" id="tss-login">Discord でログイン</button>
        <div class="sub">
          まだご購入でない方は <a href="${NOTE_URL}" target="_blank" rel="noopener">noteで購入</a>
        </div>
      </div>
    `;
  }

  function mountGate(state) {
    let gate = document.getElementById("tss-gate");
    if (!gate) {
      gate = document.createElement("div");
      gate.id = "tss-gate";
      document.body.appendChild(gate);
    }
    gate.innerHTML = gateHTML(state);
    document.body.classList.add("tss-locked");
    if (state !== "loading") {
      const btn = document.getElementById("tss-login");
      if (btn) btn.addEventListener("click", () => {
        window.location.href = BACKEND + LOGIN_PATH;
      });
    }
  }

  function unmountGate() {
    const gate = document.getElementById("tss-gate");
    if (gate) gate.remove();
    document.body.classList.remove("tss-locked");
  }

  async function verify(token) {
    const r = await fetch(BACKEND + VERIFY_PATH, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    if (!r.ok) throw new Error("verify failed: " + r.status);
    return r.json();
  }

  async function init() {
    injectStyles();
    document.body.classList.add("tss-locked");
    mountGate("loading");

    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      mountGate("login");
      return;
    }
    try {
      await verify(token);
      unmountGate();
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      mountGate("login");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
