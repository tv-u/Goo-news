import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
const parser = new Parser();

const FEEDS = {
  world: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://www.aljazeera.com/xml/rss/all.xml'],
  india: ['https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://indianexpress.com/section/india/feed/'],
  technology: ['https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.wired.com/feed/rss', 'https://www.engadget.com/rss.xml'],
  sports: ['https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040', 'https://www.bbc.com/sport/rss.xml'],
  business: ['https://feeds.bbci.co.uk/news/business/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://www.forbes.com/business/feed/'],
  politics: ['https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://feeds.bbci.co.uk/news/politics/rss.xml', 'https://www.politico.com/rss/politicopicks.xml'],
  science: ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://www.sciencedaily.com/rss/all.xml'],
  health: ['https://feeds.bbci.co.uk/news/health/rss.xml', 'https://www.medicalnewstoday.com/rss'],
  entertainment: ['https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'https://variety.com/feed/'],
  gaming: ['https://feeds.feedburner.com/ign/games-all', 'https://www.polygon.com/rss/index.xml']
};

let usedImages = new Set();

function getPoster(item, content) {
    let img = null;
    if (item['media:content']?.$?.url) img = item['media:content'].$.url;
    else if (item.enclosure?.url) img = item.enclosure.url;
    else if (item['media:thumbnail']?.$?.url) img = item['media:thumbnail'].$.url;
    if (!img && content) {
        const m = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        for (let match of m) {
            if (!match[1].match(/logo|icon|1x1|pixel/i) && match[1].startsWith('http')) {
                img = match[1]; break;
            }
        }
    }
    if (img) img = img.replace(/&amp;/g, '&');
    if (!img || usedImages.has(img)) return null;
    usedImages.add(img);
    return img;
}

(async () => {
    console.log(`🚀 डेटा जनरेट हो रहा है...`);
    let allArticles = [];
    let idCounter = 1;

    for (const [cat, urls] of Object.entries(FEEDS)) {
        for (const url of urls) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                
                // 50 न्यूज़ प्रति फीड (ताकि डेटा बहुत सारा हो)
                feed.items.slice(0, 50).forEach(item => {
                    const content = item['content:encoded'] || item.content || item.description || '';
                    const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                    if (!item.title || !cleanDesc) return;

                    const posterUrl = getPoster(item, content);
                    if (!posterUrl) return;

                    allArticles.push({
                        id: `news-${idCounter++}`,
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        snippet: cleanDesc.substring(0, 160) + '...',
                        fullText: cleanDesc.substring(0, 3000),
                        image: posterUrl,
                        source: feed.title || 'Goo-News',
                        category: cat
                    });
                });
            } catch(e) {}
        }
    }

    // डुप्लीकेट हटाएं और टॉप 3000 खबरें सेव करें
    const unique = Array.from(new Map(allArticles.map(a => [a.title, a])).values());
    const sorted = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 3000);
    
    fs.writeFileSync('news.json', JSON.stringify(sorted, null, 2));
    console.log(`🎉 सफल! कुल ${sorted.length} खबरें सेव हो गईं (Unlimited Scroll के लिए तैयार)।`);
})();
