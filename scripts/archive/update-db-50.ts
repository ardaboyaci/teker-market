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

    if (nameUpper.includes('KÜP MENTEŞE')) {
        const material = nameUpper.includes('PİRİNÇ') ? 'Pirinç' : nameUpper.includes('OTOMAT') ? 'Otomat Çeliği' : 'Metal';
        const coating = nameUpper.includes('NİKEL') ? 'Nikel Kaplamalı' : nameUpper.includes('ÇİNKO') ? 'Çinko Kaplamalı' : nameUpper.includes('KAPLAMASIZ') ? 'Kaplamasız (Ham)' : 'Standart Kaplama';
        const sizeMatch = nameUpper.match(/(\d+)\s*MM/);
        const size = sizeMatch ? sizeMatch[1] : 'Standart';

        html = `<h2>${name}: Dayanıklı ve Estetik Bağlantı Çözümü</h2><p>Makine kapakları, endüstriyel panolar ve özel mobilya tasarımları için vazgeçilmez bir bağlantı elemanı olan <strong>${name}</strong>, yüksek taşıma kapasitesi ve sarsılmaz tutuş sağlar. Üretiminde kullanılan birinci sınıf ${material} malzemesi sayesinde uzun yıllar boyunca aşınmalara ve korozyona karşı direnç gösterir.</p><p>${size} mm profil ölçüsü ile dar alanlara dahi mükemmel uyum sağlayan bu küp menteşe, ${coating} dış yüzeyi ile hem endüstriyel tasarımlarda hem de dekoratif projelerde şık bir görünüm sunar.</p><ul><li><strong>Yüksek Kaliteli Malzeme:</strong> Eğilme ve kırılmalara karşı test edilmiş ${material} gövde.</li><li><strong>Kusursuz Yüzey İşlemi:</strong> Dış etkenlere ve neme karşı koruyan ${coating} özel yapı.</li><li><strong>Pratik Montaj:</strong> Pano ve kapak sistemlerine hızlı ve sağlam geçiş.</li></ul><p>Uzun vadeli sağlamlık arıyorsanız, endüstriyel standartları tam karşılayan bu küp menteşe modelini Teker Market güvencesiyle hemen tedarik edin.</p>`;
        short = `${size}mm kalınlıklı ve ${coating} yüzey korumalı ${name}, endüstriyel panolar ve makineler için yüksek dayanıklılığa sahip ${material} küp menteşedir.`;
    
    } else if (nameUpper.includes('GİZLİ PANO MENTEŞESİ')) {
        const coating = nameUpper.includes('ÇİNKO') ? 'Çinko Kaplama' : nameUpper.includes('KAPLAMASIZ') ? 'Kaplamasız (Ham Gövde)' : 'Standart Alaşım';
        
        html = `<h2>${name}: Dışarıdan Görünmeyen Kusursuz Güvenlik</h2><p>Elektrik panoları, makine kontrol kabinleri ve güvenlik dolapları için özel olarak geliştirilen <strong>${name}</strong>, dışarıdan hiçbir şekilde müdahale edilemeyen "gizli" tasarımıyla üst düzey bir mekanik koruma sunar. Pano kapağı kapatıldığında tamamen içeride kalarak hırsızlık, manipülasyon ve dış darbe riskini sıfıra indirir.</p><p>Ağır zırhlı kapakları dahi sarkma yapmadan taşıyabilen yapısı, ${coating} korumasıyla nemli ve zorlu fabrika koşullarında paslanmaya karşı yüksek direnç gösterir.</p><ul><li><strong>Anti-Sabotaj Tasarımı:</strong> Dışarıdan sökülemeyen, tamamen kapak içinde çalışan sistem.</li><li><strong>Ağır Yük Mukavemeti:</strong> Pano kapaklarının zamanla sarkmasını önleyen rijit gövde.</li><li><strong>Geniş Açılma Pesi:</strong> Kapaklara rahat müdahale imkanı veren geniş açılı ergonomi.</li></ul><p>Tesis güvenliğinizi ve donanım korumanızı garanti altına alacak profesyonel gizli pano menteşeleri Teker Market farkıyla stoklarda.</p>`;
        short = `Dışarıdan müdahaleye tamamen kapalı özel tasarımı ve ${coating} koruması ile ${name}, elektrik ve makine panolarında üst düzey güvenlikli gizli menteşedir.`;

    } else if (nameUpper.includes('PANO KAPAK MENTEŞESİ') || nameUpper.includes('KENAR MENTEŞE')) {
        const type = nameUpper.includes('KENAR') ? 'Kenar Menteşe' : 'Pano Kapak Menteşesi';
        const coating = nameUpper.includes('KROM') ? 'Krom Kaplama' : nameUpper.includes('SİYAH') ? 'Siyah Boyalı' : 'Standart Yüzey';
        
        html = `<h2>${name}: Estetik ve Katı Endüstriyel Bağlantı</h2><p>Elektrik kabinleri, jeneratör kapakları ve metal dolaplar için en sık tercih edilen sarsılmaz bağlantı parçalarından biri olan <strong>${name}</strong>, fonksiyonellik ve sadeliği birleştirir. Kapakların rahatça ve sessizce açılıp kapanmasını sağlayan mekanizması pürüzsüz çalışır.</p><p>${coating} izolasyonu sayesinde dış ortamda ve tozlu fabrika alanlarında formunu korur. Kaliteli zamak/metal döküm teknolojisi kullanılarak üretilmiş olup, ağır kapaklarda dahi aşırı kullanıma karşı yorulma yapmaz.</p><ul><li><strong>Dayanıklı Yüzey:</strong> Korozyona ve çizilmelere ekstra dirençli ${coating}.</li><li><strong>Pürüzsüz Çalışma:</strong> Kapak açılıp kapanmalarında ses yapmayan mil yuvası.</li><li><strong>Mükemmel Uyum:</strong> Geleneksel ${type} montaj deliklerine %100 standart uyum.</li></ul><p>Hızlı kurulum ve endüstriyel kalıcılık arıyorsanız bu yüksek performanslı menteşe donanımına Teker Market üzerinden cazip fiyatlarla sahip olabilirsiniz.</p>`;
        short = `${coating} dış koruması ile uzun ömürlü ${type} yapısı sunan ${name}, elektrik panoları ve kontrol kabinleri için rijit döküm alaşıma sahiptir.`;

    } else {
        html = `<h2>${name}: Garantili Endüstriyel Çözüm</h2><p>Projenizde veya tesisinizde maksimum performans arayışınıza yanıt veren <strong>${name}</strong>, test edilmiş malzeme kalitesiyle size uzun yıllar sorunsuz hizmet eder. Gerek dış zırhı gerekse yapısal mimarisi endüstriyel taşıma ve bağlantı standartlarına uymak üzere fabrikasyon işlemlerinden geçirilmiştir.</p><p>Bakım gerektirmeyen uzun servis ömrü, korozyona dayanıklı yüzeyi ve pratik entegre edilebilmesi sayesinde üretim bantlarınızda aksama yaratmaz.</p><ul><li><strong>Birinci Sınıf Malzeme:</strong> Yüksek basınca ve aşınmalara tam dirençli alaşım.</li><li><strong>Uzun Operasyon Ömrü:</strong> Fabrika içi yoğun günlük kullanımlarda form bozukluğu yaratmaz.</li><li><strong>Uluslararası Uyumluluk:</strong> Ergonomik ebatları ile tüm sektörel standartlarla entegredir.</li></ul><p>Teker Marketin lojistik ve hırdavat uzmanlığı ile profesyonel çözüme en uygun fiyatlarla ulaşın.</p>`;
        short = `Yüksek kaliteli alaşıma ve korozyon korumalı dış yüzeye sahip ${name}, endüstriyel projelerinizde uzun ömürlü ve performanslı kullanım sunan profesyonel ekipmandır.`;
    }

    return { html, short };
}

async function run() {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name')
        .is('deleted_at', null)
        .eq('status', 'active')
        .or('description.is.null,description.eq.""')
        .limit(50);

    if (error) {
         console.error('Error fetching remaining products:', error);
         return;
    }

    if (!products || products.length === 0) {
        console.log('No products to process.');
        return;
    }

    let successCount = 0;
    for (const p of products) {
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
            console.log(`Successfully updated ${p.sku}`);
            successCount++;
        }
    }
    console.log(`\nProcessed ${successCount} hardware/hinge products.`);
}

run().catch(console.error);
