import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
const parser = new Parser();

const FEEDS = {
  world: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://www.aljazeera.com/xml/rss/all.xml', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'],
  politics: ['https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://feeds.bbci.co.uk/news/politics/rss.xml', 'https://www.politico.com/rss/politicopicks.xml', 'https://indianexpress.com/section/india/feed/'],
  technology: ['https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.wired.com/feed/rss', 'https://www.engadget.com/rss.xml', 'https://www.gadgets360.com/rss/news'],
  sports: ['https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040', 'https://www.bbc.com/sport/rss.xml', 'https://indianexpress.com/section/sports/feed/'],
  business: ['https://feeds.bbci.co.uk/news/business/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://www.forbes.com/business/feed/', 'https://economictimes.indiatimes.com/rssfeedstopstories.cms'],
  science: ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', 'https://www.sciencedaily.com/rss/all.xml'],
  health: ['https://feeds.bbci.co.uk/news/health/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', 'https://www.medicalnewstoday.com/rss'],
  entertainment: ['https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'https://variety.com/feed/', 'https://www.hollywoodreporter.com/feed/']
};

let usedImages = new Set(); // ग्लोबल सेट ताकि कोई इमेज डुप्लीकेट न हो

function getHighQualityOriginal(item, content, id) {
    let img = null;
    
    // 1. Media Content (Usually Best HD Image)
    if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
        img = item['media:content'].$.url;
    }
    // 2. Enclosure
    else if (item.enclosure && item.enclosure.url) {
        img = item.enclosure.url;
    }
    // 3. Media Thumbnail
    else if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
        img = item['media:thumbnail'].$.url;
    }
    // 4. Extract from HTML Content (Find the first valid image)
    if (!img && content) {
        const imgMatches = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        for (let match of imgMatches) {
            let url = match[1];
            // Filter out tiny logos, icons, or tracking pixels
            if (!url.includes('logo') && !url.includes('icon') && !url.includes('1x1') && !url.includes('pixel') && url.startsWith('http')) {
                img = url;
                break;
            }
        }
    }

    // Clean URL
    if (img) img = img.replace(/&amp;/g, '&');

    // If image exists and is NOT a duplicate, use it
    if (img && !usedImages.has(img)) {
        usedImages.add(img);
        return img;
    }
    
    // Fallback: If no image OR it's a duplicate, generate a unique HD image using the article ID
    // This ensures 100% no duplicate posters ever!
    return `https://picsum.photos/seed/${id}-${Math.floor(Math.random()*1000)}/800/450`;
}

(async () => {
    console.log('🚀 HD ओरिजिनल पोस्टर स्क्रैपर शुरू...');
    let categorizedNews = {};
    let idCounter = 1;
    
    for (const [category, urls] of Object.entries(FEEDS)) {
        categorizedNews[category] = [];
        for (const url of urls) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                
                feed.items.slice(0, 20).forEach(item => {
                    if (categorizedNews[category].length >= 100) return;
                    
                    const content = item['content:encoded'] || item.content || item.description || '';
                    const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                    if(!item.title || !cleanDesc) return;

                    const newsId = `news-${idCounter++}`;
                    const posterUrl = getHighQualityOriginal(item, content, newsId);

                    categorizedNews[category].push({
                        id: newsId,
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        snippet: cleanDesc.substring(0, 160) + '...',
                        fullText: cleanDesc.substring(0, 3000),
                        image: posterUrl,
                        source: feed.title || 'Goo-News',
                        category: category
                    });
                });
                console.log(`✅ ${category}: ${url.split('/')[2]} (Total: ${categorizedNews[category].length})`);
            } catch(e) { console.log(`❌ Skip: ${url.split('/')[2]}`); }
        }
    }
    
    let all = Object.values(categorizedNews).flat();
    const unique = Array.from(new Map(all.map(a => [a.title, a])).values());
    
    fs.writeFileSync('news.json', JSON.stringify(unique, null, 2));
    console.log(`🎉 सफल! कुल ${unique.length} न्यूज़ (100% यूनिक HD पोस्टर्स के साथ) सेव हो गईं।`);
})();
