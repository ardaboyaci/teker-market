import axios from 'axios';
import * as cheerio from 'cheerio';

async function testSearch() {
  try {
    const query = 'EM 01 100';
    console.log(`Searching for: ${query}`);
    const res = await axios.get(`https://emesteker.com/tr/arama?q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(res.data);
    
    // find product links
    const links: string[] = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/urun/')) links.push(href);
    });

    const uniqueLinks = [...new Set(links)];
    console.log('Found product links:', uniqueLinks);

    if (uniqueLinks.length > 0) {
      const productUrl = uniqueLinks[0].startsWith('http') ? uniqueLinks[0] : `https://emesteker.com${uniqueLinks[0]}`;
      console.log(`Fetching product page: ${productUrl}`);
      const prodRes = await axios.get(productUrl);
      const $prod = cheerio.load(prodRes.data);
      
      // Attempt to find Açıklama or any text block
      const text = $prod('body').text().replace(/\s+/g, ' ').trim();
      console.log('Extracted Body text length:', text.length);
      console.log('Sample text:', text.substring(0, 500));
    }

  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
testSearch();
