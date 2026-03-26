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
    if (nameUpper.includes('OYN.') || nameUpper.includes('OYNAK') || nameUpper.includes('SABİT') || nameUpper.includes('SAB.') || nameUpper.includes('FRENLİ') || nameUpper.includes('TEKERLEK') || nameUpper.includes('JANT') || nameUpper.includes('RULMANLI') || nameUpper.includes('PUR') || nameUpper.includes('SLB') || nameUpper.includes('ADR') || nameUpper.includes('DUR')) {
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
        else if (nameUpper.includes('LASTİK') || nameUpper.includes('SLB')) material = 'Sarsıntı Emici Çevreci Lastik';
        else if (nameUpper.includes('PVC')) material = 'Sessiz ve Çizmez PVC';
        else if (nameUpper.includes('ALÜMİNYUM') || nameUpper.includes('ALÜ.')) material = 'Alüminyum Döküm Gövde';
        else if (nameUpper.includes('DÖKÜM') || nameUpper.includes('DUR')) material = 'Ağır Sanayi Döküm (Pik)';
        else if (nameUpper.includes('PUR')) material = 'Poliüretan Kaplı Ekstra Sessiz';
        
        const mountType = nameUpper.includes('VİDALI') ? 'Vidalı Bağlantı' : nameUpper.includes('TABLALI') ? 'Tablalı (Flanşlı) Bağlantı' : nameUpper.includes('PİMLİ') ? 'Pimli (Geçmeli)' : 'Standart Mil/Burç';

        html = `<h2>${name}: Emes Kalitesiyle Mükemmel Taşıma Performansı</h2><p>Lojistik taşıma arabalarınız, fabrika ekipmanlarınız ve raf sistemleriniz için orijinal Emes standartlarında üretilen <strong>${name}</strong>, endüstriyel mobiliteyi baştan tanımlıyor. Özel formülize edilmiş ${material} dış katman ve jant yapısı, zorlu fabrika zeminlerinde üstün tutunuş sağlarken, sıfıra yakın yuvarlanma direnci ile personel eforundan tasarruf yaratır.</p><p>${dimensions} dış konfigürasyonu ile cihazınıza tam uyum gösteren bu tekerlek; ${mountType} sayesinde saniyeler içinde şasiye güçlü bir şekilde entegre edilir. Emes mühendisliğinin getirdiği <strong>${movement.charAt(0).toUpperCase() + movement.slice(1).toLowerCase()}</strong> çalışma donanımı ile tekerleğin manevra serbestisini ihtiyacınıza göre ayarlayabilirsiniz.</p><ul><li><strong>Dayanıklı ve Zemin Dostu:</strong> Kimyasallara ve sert zemin sürtünmelerine ekstra uzun ömürlü dış yüzey.</li><li><strong>Pratik Montaj Çözümü:</strong> Ağır cihazların yük merkezine uygun dengeli ${mountType} tasarımı.</li><li><strong>Şok ve Sarsıntı Emilimi:</strong> Düzensiz beton zeminlerin pürüzlerini taşıyıcı arabaya yansıtmayan profesyonel rotasyon.</li></ul><p>Tesisinizde sarsıntısız bir lojistik operasyon kurmak için ${name} modelini Teker Market kalite güvencesiyle hemen sipariş edebilirsiniz.</p>`;
        short = `Emes güvencesi ve kalitesiyle ${dimensions} ölçülerinde üretilen ${name}; güvenilir ${material} zemin teknolojisi ile araba/makineleriniz için güçlü taşıma hacmi sağlar.`;
    }
    // KAUÇUK TAKOZ VE KÖŞE BİLEŞENLERİ
    else if (nameUpper.includes('TAKOZ') || sku.toUpperCase().startsWith('KT')) {
        const typeMatch = nameUpper.match(/TİP\s([A-D])/i);
        const tip = typeMatch ? typeMatch[1] : 'Endüstriyel';
        const dimMatch = nameUpper.match(/(\d+)(x|\*)(\d+)/i);
        const dimensions = dimMatch ? `${dimMatch[1]}x${dimMatch[3]}mm` : 'Özel Seri';

        html = `<h2>${name}: Maksimum İzolasyon ve Titreşim Önleyici Zemin Takozu</h2><p>Makine ve ağır motor bloklarının zeminle olan bağlantısını en sarsılmaz şekilde sabitleyen <strong>${name}</strong> Kauçuk Takoz, çalışma esnasında doğan gürültü ve yüksek voltajlı sarsıntıları doğrudan absorbe eder. Sektörel olarak Tip ${tip} mühendislik tasarımına sahip olan bu profesyonel ürün; dizel jeneratör, pres makinesi ve kompresörlerdeki şiddetli zemin deformasyonunu önlemek için üretilmiştir.</p><p>${dimensions} fiziksel ölçü yelpazesi ile makine şasisine rijit bir şekilde oturur; vulkanize kauçuk ve metal konstrüksiyonun dayanıklı birleşimiyle kopma yırtılma gibi problemleri asla yaşatmaz.</p><ul><li><strong>Etkin Şok ve Rezonans Emilimi:</strong> Yüksek yoğunluklu kauçuk kimyası sayesinde zemine korozyon etkisi yaratan titreşimi tamamen sönümler.</li><li><strong>Ağır Sanayi Kalitesi:</strong> Tonluk devasa makine basınçlarına %100 dayanıklı Tip ${tip} güvenli bağlantı.</li><li><strong>Çalışma Alanı Konforu:</strong> Motor ve krank kaynaklı çalışma gürültülerini tabana inmeden önce yalıtır.</li></ul><p>Zorlu fabrika zeminlerinde ve hassas sistemlerde güvenli operasyonlar için bu profesyonel Emes Takozu parçasını detaylı inceleyip edinebilirsiniz.</p>`;
        short = `Profesyonel Tip ${tip} formasyonundaki ${dimensions} çaplı ${name} kauçuk takoz, makinelerinizden kaynaklanan yorucu motor titreşimini ve darbe sarsıntılarını izole eden bir güvenlik ekipmanıdır.`;
    }
    // ENDÜSTRİYEL DONANIM - MENTEŞE, KİLİT, PANO PARÇALARI
    else if (nameUpper.includes('MENTEŞE') || nameUpper.includes('KİLİT') || nameUpper.includes('KULP') || nameUpper.includes('MANDAL') || nameUpper.includes('FIRÇA') || nameUpper.includes('FAN')) {
        let type = nameUpper.includes('MENTEŞE') ? 'Menteşe, Dolap ve Kapak Bağlantı' : nameUpper.includes('KİLİT') ? 'Yüksek Güvenlik ve Kilit' : 'Endüstriyel Pano ve Çekmece';
        html = `<h2>${name}: Ağır Sanayi Dolapları ve Pano Sistemleri İçin İdeal Donanım</h2><p>Metal dolaplar, çoklu çekmeceli atölye arabaları, elektronik makine kabin sistemleri ve jeneratör kapaklarında kullanıma uygun tasarlanan <strong>${name}</strong>, orijinal donanım malzemesi standartlarında imal edilmiştir. Katı metal/alaşım mimarisindeki bu üstün hırdavat çözümü, sürtünme kaybını sıfıra indirerek sık kullanım testlerinden formunu koruyarak geçmiştir.</p><p>Makine donanımlarındaki yalıtım, güvenlik veya rijit bağlantı ihtiyacına yanıt veren bu premium ürün, nemli sanayi ortamlarında, toz partikülü aşındırmalarında veya fabrika içi solvent serpintilerinde kimyasal ve mekanik bütünlüğünü ilk günkü gibi sürdürür.</p><ul><li><strong>Termal Dirençli Endüstriyel Dış Zırh:</strong> Vuruklara, çizilmelere ve bölgesel korozyon etkilerine karşı mukavemet gösteren sertleştirilmiş materyal.</li><li><strong>Güçlendirilmiş ${type} Dinamiği:</strong> Gıcırtı, gevşeme veya boşluk tölere etmeden net kavrama sunan mekanizma hassasiyeti.</li><li><strong>Nizami Entegrasyon:</strong> Piyasadaki evrensel şasi ve sac levhalardaki yuva ve delik standartlarına %100 uyumluluk.</li></ul><p>Uzun vadeli dayanıklılık isteyenlere yönelik hazırlanan bu parçaya Teker Market ayrıcalığıyla ve uygun lojistik çözümleriyle hemen ulaşabilirsiniz.</p>`;
        short = `Panolarınız, çekmeceleriniz ve çelik makine kabinleriniz için özel kalıp dökümü yapılmış olan ${name}, zorlu dış çevrelere mükemmel tahammül eden uzun ömürlü uzman hırdavat aksesuarıdır.`;
    }
    // 4. BAĞLANTI ELEMANLARI / GENEL YEDEK PARÇA
    else {
        html = `<h2>${name}: Tüm Projeleriniz İçin Orijinal Uyumlu Endüstriyel Donanım</h2><p>Lojistik araç imalatı, taşıyıcı sehpa modernizasyonu ve sistem bileşenleri değişimlerinde mutlak başarı vadeden <strong>${name}</strong>, eksiksiz donanım gereksiniminizi orijinal ekipman üreticisi kalitesiyle (OEM) sağlar. Uzman otomasyon ekiplerinin ve usta makinecilerin ilk tercihi olan bu endüstriyel parça, arıza veya periyodik yenileme süreçlerinizi kusursuz biçimde destekler.</p><p>Özel tolerans ayarları uygulanmış rijit gövdesi, bağlantı esnasında sök-tak yıpranmaları yaşatmaz. Böylece ağır kapasiteli döküm veya montaj hatlarında çalışma döngünüz duraksamaya uğramadan devam eder.</p><ul><li><strong>Dayanıklı Enjeksiyon Cisim:</strong> Dış darbelerin yanında fiziksel kırılma ve çatlama oranlarını minimuma çeken gelişmiş malzeme bileşeni.</li><li><strong>Güvenilir Servis Ömrü:</strong> Rutin bakım periyotlarında veya ağır çalışma eforu altında operasyon kaybına sebep olmaz.</li><li><strong>Sorunsuz Parça Değişimi:</strong> Eski yorgun bileşenlerinizi çıkarıp anında yenisiyle entegre olabilmesi için genel tasarıma standart ölçülerle oturur.</li></ul><p>Marka standartlarından ödün vermeksizin projelerinizi destekleyen bu nitelikli ürünü Teker Market garantisi kapsamında sipariş listenize ekleyebilirsiniz.</p>`;
        short = `Montaj esnasındaki yüksek malzeme direnci ve projelerdeki tam adaptasyonu sayesinde ${name}, işletmenizin günlük ekipman onarımlarında %100 kalıcı işlev gören profesyonel yardımcı bağlantı takviyesidir.`;
    }

    return { html, short };
}

