import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Card, FormLayout, TextField, Checkbox, Button, BlockStack, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json(await getSettings(session.shop));
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = Object.fromEntries(await request.formData());
  return json(await saveSettings(session.shop, data));
};

export default function Settings() {
  const s = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();
  const [f, setF] = useState({ ...s, nextNumber: String(s.nextNumber) });
  const set = (k: string) => (v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="400">
        <Card>
          <FormLayout>
            <Text as="h2" variant="headingMd">Your business (shown on documents)</Text>
            <TextField label="Company name" value={f.companyName} onChange={set("companyName")} autoComplete="organization" />
            <TextField label="Address" value={f.addressLines} onChange={set("addressLines")} multiline={3} autoComplete="off" />
            <FormLayout.Group>
              <TextField label="Email" value={f.email} onChange={set("email")} autoComplete="email" />
              <TextField label="Phone" value={f.phone} onChange={set("phone")} autoComplete="tel" />
            </FormLayout.Group>
            <TextField label="VAT / tax number" value={f.vatNumber} onChange={set("vatNumber")} autoComplete="off" />
            <TextField label="Footer text" value={f.footer} onChange={set("footer")} multiline={2} autoComplete="off" />
            <TextField label="Accent colour (hex)" value={f.accentColor} onChange={set("accentColor")} autoComplete="off" />
          </FormLayout>
        </Card>
        <Card>
          <FormLayout>
            <Text as="h2" variant="headingMd">Numbering & behaviour</Text>
            <FormLayout.Group>
              <TextField label="Invoice prefix" value={f.invoicePrefix} onChange={set("invoicePrefix")} autoComplete="off" />
              <TextField label="Next number" type="number" value={f.nextNumber} onChange={set("nextNumber")} autoComplete="off" />
            </FormLayout.Group>
            <Checkbox label="Hide internal order notes on documents (recommended)" checked={f.hideNotes} onChange={set("hideNotes")} />
            <Checkbox label="Automatically create an invoice when an order is placed" checked={f.autoCreate} onChange={set("autoCreate")} helpText="Prices, taxes and discounts are frozen at the moment the invoice is created. Counts toward your monthly document limit." />
            <Button variant="primary" loading={nav.state !== "idle"} onClick={() => submit({ ...f, hideNotes: String(f.hideNotes), autoCreate: String(f.autoCreate) }, { method: "post" })}>Save</Button>
          </FormLayout>
        </Card>
      </BlockStack>
    </Page>
  );
}
