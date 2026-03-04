import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
    title: "Teker Market | Yönetim Paneli",
    description: "Teker Market PIM ve Envanter Takip Sistemi",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr">
            <body className="antialiased">
                <QueryProvider>{children}</QueryProvider>
            </body>
        </html>
    );
}
