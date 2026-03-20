// ─────────────────────────────────────────────────────────────────────────────
// CFDistribucion S.R.L. — Arqueo de Caja
// Google Apps Script — Receptor de datos
//
// INSTRUCCIONES DE INSTALACION:
// 1. Abre Google Sheets → Extensiones → Apps Script
// 2. Borrá el código existente y pegá todo este archivo
// 3. Guardá (Ctrl+S) con nombre "Arqueo CFD"
// 4. Clic en "Implementar" → "Nueva implementación"
// 5. Tipo: "Aplicación web"
// 6. Ejecutar como: "Yo (tu cuenta)"
// 7. Quién tiene acceso: "Cualquier persona"
// 8. Clic en "Implementar" → copiá la URL que aparece
// 9. Pegá esa URL en la app (ver instrucción al final)
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_NAME = "Arqueos";
const SHEET_DETALLE = "Comprobantes";
const SHEET_GASTOS  = "Gastos";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    // ── Hoja principal: un arqueo por fila ──────────────────────────────────
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        "ID Arqueo", "Fecha Envío", "Fecha Operación",
        "Distribuidor", "Monto Apertura",
        "Total Efectivo", "Total Transferencias", "Total Gastos",
        "Total Rendido", "Diferencia", "Estado Cuadre",
        "Cant. Comprobantes", "Cant. Gastos"
      ]);
      // Formato encabezado
      const header = sheet.getRange(1, 1, 1, 13);
      header.setBackground("#1a3a6b");
      header.setFontColor("#ffffff");
      header.setFontWeight("bold");
      header.setFontSize(10);
      sheet.setFrozenRows(1);
    }

    const id = Utilities.getUuid().substring(0, 8).toUpperCase();
    const ahora = new Date();
    const diferencia = data.totalRendido - data.montoInicial;
    const estado = Math.abs(diferencia) < 0.01 ? "EXACTO" :
                   diferencia > 0 ? "SOBRANTE" : "FALTANTE";

    sheet.appendRow([
      id,
      Utilities.formatDate(ahora, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      data.fecha,
      data.distribuidor || "Sin nombre",
      data.montoInicial,
      data.totalEfectivo,
      data.totalTransferencias,
      data.totalGastos,
      data.totalRendido,
      diferencia,
      estado,
      (data.comprobantes || []).length,
      (data.gastos || []).length
    ]);

    // Color de fila según estado
    const lastRow = sheet.getLastRow();
    const estadoCell = sheet.getRange(lastRow, 11);
    if (estado === "EXACTO")   estadoCell.setBackground("#d4edda").setFontColor("#155724");
    if (estado === "SOBRANTE") estadoCell.setBackground("#d1ecf1").setFontColor("#0c5460");
    if (estado === "FALTANTE") estadoCell.setBackground("#f8d7da").setFontColor("#721c24");

    // ── Hoja de comprobantes ─────────────────────────────────────────────────
    let sheetC = ss.getSheetByName(SHEET_DETALLE);
    if (!sheetC) {
      sheetC = ss.insertSheet(SHEET_DETALLE);
      sheetC.appendRow([
        "ID Arqueo", "Fecha", "Distribuidor",
        "Tipo Pago", "Cliente", "Referencia", "Monto"
      ]);
      const hC = sheetC.getRange(1, 1, 1, 7);
      hC.setBackground("#1a3a6b"); hC.setFontColor("#ffffff");
      hC.setFontWeight("bold"); sheetC.setFrozenRows(1);
    }
    (data.comprobantes || []).forEach(c => {
      sheetC.appendRow([
        id, data.fecha, data.distribuidor || "Sin nombre",
        c.tipo, c.cliente || "", c.referencia || "",
        parseFloat(c.monto) || 0
      ]);
    });

    // ── Hoja de gastos ───────────────────────────────────────────────────────
    let sheetG = ss.getSheetByName(SHEET_GASTOS);
    if (!sheetG) {
      sheetG = ss.insertSheet(SHEET_GASTOS);
      sheetG.appendRow([
        "ID Arqueo", "Fecha", "Distribuidor",
        "Categoria", "Descripcion", "Monto"
      ]);
      const hG = sheetG.getRange(1, 1, 1, 6);
      hG.setBackground("#1a3a6b"); hG.setFontColor("#ffffff");
      hG.setFontWeight("bold"); sheetG.setFrozenRows(1);
    }
    (data.gastos || []).forEach(g => {
      sheetG.appendRow([
        id, data.fecha, data.distribuidor || "Sin nombre",
        g.categoria, g.descripcion || "",
        parseFloat(g.monto) || 0
      ]);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test manual desde el editor
function testLocal() {
  const fake = {
    fecha: "2026-03-20",
    distribuidor: "Juan Pérez",
    montoInicial: 2000,
    totalEfectivo: 1585.50,
    totalTransferencias: 200,
    totalGastos: 65,
    totalRendido: 1850.50,
    comprobantes: [
      { tipo: "QR", cliente: "Tienda Don Carlos", referencia: "TRX-001", monto: 150 },
      { tipo: "Transferencia", cliente: "Minimarket El Sol", referencia: "TRX-002", monto: 50 }
    ],
    gastos: [
      { categoria: "Combustible", descripcion: "YPFB Av. América", monto: 50 },
      { categoria: "Peaje", descripcion: "Ruta Sacaba", monto: 15 }
    ]
  };
  const result = doPost({ postData: { contents: JSON.stringify(fake) } });
  Logger.log(result.getContent());
}
