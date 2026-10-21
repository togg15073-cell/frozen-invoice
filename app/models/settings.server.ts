import prisma from "../db.server";

export async function getSettings(shop: string) {
  return (
    (await prisma.shopSettings.findUnique({ where: { shop } })) ??
    (await prisma.shopSettings.create({ data: { shop } }))
  );
}
export async function saveSettings(shop: string, data: Record<string, any>) {
  const allowed = ["companyName","addressLines","email","phone","vatNumber","invoicePrefix","footer","accentColor"];
  const d: Record<string, any> = {};
  for (const k of allowed) if (k in data) d[k] = String(data[k] ?? "").slice(0, 2000);
  if ("nextNumber" in data) d.nextNumber = Math.max(1, parseInt(String(data.nextNumber), 10) || 1);
  if ("hideNotes" in data) d.hideNotes = data.hideNotes === "true" || data.hideNotes === true;
  if ("autoCreate" in data) d.autoCreate = data.autoCreate === "true" || data.autoCreate === true;
  return prisma.shopSettings.upsert({ where: { shop }, update: d, create: { shop, ...d } });
}
