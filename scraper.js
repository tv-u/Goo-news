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
  entertainment: ['https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'https://variety.com/feed/', 'https://www.hollywoodreporter.com/feed/'],
  gaming: ['https://feeds.feedburner.com/ign/games-all', 'https://www.polygon.com/rss/index.xml'],
  crypto: ['https://cointelegraph.com/rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/']
};

function getImg(item, content, category) {
    let img = null;
    if (item.enclosure && item.enclosure.url) img = item.enclosure.url;
    else if (item['media:content'] && item['media:content'].$) img = item['media:content'].$.url;
    else if (item['media:thumbnail'] && item['media:thumbnail'].$) img = item['media:thumbnail'].$.url;
    
    if (!img) {
        const match = content.match(/<img[^>]+src="([^">]+)"/);
        if (match) img = match[1];
    }
    
    if (img && img.startsWith('http')) return img;
    
    // Category specific premium fallback images (No duplicates)
    const fallbacks = {
        world: 'https://images.unsplash.com/photo-1526470498-9ae73c66517b?w=800&q=80',
        politics: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
        technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
        sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
        business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
        science: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
        health: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80',
        entertainment: 'https://images.unsplash.com/photo-1603199506016-b9a594b593c0?w=800&q=80',
        gaming: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&q=80',
        crypto: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80'
    };
    return fallbacks[category] || fallbacks.world;
}

(async () => {
    console.log('🚀 सुपर स्क्रैपर शुरू...');
    let all = [];
    let idCounter = 1;
    
    for (const [category, urls] of Object.entries(FEEDS)) {
        for (const url of urls) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                feed.items.slice(0, 10).forEach(item => {
                    const content = item['content:encoded'] || item.content || item.description || '';
                    const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                    all.push({
                        id: `news-${idCounter++}`,
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        snippet: cleanDesc.substring(0, 160) + '...',
                        fullText: cleanDesc.substring(0, 3000),
                        image: getImg(item, content, category),
                        source: feed.title || 'Goo-News',
                        category: category
                    });
                });
                console.log(`✅ ${category}: ${url.split('/')[2]}`);
            } catch(e) { console.log(`❌ Skip: ${url.split('/')[2]}`); }
        }
    }
    const unique = Array.from(new Map(all.map(a => [a.title, a])).values());
    fs.writeFileSync('news.json', JSON.stringify(unique, null, 2));
    console.log(`🎉 सफल! कुल ${unique.length} अनोखी न्यूज़ सेव हो गईं।`);
})();
