import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";
import { getSettings } from "../models/settings.server";
import { createDocument } from "../models/documents.server";
import { planFromSubscriptions } from "../models/plans";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  if (topic !== "ORDERS_CREATE") return new Response();
  const settings = await getSettings(shop);
  if (!settings.autoCreate) return new Response();
  try {
    const { admin } = await unauthenticated.admin(shop);
    const res = await admin.graphql(`#graphql
      query { currentAppInstallation { activeSubscriptions { name } } }`);
    const subs = (await res.json()).data?.currentAppInstallation?.activeSubscriptions || [];
    await createDocument(admin, shop, (payload as any).admin_graphql_api_id, planFromSubscriptions(subs));
  } catch (e) {
    console.error("orders/create auto-invoice failed", shop, e);
  }
  return new Response();
};
