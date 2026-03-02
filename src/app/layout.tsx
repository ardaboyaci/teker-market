import type { Metadata } from "next";
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
            <body className="antialiased">{children}</body>
        </html>
    );
}
