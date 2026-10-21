import prisma from "../db.server";
import { getSettings } from "./settings.server";
import { PLANS, type PlanKey, monthStart } from "./plans";

export type Snapshot = {
  number: string; type: string; issuedAt: string;
  order: { id: string; name: string; createdAt: string; paymentStatus: string; fulfillmentStatus: string; gateways: string[] };
  seller: { companyName: string; addressLines: string; email: string; phone: string; vatNumber: string; footer: string; accentColor: string };
  buyer: { name: string; company: string; lines: string[]; email: string; phone: string; vatNumber: string };
  shipTo: { name: string; lines: string[] } | null;
  items: { title: string; variant: string; sku: string; qty: number; unit: number; total: number; taxRate: number | null }[];
  totals: { subtotal: number; discount: number; shipping: number; tax: number; total: number; currency: string; taxesIncluded: boolean };
  taxLines: { title: string; rate: number; amount: number }[];
  shippingMethod: string; note: string | null;
};

const ORDER_QUERY = `#graphql
query Order($id: ID!) { order(id: $id) {
  id name createdAt processedAt currencyCode note taxesIncluded email phone
  displayFinancialStatus displayFulfillmentStatus paymentGatewayNames
  customAttributes { key value }
  customer { displayName email }
  billingAddress { name company address1 address2 city province zip country phone }
  shippingAddress { name company address1 address2 city province zip country }
  subtotalPriceSet { shopMoney { amount } } totalShippingPriceSet { shopMoney { amount } }
  totalTaxSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } totalPriceSet { shopMoney { amount } }
  taxLines { title rate priceSet { shopMoney { amount } } }
  shippingLine { title }
  refunds { createdAt totalRefundedSet { shopMoney { amount } }
    refundLineItems(first: 50) { nodes { quantity subtotalSet { shopMoney { amount } } totalTaxSet { shopMoney { amount } }
      lineItem { title sku variantTitle originalUnitPriceSet { shopMoney { amount } } taxLines { rate } } } } }
  lineItems(first: 100) { nodes { title quantity sku variantTitle
    originalUnitPriceSet { shopMoney { amount } } discountedTotalSet { shopMoney { amount } }
    taxLines { rate } } }
} }`;

const n = (v: any) => parseFloat(v?.shopMoney?.amount ?? v ?? "0") || 0;
const addr = (a: any) => a ? [a.address1, a.address2, [a.city, a.province, a.zip].filter(Boolean).join(" "), a.country].filter((x: any) => x && String(x).trim()) : [];

export async function monthlyUsage(shop: string) {
  return prisma.document.count({ where: { shop, createdAt: { gte: monthStart() } } });
}

