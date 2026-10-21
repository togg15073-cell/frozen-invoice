import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useSearchParams, Form, Link as RLink } from "@remix-run/react";
import { Page, Layout, Card, IndexTable, Text, Button, TextField, BlockStack, InlineStack, Badge, Banner, Link } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { createDocument, monthlyUsage } from "../models/documents.server";
import { PLANS, planFromSubscriptions } from "../models/plans";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const query = q ? (/^#?\d+$/.test(q) ? `name:${q.replace("#", "")}` : q) : "";
  const res = await admin.graphql(`#graphql
    query Orders($q: String) { orders(first: 25, query: $q, sortKey: CREATED_AT, reverse: true) { nodes {
      id name createdAt displayFinancialStatus customer { displayName } totalPriceSet { shopMoney { amount currencyCode } } } } }`,
    { variables: { q: query || null } });
  const data = (await res.json()).data;
  const orders = data?.orders?.nodes || [];
  const docs = await prisma.document.findMany({ where: { shop: session.shop, orderId: { in: orders.map((o: any) => o.id) } }, select: { id: true, orderId: true, number: true, type: true } });
  const { appSubscriptions } = await billing.check({ plans: ["Starter", "Pro"], isTest: process.env.NODE_ENV !== "production" });
  const plan = planFromSubscriptions(appSubscriptions);
  return json({ orders, docs, q, plan, used: await monthlyUsage(session.shop), limit: PLANS[plan].docsPerMonth });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const fd = await request.formData();
  const { appSubscriptions } = await billing.check({ plans: ["Starter", "Pro"], isTest: process.env.NODE_ENV !== "production" });
  const r = await createDocument(admin, session.shop, String(fd.get("orderId")), planFromSubscriptions(appSubscriptions), String(fd.get("type") || "invoice"));
  return json(r);
};

export default function Index() {
  const { orders, docs, q, plan, used, limit } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [search, setSearch] = useState(q);
  const [, setSp] = useSearchParams();
  const docFor = (id: string, type: string) => docs.find((d) => d.orderId === id && d.type === type);
  const err = (fetcher.data as any)?.error;
  return (
    <Page>
      <TitleBar title="Orders" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {err && <Banner tone="critical" title={err}><Link url="/app/plans">See plans</Link></Banner>}
            <Card>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodyMd">Plan: <b>{PLANS[plan].name}</b> · {used}{Number.isFinite(limit) ? ` / ${limit}` : ""} documents this month</Text>
                <RLink to="/app/plans">Change plan</RLink>
              </InlineStack>
            </Card>
            <Card>
              <Form method="get" onSubmit={(e) => { e.preventDefault(); setSp(search ? { q: search } : {}); }}>
                <TextField label="Search orders" labelHidden autoComplete="off" placeholder="Order number (#1001), customer name or email" value={search} onChange={setSearch} connectedRight={<Button submit>Search</Button>} />
              </Form>
            </Card>
            <Card padding="0">
              <IndexTable resourceName={{ singular: "order", plural: "orders" }} itemCount={orders.length} selectable={false}
                headings={[{ title: "Order" }, { title: "Date" }, { title: "Customer" }, { title: "Total" }, { title: "Payment" }, { title: "Documents" }]}>
                {orders.map((o: any, i: number) => {
                  const inv = docFor(o.id, "invoice"), pack = docFor(o.id, "packing"), cn = docFor(o.id, "credit");
                  const refunded = /REFUNDED/.test(o.displayFinancialStatus || "");
                  const busy = fetcher.state !== "idle" && fetcher.formData?.get("orderId") === o.id;
                  return (
                    <IndexTable.Row id={o.id} key={o.id} position={i}>
                      <IndexTable.Cell><Text as="span" fontWeight="bold">{o.name}</Text></IndexTable.Cell>
                      <IndexTable.Cell>{o.createdAt.slice(0, 10)}</IndexTable.Cell>
                      <IndexTable.Cell>{o.customer?.displayName || "—"}</IndexTable.Cell>
                      <IndexTable.Cell>{o.totalPriceSet.shopMoney.amount} {o.totalPriceSet.shopMoney.currencyCode}</IndexTable.Cell>
                      <IndexTable.Cell><Badge tone={o.displayFinancialStatus === "PAID" ? "success" : "attention"}>{o.displayFinancialStatus?.toLowerCase()}</Badge></IndexTable.Cell>
                      <IndexTable.Cell>
                        <InlineStack gap="200">
                          {inv ? <Button url={`/app/documents/${inv.id}/pdf`} target="_blank" size="slim">Invoice {inv.number}</Button>
                            : <Button size="slim" loading={busy} onClick={() => fetcher.submit({ orderId: o.id, type: "invoice" }, { method: "post" })}>Create invoice</Button>}
                          {pack ? <Button url={`/app/documents/${pack.id}/pdf`} target="_blank" size="slim" variant="plain">Packing slip</Button>
                            : <Button size="slim" variant="plain" onClick={() => fetcher.submit({ orderId: o.id, type: "packing" }, { method: "post" })}>Packing slip</Button>}
                          {refunded && (cn ? <Button url={`/app/documents/${cn.id}/pdf`} target="_blank" size="slim" variant="plain">Credit note</Button>
                            : <Button size="slim" variant="plain" onClick={() => fetcher.submit({ orderId: o.id, type: "credit" }, { method: "post" })}>Credit note</Button>)}
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
