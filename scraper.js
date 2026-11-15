import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import pLimit from 'p-limit';

const parser = new Parser();
const limit = pLimit(20); // 20 concurrent requests to avoid blocking

// Massive RSS List (Fallback if remote fetch fails)
const FALLBACK_FEEDS = [
    'https://feeds.bbci.co.uk/news/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    'https://www.aljazeera.com/xml/rss/all.xml', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.wired.com/feed/rss',
    'https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040', 'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://www.politico.com/rss/politicopicks.xml',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://feeds.bbci.co.uk/news/health/rss.xml',
    'https://variety.com/feed/', 'https://www.hollywoodreporter.com/feed/'
];

// Fetch a massive list of 1000+ feeds from a public repository
async function getMassiveFeeds() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/recommended/with_category/News.json');
        const data = await res.json();
        let feeds = [];
        Object.values(data).forEach(categoryFeeds => {
            feeds = feeds.concat(categoryFeeds.map(f => f.url));
        });
        return feeds.slice(0, 1000); // Limit to 1000 feeds
    } catch (e) {
        console.log('⚠️ Remote list failed, using fallback feeds.');
        return FALLBACK_FEEDS;
    }
}

let usedImages = new Set();

function getStrictOriginalPoster(item, content) {
    let img = null;
    // 1. Media Content
    if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) img = item['media:content'].$.url;
    // 2. Enclosure
    else if (item.enclosure && item.enclosure.url) img = item.enclosure.url;
    // 3. Media Thumbnail
    else if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) img = item['media:thumbnail'].$.url;
    
    // 4. Extract from HTML Content
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
    
    // STRICT RULE: If no image OR it's a duplicate, REJECT the article (return null)
    if (!img || usedImages.has(img)) return null;
    
    usedImages.add(img);
    return img;
}

(async () => {
    console.log('🚀 1000+ RSS स्क्रैपर शुरू हो रहा है...');
    const FEEDS = await getMassiveFeeds();
    console.log(`📡 कुल ${FEEDS.length} RSS फीड्स मिले। स्क्रैपिंग शुरू...`);

    let allArticles = [];
    let idCounter = 1;

    await Promise.all(FEEDS.map(url => limit(async () => {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            if (!res.ok) return;
            const xml = await res.text();
            const feed = await parser.parseString(xml);
            
            feed.items.slice(0, 5).forEach(item => {
                const content = item['content:encoded'] || item.content || item.description || '';
                const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                if (!item.title || !cleanDesc) return;

                const posterUrl = getStrictOriginalPoster(item, content);
                
                // If no original poster, skip this news
                if (!posterUrl) return;

                let cat = 'world';
                const titleLower = (feed.title + url).toLowerCase();
                if (titleLower.match(/tech|verge|wired|gadget/)) cat = 'technology';
                else if (titleLower.match(/sport|espn|nba|nfl/)) cat = 'sports';
                else if (titleLower.match(/politic|nytimes|national/)) cat = 'politics';
                else if (titleLower.match(/business|finance|money/)) cat = 'business';
                else if (titleLower.match(/health|medic/)) cat = 'health';
                else if (titleLower.match(/science|space/)) cat = 'science';
                else if (titleLower.match(/movie|entertain|holly/)) cat = 'entertainment';

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
        } catch(e) { /* Ignore failed feeds silently */ }
    })));

    // Sort by latest and take top 1500 to keep site fast
    const sorted = allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 1500);
    
    fs.writeFileSync('news.json', JSON.stringify(sorted, null, 2));
    console.log(`🎉 सफल! 1000+ फीड्स से ${sorted.length} खबरें (सिर्फ असली पोस्टर्स) सेव हो गईं।`);
})();
