import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import pLimit from 'p-limit';

const parser = new Parser();
const limit = pLimit(30); 

const FALLBACK_FEEDS = [
    'https://feeds.bbci.co.uk/news/world/rss.xml', 'https://techcrunch.com/feed/', 
    'https://www.espn.com/espn/rss/news', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://www.aljazeera.com/xml/rss/all.xml'
];

async function get1000Feeds() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/recommended/with_category/News.json');
        const data = await res.json();
        let feeds = [];
        Object.values(data).forEach(categoryFeeds => {
            feeds = feeds.concat(categoryFeeds.map(f => f.url));
        });
        return [...new Set(feeds)].slice(0, 1000); 
    } catch (e) { return FALLBACK_FEEDS; }
}

let usedImages = new Set();

function getStrictPoster(item, content) {
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
    if (!img || usedImages.has(img)) return null;
    usedImages.add(img);
    return img;
}

function autoCategorize(title, url) {
    const text = (title + url).toLowerCase();
    if (text.match(/tech|verge|wired|gadget|ai|cyber/)) return 'technology';
    if (text.match(/sport|espn|sky|cricket|football|nba|f1/)) return 'sports';
    if (text.match(/politic|nytimes|politico|election/)) return 'politics';
    if (text.match(/business|finance|money|economy|crypto/)) return 'business';
    if (text.match(/health|medic|fitness/)) return 'health';
    if (text.match(/science|space|nature/)) return 'science';
    if (text.match(/movie|entertain|holly|music|tv/)) return 'entertainment';
    if (text.match(/game|gaming|ign|polygon/)) return 'gaming';
    if (text.match(/india|hindi|timesofindia/)) return 'india';
    return 'world';
}

(async () => {
    console.log(`🚀 मेगा स्क्रैपिंग शुरू...`);
    const FEEDS = await get1000Feeds();
    let allArticles = [];
    let idCounter = 1;

    await Promise.all(FEEDS.map(url => limit(async () => {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            if (!res.ok) return;
            const feed = await parser.parseString(await res.text());
            
            feed.items.slice(0, 4).forEach(item => {
                const content = item['content:encoded'] || item.content || item.description || '';
                const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                if (!item.title || !cleanDesc) return;

                const posterUrl = getStrictPoster(item, content);
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
                    domain: new URL(url).hostname.replace('www.', ''),
                    category: autoCategorize(feed.title || '', url)
                });
            });
        } catch(e) { }
    })));

    const unique = Array.from(new Map(allArticles.map(a => [a.title, a])).values());
    const sorted = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 3000);
    fs.writeFileSync('news.json', JSON.stringify(sorted, null, 2));
    console.log(`🎉 सफल! कुल ${sorted.length} खबरें सेव हो गईं।`);
})();
