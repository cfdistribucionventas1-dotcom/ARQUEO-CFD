// ============================================================
//  ARQUEO DE CAJA — ALMACEN CENTRAL
//  Google Apps Script  —  Receptor de datos desde la PWA
//
//  INSTRUCCIONES DE INSTALACION:
//  1. Abre Google Sheets y crea una hoja nueva
//  2. Menu: Extensiones → Apps Script
//  3. Borra el código de ejemplo y pega TODO este archivo
//  4. Guarda (Ctrl+S)
//  5. Clic en "Implementar" → "Nueva implementación"
//  6. Tipo: Aplicación web
//  7. Ejecutar como: Yo (tu cuenta)
//  8. Quién tiene acceso: Cualquier usuario
//  9. Clic en "Implementar" → copia la URL que aparece
//  10. Pega esa URL en la PWA (campo "URL de Google Sheets")
// ============================================================

const SHEET_ARQUEOS    = "Arqueos";
const SHEET_DETALLE    = "Detalle Comprobantes";
const SHEET_GASTOS     = "Detalle Gastos";
const SHEET_DASHBOARD  = "Dashboard";

// ── Encabezados ────────────────────────────────────────────
const HEADERS_ARQUEOS = [
  "ID Arqueo", "Fecha Envio", "Fecha Operacion",
  "Distribuidor", "Ruta / Zona",
  "Monto Apertura (Bs.)",
  "Total Efectivo (Bs.)", "Total Transferencias (Bs.)", "Total Gastos (Bs.)",
  "Total Rendido (Bs.)", "Diferencia (Bs.)", "Estado Cuadre",
  "N° Comprobantes", "N° Gastos",
  "Billetes Bs.200", "Billetes Bs.100", "Billetes Bs.50", "Billetes Bs.20", "Billetes Bs.10",
  "Monedas Bs.5", "Monedas Bs.2", "Monedas Bs.1", "Monedas 50cts", "Monedas 20cts", "Monedas 10cts",
];

const HEADERS_COMPROBANTES = [
  "ID Arqueo", "Fecha Operacion", "Distribuidor", "Ruta",
  "#", "Tipo", "Cliente", "Referencia", "Monto (Bs.)", "Tiene Foto",
];

const HEADERS_GASTOS_DET = [
  "ID Arqueo", "Fecha Operacion", "Distribuidor", "Ruta",
  "#", "Categoria", "Descripcion", "Monto (Bs.)",
];

// ── Entry point POST ────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const id   = generarID();

    asegurarHojas(ss);
    escribirArqueo(ss, id, data);
    escribirComprobantes(ss, id, data);
    escribirGastos(ss, id, data);
    actualizarDashboard(ss);

    return respuesta({ ok: true, id: id, mensaje: "Arqueo guardado correctamente." });

  } catch (err) {
    return respuesta({ ok: false, error: err.toString() }, true);
  }
}

// ── GET: ping de prueba ─────────────────────────────────────
function doGet() {
  return respuesta({ ok: true, mensaje: "API Arqueo activa. Usa POST para enviar datos." });
}

// ── Escribir fila principal ─────────────────────────────────
function escribirArqueo(ss, id, d) {
  const hoja = ss.getSheetByName(SHEET_ARQUEOS);
  const b = d.billetes || {};
  const m = d.monedas  || {};

  const diferencia = (d.totalRendido || 0) - (d.montoInicial || 0);
  let estado = "Exacto";
  if (Math.abs(diferencia) >= 0.01) estado = diferencia > 0 ? "Sobrante" : "Faltante";

  const fila = [
    id,
    new Date(),
    d.fecha || "",
    d.distribuidor || "",
    d.ruta || "",
    d.montoInicial   || 0,
    d.totalEfectivo  || 0,
    d.totalTransf    || 0,
    d.totalGastos    || 0,
    d.totalRendido   || 0,
    diferencia,
    estado,
    (d.comprobantes || []).length,
    (d.gastos       || []).length,
    b[200] || 0, b[100] || 0, b[50] || 0, b[20] || 0, b[10] || 0,
    m[5]   || 0, m[2]   || 0, m[1]  || 0, m[0.5]|| 0, m[0.2]|| 0, m[0.1]|| 0,
  ];

  hoja.appendRow(fila);

  // Colorear fila segun estado
  const ultima = hoja.getLastRow();
  const rango  = hoja.getRange(ultima, 1, 1, fila.length);

  if (estado === "Exacto")   rango.setBackground("#d4edda");
  else if (estado === "Sobrante") rango.setBackground("#cce5ff");
  else                            rango.setBackground("#f8d7da");
}

