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
    if (nameUpper.includes('OYN.') || nameUpper.includes('OYNAK') || nameUpper.includes('SABİT') || nameUpper.includes('SAB.') || nameUpper.includes('FRENLİ')) {
        const movementMatches = nameUpper.match(/(OYNAK|SABİT|FRENLİ)/);
        const movement = movementMatches ? movementMatches[1] : 'Oynak';
        
        const dimMatch = nameUpper.match(/(\d+)X(\d+)X(\d+)/i);
        const cap = dimMatch ? dimMatch[1] : '';
        const genislik = dimMatch ? dimMatch[2] : '';
        const mil = dimMatch ? dimMatch[3] : '';
        const dimensions = cap ? `${cap}x${genislik}x${mil}mm` : 'Özel';
        
        let material = 'Poliüretan/Endüstriyel Plastik';
        if (nameUpper.includes('POLİAMİD') || nameUpper.includes('POL.')) material = 'Poliamid (Aşınmaya Ekstra Dirençli)';
        else if (nameUpper.includes('LASTİK')) material = 'Sarsıntı Emici Çevreci Lastik';
        else if (nameUpper.includes('PVC')) material = 'Sessiz ve Çizmez PVC';
        
        const mountType = nameUpper.includes('VİDALI') ? 'Vidalı Bağlantı' : nameUpper.includes('KARE TABLALI') ? 'Kare Tablalı (Flanşlı)' : nameUpper.includes('PİMLİ') ? 'Pimli (Geçmeli)' : 'Standart Mil/Burç';

        html = `<h2>${name}: Kusursuz Hareket ve Güvenilir Performans</h2><p>Tesis içi lojistik işlemlerinizi hızlandırmak ve eforu azaltmak üzere geliştirilen <strong>${name}</strong>, endüstriyel standartları tam anlamıyla karşılar. Özel ${material} tekerlek yapısı sayesinde zeminlere zarar vermezken, düşük yuvarlanma direnci sunarak itme-çekme işlemlerinde operatörlere ergonomik bir rahatlık sağlar.</p><p>${dimensions} boyutlarıyla en dar depo koridorlarından ağır sanayi alanlarına kadar ideal ağırlık dağılımı sunar. Cihazlarınıza ${mountType} sayesinde kolayca entegre edebilirsiniz. <strong>${movement.charAt(0).toUpperCase() + movement.slice(1).toLowerCase()}</strong> profil tasarımı operasyonunuzun ihtiyaç duyduğu manevra veya sabitleme gücünü sağlar.</p><ul><li><strong>Yüksek Aşınma Direnci:</strong> Uzun mesafeli sürüşlerde form kaybetmeyen yapı.</li><li><strong>Pratik Entegrasyon:</strong> Makine ayakları ve mobilya sistemleri için güvenli ${mountType}.</li><li><strong>Stabil Kullanım:</strong> Darbe emilimi ve sarsıntısız rotasyon.</li></ul><p>Uzun vadeli dayanıklılık ve kesintisiz mobilite için bu modeli Teker Market güvencesiyle hemen sipariş edebilirsiniz.</p>`;
        short = `${dimensions} ebatlarındaki ${name}, ${material} yüzeyi ve ${movement.toLowerCase()} mekanizmasıyla araba ve makineleriniz için sarsıntısız sürüş sağlar.`;
    }
    // MATCH HINGES
    else if (nameUpper.includes('MENTEŞE')) {
        html = `<h2>${name}: Makine ve Pano Kapaklarında Sarsılmaz Güç</h2><p>Endüstriyel dolaplar, güvenlik panoları ve makine kapaklarında kullanılan <strong>${name}</strong>, sık kullanımda bile sarkma veya deformasyon yaşatmayan katı döküm bir menteşedir. Metalik yapısı korozyon direnci ile donatılmış olup nem, titreşim ve fabrika tozu gibi sert ortam faktörlerinden etkilenmez.</p><p>Makine mühendisliği kurallarına uygun olarak tasarlanan vida yatakları ve pürüzsüz çalışma mafsalı, kapakların sessizce açılıp kapanmasını sağlar. Üstelik güçlü taşıma kapasitesi ile ağır zırhlı kapaklarda güvenle tercih edilebilir.</p><ul><li><strong>Endüstriyel Çelik/Zamak Döküm:</strong> Uzun yıllar süren ağır yük performansı.</li><li><strong>Sessiz Çalışma:</strong> Sürtünme önleyici mafsal mimarisi.</li><li><strong>Kolay Sabitleme:</strong> Tüm endüstri standartlarındaki pano kapaklarına uyumlu montaj ölçüleri.</li></ul><p>Tesisinizde veya ekipman üretiminizde kaliteden taviz vermemek için Teker Market hırdavat çözümlerini seçin.</p>`;
        short = `Panolarınız ve endüstriyel kapaklarınız için özel tasarlanan ${name}, ağır yük taşıma kapasitesine sahip uzun ömürlü profosyonel menteşe çözümüdür.`;
    }
    // MATCH FASTENERS (SCREWS, NUTS)
    else if (nameUpper.includes('VİDA') || nameUpper.includes('SOMUN') || nameUpper.includes('PUL')) {
        const item = nameUpper.includes('VİDA') ? 'Vida' : nameUpper.includes('SOMUN') ? 'Somun' : 'Pul';
        html = `<h2>${name}: Endüstriyel Sabitleme Elemanı</h2><p>Tekerlek montajları, panel birleştirmeleri ve makine konstrüksiyonları için kritik öneme sahip bağlantı elemanımız <strong>${name}</strong>, paslanmaz alaşımlı yapısı sayesinde kopma veya yalama yapmadan kusursuz bir kilitlenme sağlar.</p><p>Metrik standartlara %100 uyumlu dişli yuvaları, yüksek devirli titreşimlerde bile gevşeme riskine karşı mukavemet gösterir. Güvenliğinizin en ufak bir parçasıdır.</p><ul><li><strong>Dayanıklı Diş Yapısı:</strong> Sürekli sök-tak işlemlerinde bozulmaz.</li><li><strong>Güvenli Sıkıştırma:</strong> Titreşimle gevşeyen standart vidaların aksine stabil duruş.</li></ul>`;
        short = `Makine montaj ve yedek parça bağlantılarınız için üretilmiş, paslanmaz ve standart diş yapısına sahip profesyonel ${item.toLowerCase()} elemanıdır.`;
    }
    // MATCH ACCESSORIES
    else {
        html = `<h2>${name}: Profesyonel Donanım Aksesuarı</h2><p>Tesisinizin makine hatlarında veya lojistik arabalarında tamamlayıcı fonksiyon üstlenen <strong>${name}</strong>, OEM standartlarına uygun uzun ömürlü bir endüstriyel çözümdür. Dayanıklı hammadde bileşenleri sayesinde çalışma esnasında fiziksel strese karşı yapısal kırılmalar yaşatmaz.</p><p>Kolay monte edilebilir tasarımı ve pürüzsüz işçiliği, çalıştığınız sektördeki bakım ve yenileme operasyonlarınızı kolaylaştırır.</p><ul><li><strong>Orijinal Ekipman Kalitesi:</strong> Test edilmiş güvenilir performans garantisi.</li><li><strong>Geniş Kullanım Alanı:</strong> Cihaz onarımı ve parça yenilemesinde standartlara uygun entegrasyon.</li></ul><p>Projeniz için eksiksiz donanım malzemelerini Teker Market platformundan hemen edinebilirsiniz.</p>`;
        short = `Dayanıklı dış yüzey kaplaması ve uzun ömürlü yapısal bütünlüğü ile ${name}, güvenilir bir tamamlayıcı endüstriyel aksesuardır.`;
    }

    return { html, short };
}

async function run() {
    try {
        const rawData = fs.readFileSync('scripts/excel_skus.json', 'utf8');
        const excelSkus: string[] = JSON.parse(rawData);

        const { data: products, error } = await supabase
            .from('products')
            .select('id, sku, name')
            .is('deleted_at', null)
            .eq('status', 'active')
            .or('description.is.null,description.eq.""')
            .limit(5000);

        if (error) {
             console.error('Error fetching products:', error.message);
             return;
        }

        const normalizedExcelSkus = new Set(excelSkus.map(s => s.trim().toUpperCase()));
        const matchedProducts = products.filter(p => p.sku && normalizedExcelSkus.has(p.sku.trim().toUpperCase()));

        // Take the first 50
        const batch = matchedProducts.slice(0, 50);

        let successCount = 0;
        for (const p of batch) {
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
                console.error(`Failed to update ${p.sku}:`, updErr.message);
            } else {
                console.log(`Successfully updated ${p.sku} (${p.name})`);
                successCount++;
            }
        }
        console.log(`\nProcessed ${successCount} Excel-matched products.`);

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();
