export interface ScrapedProduct {
    sku: string;
    name: string;
    imageUrl: string;
    sale_price: string;
    localImagePath?: string;
    detailUrl?: string;
    // Rich attributes from detail pages
    description?: string;
    wheelDiameter?: string;     // Tekerlek Çapı (mm)
    wheelWidth?: string;        // Tekerlek Genişliği (mm)
    loadCapacity?: string;      // Taşıma Kapasitesi (kg)
    wheelType?: string;         // Döner Tablalı, Sabit, Frenli vb.
    coatingType?: string;       // Kaplama Cinsi: Kauçuk, Poliüretan vb.
    series?: string;            // Seri kodu: EA, EB, EM vb.
    category?: string;          // Otomatik kategori ataması
}