// ── Escribir comprobantes ───────────────────────────────────
function escribirComprobantes(ss, id, d) {
  const hoja = ss.getSheetByName(SHEET_DETALLE);
  (d.comprobantes || []).forEach((c, i) => {
    hoja.appendRow([
      id,
      d.fecha        || "",
      d.distribuidor || "",
      d.ruta         || "",
      i + 1,
      c.tipo         || "",
      c.cliente      || "",
      c.referencia   || "",
      parseFloat(c.monto) || 0,
      c.foto ? "Si" : "No",
    ]);
  });
}

// ── Escribir gastos ─────────────────────────────────────────
function escribirGastos(ss, id, d) {
  const hoja = ss.getSheetByName(SHEET_GASTOS);
  (d.gastos || []).forEach((g, i) => {
    hoja.appendRow([
      id,
      d.fecha        || "",
      d.distribuidor || "",
      d.ruta         || "",
      i + 1,
      g.categoria    || "",
      g.descripcion  || "",
      parseFloat(g.monto) || 0,
    ]);
  });
}

// ── Dashboard con formulas ──────────────────────────────────
function actualizarDashboard(ss) {
  const hoja = ss.getSheetByName(SHEET_DASHBOARD);
  hoja.clearContents();

  const ahora = new Date();
  const hoy   = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  hoja.getRange("A1").setValue("DASHBOARD — ARQUEO DE CAJA");
  hoja.getRange("A2").setValue("Actualizado: " + hoy);

  hoja.getRange("A4").setValue("TOTALES HISTORICOS");
  hoja.getRange("A5").setValue("Total arqueos registrados");
  hoja.getRange("B5").setFormula("=COUNTA(Arqueos!A2:A)");
  hoja.getRange("A6").setValue("Arqueos exactos");
  hoja.getRange("B6").setFormula('=COUNTIF(Arqueos!L2:L,"Exacto")');
  hoja.getRange("A7").setValue("Arqueos con sobrante");
  hoja.getRange("B7").setFormula('=COUNTIF(Arqueos!L2:L,"Sobrante")');
  hoja.getRange("A8").setValue("Arqueos con faltante");
  hoja.getRange("B8").setFormula('=COUNTIF(Arqueos!L2:L,"Faltante")');

  hoja.getRange("A10").setValue("SUMAS GENERALES (Bs.)");
  hoja.getRange("A11").setValue("Total apertura acumulado");
  hoja.getRange("B11").setFormula("=SUM(Arqueos!F2:F)");
  hoja.getRange("A12").setValue("Total efectivo acumulado");
  hoja.getRange("B12").setFormula("=SUM(Arqueos!G2:G)");
  hoja.getRange("A13").setValue("Total transferencias acumulado");
  hoja.getRange("B13").setFormula("=SUM(Arqueos!H2:H)");
  hoja.getRange("A14").setValue("Total gastos acumulado");
  hoja.getRange("B14").setFormula("=SUM(Arqueos!I2:I)");
  hoja.getRange("A15").setValue("Diferencia total acumulada");
  hoja.getRange("B15").setFormula("=SUM(Arqueos!K2:K)");

  hoja.getRange("A17").setValue("GASTO MAS FRECUENTE");
  hoja.getRange("A18").setFormula('=IFERROR(INDEX(\'Detalle Gastos\'!F2:F,MATCH(MAX(COUNTIF(\'Detalle Gastos\'!F2:F,\'Detalle Gastos\'!F2:F)),COUNTIF(\'Detalle Gastos\'!F2:F,\'Detalle Gastos\'!F2:F),0)),"Sin datos")');
}

// ── Asegurar hojas con encabezados ──────────────────────────
function asegurarHojas(ss) {
  crearSiNoExiste(ss, SHEET_ARQUEOS,   HEADERS_ARQUEOS);
  crearSiNoExiste(ss, SHEET_DETALLE,   HEADERS_COMPROBANTES);
  crearSiNoExiste(ss, SHEET_GASTOS,    HEADERS_GASTOS_DET);
  crearSiNoExiste(ss, SHEET_DASHBOARD, []);
}

function crearSiNoExiste(ss, nombre, headers) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    if (headers.length > 0) {
      const r = hoja.getRange(1, 1, 1, headers.length);
      r.setValues([headers]);
      r.setFontWeight("bold");
      r.setBackground("#f0b429");
      r.setFontColor("#0f1117");
      hoja.setFrozenRows(1);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────
function generarID() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `ARQ-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function respuesta(obj, esError) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
