import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      const email = (payload as any).customer?.email;
      const docs = email ? await prisma.document.findMany({ where: { shop, email }, select: { number: true, orderName: true, createdAt: true } }) : [];
      console.log("customers/data_request", shop, JSON.stringify(docs));
      break;
    }
    case "CUSTOMERS_REDACT": {
      const email = (payload as any).customer?.email;
      if (email) {
        const docs = await prisma.document.findMany({ where: { shop, email }, select: { id: true, snapshot: true } });
        for (const d of docs) {
          const snap = JSON.parse(d.snapshot);
          snap.buyer = { ...snap.buyer, name: "[redacted]", company: "", lines: [], email: "", phone: "", vatNumber: "" };
          snap.shipTo = null;
          await prisma.document.update({ where: { id: d.id }, data: { customerName: "[redacted]", email: "", snapshot: JSON.stringify(snap) } });
        }
        console.log("customers/redact", shop, docs.length);
      }
      break;
    }
    case "SHOP_REDACT":
      await prisma.document.deleteMany({ where: { shop } });
      await prisma.shopSettings.deleteMany({ where: { shop } });
      break;
  }
  return new Response();
};
