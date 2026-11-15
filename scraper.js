import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import pLimit from 'p-limit';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const parser = new Parser();
const limit = pLimit(15);

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

function extractHDImage(content) {
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

async function fetchFullArticle(url) {
    try {
        const res = await fetch(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();
        return article ? article.textContent.substring(0, 3000) : null;
    } catch (e) { return null; }
}

function categorizeFeed(url, title) {
    const text = (url + title).toLowerCase();
    if (text.match(/tech|verge|wired|engadget|gadget/)) return 'technology';
    if (text.match(/sport|espn|sky/)) return 'sports';
    if (text.match(/politic|nytimes|national|india/)) return 'politics';
    return 'world';
}

async function fetchFeed(url) {
    try {
        const res = await fetch(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return [];
        const feed = await parser.parseString(await res.text());
        
        const items = await Promise.all(feed.items.slice(0, 10).map(async item => {
            const rawContent = item['content:encoded'] || item.content || item.description || '';
            const fullText = await fetchFullArticle(item.link); // Fetch full text for reader mode
            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate || new Date().toISOString(),
                snippet: rawContent.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...',
                fullText: fullText || rawContent.replace(/<[^>]*>?/gm, ''),
                image: extractHDImage(rawContent),
                source: feed.title,
                category: categorizeFeed(url, feed.title)
            };
        }));
        return items;
    } catch (e) { return []; }
}

(async () => {
    console.log('🚀 Enterprise Scraper Started...');
    let allArticles = [];
    await Promise.all(FEEDS.map(url => limit(async () => {
        allArticles = allArticles.concat(await fetchFeed(url));
    })));

    const unique = Array.from(new Map(allArticles.map(a => [a.title, a])).values());
    const top1000 = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 1000);
    
    fs.writeFileSync('news.json', JSON.stringify(top1000, null, 2));
    console.log(`🎉 Done! Total ${top1000.length} news saved.`);
})();
