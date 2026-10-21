import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { renderDocumentsPdf } from "../pdf/invoice.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 200);
  const docs = await prisma.document.findMany({ where: { id: { in: ids }, shop: session.shop }, orderBy: { createdAt: "asc" } });
  if (!docs.length) throw new Response("Not found", { status: 404 });
  const pdf = await renderDocumentsPdf(docs.map((d) => JSON.parse(d.snapshot)));
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="documents-${docs.length}.pdf"` } });
};
