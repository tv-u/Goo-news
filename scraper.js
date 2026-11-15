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
    'https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml',
    'https://www.wired.com/feed/rss', 'https://www.engadget.com/rss.xml',
    'https://www.gadgets360.com/rss/news', 'https://indianexpress.com/section/technology/feed/',
    'https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040',
    'https://indianexpress.com/section/sports/feed/', 'https://feeds.feedburner.com/ndtvsports-latest'
];

async function extractFullArticle(url) {
    try {
        const res = await fetch(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();
        return article ? { text: article.textContent.substring(0, 2000), title: article.title } : null;
    } catch (e) { return null; }
}

function getHDImage(content) {
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match, bestImage = null;
    while ((match = imgRegex.exec(content)) !== null) {
        if (match[1].includes('width') || match[1].includes('large') || match[1].includes('1200')) {
            bestImage = match[1]; break;
        }
        if (!bestImage && match[1].startsWith('http')) bestImage = match[1];
    }
    return bestImage || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
}

async function fetchFeed(url) {
    try {
        const res = await fetch(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const feed = await parser.parseString(await res.text());
        return feed.items.map(item => {
            const rawContent = item['content:encoded'] || item.content || item.description || '';
            let cat = 'world';
            if (url.match(/tech|verge|wired|gadget/)) cat = 'technology';
            if (url.match(/sport|espn|sky|sports/)) cat = 'sports';
            if (url.match(/politic|national|india/)) cat = 'politics';

            return {
                title: item.title,
                link: item.link,
                pubDate: item.pubDate || new Date().toISOString(),
                snippet: rawContent.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...',
                image: getHDImage(rawContent),
                source: feed.title,
                category: cat,
                fullText: null // Will be fetched later if needed
            };
        });
    } catch (e) { return []; }
}

(async () => {
    console.log('🚀 1000x Scraper Booting...');
    let allArticles = [];
    await Promise.all(FEEDS.map(url => limit(async () => {
        const articles = await fetchFeed(url);
        allArticles = allArticles.concat(articles);
    })));

    const unique = Array.from(new Map(allArticles.map(a => [a.title, a])).values());
    const top1000 = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 1000);
    
    fs.writeFileSync('news.json', JSON.stringify(top1000, null, 2));
    console.log(`🎉 1000x Scraper Done! Total ${top1000.length} news saved.`);
})();
