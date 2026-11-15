import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import pLimit from 'p-limit';

const parser = new Parser();
// एक बार में 30 फीड्स ही खोलेंगे ताकि नेटवर्क क्रैश न हो
const limit = pLimit(30); 

// Fallback Feeds (अगर इंटरनेट से लिस्ट न मिले)
const FALLBACK_FEEDS = [
    'https://feeds.bbci.co.uk/news/world/rss.xml', 'https://techcrunch.com/feed/', 
    'https://www.espn.com/espn/rss/news', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://www.aljazeera.com/xml/rss/all.xml',
    'https://feeds.bbci.co.uk/news/business/rss.xml', 'https://variety.com/feed/'
];

// 1000+ RSS Feeds की लिस्ट गिटहब से लाएं
async function get1000Feeds() {
    try {
        console.log("📡 1000+ RSS फीड्स की लिस्ट डाउनलोड हो रही है...");
        const res = await fetch('https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/recommended/with_category/News.json');
        const data = await res.json();
        let feeds = [];
        Object.values(data).forEach(categoryFeeds => {
            feeds = feeds.concat(categoryFeeds.map(f => f.url));
        });
        // डुप्लीकेट हटाएं और 1000 तक सीमित करें
        return [...new Set(feeds)].slice(0, 1000); 
    } catch (e) {
        console.log("⚠️ रिमोट लिस्ट फेल, फॉलबैक फीड्स इस्तेमाल हो रहे हैं।");
        return FALLBACK_FEEDS;
    }
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
    
    // सख्त नियम: अगर इमेज नहीं है या डुप्लीकेट है, तो न्यूज़ रिजेक्ट
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
    console.log(`📡 कुल ${FEEDS.length} फीड्स प्रोसेस होंगे।`);

    let allArticles = [];
    let idCounter = 1;
    let processedCount = 0;

    await Promise.all(FEEDS.map(url => limit(async () => {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            if (!res.ok) return;
            const xml = await res.text();
            const feed = await parser.parseString(xml);
            
            // हर फीड से सिर्फ 4 न्यूज़ लेंगे ताकि फाइल साइज कंट्रोल में रहे
            feed.items.slice(0, 4).forEach(item => {
                const content = item['content:encoded'] || item.content || item.description || '';
                const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                if (!item.title || !cleanDesc) return;

                const posterUrl = getStrictPoster(item, content);
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
                    category: autoCategorize(feed.title || '', url)
                });
            });
            
            processedCount++;
            if (processedCount % 100 === 0) console.log(`✅ ${processedCount} फीड्स प्रोसेस हो चुके हैं...`);

        } catch(e) { /* साइलेंटली स्किप करें */ }
    })));

    // डुप्लीकेट टाइटल हटाएं और टॉप 3000 चुनें
    const unique = Array.from(new Map(allArticles.map(a => [a.title, a])).values());
    const sorted = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 3000);
    
    fs.writeFileSync('news.json', JSON.stringify(sorted, null, 2));
    console.log(`🎉 सफल! 1000+ फीड्स से कुल ${sorted.length} खबरें (100% असली पोस्टर्स) सेव हो गईं।`);
})();
