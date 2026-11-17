/**
 * Google Apps Script Web App API Client + PDF Base64 Helpers.
 * Follows docs/CONTEXT.md contract strictly:
 * - POST with Content-Type: text/plain;charset=utf-8 and redirect: 'follow' (avoids CORS preflight)
 * - No custom headers; never sends line_user_id from client
 */
window.GasApi = (function () {
  var ERROR_MESSAGES_TH = {
    BAD_REQUEST: "ข้อมูลที่ส่งไม่ครบถ้วนหรือไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    UNKNOWN_ACTION: "คำสั่งไม่ถูกต้อง",
    UNAUTHORIZED: "ไม่สามารถยืนยันตัวตน LINE ได้ กรุณาเปิดผ่านแอป LINE อีกครั้ง",
    FORBIDDEN: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลหรือไฟล์นี้ (PIN หรือสิทธิ์แอดมินไม่ถูกต้อง)",
    LOCKED: "ลองผิดพลาดหลายครั้งเกินไป กรุณารอสักครู่ (10-15 นาที) แล้วลองใหม่",
    NOT_FOUND: "ไม่พบข้อมูลที่ตรงกันในระบบ กรุณาตรวจสอบเบอร์โทรและเลขทะเบียนรถ",
    ALREADY_LINKED: "ข้อมูลนี้ถูกผูกกับบัญชี LINE อื่นแล้ว กรุณาติดต่อแอดมิน",
    NO_FILE: "ยังไม่มีไฟล์ PDF ในระบบสำหรับกรมธรรม์นี้",
    TOO_LARGE: "ไฟล์มีขนาดใหญ่เกินขีดจำกัดของระบบ (สูงสุด 8 MB หลังเข้ารหัส)",
    SERVER_ERROR: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง"
  };

  function isPlaceholderConfig() {
    var cfg = window.APP_CONFIG || {};
    var liff = (cfg.LIFF_ID || "").trim();
    var gas = (cfg.GAS_WEB_APP_URL || "").trim();
    return (
      !liff ||
      liff === "YOUR_LIFF_ID" ||
      !gas ||
      gas === "YOUR_GAS_WEB_APP_URL"
    );
  }

  function mapErrorMessage(res) {
    if (!res) return ERROR_MESSAGES_TH.SERVER_ERROR;
    return ERROR_MESSAGES_TH[res.error] || res.message || ERROR_MESSAGES_TH.SERVER_ERROR;
  }

  async function request(action, params, auth) {
    auth = auth || {};
    if (auth.useMock || isPlaceholderConfig()) {
      return window.MockBackend.handle(action, params);
    }

    var cfg = window.APP_CONFIG || {};
    var payload = Object.assign({}, params || {}, { action: action });
    if (auth.accessToken) {
      payload.accessToken = auth.accessToken;
    }
    if (auth.adminPin) {
      payload.adminPin = auth.adminPin;
    }

    var response = await fetch(cfg.GAS_WEB_APP_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    var text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        ok: false,
        error: "SERVER_ERROR",
        message: "การตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง"
      };
    }
  }

  function validateAndReadPdfBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve(null);
        return;
      }
      var maxMb = (window.APP_CONFIG && window.APP_CONFIG.MAX_PDF_MB) || 5;
      var maxBytes = maxMb * 1024 * 1024;
      var isPdf =
        file.type === "application/pdf" ||
        (file.name && file.name.toLowerCase().endsWith(".pdf"));

      if (!isPdf) {
        reject(new Error("กรุณาเลือกไฟล์นามสกุล .pdf เท่านั้น"));
        return;
      }
      if (file.size > maxBytes) {
        var sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        reject(
          new Error(
            "ไฟล์ \"" +
              file.name +
              "\" มีขนาด " +
              sizeMb +
              " MB เกินขีดจำกัด " +
              maxMb +
              " MB กรุณาย่อขนาดไฟล์ก่อนอัปโหลด"
          )
        );
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result); // data:application/pdf;base64,...
      };
      reader.onerror = function () {
        reject(new Error("ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่"));
      };
      reader.readAsDataURL(file);
    });
  }

  function base64ToBlobUrl(base64Str, mimeType) {
    var clean = String(base64Str || "").replace(/^data:[^;]+;base64,/, "");
    var binary = atob(clean);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    var blob = new Blob([bytes], { type: mimeType || "application/pdf" });
    return URL.createObjectURL(blob);
  }

  function triggerPdfDownload(base64Str, filename, mimeType) {
    var url = base64ToBlobUrl(base64Str, mimeType);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "policy.pdf";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return url;
  }

  return {
    isPlaceholderConfig: isPlaceholderConfig,
    mapErrorMessage: mapErrorMessage,
    request: request,
    validateAndReadPdfBase64: validateAndReadPdfBase64,
    triggerPdfDownload: triggerPdfDownload
  };
})();
