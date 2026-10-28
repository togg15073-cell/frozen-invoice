import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { Page, Card, InlineGrid, Text, Button, BlockStack, List, Banner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS, planFromSubscriptions } from "../models/plans";
import { monthlyUsage } from "../models/documents.server";

const isTest = process.env.NODE_ENV !== "production";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check({ plans: ["Starter", "Pro"], isTest });
  return json({ plan: planFromSubscriptions(appSubscriptions), used: await monthlyUsage(session.shop), shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const fd = await request.formData();
  const target = String(fd.get("plan"));
  const { appSubscriptions } = await billing.check({ plans: ["Starter", "Pro"], isTest });
  for (const s of appSubscriptions) await billing.cancel({ subscriptionId: s.id, isTest, prorate: true });
  if (target === "free") return redirect("/app/plans");
  const returnUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/plans`;
  try {
    return await billing.request({ plan: target as "Starter" | "Pro", isTest, returnUrl });
  } catch (e: any) {
    if (e instanceof Response) throw e;
    const detail = Array.isArray(e?.errorData) ? e.errorData.map((x: any) => x.message).join("; ") : String(e?.message || e);
    return json({ error: `Could not start the subscription: ${detail}` }, { status: 400 });
  }
};

export default function Plans() {
  const { plan, used } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const actionData = useActionData<{ error?: string }>();
  const features: Record<string, string[]> = {
    free: ["20 documents / month", "Invoices & packing slips", "Prices frozen at order time", "Search by order, invoice, customer"],
    starter: ["300 documents / month", "Everything in Free", "Automatic invoice on new orders", "Email support within 24h"],
    pro: ["Unlimited documents", "Everything in Starter", "Credit notes", "Priority support"],
  };
  return (
    <Page>
      <TitleBar title="Plan" />
      <BlockStack gap="400">
        {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}
        <Banner tone="info">Billing counts <b>documents you create</b> — never your store's order volume. {used} documents created this month. Paid plans include a 7-day free trial.</Banner>
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => (
            <Card key={k}>
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg">{PLANS[k].name}</Text>
                <Text as="p" variant="heading2xl">${PLANS[k].price}<Text as="span" variant="bodySm"> / month</Text></Text>
                <List>{features[k].map((f) => <List.Item key={f}>{f}</List.Item>)}</List>
                <Button variant={k === "pro" ? "primary" : undefined} disabled={plan === k} onClick={() => submit({ plan: k === "free" ? "free" : PLANS[k].name }, { method: "post" })}>
                  {plan === k ? "Current plan" : k === "free" ? "Downgrade" : "Choose " + PLANS[k].name}
                </Button>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
