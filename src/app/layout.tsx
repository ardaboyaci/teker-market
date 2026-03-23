import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/query-provider";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
    subsets: ["latin"],
    variable: "--font-display",
    weight: ["700", "800"],
    display: "swap",
});

const dmSans = DM_Sans({
    subsets: ["latin"],
    variable: "--font-body",
    weight: ["400", "500", "600"],
    display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tekermarket.com.tr";

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: "Teker Market | Endüstriyel Teker ve Roda Çözümleri",
        template: "%s | Teker Market",
    },
    description:
        "Teker Market; endüstriyel teker, roda ve ekipman ürünleri için hızlı teklif, güncel stok ve kapsamlı ürün yönetimi sunar.",
    keywords: [
        "teker market",
        "endüstriyel teker",
        "roda",
        "polyüretan teker",
        "ağır yük tekeri",
        "stok takip",
        "pim sistemi",
    ],
    applicationName: "Teker Market",
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        locale: "tr_TR",
        siteName: "Teker Market",
        title: "Teker Market | Endüstriyel Teker ve Roda Çözümleri",
        description:
            "Endüstriyel teker ve donanım ürünlerinde güncel katalog, hızlı fiyatlama ve güvenilir stok takibi.",
    },
    twitter: {
        card: "summary_large_image",
        title: "Teker Market | Endüstriyel Teker ve Roda Çözümleri",
        description:
            "Teker ve roda ürünlerinde hızlı keşif, teklif ve sipariş süreci için Teker Market.",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr" className={`${syne.variable} ${dmSans.variable}`}>
            <body className="antialiased font-body">
                <QueryProvider>{children}</QueryProvider>
            </body>
        </html>
    );
}
