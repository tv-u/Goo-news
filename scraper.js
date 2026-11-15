import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
const parser = new Parser();

// Complete i18n + Multi-Category Feed Structure
const FEEDS = {
  world: { lang: 'en', urls: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://www.aljazeera.com/xml/rss/all.xml'] },
  politics: { lang: 'en', urls: ['https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://feeds.bbci.co.uk/news/politics/rss.xml', 'https://www.politico.com/rss/politicopicks.xml'] },
  technology: { lang: 'en', urls: ['https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.wired.com/feed/rss'] },
  sports: { lang: 'en', urls: ['https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040', 'https://www.bbc.com/sport/rss.xml'] },
  business: { lang: 'en', urls: ['https://feeds.bbci.co.uk/news/business/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://www.forbes.com/business/feed/'] },
  science: { lang: 'en', urls: ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml'] },
  health: { lang: 'en', urls: ['https://feeds.bbci.co.uk/news/health/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml'] },
  entertainment: { lang: 'en', urls: ['https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'https://variety.com/feed/'] },
  hindi: { lang: 'hi', urls: ['https://feeds.feedburner.com/ndtvnews-latest', 'https://www.amarujala.com/rss/breaking-news.xml', 'https://navbharattimes.indiatimes.com/rssfeedstopstories.cms'] },
  spanish: { lang: 'es', urls: ['https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada'] },
  french: { lang: 'fr', urls: ['https://www.lefigaro.fr/rss/figaro_actualites.xml', 'https://www.france24.com/fr/rss'] },
  german: { lang: 'de', urls: ['https://rss.sueddeutsche.de/rss/Topthemen'] },
  arabic: { lang: 'ar', urls: ['https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9'] },
  chinese: { lang: 'zh', urls: ['https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'] },
  russian: { lang: 'ru', urls: ['https://tass.com/rss/v2.xml'] },
  portuguese: { lang: 'pt', urls: ['https://feeds.folha.uol.com.br/emcimadahora/rss091.xml'] },
  japanese: { lang: 'ja', urls: ['https://www3.nhk.or.jp/rss/news/cat0.xml'] }
};

let usedImages = new Set();

function getPoster(item, content, id) {
    let img = null;
    if (item['media:content']?.$?.url) img = item['media:content'].$.url;
    else if (item.enclosure?.url) img = item.enclosure.url;
    else if (item['media:thumbnail']?.$?.url) img = item['media:thumbnail'].$.url;
    
    if (!img && content) {
        const m = [...content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        for (let match of m) {
            if (!match[1].match(/logo|icon|1x1|pixel|avatar/i) && match[1].startsWith('http')) {
                img = match[1]; break;
            }
        }
    }
    
    if (img) img = img.replace(/&amp;/g, '&');
    if (img && !usedImages.has(img)) {
        usedImages.add(img);
        return img;
    }
    return `https://picsum.photos/seed/${id}-${Math.random()}/800/450`;
}

(async () => {
    console.log('🚀 Scraping with i18n + Unique Posters...');
    let data = [];
    let counter = 1;
    
    for (const [cat, config] of Object.entries(FEEDS)) {
        for (const url of config.urls) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                
                feed.items.slice(0, 15).forEach(item => {
                    const content = item['content:encoded'] || item.content || item.description || '';
                    const clean = content.replace(/<[^>]*>?/gm, '').trim();
                    if (!item.title || !clean) return;
                    
                    const id = `news-${counter++}`;
                    data.push({
                        id: id,
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        snippet: clean.substring(0, 160) + '...',
                        fullText: clean.substring(0, 3000),
                        image: getPoster(item, content, id),
                        source: feed.title || 'Goo-News',
                        category: cat,
                        language: config.lang
                    });
                });
                console.log(`✅ [${config.lang}] ${cat}: ${feed.items.length} items`);
            } catch(e) { console.log(`❌ Skip: ${url.substring(0, 40)}`); }
        }
    }
    
    const unique = Array.from(new Map(data.map(a => [a.title, a])).values());
    fs.writeFileSync('news.json', JSON.stringify(unique, null, 2));
    console.log(`🎉 Done! ${unique.length} news (i18n + unique posters) saved.`);
})();
