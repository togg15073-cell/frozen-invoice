import PDFDocument from "pdfkit";
import type { Snapshot } from "../models/documents.server";

const money = (v: number, cur: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(v);
const date = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function renderInvoicePdf(s: Snapshot): Promise<Buffer> { return renderDocumentsPdf([s]); }

export function renderDocumentsPdf(snaps: Snapshot[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: false, info: { Title: snaps.length === 1 ? `${snaps[0].type} ${snaps[0].number}` : `${snaps.length} documents` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    for (const s of snaps) { doc.addPage(); draw(doc, s); }
    doc.end();
  });
}

function draw(doc: PDFKit.PDFDocument, s: Snapshot) {
    const W = doc.page.width - 100, L = 50, cur = s.totals.currency, accent = /^#[0-9a-f]{6}$/i.test(s.seller.accentColor) ? s.seller.accentColor : "#1d2433";
    const title = s.type === "credit" ? "CREDIT NOTE" : s.type === "packing" ? "PACKING SLIP" : "INVOICE";

    doc.fillColor(accent).font("Helvetica-Bold").fontSize(24).text(title, L, 50);
    doc.fillColor("#000").font("Helvetica").fontSize(10).text(s.number, L, 80);
    doc.font("Helvetica-Bold").fontSize(12).text(s.seller.companyName || "", L + W / 2, 50, { width: W / 2, align: "right" });
    doc.font("Helvetica").fontSize(9).text([s.seller.addressLines, s.seller.email, s.seller.phone, s.seller.vatNumber ? `VAT: ${s.seller.vatNumber}` : ""].filter(Boolean).join("\n"), L + W / 2, 66, { width: W / 2, align: "right" });

    let y = 130;
    doc.font("Helvetica-Bold").fontSize(9).text("BILL TO", L, y); doc.font("Helvetica").text([s.buyer.name, s.buyer.company, ...s.buyer.lines, s.buyer.email, s.buyer.vatNumber ? `VAT: ${s.buyer.vatNumber}` : ""].filter(Boolean).join("\n"), L, y + 12, { width: 200 });
    if (s.shipTo && s.type !== "credit") { doc.font("Helvetica-Bold").text("SHIP TO", L + 210, y); doc.font("Helvetica").text([s.shipTo.name, ...s.shipTo.lines].filter(Boolean).join("\n"), L + 210, y + 12, { width: 150 }); }
    const meta: [string, string][] = [["Order", s.order.name], ["Order date", date(s.order.createdAt)], ["Issue date", date(s.issuedAt)], ["Payment", s.order.paymentStatus.toLowerCase()]];
    if (s.shippingMethod) meta.push(["Shipping", s.shippingMethod]);
    meta.forEach(([k, v], i) => { doc.font("Helvetica-Bold").text(k, L + 380, y + i * 12, { width: 60 }); doc.font("Helvetica").text(v, L + 440, y + i * 12, { width: 105, align: "right" }); });
    y = Math.max(doc.y, y + 80) + 20;

    const cols = s.type === "packing" ? [["Item", L, 330, "left"], ["SKU", L + 340, 100, "left"], ["Qty", L + 450, 45, "right"]] as const
      : [["Item", L, 240, "left"], ["Qty", L + 250, 40, "right"], ["Unit price", L + 300, 80, "right"], ["Tax", L + 385, 40, "right"], ["Amount", L + 430, 65, "right"]] as const;
    const row = (vals: string[], bold = false) => {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      const h = Math.max(...vals.map((v, i) => doc.heightOfString(v, { width: cols[i][2] })));
      vals.forEach((v, i) => doc.text(v, cols[i][1], y, { width: cols[i][2], align: cols[i][3] as any }));
      y += h + 6;
    };
    doc.rect(L, y - 4, W, 18).fill(accent); doc.fillColor("#fff"); row(cols.map((c) => c[0]), true); doc.fillColor("#000");
    for (const it of s.items) {
      const name = it.variant ? `${it.title} — ${it.variant}` : it.title;
      if (s.type === "packing") row([name, it.sku, String(it.qty)]);
      else row([name + (it.sku ? `\nSKU ${it.sku}` : ""), String(it.qty), money(it.unit, cur), it.taxRate != null ? `${Math.round(it.taxRate * 1000) / 10}%` : "—", money(it.total, cur)]);
      doc.moveTo(L, y - 3).lineTo(L + W, y - 3).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    }
    if (s.type !== "packing") {
      y += 6; const t = s.totals; const tx = L + 300, tw = 195;
      const line = (k: string, v: string, bold = false) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).text(k, tx, y, { width: 100 }); doc.text(v, tx + 100, y, { width: tw - 100, align: "right" }); y += bold ? 18 : 14; };
      line("Subtotal", money(t.subtotal, cur));
      if (t.discount) line("Discount", "-" + money(t.discount, cur));
      if (t.shipping) line("Shipping", money(t.shipping, cur));
      for (const tl of s.taxLines) line(`${tl.title} (${Math.round(tl.rate * 1000) / 10}%)${t.taxesIncluded ? " incl." : ""}`, money(tl.amount, cur));
      if (!s.taxLines.length && t.tax) line("Tax", money(t.tax, cur));
      doc.moveTo(tx, y).lineTo(tx + tw, y).strokeColor(accent).lineWidth(1).stroke(); y += 4;
      line(s.type === "credit" ? "Total credited" : "Total", money(t.total, cur), true);
      if (t.taxesIncluded) { doc.font("Helvetica").fontSize(8).fillColor("#555").text("Prices include tax.", tx, y, { width: tw, align: "right" }); doc.fillColor("#000"); y += 12; }
    }
    if (s.note) { y += 10; doc.font("Helvetica-Bold").fontSize(9).text("Note", L, y); doc.font("Helvetica").text(s.note, L, y + 12, { width: W }); y = doc.y; }
    if (s.seller.footer) { doc.font("Helvetica").fontSize(8).fillColor("#555").text(s.seller.footer, L, doc.page.height - 70, { width: W, align: "center", lineBreak: false }); doc.fillColor("#000"); }
}
