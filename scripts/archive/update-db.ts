import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const data = [
  {
    sku: 'AÇKKt 12512',
    description: `<h2>AÇKKt 12512 Alüminyum Çark (Turuncu): Pratik Katlanır Kol Tasarımı</h2><p>Endüstriyel taşıma arabaları ve mobil makine sistemleri için yenilikçi bir çözüm sunan <strong>AÇKKt 12512 Alüminyum Çark Katlanır Kollu (Turuncu)</strong>, yüksek manevra kabiliyeti ve pratik kullanımı bir araya getiriyor. Kullanılmadığı zaman pratik bir şekilde içe doğru katlanabilen özel tasarım kolu sayesinde, dar manevra alanlarında ayak takılması veya makinelere çarpma gibi iş güvenliği risklerini tamamen ortadan kaldırır.</p><p>Dikkat çekici turuncu rengiyle depolama alanlarında görsel bir uyarı niteliği taşıyan bu model, aynı zamanda standart alüminyum jantların tüm sağlamlığını barındırır. Emes güvencesiyle ağır yük altında deformasyona uğramazken, tekerlek hareketliliğini en düşük yuvarlama direncinde tutar.</p><ul><li><strong>İş Güvenliği:</strong> Darbelere karşı katlanır kol mekanizması.</li><li><strong>Fark Edilebilir Renk:</strong> Görünürlüğü yüksek, dikkat çekici tasarım.</li><li><strong>Yük Taşıma Dengesi:</strong> Dayanıklı döküm jant çekirdeği.</li><li><strong>Bakım Gerektirmeyen Yapı:</strong> Sağlam mafsallar ve paslanmaz vida yatakları.</li></ul><p>Uzun süreli endüstriyel kullanımda konforunuzu garanti altına almak için en iyi çözümü sunan bu modele, Teker Market avantajlarıyla hemen sahip olabilirsiniz.</p>`,
    short_description: `AÇKKt 12512 Turuncu Alüminyum Çark, pratik katlanır kolu sayesinde dar alanlarda takılma riskini önleyen, dayanıklı ve ergonomik endüstriyel tekerlektir.`
  },
  {
    sku: 'AÇKKt 20018',
    description: `<h2>AÇKKt 20018 Turuncu Alüminyum Çark: Ağır Yüklerde Yüksek Kontrol</h2><p>Büyük boyutlu ekipmanların hareketliliğinde maksimum güvenlik arayanlar için geliştirilen <strong>AÇKKt 20018 Alüminyum Çark Katlanır Kol (Turuncu)</strong>, 200mm'lik ideal çapı sayesinde ağır yük arabalarında mükemmel bir ağırlık transferi ve denge sağlar. Çalışma sırasında kolayca katlanabilen özel kolu sayesinde alan tasarrufu yaratır ve iş güvenliğini en üst seviyeye çıkartır.</p><p>Korozyona dayanıklı yapısı, sıvı ve kimyasal temasının olduğu fabrika zeminleri için mükemmel bir alternatiftir. Akıcı bir sürüş sergileyerek yük çekme gücünü azaltır ve profesyonel lojistik faaliyetlerinin hızını doğrudan artırır.</p><ul><li><strong>Geniş Çap, Kolay Manevra:</strong> 200mm'lik dev yapı ile engellerde takılmaz sürüş.</li><li><strong>Akıllı Katlanır Mekanizma:</strong> Sürüş sonrası güvenli park pozisyonu.</li><li><strong>Darbe Emici Tasarım:</strong> Bozuk zeminlerde dahi sarsıntıyı önleyen jant uyumu.</li></ul><p>En zorlu ortamlar için hazırlanan özel tasarıma Teker Market üzerinden cazip fiyatlarla ulaşın.</p>`,
    short_description: `200mm çapındaki AÇKKt 20018 Turuncu Alüminyum Çark, katlanabilir kol güvenlik sistemiyle ağır sanayi arabaları için mükemmel bir taşıma deneyimi sunar.`
  },
  {
    sku: 'AÇKKt 16014',
    description: `<h2>AÇKKt 16014 Katlanır Kollu Alüminyum Çark (Turuncu)</h2><p>Atölye ve imalat ortamlarında verimliliği artırmak üzere tasarlanan <strong>AÇKKt 16014 Alüminyum Çark</strong>, endüstriyel profesyonellerin değişmez tercihidir. Güçlendirilmiş alüminyum profil yapısına entegre edilen, ayak takılmasını engelleyen katlanır kol teknolojisiyle modern bir mühendislik örneği sergiler. Çarpıcı turuncu renk detayı, kalabalık depolar içinde operatör güvenliğini sağlayan görsel bir uyanıştır.</p><p>Kaldırma mekanizmalarında veya itme-çekme proseslerinde üst düzey ergonomi sağlarken, uzun yıllar mekanik aşınmaya karşı direnen bir gövde sunar.</p><ul><li><strong>Ergonomik Katlanır Kol:</strong> Kullanım sonrasında sıfır risk bırakan, dışa taşmayan tasarım.</li><li><strong>Yüksek Korozyon Direnci:</strong> Kimyasal buharlara ve neme dayanıklı alüminyum alaşım.</li><li><strong>Stabil ve Düzenli Sürüş:</strong> Yüksek ağırlık altında dahi formu bozulmaz.</li></ul><p>Stoklar tükenmeden tesisinize uzun süreli sağlamlık kazandırmak için şimdi Teker Market'ten sipariş verin!</p>`,
    short_description: `AÇKKt 16014 Turuncu Alüminyum Çark, iş güvenliğini destekleyen katlanır kol mekanizmasına sahip, korozyona dayanıklı mobil sistem jantıdır.`
  },
  {
    sku: 'AÇKK 20018',
    description: `<h2>AÇKK 20018 Katlanır Kollu Alüminyum Çark: Güç ve Yenilik</h2><p>Konvansiyonel taşıma sistemlerinin ötesine geçen <strong>AÇKK 20018 Alüminyum Çark Katlanır Kollu</strong>; standart rengi, yüksek performansı ve inovatif tasarımıyla öne çıkar. Açık haldeyken güçlü bir yönlendirme/kilit mekanizması sunan bu ürün, hareket esnasında içe katlanarak taşıma arabasının veya makinenin iskelet sistemine sıfıra yakın hizalanarak ekstra güvenli bir çalışma alanı oluşturur.</p><p>Özellikle otomotiv ve ağır sanayi bantlarında operatörlere kullanım rahatlığı sağlayan bu büyük boyutlu jant, döküm alüminyumun hafiflik ve efsanevi dayanıklılığını bünyesinde taşır.</p><ul><li><strong>Ağır Sanayi Standardı:</strong> 200mm profil ile zorlu saha koşullarına direnç.</li><li><strong>Alan Yönetimi:</strong> Dışarı taşmayan mekanizması ile depo koridorlarında rahat geçiş.</li><li><strong>Sıfır Esneme:</strong> Statik ve dinamik ağırlıklar altında formu asla bozulmaz.</li></ul><p>Kurumsal taşıma projelerinde vazgeçilmeziniz olacak AÇKK 20018'i anında projenize entegre etmek için Teker Market müşteri hizmetleri veya online mağazamızla iletişime geçin.</p>`,
    short_description: `Operatör güvenliğini artıran katlanabilir kol yapısına sahip AÇKK 20018 Alüminyum Çark, ağır lojistik arabalarında konforlu ve sağlam bir sürüş sağlar.`
  },
  {
    sku: 'AÇ 160',
    description: `<h2>AÇ 160 Alüminyum Çark: Uzun Ömürlü Ağır Sanayi Taşıyıcısı</h2><p>Gelişmiş mühendislik ve üst düzey dayanıklılık felsefesinin ürünü olan <strong>AÇ 160 Alüminyum Çark</strong>, tesislerinizin tüm yükünü çekmeye hazırdır. Her türlü sert fabrika zemininde yüksek aşınma göstergelerine rağmen sarsıntısız bir kullanım sağlayan bu ürün, sağlam ve hafif yapısıyla bakım masraflarınızı radikal şekilde düşürür.</p><p>Poliüretan veya kauçuk kalıp işlemlerine mükemmel şekilde uyum sağlayan saf alüminyum çekirdeği, taşıma arabasının toplam ağırlığını artırmadan çok yüksek taşıma kapasitelerine ulaşmasına olanak sağlar. Düşük yuvarlanma direnci, enerji ve güç tasarrufunun merkezindedir.</p><ul><li><strong>Düşük Yuvarlanma Direnci:</strong> Tekerlek hareketini daha az fiziksel kuvvetle sağlar.</li><li><strong>Endüstriyel Mukavemet:</strong> Oksitlenme yapmayan pürüzsüz dış yüzey yapısı.</li><li><strong>Hafiflik ve Güç:</strong> Demire benzer yük kapasitesini çok daha hafif bir formla sunar.</li></ul><p>Teker Market ayrıcalıklarıyla sunulan bu eşsiz döküm ürüne hemen sahip olun, operasyonel hızınızı maksimuma taşıyın.</p>`,
    short_description: `AÇ 160 Alüminyum Çark, düşük yuvarlanma direnci ve hafif ama güçlü döküm yapısıyla, fabrika ortamlarındaki makine taşımaları için ideal bütçe dostu çözümdür.`
  }
];

async function run() {
    for (const item of data) {
        const { error } = await supabase
            .from('products')
            .update({ 
                description: item.description,
                short_description: item.short_description,
                updated_at: new Date().toISOString()
            })
            .eq('sku', item.sku);
            
        if (error) {
            console.error(`Error updating ${item.sku}:`, error.message);
        } else {
            console.log(`Successfully updated ${item.sku}`);
        }
    }
}

run().catch(console.error);
