import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
const parser = new Parser();

const FEEDS = [
    // World, Politics, Tech, Sports, Business, Health, Science, Entertainment
    'https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml',
    'https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040',
    'https://feeds.bbci.co.uk/news/business/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',
    'https://feeds.bbci.co.uk/news/health/rss.xml', 'https://variety.com/feed/',
    'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://indianexpress.com/section/india/feed/',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://www.politico.com/rss/politicopicks.xml',
    'https://www.aljazeera.com/xml/rss/all.xml', 'https://www.wired.com/feed/rss',
    'https://www.engadget.com/rss.xml', 'https://www.gadgets360.com/rss/news',
    'https://www.espn.com/espn/rss/soccer/news', 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    'https://www.forbes.com/business/feed/', 'https://cointelegraph.com/rss',
    'https://www.space.com/feeds/all', 'https://www.sciencedaily.com/rss/all.xml',
    'https://www.hollywoodreporter.com/feed/', 'https://feeds.feedburner.com/ign/games-all'
];

let usedImages = new Set();

function getPoster(item, content) {
    let img = null;
    if (item['media:content']?.$?.url) img = item['media:content'].$.url;
    else if (item.enclosure?.url) img = item.enclosure.url;
    else if (item['media:thumbnail']?.$?.url) img = item['media:thumbnail'].$.url;
    
    if (!img && content) {
        const m = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        for (let match of m) {
            let url = match[1];
            if (!url.match(/logo|icon|1x1|pixel|avatar|feedsportal/i) && url.startsWith('http')) {
                img = url; break;
            }
        }
    }
    if (img) img = img.replace(/&amp;/g, '&');
    
    // Strict: Return null if no image or duplicate (Frontend will handle fallback)
    if (!img || usedImages.has(img)) return null;
    usedImages.add(img);
    return img;
}

function getCategory(title, url) {
    const text = (title + url).toLowerCase();
    if (text.match(/tech|verge|wired|gadget/)) return 'technology';
    if (text.match(/sport|espn|sky|cricket/)) return 'sports';
    if (text.match(/politic|nytimes|politico/)) return 'politics';
    if (text.match(/business|finance|money/)) return 'business';
    if (text.match(/health|medic/)) return 'health';
    if (text.match(/science|space/)) return 'science';
    if (text.match(/movie|entertain|holly/)) return 'entertainment';
    return 'world';
}

(async () => {
    console.log(`🚀 स्क्रैपिंग शुरू (सिर्फ असली पोस्टर्स)...`);
    let allArticles = [];
    let idCounter = 1;

    for (const url of FEEDS) {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
            if(!res.ok) throw new Error("Bad Request");
            const xml = await res.text();
            const feed = await parser.parseString(xml);
            
            feed.items.slice(0, 15).forEach(item => {
                const content = item['content:encoded'] || item.content || item.description || '';
                const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                if (!item.title || !cleanDesc) return;

                const posterUrl = getPoster(item, content);
                if (!posterUrl) return; // Drop if no real poster

                allArticles.push({
                    id: `news-${idCounter++}`,
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate || new Date().toISOString(),
                    snippet: cleanDesc.substring(0, 160) + '...',
                    fullText: cleanDesc.substring(0, 3000),
                    image: posterUrl,
                    source: feed.title || 'Goo-News',
                    category: getCategory(feed.title || '', url)
                });
            });
            console.log(`✅ ${url.split('/')[2]} - OK`);
        } catch(e) { console.log(`❌ Skip: ${url.split('/')[2]}`); }
    }

    // Add 50 categories tag dynamically based on keywords
    allArticles.forEach(article => {
        if (article.category === 'world') {
            if (article.title.match(/election/i)) article.category = 'elections';
            if (article.title.match(/climate/i)) article.category = 'environment';
            if (article.title.match(/ai|artificial/i)) article.category = 'ai';
            if (article.title.match(/startup/i)) article.category = 'startups';
            if (article.title.match(/fashion/i)) article.category = 'fashion';
            if (article.title.match(/travel/i)) article.category = 'travel';
            if (article.title.match(/food|recipe/i)) article.category = 'food';
        }
    });

    const sorted = allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 1500);
    fs.writeFileSync('news.json', JSON.stringify(sorted, null, 2));
    console.log(`🎉 सफल! कुल ${sorted.length} खबरें (100% असली पोस्टर्स) सेव हो गईं।`);
})();
