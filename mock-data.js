/**
 * Interactive Mock Data & Offline/Demo Backend Simulator.
 * Activated automatically when config.js still has placeholder values
 * and the app is opened in a regular browser.
 */
window.MockBackend = (function () {
  // Minimal valid 1-page PDF encoded in Base64 for realistic Demo download
  var SAMPLE_PDF_BASE64 = btoa(
    "%PDF-1.4\n" +
      "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
      "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
      "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n" +
      "4 0 obj<< /Length 68 >>stream\nBT /F1 16 Tf 30 120 Td (Car Insurance Policy Demo PDF) Tj ET\nendstream\nendobj\n" +
      "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n" +
      "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000359 0000000000 n \n" +
      "trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n429\n%%EOF"
  );

  function addDaysIso(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  var state = {
    linked: true,
    is_admin: true,
    customer: {
      customer_id: "CUS-001",
      full_name: "สมชาย ใจดี",
      phone: "0812345678",
      id_last4: "5678",
      bot_mode: "auto",
      admin_note: "ลูกค้าVIP ต่อเนื่อง 3 ปี",
      linked: true
    },
    policies: [
      {
        policy_id: "POL-001",
        customer_id: "CUS-001",
        license_plate: "1กก 1234",
        province: "กรุงเทพมหานคร",
        car_brand_model: "Toyota Camry 2.5 HV",
        insurer_name: "วิริยะประกันภัย",
        coverage_class: "ชั้น 1",
        garage_type: "ซ่อมห้าง",
        policy_number: "VRI-69-11223344",
        prb_number: "PRB-69-998877",
        start_date: addDaysIso(-220),
        end_date: addDaysIso(145),
        policy_status: "active",
        days_left: 145,
        status_badge: "active",
        has_policy_pdf: true,
        has_prb_pdf: true,
        claim_hotline_24h: "1557",
        roadside_phone: "02-239-1557",
        claim_instructions: "ถ่ายรูปความเสียหายและใบขับขี่คู่กรณี รอเจ้าหน้าที่สำรวจภัยถึงจุดเกิดเหตุภายใน 30 นาที"
      },
      {
        policy_id: "POL-002",
        customer_id: "CUS-001",
        license_plate: "2ขข 5678",
        province: "นนทบุรี",
        car_brand_model: "Honda Civic e:HEV",
        insurer_name: "โตเกียวมารีนประกันภัย",
        coverage_class: "2+",
        garage_type: "ซ่อมอู่",
        policy_number: "TM-69-44556677",
        prb_number: "PRB-69-554433",
        start_date: addDaysIso(-347),
        end_date: addDaysIso(18),
        policy_status: "active",
        days_left: 18,
        status_badge: "expiring",
        has_policy_pdf: true,
        has_prb_pdf: false,
        claim_hotline_24h: "",
        roadside_phone: "",
        claim_instructions: "ติดต่อศูนย์รับแจ้งเหตุผ่าน LINE OA หรือสาขาใกล้บ้าน"
      }
    ],
    extraCustomers: [
      {
        customer: {
          customer_id: "CUS-002",
          full_name: "สมหญิง รักรถ",
          phone: "0898765432",
          id_last4: "4321",
          bot_mode: "manual",
          admin_note: "รอแอดมินส่งใบเสนอราคาชั้น 1",
          linked: false
        },
        policies: [
          {
            policy_id: "POL-003",
            customer_id: "CUS-002",
            license_plate: "3คค 9090",
            province: "เชียงใหม่",
            car_brand_model: "Mazda CX-5",
            insurer_name: "กรุงเทพประกันภัย",
            coverage_class: "ชั้น 1",
            garage_type: "ซ่อมห้าง",
            policy_number: "BKI-69-77889900",
            prb_number: "",
            start_date: addDaysIso(-350),
            end_date: addDaysIso(15),
            policy_status: "active",
            days_left: 15,
            status_badge: "expiring",
            has_policy_pdf: true,
            has_prb_pdf: false,
            claim_hotline_24h: "1620",
            roadside_phone: "",
            claim_instructions: ""
          }
        ]
      }
    ],
    insurers: [
      { insurer_name: "วิริยะประกันภัย", claim_hotline_24h: "1557", roadside_phone: "02-239-1557" },
      { insurer_name: "กรุงเทพประกันภัย", claim_hotline_24h: "1620", roadside_phone: "" },
      { insurer_name: "เมืองไทยประกันภัย", claim_hotline_24h: "1484", roadside_phone: "" },
      { insurer_name: "ทิพยประกันภัย", claim_hotline_24h: "1736", roadside_phone: "" },
      { insurer_name: "ธนชาตประกันภัย", claim_hotline_24h: "02-666-8899", roadside_phone: "" },
      { insurer_name: "ไทยวิวัฒน์ประกันภัย", claim_hotline_24h: "1231", roadside_phone: "" },
      { insurer_name: "โตเกียวมารีนประกันภัย", claim_hotline_24h: "", roadside_phone: "" }
    ]
  };

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function norm(s) {
    return String(s || "").replace(/[\s-]/g, "").toLowerCase();
  }

  function computeDaysLeft(endDate) {
    if (!endDate) return null;
    var end = new Date(endDate + "T00:00:00");
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((end - today) / 86400000);
  }

  function computeBadge(status, daysLeft) {
    if (status === "cancelled") return "cancelled";
    if (daysLeft === null) return "active";
    if (daysLeft < 0 || status === "expired") return "expired";
    if (daysLeft <= 30) return "expiring";
    return "active";
  }

  function allAdminRecords() {
    return [{ customer: state.customer, policies: state.policies }].concat(state.extraCustomers);
  }

  async function handle(action, params) {
    await delay(280);
    params = params || {};

    if (action === "get_my_wallet") {
      if (!state.linked) {
        return { ok: true, linked: false, is_admin: state.is_admin };
      }
      return {
        ok: true,
        linked: true,
        is_admin: state.is_admin,
        customer: state.customer,
        policies: state.policies
      };
    }

    if (action === "link_account") {
      var p = norm(params.phone);
      var plate = norm(params.license_plate);
      var id4 = norm(params.id_last4);
      if (!p || (!plate && !id4)) {
        return { ok: false, error: "BAD_REQUEST", message: "กรุณากรอกเบอร์โทรและเลขทะเบียนรถ หรือเลขบัตร 4 ตัวท้าย" };
      }
      var phoneMatch = p === norm(state.customer.phone);
      var secondMatch =
        (plate && state.policies.some(function (pol) { return norm(pol.license_plate) === plate; })) ||
        (id4 && id4 === norm(state.customer.id_last4));

      if (!phoneMatch || !secondMatch) {
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "ไม่พบข้อมูลที่ตรงกัน (โหมด Demo: ลองใช้เบอร์ 0812345678 และทะเบียน 1กก 1234)"
        };
      }
      state.linked = true;
      state.customer.linked = true;
      return { ok: true, linked: true, matched_policies: state.policies.length };
    }

    if (action === "download_pdf") {
      var kind = params.kind === "prb" ? "PRB" : "POLICY";
      return {
        ok: true,
        filename: (params.policy_id || "DEMO") + "_" + kind + ".pdf",
        mimeType: "application/pdf",
        base64: SAMPLE_PDF_BASE64
      };
    }

    if (action === "admin_search") {
      var q = norm(params.query);
      var all = allAdminRecords();
      var results = !q
        ? all
        : all.filter(function (item) {
            var c = item.customer;
            if (
              norm(c.full_name).includes(q) ||
              norm(c.phone).includes(q) ||
              norm(c.customer_id).includes(q)
            ) {
              return true;
            }
            return item.policies.some(function (pol) {
              return norm(pol.license_plate).includes(q) || norm(pol.policy_number).includes(q);
            });
          });
      return {
        ok: true,
        results: results,
        insurers: state.insurers,
        coverage_classes: ["ชั้น 1", "2+", "3+", "ชั้น 3", "พ.ร.บ."],
        garage_types: ["ซ่อมห้าง", "ซ่อมอู่"]
      };
    }

    if (action === "admin_toggle_bot") {
      var cid = params.customer_id;
      var target = allAdminRecords().find(function (r) {
        return r.customer.customer_id === cid;
      });
      if (!target) {
        return { ok: false, error: "NOT_FOUND", message: "ไม่พบลูกค้า" };
      }
      var nextMode = params.bot_mode || (target.customer.bot_mode === "auto" ? "manual" : "auto");
      target.customer.bot_mode = nextMode;
      return { ok: true, customer_id: cid, bot_mode: nextMode };
    }

    if (action === "admin_upsert_policy") {
      var cIn = params.customer || {};
      var pIn = params.policy || {};
      if (!cIn.full_name || !cIn.phone || !pIn.license_plate || !pIn.end_date) {
        return { ok: false, error: "BAD_REQUEST", message: "กรุณากรอกข้อมูลบังคับให้ครบถ้วน" };
      }

      var allRecs = allAdminRecords();
      var rec = allRecs.find(function (r) {
        return (cIn.customer_id && r.customer.customer_id === cIn.customer_id) ||
               norm(r.customer.phone) === norm(cIn.phone);
      });

      var createdCustomer = false;
      if (!rec) {
        createdCustomer = true;
        rec = {
          customer: {
            customer_id: "CUS-" + String(allRecs.length + 1).padStart(3, "0"),
            full_name: cIn.full_name,
            phone: cIn.phone,
            id_last4: cIn.id_last4 || "",
            bot_mode: "auto",
            admin_note: cIn.admin_note || "",
            linked: false
          },
          policies: []
        };
        state.extraCustomers.unshift(rec);
      } else {
        rec.customer.full_name = cIn.full_name;
        rec.customer.phone = cIn.phone;
        if (cIn.id_last4 !== undefined) rec.customer.id_last4 = cIn.id_last4;
        if (cIn.admin_note !== undefined) rec.customer.admin_note = cIn.admin_note;
      }

      var daysLeft = computeDaysLeft(pIn.end_date);
      var status = pIn.policy_status || "active";
      var insurerInfo = state.insurers.find(function (ins) {
        return ins.insurer_name === pIn.insurer_name;
      }) || { claim_hotline_24h: "", roadside_phone: "" };

      var existingPol = pIn.policy_id
        ? rec.policies.find(function (x) { return x.policy_id === pIn.policy_id; })
        : null;
      var createdPolicy = !existingPol;

      var polObj = existingPol || {
        policy_id: "POL-" + String(Math.floor(100 + Math.random() * 900)),
        customer_id: rec.customer.customer_id,
        has_policy_pdf: false,
        has_prb_pdf: false
      };

      Object.assign(polObj, {
        license_plate: pIn.license_plate,
        province: pIn.province || "",
        car_brand_model: pIn.car_brand_model || "",
        insurer_name: pIn.insurer_name || "",
        coverage_class: pIn.coverage_class || "ชั้น 1",
        garage_type: pIn.garage_type || "ซ่อมห้าง",
        policy_number: pIn.policy_number || "",
        prb_number: pIn.prb_number || "",
        start_date: pIn.start_date || "",
        end_date: pIn.end_date,
        policy_status: status,
        days_left: daysLeft,
        status_badge: computeBadge(status, daysLeft),
        has_policy_pdf: polObj.has_policy_pdf || Boolean(params.policyPdfBase64),
        has_prb_pdf: polObj.has_prb_pdf || Boolean(params.prbPdfBase64),
        claim_hotline_24h: insurerInfo.claim_hotline_24h,
        roadside_phone: insurerInfo.roadside_phone,
        claim_instructions: polObj.claim_instructions || ""
      });

      if (createdPolicy) {
        rec.policies.push(polObj);
      }

      return {
        ok: true,
        customer_id: rec.customer.customer_id,
        policy_id: polObj.policy_id,
        created: { customer: createdCustomer, policy: createdPolicy },
        has_policy_pdf: polObj.has_policy_pdf,
        has_prb_pdf: polObj.has_prb_pdf
      };
    }

    return { ok: false, error: "UNKNOWN_ACTION", message: "Unknown action: " + action };
  }

  return {
    setLinked: function (val) {
      state.linked = Boolean(val);
    },
    handle: handle
  };
})();
