import ExcelJS from "exceljs";

async function svgElementToPngDataUrl(svg: SVGElement, width = 800, height = 400): Promise<string | null> {
  try {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("width")) clone.setAttribute("width", String(width));
    if (!clone.getAttribute("height")) clone.setAttribute("height", String(height));
    const xml = new XMLSerializer().serializeToString(clone);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const dataUrl = `data:image/svg+xml;base64,${svg64}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2; canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function addRows(ws: ExcelJS.Worksheet, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) { ws.addRow(["Sin datos"]); return; }
  const cols = Object.keys(rows[0]);
  const header = ws.addRow(cols);
  header.font = { bold: true };
  for (const r of rows) ws.addRow(cols.map((c) => (r[c] as string | number | boolean | Date | null) ?? ""));
  ws.columns = cols.map(() => ({ width: 18 }));
}

export interface WorkbookChartRef {
  chartElId: string; // DOM id containing a chart's <svg>
  sheet: string;     // sheet name to place chart on
  title?: string;
}

export async function downloadWorkbookWithCharts(
  sheets: Record<string, Array<Record<string, unknown>>>,
  fileName: string,
  charts: WorkbookChartRef[] = [],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ConTaxes";
  wb.created = new Date();

  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name.slice(0, 31));
    addRows(ws, rows);
  }

  for (const c of charts) {
    const el = document.getElementById(c.chartElId);
    const svg = el?.querySelector("svg") as SVGElement | null;
    if (!svg) continue;
    const png = await svgElementToPngDataUrl(svg);
    if (!png) continue;
    const imageId = wb.addImage({ base64: png, extension: "png" });
    const ws = wb.getWorksheet(c.sheet.slice(0, 31)) ?? wb.addWorksheet(c.sheet.slice(0, 31));
    if (c.title) {
      const startRow = ws.rowCount + 2;
      ws.getCell(`A${startRow}`).value = c.title;
      ws.getCell(`A${startRow}`).font = { bold: true };
    }
    const anchorRow = ws.rowCount + 1;
    ws.addImage(imageId, {
      tl: { col: 0, row: anchorRow },
      ext: { width: 700, height: 350 },
      editAs: "oneCell",
    });
    for (let i = 0; i < 18; i++) ws.addRow([]);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

// Retro-compat: firma anterior sin gráficos.
export function downloadWorkbook(sheets: Record<string, Array<Record<string, unknown>>>, fileName: string) {
  void downloadWorkbookWithCharts(sheets, fileName, []);
}
