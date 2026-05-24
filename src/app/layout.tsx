import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Allo Inventory — Reservation System",
  description: "Reserve products from our warehouses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-screen bg-[#080809] text-white antialiased font-sans">
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#131315",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: "13px",
              borderRadius: "12px",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}