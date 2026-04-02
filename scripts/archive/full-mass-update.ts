import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generateSEO(sku: string, name: string) {
    let html = '';
    let short = '';
    const nameUpper = name.toUpperCase();

    // MATCH WHEELS
    if (nameUpper.includes('OYN.') || nameUpper.includes('OYNAK') || nameUpper.includes('SABİT') || nameUpper.includes('SAB.') || nameUpper.includes('FRENLİ') || nameUpper.includes('TEKERLEK') || nameUpper.includes('JANT')) {
        const movementMatches = nameUpper.match(/(OYNAK|SABİT|FRENLİ|SAB\.|OYN\.)/);
        let movement = 'Oynak';
        if (movementMatches) {
            movement = movementMatches[1].replace('.', '');
            if (movement === 'SAB') movement = 'Sabit';
            if (movement === 'OYN') movement = 'Oynak';
        }
        
        const dimMatch = nameUpper.match(/(\d+)X(\d+)X(\d+)/i) || nameUpper.match(/(\d+)\*\s*(\d+)/i);
        let dimensions = 'Endüstriyel Boyut';
        if (dimMatch && dimMatch[3]) dimensions = `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]}mm`;
        else if (dimMatch && dimMatch[2]) dimensions = `${dimMatch[1]}x${dimMatch[2]}mm`;
        
        let material = 'Poliüretan / Endüstriyel Plastik';
        if (nameUpper.includes('POLİAMİD') || nameUpper.includes('POL.')) material = 'Poliamid (Aşınmaya Ekstra Dirençli)';
        else if (nameUpper.includes('LASTİK')) material = 'Sarsıntı Emici Çevreci Lastik';
        else if (nameUpper.includes('PVC')) material = 'Sessiz ve Çizmez PVC';
        else if (nameUpper.includes('ALÜMİNYUM') || nameUpper.includes('ALÜ.')) material = 'Alüminyum Döküm Gövde';
        else if (nameUpper.includes('DÖKÜM')) material = 'Ağır Sanayi Döküm (Pik)';
        
        const mountType = nameUpper.includes('VİDALI') ? 'Vidalı Bağlantı' : nameUpper.includes('TABLALI') ? 'Tablalı (Flanşlı) Bağlantı' : nameUpper.includes('PİMLİ') ? 'Pimli (Geçmeli)' : 'Standart Geçme/Burç';

        html = `<h2>${name}: Emes Kalitesiyle Mükemmel Taşıma Performansı</h2><p>Lojistik taşıma arabalarınız, fabrika ekipmanlarınız ve raf sistemleriniz için orijinal Emes standartlarında üretilen <strong>${name}</strong>, endüstriyel mobiliteyi baştan tanımlıyor. Özel formülize edilmiş ${material} dış lastik ve jant yapısı, zorlu fabrika zeminlerinde üstün tutunuş sağlarken, en düşük yuvarlanma direnci ile insan gücü/enerji tasarrufu yaratır.</p><p>${dimensions} dış konfigürasyonu ile kullanım alanına tam uyum gösteren bu tekerlek; arabaya ${mountType} sayesinde saniyeler içinde doğrudan sağlam bir şekilde entegre edilir. Emes mühendisliğinin getirdiği <strong>${movement.charAt(0).toUpperCase() + movement.slice(1).toLowerCase()}</strong> çalışma donanımı ile manevra gücünüzü çalışma ortamınızın zorluğuna göre tamamen siz belirlersiniz.</p><ul><li><strong>Dayanıklı ve Zemin Dostu:</strong> Kimyasallara, yağlara ve aşınmalara karşı ekstra korumalı dış yüzey.</li><li><strong>Pratik Endüstriyel Montaj:</strong> Cihaz yük merkezine uygun ${mountType} tasarımı.</li><li><strong>Şok ve Sarsıntı Emilimi:</strong> Düzensiz zeminlerin pürüzlerini şasiye yansıtmayan rotasyon mekanizması.</li></ul><p>Uzun vadeli dayanıklılık, sıfır bakım maliyeti ve kesintisiz iş akışı için ${name} tekerlek çözümünü Teker Market garantisiyle şimdi tedarik edebilirsiniz.</p>`;
        short = `Emes güvencesiyle ${dimensions} ebatlarında üretilen ${name}; ${material} jant/lastik teknolojisi ve pratik ${mountType} ile araba ve makineleriniz için ağır yüke dirençli taşıma sağlar.`;
    }
    // KAUÇUK TAKOZ
    else if (nameUpper.includes('TAKOZ') || sku.toUpperCase().startsWith('KT')) {
        const typeMatch = nameUpper.match(/TİP\s([A-D])/i);
        const tip = typeMatch ? typeMatch[1] : 'Endüstriyel';
        const dimMatch = nameUpper.match(/(\d+)(x|\*)(\d+)/i);
        const dimensions = dimMatch ? `${dimMatch[1]}x${dimMatch[3]}mm` : 'Özel Seri';

        html = `<h2>${name}: Maksimum İzolasyon ve Titreşim Önleyici Takoz</h2><p>Makine ve ağır ekipmanlarınızın zeminle olan bağlantısını en stabil şekilde sağlayan <strong>${name}</strong> Kauçuk Takoz, gürültü ve yüksek voltajlı sarsıntıları doğrudan kendi bünyesinde emer. Emes'in Tip ${tip} mühendislik tasarımına sahip ürün, kompresör, jeneratör, motor ve ağır pres makinelerinde zemin deformasyonunu önlemek için tasarlanmıştır.</p><p>${dimensions} çap ve yükseklik değerleriyle cihaz şasisine kolayca oturur, metal ve kauçuk birleşiminin kusursuz dengesiyle ağır tonaj altındayken bile kopma/yırtılma oranını sıfıra düşürür.</p><ul><li><strong>Etkin Şok Emilimi:</strong> Yüksek yoğunluklu kauçuk kimyası sayesinde zemine yansıyan titreşimi keser.</li><li><strong>Ağır Sanayi Standartları:</strong> Tonlarca basınca dayanıklı Tip ${tip} bağlantı modeli.</li><li><strong>Akustik Düzenleyici:</strong> Fabrika içi çalışan konforu için makine kaynaklı sarsıntı sesini ortadan kaldırır.</li></ul><p>Tesisinizin makine parkurunu güvence altına alacak profesyonel Emes Takozları, Teker Market stoklarından doğrudan temin edebilirsiniz.</p>`;
        short = `Tip ${tip} kalitesindeki ${dimensions} ölçülü ${name} Kauçuk Takoz, makinelerinizin yaydığı titreşimi ve motor sarsıntısını absorbe eden profesyonel zemin izolasyon elemanıdır.`;
    }
    // MENTEŞE, KİLİT
    else if (nameUpper.includes('MENTEŞE') || nameUpper.includes('KİLİT') || nameUpper.includes('KULP') || nameUpper.includes('MANDALI')) {
        let type = nameUpper.includes('MENTEŞE') ? 'Menteşe ve Bağlantı' : nameUpper.includes('KİLİT') ? 'Güvenlik ve Kilit' : 'Endüstriyel Kapak-Kabin';
        html = `<h2>${name}: Panolar ve Kabinler İçin Kesintisiz Performans</h2><p>Elektrik panoları, makine kabin sistemleri ve endüstriyel mobilyalarda yıllarca güvenle kullanabileceğiniz donanım çözümümüz <strong>${name}</strong>, OEM standartlarına tam uyumlu olarak üretilmiştir. Gövde tasarımındaki sağlamlık, paslanma ve sürtünme direncini en üst seviyeye çıkartırken, sık aç-kapa operasyonlarında yorulma belirtisi göstermez.</p><p>Sızdırmazlık, güvenlik veya pratik bağlantı arayan mühendis ve teknisyenler için dizayn edilen bu ürün; fabrika dış ortamlarında, nemli ve tozlu üretim sahalarında dahi estetiğini korur.</p><ul><li><strong>Dayanıklı Döküm / Alaşım:</strong> Şiddetli darbelere ve dış hava koşullarına kalkan olan özel dış yüzey kaplaması.</li><li><strong>Kusursuz ${type} Dinamiği:</strong> Sessiz çalışma veya %100 kavrama sağlayan tasarım harikası detaylar.</li><li><strong>Hızlı Kurulum:</strong> Standart endüstri normlarına uyan montaj vida delikleri/yuvaları.</li></ul><p>Aksesuarda sanayi kalitesi arayanlara Teker Market ayrıcalığıyla hizmet veren ürünümüzü online sitemizden anında rezerve ediniz.</p>`;
        short = `Pano ve ağır makine kabinleri için üstün kaliteli yapıya sahip ${name}, yorulma yapmayan ve dış etkenlere dirençli kusursuz bir profesyonel donanım aksesuarıdır.`;
    }
    else {
        html = `<h2>${name}: Emes Garantisiyle Üstün Endüstriyel Donanım</h2><p>İhtiyaç duyduğunuz teknik özelliklere direkt yanıt vermek adına Emes standartlarında test edilip tasarlanan <strong>${name}</strong>, projelerinizde veya makine otomasyon hatlarında aradığınız eksiksiz performansı sunar. Malzeme mühendisliğinin en dayanıklı bileşenleriyle şekillenmiş dış katmanı, fiziki strese ve uzun süreli endüstriyel çalışmalara karşı tam mukavemet sağlar.</p><p>Sökme-takma ve yedek parça değişimlerini en basit seviyeye indiren ergonomik geometrisi, çalışma hızınızı yavaşlatmaz. Tesis içindeki asidik, nemli veya yüksek dirençli mekanlarda formunu en ufak bir kayıp yaşamadan korur.</p><ul><li><strong>Yüksek Teknoloji:</strong> Korozyona, paslanmaya veya aşırı sürtünmeye ekstra direnç gösteren Emes kalitesi.</li><li><strong>Sarsılmaz Form:</strong> Fabrika içi yoğun günlük kullanımlarda dahi ilk günkü yapısal sağlamlık.</li><li><strong>Mükemmel Uyum:</strong> Standart imalat ölçüleri sayesinde yedek parça uyumluluğu garantisi.</li></ul><p>Operasyon güvenliğinden taviz vermek istemeyen endüstri devlerinin tercihi bu donanımı Teker Market stoklarından efor harcamadan hemen satın alın.</p>`;
        short = `Projenizin kalitesini yükseltecek olan ${name}, yüksek malzeme direnci ve endüstri normlarına tam uyumu sayesinde işletmenizin donanım operasyonlarında en güvenilir yardımcısıdır.`;
    }

    return { html, short };
}

