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
        let materialInfo = nameUpper.includes('PİRİNÇ') ? 'Pirinç Profil' : nameUpper.includes('ZAMAK') ? 'Zamak Gövde' : 'Güçlendirilmiş Döküm';
        html = `<h2>${name}: Makine ve Pano Kapaklarında Sarsılmaz Güç</h2><p>Endüstriyel dolaplar, güvenlik panoları ve makine kapaklarında kullanılan <strong>${name}</strong>, sık kullanımda bile sarkma veya deformasyon yaşatmayan katı döküm bir menteşedir. ${materialInfo} yapısı korozyon direnci ile donatılmış olup nem, titreşim ve fabrika tozu gibi sert ortam faktörlerinden etkilenmez.</p><p>Makine mühendisliği kurallarına uygun olarak tasarlanan vida yatakları ve pürüzsüz çalışma mafsalı, kapakların sessizce açılıp kapanmasını sağlar. Üstelik güçlü taşıma kapasitesi ile ağır zırhlı kapaklarda güvenle tercih edilebilir.</p><ul><li><strong>Dayanıklı Tasarım (${materialInfo}):</strong> Uzun yıllar süren ağır yük performansı.</li><li><strong>Sessiz Çalışma:</strong> Sürtünme önleyici mafsal mimarisi.</li><li><strong>Kolay Sabitleme:</strong> Tüm endüstri standartlarındaki pano kapaklarına uyumlu montaj ölçüleri.</li></ul><p>Tesisinizde veya ekipman üretiminizde kaliteden taviz vermemek için Teker Market hırdavat çözümlerini seçin.</p>`;
        short = `Panolarınız ve endüstriyel kapaklarınız için tasarlanan ${name}, ${materialInfo.toLowerCase()} yapısıyla ağır yük taşıma kapasitesine sahip uzun ömürlü profosyonel menteşe çözümüdür.`;
    }
    // MATCH FASTENERS AND COMPONENT PARTS
    else if (nameUpper.includes('VİDA') || nameUpper.includes('SOMUN') || nameUpper.includes('PUL') || nameUpper.includes('TAKOZ') || nameUpper.includes('KULP') || nameUpper.includes('FAN')) {
        const itemType = nameUpper.includes('FAN') ? 'Elektronik / Havalandırma Bileşeni' : nameUpper.includes('KULP') ? 'Paneller İçin Taşıma/Çekme Kulbu' : 'Bağlantı ve Montaj Elemanı';
        html = `<h2>${name}: Endüstriyel Montajda Eksiksiz Tamamlayıcı</h2><p>Makine şasilerinden hafif taşıma platformlarına kadar birçok projede temel bir taşıyıcı/tamamlayıcı öğe olan <strong>${name}</strong>, tasarımında işlevselliği temel alır. Paslanmaz metal ve esnetilmiş endüstriyel kauçuk/plastik karışımlarından üretilen ilgili parçalarımız, çalışma performansınızı üst düzeye çıkarır.</p><p>Sınıfının en iyi materyalleri kullanılarak formize edilen bu ${itemType.toLowerCase()}, titreşime ve fiziksel asimetriye direnen bir yapıdadır.</p><ul><li><strong>Profesyonel Mukavemet:</strong> Yıpranmaya ve sök-tak işlemlerine uyumlu form.</li><li><strong>OEM Standartları:</strong> Üretim hattınıza birebir uyan ebat ve geometrik tasarım.</li><li><strong>Kesintisiz Destek:</strong> Performans dalgalanması yaşatmadan işlevini yerine getirir.</li></ul><p>Üst düzey endüstriyel ${itemType.toLowerCase()} ihtiyaçlarınızı doğrudan stoktan hızlı kargo seçeneğiyle sipariş edebilirsiniz.</p>`;
        short = `Tesis bileşenleri ve makine sistemleri için uygun standartlarda üretilen ${name}, yüksek performans sağlayan güvenilir endüstriyel montaj elemanıdır.`;
    }
    // CATCH-ALL
    else {
        html = `<h2>${name}: Garantili Endüstriyel Çözüm</h2><p>Projenizde veya tesisinizde maksimum performans arayışınıza mükemmel yanıt veren <strong>${name}</strong>, tescilli malzeme kalitesiyle size uzun yıllar sorunsuz kullanım garantiler. Gerek dış zırhı gerekse yapısal mimarisi endüstriyel taşıma ve konstrüksiyon standartlarına uymak üzere fabrikasyon testlerinden geçirilmiştir.</p><p>Bakım gerektirmeyen uzun servis ömrü, korozyona dayanıklı koruma yüzeyi ve pratik monte edilebilmesi sayesinde üretim bantlarınızda aksama yaratmaz.</p><ul><li><strong>Birinci Sınıf Bileşenler:</strong> Yüksek basınca ve aşınmalara tam direnç.</li><li><strong>Uzun Operasyon Ömrü:</strong> Fabrika içi yoğun günlük kullanımlarda formunu %100 korur.</li><li><strong>Geniş Çaplı Uyumluluk:</strong> Ergonomik ebatları ile tüm uluslararası standartlarla uyumludur.</li></ul><p>Teker Marketin donanım uzmanlığı ile işinizde aksama yaşamamak için şimdi stoktan tedarik edin.</p>`;
        short = `Yüksek kaliteli ve stabil yapısal dayanıklılığa sahip olan ${name}, endüstriyel projelerinizde uzun ömürlü ve garantili performans sağlayan donanımdır.`;
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
            .limit(5000); // Need a large chunk to cross-reference

        if (error) {
             console.error('Error fetching products:', error.message);
             return;
        }

        const normalizedExcelSkus = new Set(excelSkus.map(s => s.trim().toUpperCase()));
        // Note: Filter trims SKUs on both sides
        const matchedProducts = products.filter(p => p.sku && normalizedExcelSkus.has(p.sku.trim().toUpperCase()));

        // Take exactly 100 
        const batch = matchedProducts.slice(0, 100);

        if (batch.length === 0) {
            console.log('No matched products left to process.');
            return;
        }

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
        console.log(`\nProcessed ${successCount} Excel-matched products for Group 7.`);

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();
