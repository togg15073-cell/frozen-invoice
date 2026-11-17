import { Button, type ButtonProps } from "@shopify/polaris";
import { useState } from "react";

type Props = Omit<ButtonProps, "url" | "target" | "onClick" | "loading"> & { pdfUrl: string; fallbackName: string };

// PDFs must be fetched from inside the embedded app: only there does App Bridge attach the
// session token. Opening the URL in a new tab has no session and lands on the login page.
export function PdfButton({ pdfUrl, fallbackName, children, ...rest }: Props) {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok || !(res.headers.get("Content-Type") || "").includes("application/pdf")) throw new Error(String(res.status));
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || fallbackName;
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      shopify.toast.show(`Downloaded ${name}`);
    } catch {
      shopify.toast.show("Could not download the PDF. Please try again.", { isError: true });
    } finally {
      setLoading(false);
    }
  };
  return <Button {...rest} loading={loading} onClick={download}>{children}</Button>;
}