export async function createDocument(admin: any, shop: string, orderGid: string, plan: PlanKey, type = "invoice") {
  if (type === "credit" && plan !== "pro") return { error: "Credit notes are available on the Pro plan." } as const;
  const used = await monthlyUsage(shop);
  const limit = PLANS[plan].docsPerMonth;
  if (used >= limit) return { error: `Monthly limit reached (${used}/${limit} documents on the ${PLANS[plan].name} plan). Upgrade to create more.` } as const;

  const existing = await prisma.document.findFirst({ where: { shop, orderId: orderGid, type } });
  if (existing) return { document: existing, existed: true } as const;

  const res = await admin.graphql(ORDER_QUERY, { variables: { id: orderGid } });
  const { data } = await res.json();
  const o = data?.order;
  if (!o) return { error: "Order not found" } as const;

  const s = await getSettings(shop);
  let number: string;
  if (type === "invoice") {
    number = `${s.invoicePrefix}${String(s.nextNumber).padStart(4, "0")}`;
    await prisma.shopSettings.update({ where: { shop }, data: { nextNumber: { increment: 1 } } });
  } else {
    number = `${type === "packing" ? "PS-" : "CN-"}${String(o.name).replace(/^#/, "")}`;
  }

  if (type === "credit" && !(o.refunds || []).length) return { error: "This order has no refunds, so there is nothing to credit." } as const;
  const vatAttr = (o.customAttributes || []).find((a: any) => /vat|tax ?id|abn|ein/i.test(a.key));
  const b = o.billingAddress || o.shippingAddress || {};
  const snap: Snapshot = {
    number, type, issuedAt: new Date().toISOString(),
    order: { id: o.id, name: o.name, createdAt: o.processedAt || o.createdAt, paymentStatus: o.displayFinancialStatus || "", fulfillmentStatus: o.displayFulfillmentStatus || "", gateways: o.paymentGatewayNames || [] },
    seller: { companyName: s.companyName, addressLines: s.addressLines, email: s.email, phone: s.phone, vatNumber: s.vatNumber, footer: s.footer, accentColor: s.accentColor },
    buyer: { name: b.name || o.customer?.displayName || "", company: b.company || "", lines: addr(b), email: o.email || o.customer?.email || "", phone: b.phone || o.phone || "", vatNumber: vatAttr?.value || "" },
    shipTo: o.shippingAddress ? { name: o.shippingAddress.name || "", lines: addr(o.shippingAddress) } : null,
    items: type === "credit"
      ? (o.refunds || []).flatMap((r: any) => (r.refundLineItems?.nodes || []).map((rl: any) => ({ title: rl.lineItem.title, variant: rl.lineItem.variantTitle || "", sku: rl.lineItem.sku || "", qty: rl.quantity, unit: n(rl.lineItem.originalUnitPriceSet), total: n(rl.subtotalSet), taxRate: rl.lineItem.taxLines?.[0]?.rate ?? null })))
      : (o.lineItems?.nodes || []).map((li: any) => ({ title: li.title, variant: li.variantTitle || "", sku: li.sku || "", qty: li.quantity, unit: n(li.originalUnitPriceSet), total: n(li.discountedTotalSet), taxRate: li.taxLines?.[0]?.rate ?? null })),
    totals: type === "credit"
      ? (() => { const refunded = (o.refunds || []).reduce((a: number, r: any) => a + n(r.totalRefundedSet), 0); const tax = (o.refunds || []).flatMap((r: any) => r.refundLineItems?.nodes || []).reduce((a: number, rl: any) => a + n(rl.totalTaxSet), 0); const sub = (o.refunds || []).flatMap((r: any) => r.refundLineItems?.nodes || []).reduce((a: number, rl: any) => a + n(rl.subtotalSet), 0); return { subtotal: sub, discount: 0, shipping: Math.max(0, Math.round((refunded - sub - (o.taxesIncluded ? 0 : tax)) * 100) / 100), tax, total: refunded, currency: o.currencyCode, taxesIncluded: !!o.taxesIncluded }; })()
      : { subtotal: n(o.subtotalPriceSet), discount: n(o.totalDiscountsSet), shipping: n(o.totalShippingPriceSet), tax: n(o.totalTaxSet), total: n(o.totalPriceSet), currency: o.currencyCode, taxesIncluded: !!o.taxesIncluded },
    taxLines: type === "credit" ? [] : (o.taxLines || []).map((t: any) => ({ title: t.title, rate: t.rate, amount: n(t.priceSet) })),
    shippingMethod: o.shippingLine?.title || "",
    note: s.hideNotes ? null : o.note || null,
  };
  const document = await prisma.document.create({
    data: { shop, orderId: o.id, orderName: o.name, number, type, customerName: snap.buyer.name, email: snap.buyer.email, currency: o.currencyCode, total: snap.totals.total, snapshot: JSON.stringify(snap) },
  });
  return { document, existed: false } as const;
}

export async function listDocuments(shop: string, q = "", take = 50) {
  const where: any = { shop };
  if (q) where.OR = [{ number: { contains: q } }, { orderName: { contains: q } }, { customerName: { contains: q } }, { email: { contains: q } }];
  return prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take });
}