async function run() {
    try {
        console.log("Loading Full Deep Excel Text Data (67,700 rows)...");
        const rawData = fs.readFileSync('scripts/deep_excel_text.json', 'utf8');
        const excelDataRaw: string[] = JSON.parse(rawData);
        
        const excelTextSet = new Set(excelDataRaw.map(s => s.trim().toUpperCase()));
        console.log(`Deep Text set loaded size: ${excelTextSet.size}`);

        let allMatchedProducts: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log("Paginating through entire Superbase products table for missing descriptions...");

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
                if (p.sku && excelTextSet.has(p.sku.trim().toUpperCase())) {
                    allMatchedProducts.push(p);
                }
            }
            page++;
        }

        console.log(`Discovered EXACTLY ${allMatchedProducts.length} Emes products matched via deep-search!`);

        if (allMatchedProducts.length === 0) {
            console.log("No new products to update!");
            return;
        }

        console.log("Initiating Massive Parallel Update Sequence...");

        let successCount = 0;
        let errorCount = 0;
        const chunkSize = 50; 

        // We will speed this up slightly by increasing parallelism
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
            
            // Log every 500 items to avoid terminal spam
            if ((i + chunkSize) % 500 === 0 || i + chunkSize >= allMatchedProducts.length) {
                console.log(`Updating... ${Math.min(i + chunkSize, allMatchedProducts.length)} / ${allMatchedProducts.length}`);
            }
            // 20ms pause purely to prevent REST connection flooding 
            await new Promise(r => setTimeout(r, 20));
        }

        console.log(`\n============== FINAL REPORT ==============`);
        console.log(`Successfully Generated & Uploaded: ${successCount} products`);
        console.log(`Failed / Errors: ${errorCount} products`);

    } catch (e) {
        console.error('Script Error:', e);
    }
}

run();
