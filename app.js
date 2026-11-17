(function () {
  "use strict";

  var ADMIN_PIN_SESSION_KEY = "car_ins_admin_pin";

  var state = {
    isDemo: false,
    inLiffClient: false,
    accessToken: null,
    lineEmail: "",
    isAdmin: false,
    adminPin: sessionStorage.getItem(ADMIN_PIN_SESSION_KEY) || "",
    view: "loading", // loading | link | wallet | admin
    linkMode: "plate", // plate | id4
    wallet: {
      customer: null,
      policies: [],
      selectedIndex: 0
    },
    admin: {
      results: [],
      insurers: [],
      coverageClasses: ["ชั้น 1", "2+", "3+", "ชั้น 3", "พ.ร.บ."],
      garageTypes: ["ซ่อมห้าง", "ซ่อมอู่"],
      policyPdfBase64: null,
      prbPdfBase64: null
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanTel(phone) {
    return String(phone || "").replace(/[^0-9+*#]/g, "");
  }

  var toastTimer = null;
  function showToast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 2600);
  }

  function showModal(title, body, linkHref, linkText) {
    $("modalTitle").textContent = title;
    $("modalBody").textContent = body;
    var linkEl = $("modalPrimaryLink");
    if (linkHref) {
      linkEl.href = linkHref;
      linkEl.textContent = linkText || "เปิดลิงก์";
      linkEl.classList.remove("hidden");
    } else {
      linkEl.classList.add("hidden");
    }
    $("appModal").classList.remove("hidden");
  }

  function hideModal() {
    $("appModal").classList.add("hidden");
  }

  function setGlobalAlert(msg) {
    var el = $("globalAlert");
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
    } else {
      el.textContent = msg;
      el.classList.remove("hidden");
    }
  }

  function setView(viewName) {
    state.view = viewName;
    ["viewLoading", "viewLink", "viewWallet", "viewAdmin"].forEach(function (id) {
      $(id).classList.add("hidden");
    });
    var map = {
      loading: "viewLoading",
      link: "viewLink",
      wallet: "viewWallet",
      admin: "viewAdmin"
    };
    $(map[viewName]).classList.remove("hidden");

    var shell = $("appShell");
    var toggleBtn = $("btnToggleMode");
    if (viewName === "admin") {
      shell.classList.add("admin-wide");
      toggleBtn.textContent = "🛡️ กลับหน้ากระเป๋า";
    } else {
      shell.classList.remove("admin-wide");
      toggleBtn.textContent = "🔐 โหมดแอดมิน";
    }

    syncDemoTabs();
  }

  function syncDemoTabs() {
    if (!state.isDemo) return;
    var tabs = document.querySelectorAll(".demo-tab");
    tabs.forEach(function (btn) {
      var target = btn.getAttribute("data-demo-view");
      btn.classList.toggle("active", target === state.view);
    });
  }

  function getAuth() {
    return {
      useMock: state.isDemo,
      accessToken: state.accessToken,
      adminPin: state.adminPin
    };
  }

  /* ======================== LIFF INIT & BOOTSTRAP ======================== */
  async function initApp() {
    setView("loading");
    var usePlaceholder = window.GasApi.isPlaceholderConfig();

    if (usePlaceholder) {
      state.isDemo = true;
      $("demoBar").classList.remove("hidden");
      $("demoLinkHint").classList.remove("hidden");
      $("brandSub").textContent = "Demo Preview Mode";
      await loadWallet();
      return;
    }

    try {
      await liff.init({ liffId: window.APP_CONFIG.LIFF_ID });
      state.inLiffClient = liff.isInClient();

      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      state.accessToken = liff.getAccessToken();
      try {
        var decoded = liff.getDecodedIDToken();
        if (decoded && decoded.email) state.lineEmail = decoded.email;
      } catch (e) {}
      await loadWallet();
    } catch (err) {
      setGlobalAlert("ไม่สามารถเชื่อมต่อ LINE LIFF ได้: " + (err.message || err));
      setView("link");
    }
  }

  async function loadWallet() {
    setGlobalAlert("");
    setView("loading");
    try {
      var res = await window.GasApi.request("get_my_wallet", {}, getAuth());
      if (!res.ok) {
        setGlobalAlert(window.GasApi.mapErrorMessage(res));
        setView("link");
        return;
      }

      state.isAdmin = Boolean(res.is_admin);
      if (!res.linked) {
        if (state.lineEmail && !$("linkEmail").value) {
          $("linkEmail").value = state.lineEmail;
        }
        setView("link");
        return;
      }

      state.wallet.customer = res.customer;
      state.wallet.policies = res.policies || [];
      state.wallet.selectedIndex = 0;
      renderWallet();
      setView("wallet");
    } catch (err) {
      setGlobalAlert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setView("link");
    }
  }

  /* ======================== POLICY LINKING VIEW ======================== */
  function setLinkMode(mode) {
    state.linkMode = mode;
    document.querySelectorAll("[data-link-mode]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-link-mode") === mode);
    });
    if (mode === "plate") {
      $("linkPlateGroup").classList.remove("hidden");
      $("linkId4Group").classList.add("hidden");
    } else {
      $("linkPlateGroup").classList.add("hidden");
      $("linkId4Group").classList.remove("hidden");
    }
  }

  async function handleLinkSubmit(e) {
    e.preventDefault();
    var errBox = $("linkError");
    errBox.classList.add("hidden");

    var phone = $("linkPhone").value.trim();
    var digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 10) {
      errBox.textContent = "กรุณากรอกเบอร์โทรศัพท์ 9–10 หลักให้ถูกต้อง";
      errBox.classList.remove("hidden");
      return;
    }

    var email = $("linkEmail").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errBox.textContent = "กรุณากรอกอีเมลให้ถูกต้อง";
      errBox.classList.remove("hidden");
      return;
    }

    var params = { phone: phone, email: email };
    if (state.linkMode === "plate") {
      var plate = $("linkPlate").value.trim();
      if (!plate) {
        errBox.textContent = "กรุณากรอกเลขทะเบียนรถ";
        errBox.classList.remove("hidden");
        return;
      }
      params.license_plate = plate;
    } else {
      var id4 = $("linkId4").value.trim();
      if (!/^\d{4}$/.test(id4)) {
        errBox.textContent = "กรุณากรอกเลขบัตรประชาชน 4 ตัวท้ายให้ครบ 4 หลัก";
        errBox.classList.remove("hidden");
        return;
      }
      params.id_last4 = id4;
    }

    var btn = $("btnLinkSubmit");
    btn.disabled = true;
    btn.textContent = "กำลังตรวจสอบข้อมูล...";

    try {
      var res = await window.GasApi.request("link_account", params, getAuth());
      if (!res.ok) {
        errBox.textContent = window.GasApi.mapErrorMessage(res);
        errBox.classList.remove("hidden");
        return;
      }
      showToast("ผูกบัญชีสำเร็จ (" + (res.matched_policies || 1) + " กรมธรรม์)");
      await loadWallet();
    } catch (err) {
      errBox.textContent = "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่";
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "ยืนยันและเปิดกระเป๋ากรมธรรม์";
    }
  }

  /* ======================== DIGITAL POLICY WALLET ======================== */
  function badgeInfo(policy) {
    var b = policy.status_badge || "active";
    var d = policy.days_left;
    if (b === "cancelled") return { cls: "badge-cancelled", text: "ยกเลิกกรมธรรม์" };
    if (b === "expired") {
      var over = typeof d === "number" ? " (" + Math.abs(d) + " วัน)" : "";
      return { cls: "badge-expired", text: "หมดอายุแล้ว" + over };
    }
    if (b === "expiring") {
      var rem = typeof d === "number" ? "อีก " + d + " วัน" : "เร็วๆ นี้";
      return { cls: "badge-expiring", text: "ใกล้หมดอายุ • " + rem };
    }
    var left = typeof d === "number" ? " • เหลือ " + d + " วัน" : "";
    return { cls: "badge-active", text: "คุ้มครองปกติ" + left };
  }

  function renderWallet() {
    var customer = state.wallet.customer || {};
    var policies = state.wallet.policies || [];
    $("walletCustomerName").textContent = customer.full_name || "-";
    $("walletCarCount").textContent = policies.length + " คันในระบบ";

    var tabsEl = $("carTabs");
    if (policies.length === 0) {
      tabsEl.innerHTML = "";
      $("policyHero").innerHTML = '<div style="text-align:center; padding: 20px;">ยังไม่มีข้อมูลกรมธรรม์ในระบบ</div>';
      return;
    }

    tabsEl.innerHTML = policies
      .map(function (p, idx) {
        var activeCls = idx === state.wallet.selectedIndex ? " active" : "";
        return (
          '<button type="button" class="car-tab' + activeCls + '" data-car-idx="' + idx + '">' +
          '<span class="car-tab-plate">' + escapeHtml(p.license_plate) + "</span>" +
          '<span class="car-tab-sub">' + escapeHtml(p.car_brand_model || p.insurer_name || "-") + "</span>" +
          "</button>"
        );
      })
      .join("");

    tabsEl.querySelectorAll(".car-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.wallet.selectedIndex = Number(btn.getAttribute("data-car-idx"));
        renderWallet();
      });
    });

    var p = policies[state.wallet.selectedIndex] || policies[0];
    var badge = badgeInfo(p);

    $("policyHero").innerHTML =
      '<div class="policy-hero-top">' +
        '<div>' +
          '<span class="plate-pill">' + escapeHtml(p.license_plate) + "</span>" +
          (p.province ? '<span class="plate-province" style="color:#e2e8f0; margin-top:4px;">' + escapeHtml(p.province) + "</span>" : "") +
        "</div>" +
        '<span class="status-badge ' + badge.cls + '">' + escapeHtml(badge.text) + "</span>" +
      "</div>" +
      '<div class="hero-insurer">' + escapeHtml(p.insurer_name || "ไม่ระบุบริษัทประกัน") + "</div>" +
      '<div class="hero-car">' + escapeHtml(p.car_brand_model || "-") + "</div>" +
      '<div class="hero-chips">' +
        (p.coverage_class ? '<span class="hero-chip">' + escapeHtml(p.coverage_class) + "</span>" : "") +
        (p.garage_type ? '<span class="hero-chip">' + escapeHtml(p.garage_type) + "</span>" : "") +
      "</div>" +
      '<div class="policy-no-box">' +
        '<div>' +
          '<div class="policy-no-label">เลขที่กรมธรรม์</div>' +
          '<div class="policy-no-val">' + escapeHtml(p.policy_number || "-") + "</div>" +
        "</div>" +
        (p.policy_number
          ? '<button type="button" class="btn-copy" id="btnCopyPolicyNo">📋 คัดลอก</button>'
          : "") +
      "</div>" +
      '<div class="hero-dates">' +
        "<span>เริ่ม: " + escapeHtml(p.start_date || "-") + "</span>" +
        "<span>หมดอายุ: <strong>" + escapeHtml(p.end_date || "-") + "</strong></span>" +
      "</div>";

    var copyBtn = $("btnCopyPolicyNo");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyText(p.policy_number, "คัดลอกเลขกรมธรรม์แล้ว: " + p.policy_number);
      });
    }

    // SOS Claim Hotline (Hide if empty!)
    var sosBtn = $("btnSosCall");
    if (p.claim_hotline_24h && cleanTel(p.claim_hotline_24h)) {
      sosBtn.href = "tel:" + cleanTel(p.claim_hotline_24h);
      $("sosPhoneText").textContent = p.claim_hotline_24h;
      sosBtn.classList.remove("hidden");
    } else {
      sosBtn.classList.add("hidden");
    }

    // Roadside Assistance (Hide if empty!)
    var roadBtn = $("btnRoadsideCall");
    if (p.roadside_phone && cleanTel(p.roadside_phone)) {
      roadBtn.href = "tel:" + cleanTel(p.roadside_phone);
      $("roadsidePhoneText").textContent = p.roadside_phone;
      roadBtn.classList.remove("hidden");
    } else {
      roadBtn.classList.add("hidden");
    }

    // Claim instructions
    var tipBox = $("claimTipBox");
    if (p.claim_instructions) {
      tipBox.textContent = "📌 คำแนะนำเมื่อเกิดเหตุ: " + p.claim_instructions;
      tipBox.classList.remove("hidden");
    } else {
      tipBox.classList.add("hidden");
    }

    // PDF Buttons
    var btnPolPdf = $("btnDownloadPolicy");
    var btnPrbPdf = $("btnDownloadPrb");
    btnPolPdf.disabled = !p.has_policy_pdf;
    btnPolPdf.textContent = p.has_policy_pdf ? "📄 ดาวน์โหลดกรมธรรม์ PDF" : "ไม่มีไฟล์กรมธรรม์";
    btnPrbPdf.disabled = !p.has_prb_pdf;
    btnPrbPdf.textContent = p.has_prb_pdf ? "📄 ดาวน์โหลด พ.ร.บ. PDF" : "ไม่มีไฟล์ พ.ร.บ.";

    // Details list
    $("policyDetailsList").innerHTML =
      detailRow("เลขที่ พ.ร.บ.", p.prb_number || "-") +
      detailRow("วันเริ่มคุ้มครอง", p.start_date || "-") +
      detailRow("วันหมดอายุ", p.end_date || "-") +
      detailRow("รหัสอ้างอิงกรมธรรม์", p.policy_id || "-");
  }

  function detailRow(k, v) {
    return (
      '<div class="detail-row">' +
      '<span class="detail-key">' + escapeHtml(k) + "</span>" +
      '<span class="detail-val">' + escapeHtml(v) + "</span>" +
      "</div>"
    );
  }

  function copyText(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast(successMsg);
        },
        function () {
          fallbackCopy(text, successMsg);
        }
      );
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast(successMsg);
    } catch (e) {
      showToast("ไม่สามารถคัดลอกอัตโนมัติได้: " + text);
    }
    document.body.removeChild(ta);
  }

  async function handleDownloadPdf(kind) {
    var p = state.wallet.policies[state.wallet.selectedIndex];
    if (!p) return;
    var btn = kind === "prb" ? $("btnDownloadPrb") : $("btnDownloadPolicy");
    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "กำลังดึงไฟล์จากตู้นิรภัย...";

    try {
      var res = await window.GasApi.request(
        "download_pdf",
        { policy_id: p.policy_id, kind: kind },
        getAuth()
      );
      if (!res.ok) {
        showToast(window.GasApi.mapErrorMessage(res));
        return;
      }
      var blobUrl = window.GasApi.triggerPdfDownload(res.base64, res.filename, res.mimeType);
      showModal(
        "ดึงไฟล์ PDF สำเร็จ",
        "ระบบกำลังดาวน์โหลดไฟล์: " + (res.filename || "document.pdf") + "\nหากเบราว์เซอร์บนมือถือไม่เปิดอัตโนมัติ สามารถกดปุ่มด้านล่างเพื่อเปิดดูได้ทันที",
        blobUrl,
        "เปิดดูไฟล์ PDF"
      );
    } catch (err) {
      showToast("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  async function handlePushToReply() {
    var p = state.wallet.policies[state.wallet.selectedIndex];
    if (!p) return;
    var msg = "ขอเช็กเบี้ยต่ออายุ/ปรึกษาข้อมูลรถทะเบียน " + p.license_plate + " (รหัส " + p.policy_id + ")";

    if (state.inLiffClient && typeof liff !== "undefined") {
      try {
        await liff.sendMessages([{ type: "text", text: msg }]);
        liff.closeWindow();
        return;
      } catch (err) {
        showToast("ส่งข้อความเข้าห้องแชทไม่สำเร็จ: " + (err.message || "โปรดลองใหม่"));
        return;
      }
    }

    copyText(msg, "คัดลอกข้อความแล้ว");
    showModal(
      "Push-to-Reply (ส่งเข้าห้องแชทฟรี)",
      "เมื่อเปิดในแอป LINE ปุ่มนี้จะส่งข้อความด้านล่างเข้าห้องแชทให้อัตโนมัติเพื่อให้ AI/แอดมินตอบกลับฟรีโดยไม่เสียโควต้า:\n\n\"" + msg + "\""
    );
  }

  /* ======================== ADMIN PORTAL ======================== */
  async function openAdminPortal() {
    setView("admin");
    if (state.isDemo || state.isAdmin || state.adminPin) {
      $("adminPinCard").classList.add("hidden");
      $("adminWorkspace").classList.remove("hidden");
      $("btnAdminLogout").classList.toggle("hidden", !state.adminPin);
      await runAdminSearch();
    } else {
      $("adminPinCard").classList.remove("hidden");
      $("adminWorkspace").classList.add("hidden");
    }
  }

  async function handleAdminPinSubmit(e) {
    e.preventDefault();
    var errBox = $("adminPinError");
    errBox.classList.add("hidden");
    var pin = $("adminPinInput").value.trim();
    if (!pin) return;

    var btn = $("btnAdminPinSubmit");
    btn.disabled = true;
    btn.textContent = "กำลังตรวจสอบ PIN...";
    state.adminPin = pin;

    try {
      var res = await window.GasApi.request("admin_search", { query: "" }, getAuth());
      if (!res.ok) {
        state.adminPin = "";
        errBox.textContent = window.GasApi.mapErrorMessage(res);
        errBox.classList.remove("hidden");
        return;
      }
      sessionStorage.setItem(ADMIN_PIN_SESSION_KEY, pin);
      $("adminPinCard").classList.add("hidden");
      $("adminWorkspace").classList.remove("hidden");
      $("btnAdminLogout").classList.remove("hidden");
      applyAdminSearchResponse(res);
    } catch (err) {
      state.adminPin = "";
      errBox.textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ";
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "เข้าสู่ระบบแอดมิน";
    }
  }

  async function runAdminSearch(e) {
    if (e) e.preventDefault();
    var query = $("adminSearchInput").value.trim();
    $("adminSearchStatus").textContent = "กำลังค้นหาข้อมูล...";
    try {
      var res = await window.GasApi.request("admin_search", { query: query }, getAuth());
      if (!res.ok) {
        $("adminSearchStatus").textContent = window.GasApi.mapErrorMessage(res);
        return;
      }
      applyAdminSearchResponse(res);
    } catch (err) {
      $("adminSearchStatus").textContent = "เกิดข้อผิดพลาดในการค้นหา";
    }
  }

  function applyAdminSearchResponse(res) {
    state.admin.results = res.results || [];
    state.admin.insurers = res.insurers || [];
    if (res.coverage_classes && res.coverage_classes.length) {
      state.admin.coverageClasses = res.coverage_classes;
    }
    if (res.garage_types && res.garage_types.length) {
      state.admin.garageTypes = res.garage_types;
    }
    populateAdminDropdowns();
    renderAdminResults();
  }

  function populateAdminDropdowns() {
    var insSelect = $("fInsurer");
    var currentIns = insSelect.value;
    var options = state.admin.insurers
      .map(function (i) {
        return '<option value="' + escapeHtml(i.insurer_name) + '">' + escapeHtml(i.insurer_name) + "</option>";
      })
      .join("");
    insSelect.innerHTML = '<option value="">-- เลือกบริษัทประกัน --</option>' + options;
    if (currentIns) insSelect.value = currentIns;

    $("fCoverageClass").innerHTML = state.admin.coverageClasses
      .map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; })
      .join("");

    $("fGarageType").innerHTML = state.admin.garageTypes
      .map(function (g) { return '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>"; })
      .join("");
  }

  function renderAdminResults() {
    var list = state.admin.results;
    $("adminSearchStatus").textContent = "พบข้อมูลลูกค้า " + list.length + " ราย";
    var container = $("adminResultsList");

    if (list.length === 0) {
      container.innerHTML = '<div class="card" style="text-align:center; color:var(--text-light);">ไม่พบข้อมูลที่ค้นหา</div>';
      return;
    }

    container.innerHTML = list
      .map(function (entry, rIdx) {
        var c = entry.customer;
        var pols = entry.policies || [];
        var isAuto = c.bot_mode !== "manual";
        var botLabel = isAuto ? "🤖 AI ตอบอัตโนมัติ" : "👤 แอดมินคุยเอง";
        var botCls = isAuto ? "is-auto" : "is-manual";

        var polHtml = pols
          .map(function (p, pIdx) {
            var pdfTags =
              (p.has_policy_pdf ? " ✅PDFกรมธรรม์" : " ⚠️ขาดPDF") +
              (p.has_prb_pdf ? " ✅พ.ร.บ." : "");
            return (
              '<div class="admin-policy-item">' +
                '<div>' +
                  '<div style="font-weight:700; font-size:15px;">' + escapeHtml(p.license_plate) + " • " + escapeHtml(p.insurer_name || "-") + "</div>" +
                  '<div style="font-size:12px; color:var(--text-light);">' +
                    escapeHtml(p.coverage_class || "-") + " | หมดอายุ: " + escapeHtml(p.end_date || "-") + pdfTags +
                  "</div>" +
                "</div>" +
                '<button type="button" class="btn btn-outline btn-sm" data-edit-pol="' + rIdx + ":" + pIdx + '">✏️ แก้ไข / อัปโหลด PDF</button>' +
              "</div>"
            );
          })
          .join("");

        return (
          '<div class="admin-customer-card">' +
            '<div class="admin-customer-head">' +
              '<div>' +
                '<div style="font-weight:800; font-size:16px;">' + escapeHtml(c.full_name) +
                  (c.linked ? ' <span style="font-size:11px; color:var(--success);">(ผูก LINE แล้ว)</span>' : ' <span style="font-size:11px; color:var(--text-light);">(ยังไม่ผูก LINE)</span>') +
                "</div>" +
                '<div style="font-size:13px; color:var(--text-muted);">📞 ' + escapeHtml(c.phone) + " • รหัส " + escapeHtml(c.customer_id) + "</div>" +
              "</div>" +
              '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                '<button type="button" class="bot-toggle ' + botCls + '" data-toggle-bot="' + escapeHtml(c.customer_id) + '" data-cur-mode="' + (isAuto ? "auto" : "manual") + '">' +
                  botLabel +
                "</button>" +
                '<button type="button" class="btn btn-outline btn-sm" data-add-car="' + rIdx + '">+ เพิ่มรถ</button>' +
              "</div>" +
            "</div>" +
            polHtml +
          "</div>"
        );
      })
      .join("");

    container.querySelectorAll("[data-toggle-bot]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleBotMode(btn.getAttribute("data-toggle-bot"), btn.getAttribute("data-cur-mode"));
      });
    });

    container.querySelectorAll("[data-add-car]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = Number(btn.getAttribute("data-add-car"));
        openAdminForm(list[idx].customer, null);
      });
    });

    container.querySelectorAll("[data-edit-pol]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var parts = btn.getAttribute("data-edit-pol").split(":");
        var rec = list[Number(parts[0])];
        var pol = rec.policies[Number(parts[1])];
        openAdminForm(rec.customer, pol);
      });
    });
  }

  async function toggleBotMode(customerId, curMode) {
    var nextMode = curMode === "auto" ? "manual" : "auto";
    try {
      var res = await window.GasApi.request(
        "admin_toggle_bot",
        { customer_id: customerId, bot_mode: nextMode },
        getAuth()
      );
      if (!res.ok) {
        showToast(window.GasApi.mapErrorMessage(res));
        return;
      }
      showToast(res.bot_mode === "auto" ? "เปลี่ยนเป็นโหมด AI ตอบอัตโนมัติแล้ว" : "เปลี่ยนเป็นโหมดแอดมินคุยเองแล้ว");
      await runAdminSearch();
    } catch (err) {
      showToast("สลับโหมดบอทไม่สำเร็จ");
    }
  }

  function resetPdfSelection(kind) {
    if (kind === "policy" || kind === "all") {
      state.admin.policyPdfBase64 = null;
      $("filePolicy").value = "";
      $("dzPolicyChip").classList.add("hidden");
      $("dzPolicyChip").textContent = "";
    }
    if (kind === "prb" || kind === "all") {
      state.admin.prbPdfBase64 = null;
      $("filePrb").value = "";
      $("dzPrbChip").classList.add("hidden");
      $("dzPrbChip").textContent = "";
    }
  }

  function openAdminForm(customer, policy) {
    $("adminFormError").classList.add("hidden");
    resetPdfSelection("all");
    populateAdminDropdowns();

    $("adminFormTitle").textContent = policy
      ? "แก้ไขกรมธรรม์ (" + policy.license_plate + ")"
      : customer
      ? "เพิ่มรถใหม่ให้คุณ " + customer.full_name
      : "เพิ่มลูกค้าและกรมธรรม์ใหม่";

    $("fCustomerId").value = customer ? customer.customer_id || "" : "";
    $("fFullName").value = customer ? customer.full_name || "" : "";
    $("fPhone").value = customer ? customer.phone || "" : "";
    $("fIdLast4").value = customer ? customer.id_last4 || "" : "";
    $("fEmail").value = customer ? customer.email || "" : "";
    $("fAdminNote").value = customer ? customer.admin_note || "" : "";

    $("fPolicyId").value = policy ? policy.policy_id || "" : "";
    $("fLicensePlate").value = policy ? policy.license_plate || "" : "";
    $("fProvince").value = policy ? policy.province || "" : "";
    $("fCarModel").value = policy ? policy.car_brand_model || "" : "";
    $("fInsurer").value = policy ? policy.insurer_name || "" : "";
    $("fCoverageClass").value = policy ? policy.coverage_class || "ชั้น 1" : "ชั้น 1";
    $("fGarageType").value = policy ? policy.garage_type || "ซ่อมห้าง" : "ซ่อมห้าง";
    $("fPolicyNo").value = policy ? policy.policy_number || "" : "";
    $("fPrbNo").value = policy ? policy.prb_number || "" : "";
    $("fStartDate").value = policy ? policy.start_date || "" : "";
    $("fEndDate").value = policy ? policy.end_date || "" : "";
    $("fPolicyStatus").value = policy ? policy.policy_status || "active" : "active";

    $("adminFormCard").classList.remove("hidden");
    $("adminFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setupDropzone(dzId, inputId, chipId, kind) {
    var dz = $(dzId);
    var input = $(inputId);
    var chip = $(chipId);

    async function handleFile(file) {
      if (!file) return;
      try {
        var b64 = await window.GasApi.validateAndReadPdfBase64(file);
        if (kind === "policy") state.admin.policyPdfBase64 = b64;
        else state.admin.prbPdfBase64 = b64;
        var kb = Math.round(file.size / 1024);
        chip.textContent = "✅ " + file.name + " (" + kb + " KB)";
        chip.classList.remove("hidden");
      } catch (err) {
        resetPdfSelection(kind);
        showToast(err.message);
      }
    }

    dz.addEventListener("click", function () {
      input.click();
    });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });
    dz.addEventListener("dragover", function (e) {
      e.preventDefault();
      dz.classList.add("dragover");
    });
    dz.addEventListener("dragleave", function () {
      dz.classList.remove("dragover");
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      dz.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  async function handleAdminUpsertSubmit(e) {
    e.preventDefault();
    var errBox = $("adminFormError");
    errBox.classList.add("hidden");

    var fullName = $("fFullName").value.trim();
    var phone = $("fPhone").value.trim();
    var plate = $("fLicensePlate").value.trim();
    var endDate = $("fEndDate").value.trim();

    if (!fullName || !phone || !plate || !endDate) {
      errBox.textContent = "กรุณากรอก ชื่อ-นามสกุล, เบอร์โทร, เลขทะเบียนรถ และวันหมดอายุให้ครบถ้วน";
      errBox.classList.remove("hidden");
      return;
    }

    var payload = {
      customer: {
        customer_id: $("fCustomerId").value.trim() || undefined,
        full_name: fullName,
        phone: phone,
        id_last4: $("fIdLast4").value.trim(),
        email: $("fEmail").value.trim(),
        admin_note: $("fAdminNote").value.trim()
      },
      policy: {
        policy_id: $("fPolicyId").value.trim() || undefined,
        license_plate: plate,
        province: $("fProvince").value.trim(),
        car_brand_model: $("fCarModel").value.trim(),
        insurer_name: $("fInsurer").value,
        coverage_class: $("fCoverageClass").value,
        garage_type: $("fGarageType").value,
        policy_number: $("fPolicyNo").value.trim(),
        prb_number: $("fPrbNo").value.trim(),
        start_date: $("fStartDate").value.trim(),
        end_date: endDate,
        policy_status: $("fPolicyStatus").value
      }
    };

    if (state.admin.policyPdfBase64) {
      payload.policyPdfBase64 = state.admin.policyPdfBase64;
    }
    if (state.admin.prbPdfBase64) {
      payload.prbPdfBase64 = state.admin.prbPdfBase64;
    }

    var btn = $("btnAdminSave");
    btn.disabled = true;
    btn.textContent = "กำลังบันทึกและอัปโหลดไฟล์เข้า Google Drive...";

    try {
      var res = await window.GasApi.request("admin_upsert_policy", payload, getAuth());
      if (!res.ok) {
        errBox.textContent = window.GasApi.mapErrorMessage(res);
        errBox.classList.remove("hidden");
        return;
      }
      showToast("บันทึกข้อมูลเรียบร้อย (" + res.policy_id + ")");
      $("adminFormCard").classList.add("hidden");
      await runAdminSearch();
    } catch (err) {
      errBox.textContent = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      errBox.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "💾 บันทึกข้อมูล & อัปโหลดเข้า Google Drive";
    }
  }

  /* ======================== EVENT BINDINGS ======================== */
  function bindEvents() {
    $("btnToggleMode").addEventListener("click", function () {
      if (state.view === "admin") {
        loadWallet();
      } else {
        openAdminPortal();
      }
    });

    document.querySelectorAll("[data-demo-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-demo-view");
        if (target === "link") {
          window.MockBackend.setLinked(false);
          loadWallet();
        } else if (target === "wallet") {
          window.MockBackend.setLinked(true);
          loadWallet();
        } else if (target === "admin") {
          openAdminPortal();
        }
      });
    });

    document.querySelectorAll("[data-link-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLinkMode(btn.getAttribute("data-link-mode"));
      });
    });

    $("linkForm").addEventListener("submit", handleLinkSubmit);
    $("btnDownloadPolicy").addEventListener("click", function () { handleDownloadPdf("policy"); });
    $("btnDownloadPrb").addEventListener("click", function () { handleDownloadPdf("prb"); });
    $("btnPushToReply").addEventListener("click", handlePushToReply);

    $("adminPinForm").addEventListener("submit", handleAdminPinSubmit);
    $("adminSearchForm").addEventListener("submit", runAdminSearch);
    $("btnNewPolicyForm").addEventListener("click", function () { openAdminForm(null, null); });
    $("btnCloseAdminForm").addEventListener("click", function () { $("adminFormCard").classList.add("hidden"); });
    $("btnAdminLogout").addEventListener("click", function () {
      state.adminPin = "";
      sessionStorage.removeItem(ADMIN_PIN_SESSION_KEY);
      openAdminPortal();
    });

    setupDropzone("dzPolicy", "filePolicy", "dzPolicyChip", "policy");
    setupDropzone("dzPrb", "filePrb", "dzPrbChip", "prb");
    $("adminUpsertForm").addEventListener("submit", handleAdminUpsertSubmit);

    $("modalCloseBtn").addEventListener("click", hideModal);
    $("appModal").addEventListener("click", function (e) {
      if (e.target === $("appModal")) hideModal();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindEvents();
    initApp();
  });
})();
