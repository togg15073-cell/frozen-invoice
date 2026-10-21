export default function Privacy() {
  const s: React.CSSProperties = { fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "40px auto", padding: "0 20px", lineHeight: 1.6, color: "#1d2433" };
  return (
    <main style={s}>
      <h1>Privacy Policy — Frozen Invoice</h1>
      <p>Last updated: 2026-10-21</p>
      <h2>What we store</h2>
      <p>When you create a document, the app stores a snapshot of that order (order number, line items, prices, taxes, discounts, billing and shipping address, customer name and email) together with the business details you entered in Settings. The snapshot exists so the document never changes after it is issued. We do not store payment card data, and we do not read orders you have not created a document for, except to show the order list inside the app.</p>
      <h2>Why</h2>
      <p>Solely to generate, store and let you re-download invoices, packing slips and credit notes, and to count documents for billing.</p>
      <h2>Sharing</h2>
      <p>We do not sell or share merchant or customer data with third parties. Data is processed on our hosting provider's servers and transmitted over HTTPS.</p>
      <h2>Retention and deletion</h2>
      <p>Documents are kept while the app is installed. When you uninstall, access tokens are deleted immediately and all stored documents and settings are deleted within 48 hours of Shopify's <code>shop/redact</code> request. Customer data erasure requests from Shopify (<code>customers/redact</code>) remove the customer's name and email from stored documents.</p>
      <h2>Contact</h2>
      <p>Questions or data requests: support email shown on the app listing.</p>
    </main>
  );
}
