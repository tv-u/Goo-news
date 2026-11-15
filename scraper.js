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

function getOriginalPoster(item, content) {
    let img = null;
    // 1. Check Enclosure
    if (item.enclosure && item.enclosure.url && item.enclosure.type?.includes('image')) img = item.enclosure.url;
    // 2. Check Media Content
    else if (item['media:content'] && item['media:content'].$) img = item['media:content'].$.url;
    // 3. Check Media Thumbnail
    else if (item['media:thumbnail'] && item['media:thumbnail'].$) img = item['media:thumbnail'].$.url;
    
    // 4. Extract from HTML content if not found above
    if (!img && content) {
        const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match) img = match[1];
    }
    
    // Clean up URL
    if (img && img.startsWith('http')) {
        return img.replace(/&amp;/g, '&');
    }
    return null;
}

(async () => {
    console.log('🚀 ओरिजिनल पोस्टर्स वाला स्क्रैपर शुरू...');
    let categorizedNews = {};
    let idCounter = 1;
    let usedImages = new Set(); // To prevent duplicate images across the site
    
    for (const [category, urls] of Object.entries(FEEDS)) {
        categorizedNews[category] = [];
        for (const url of urls) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                
                feed.items.forEach(item => {
                    if (categorizedNews[category].length >= 100) return; // Max 100 per category
                    
                    const content = item['content:encoded'] || item.content || item.description || '';
                    const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                    if(!item.title || !cleanDesc) return;

                    const posterUrl = getOriginalPoster(item, content);
                    
                    // STRICT FILTER: Skip if no image found OR if image is already used by another article
                    if (!posterUrl || usedImages.has(posterUrl)) return;
                    
                    usedImages.add(posterUrl);

                    categorizedNews[category].push({
                        id: `news-${idCounter++}`,
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
    console.log(`🎉 सफल! कुल ${unique.length} न्यूज़ (सभी के असली पोस्टर्स) सेव हो गईं।`);
})();
