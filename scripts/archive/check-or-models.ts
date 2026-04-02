import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const OR_KEY = process.env.OPENROUTER_API_KEY!;

async function main() {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${OR_KEY}` }
  });
  const json = await res.json();
  // sadece ücretsiz modelleri listele
  const free = (json.data || []).filter((m: any) => 
    m.id.includes(':free') || m.pricing?.prompt === '0'
  );
  console.log('Free models:', free.map((m: any) => m.id).join('\n'));
}
main().catch(console.error);
