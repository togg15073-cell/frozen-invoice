import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { renderInvoicePdf } from "../pdf/invoice.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const doc = await prisma.document.findFirst({ where: { id: params.id, shop: session.shop } });
  if (!doc) throw new Response("Not found", { status: 404 });
  console.log("pdf_access", session.shop, doc.id, new Date().toISOString());
  const pdf = await renderInvoicePdf(JSON.parse(doc.snapshot));
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.type}-${doc.number}.pdf"` } });
};