async function run() {
    try {
        console.log("Loading Excel SKUs...");
        const rawData = fs.readFileSync('scripts/excel_skus.json', 'utf8');
        const excelSkus: string[] = JSON.parse(rawData);
        const normalizedExcelSkus = new Set(excelSkus.map(s => s.trim().toUpperCase()));
        
        console.log(`Excel contains ${normalizedExcelSkus.size} normalized SKUs.`);

        let allMatchedProducts: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log("Fetching all products without descriptions from Database in pages...");

        while (hasMore) {
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name')
                .is('deleted_at', null)
                .eq('status', 'active')
                .or('description.is.null,description.eq.""')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                 console.error('Error fetching page:', error.message);
                 break;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            for (const p of data) {
                if (p.sku && normalizedExcelSkus.has(p.sku.trim().toUpperCase())) {
                    allMatchedProducts.push(p);
                }
            }
            page++;
        }

        console.log(`Finished pagination. Found ${allMatchedProducts.length} Emes products missing descriptions!`);

        if (allMatchedProducts.length === 0) {
            console.log("Everything is already processed. We are done!");
            return;
        }

        console.log("Starting bulk update...");

        let successCount = 0;
        let errorCount = 0;
        const chunkSize = 50; 

        for (let i = 0; i < allMatchedProducts.length; i += chunkSize) {
            const chunk = allMatchedProducts.slice(i, i + chunkSize);
            
            const promises = chunk.map(async (p) => {
                const seoData = generateSEO(p.sku, p.name);
                const { error: updErr } = await supabase
                    .from('products')
                    .update({
                        description: seoData.html,
                        short_description: seoData.short,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', p.id);

                if (updErr) {
                    return { success: false, error: updErr.message };
                }
                return { success: true };
            });

            const results = await Promise.all(promises);
            for (const r of results) {
                if (r.success) successCount++;
                else errorCount++;
            }
            
            console.log(`Updates processing: ${Math.min(i + chunkSize, allMatchedProducts.length)} / ${allMatchedProducts.length}`);
            // delay to manage rate limits
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`\n--- FINAL MASS UPDATE COMPLETE ---`);
        console.log(`Successfully updated: ${successCount}`);
        console.log(`Failed to update: ${errorCount}`);

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();
