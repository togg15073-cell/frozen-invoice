import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { Page, Card, IndexTable, Text, Button, TextField, BlockStack, useIndexResourceState, InlineStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { listDocuments } from "../models/documents.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  return json({ q, docs: await listDocuments(session.shop, q) });
};

export default function Documents() {
  const { q, docs } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState(q);
  const [, setSp] = useSearchParams();
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(docs as any);
  return (
    <Page>
      <TitleBar title="Documents" />
      <BlockStack gap="400">
        <Card>
          <Form method="get" onSubmit={(e) => { e.preventDefault(); setSp(search ? { q: search } : {}); }}>
            <TextField label="Search" labelHidden autoComplete="off" placeholder="Invoice number, order number, customer name or email" value={search} onChange={setSearch} connectedRight={<Button submit>Search</Button>} />
          </Form>
        </Card>
        {selectedResources.length > 0 && (
          <Card><InlineStack align="space-between" blockAlign="center">
            <Text as="p">{selectedResources.length} selected</Text>
            <Button variant="primary" url={`/app/documents/bulk/pdf?ids=${selectedResources.join(",")}`} target="_blank">Download as one PDF</Button>
          </InlineStack></Card>
        )}
        <Card padding="0">
          <IndexTable resourceName={{ singular: "document", plural: "documents" }} itemCount={docs.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length} onSelectionChange={handleSelectionChange}
            headings={[{ title: "Number" }, { title: "Type" }, { title: "Order" }, { title: "Customer" }, { title: "Total" }, { title: "Created" }, { title: "" }]}>
            {docs.map((d, i) => (
              <IndexTable.Row id={d.id} key={d.id} position={i} selected={selectedResources.includes(d.id)}>
                <IndexTable.Cell><Text as="span" fontWeight="bold">{d.number}</Text></IndexTable.Cell>
                <IndexTable.Cell>{d.type}</IndexTable.Cell>
                <IndexTable.Cell>{d.orderName}</IndexTable.Cell>
                <IndexTable.Cell>{d.customerName}</IndexTable.Cell>
                <IndexTable.Cell>{d.total.toFixed(2)} {d.currency}</IndexTable.Cell>
                <IndexTable.Cell>{String(d.createdAt).slice(0, 10)}</IndexTable.Cell>
                <IndexTable.Cell><Button url={`/app/documents/${d.id}/pdf`} target="_blank" size="slim">PDF</Button></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </Card>
      </BlockStack>
    </Page>
  );
}
