import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
const parser = new Parser();

const FEEDS = [
    'https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.aljazeera.com/xml/rss/all.xml', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://indianexpress.com/section/world/feed/', 'https://feeds.feedburner.com/ndtvnews-world-news',
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    'https://indianexpress.com/section/india/feed/', 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
    'https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.wired.com/feed/rss',
    'https://www.engadget.com/rss.xml', 'https://www.gadgets360.com/rss/news', 'https://indianexpress.com/section/technology/feed/',
    'https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040', 'https://indianexpress.com/section/sports/feed/'
];

function extractImg(content) {
    const m = content.match(/<img[^>]+src="([^">]+)"/);
    return m ? m[1] : 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
}

function getCategory(url) {
    if (url.match(/tech|verge|wired|engadget|gadget/)) return 'technology';
    if (url.match(/sport|espn|sky/)) return 'sports';
    if (url.match(/politic|national|india/)) return 'politics';
    return 'world';
}

(async () => {
    console.log('🚀 डेटा स्क्रैपिंग शुरू...');
    let all = [];
    for (const url of FEEDS) {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const xml = await res.text();
            const feed = await parser.parseString(xml);
            feed.items.slice(0, 15).forEach(item => {
                const content = item['content:encoded'] || item.content || item.description || '';
                all.push({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate || new Date().toISOString(),
                    snippet: content.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...',
                    fullText: content.replace(/<[^>]*>?/gm, '').substring(0, 1000),
                    image: extractImg(content),
                    source: feed.title || 'News',
                    category: getCategory(url)
                });
            });
        } catch(e) { console.log('Skip: ' + url); }
    }
    const unique = Array.from(new Map(all.map(a => [a.title, a])).values());
    fs.writeFileSync('news.json', JSON.stringify(unique, null, 2));
    console.log(`✅ सफल! कुल ${unique.length} न्यूज़ सेव हो गईं।`);
})();
