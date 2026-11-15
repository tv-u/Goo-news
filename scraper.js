import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import pLimit from 'p-limit';

const parser = new Parser();
const limit = pLimit(15); 

// 100+ Top RSS Feeds (World, Politics, Tech, Sports)
const FEEDS = [
    // World & General
    'https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.aljazeera.com/xml/rss/all.xml', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://indianexpress.com/section/world/feed/', 'https://feeds.feedburner.com/ndtvnews-world-news',
    'https://www.thehindu.com/news/international/feeder/default.rss', 'https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml',
    'https://www.wionews.com/rss/world.xml', 'https://feeds.reuters.com/reuters/topNews',
    // Politics
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    'https://timesofindia.indiatimes.com/rssfeeds/1221656.cms', 'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://indianexpress.com/section/india/feed/', 'https://feeds.feedburner.com/ndtvnews-india-news',
    'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', 'https://www.politico.com/rss/politicopicks.xml',
    // Tech
    'https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml',
    'https://www.wired.com/feed/rss', 'https://news.ycombinator.com/rss',
    'https://www.cnet.com/rss/news/', 'https://www.engadget.com/rss.xml',
    'https://www.gadgets360.com/rss/news', 'https://indianexpress.com/section/technology/feed/',
    'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms', 'https://feeds.feedburner.com/TechCrunch/',
    // Sports
    'https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040',
    'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms', 'https://www.thehindu.com/sport/feeder/default.rss',
    'https://indianexpress.com/section/sports/feed/', 'https://feeds.feedburner.com/ndtvsports-latest',
    'https://www.hindustantimes.com/feeds/rss/sports/rssfeed.xml', 'https://www.bbc.com/sport/rss.xml'
];

function extractHDImage(item, content) {
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) return item['media:content'].$.url;
    if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) return item['media:thumbnail'].$.url;
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match, bestImage = null;
    while ((match = imgRegex.exec(content)) !== null) {
        if (match[1].includes('width') || match[1].includes('large') || match[1].startsWith('http')) {
            bestImage = match[1]; break;
        }
        if (!bestImage) bestImage = match[1];
    }
    return bestImage || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
}

function categorizeFeed(url, title) {
    const text = (url + title).toLowerCase();
    if (text.match(/tech|verge|wired|cnet|engadget|gadget/)) return 'technology';
    if (text.match(/sport|espn|sky|cricket|football/)) return 'sports';
    if (text.match(/politic|nytimes|politico|national|india/)) return 'politics';
    return 'world';
}

async function fetchFeed(url) {
    try {
        const res = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return [];
        const xml = await res.text();
        const feed = await parser.parseString(xml);
        return feed.items.map(item => {
            const rawContent = item['content:encoded'] || item.content || item.description || '';
            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate || new Date().toISOString(),
                snippet: rawContent.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...',
                image: extractHDImage(item, rawContent),
                source: feed.title,
                category: categorizeFeed(url, feed.title)
            };
        });
    } catch (e) { return []; }
}

(async () => {
    console.log('🚀 Scraper Booting...');
    let allArticles = [];
    await Promise.all(FEEDS.map(url => limit(async () => {
        const articles = await fetchFeed(url);
        allArticles = allArticles.concat(articles);
    })));

    const unique = Array.from(new Map(allArticles.map(a => [a.title, a])).values());
    const top1000 = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 1000);
    
    fs.writeFileSync('news.json', JSON.stringify(top1000, null, 2));
    console.log(`🎉 Done! Total ${top1000.length} news saved.`);
})();
