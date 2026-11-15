import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
const parser = new Parser();

// Top 10 Languages & Top Categories Feeds
const FEEDS = {
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'https://www.aljazeera.com/xml/rss/all.xml', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://www.lemonde.fr/rss/une.xml', 'https://www.spiegel.de/international/index.rss'
  ],
  politics: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://feeds.bbci.co.uk/news/politics/rss.xml', 'https://www.politico.com/rss/politicopicks.xml', 'https://indianexpress.com/section/india/feed/', 'https://feeds.npr.org/1014/rss.xml'
  ],
  technology: [
    'https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.wired.com/feed/rss', 'https://www.engadget.com/rss.xml', 'https://www.gadgets360.com/rss/news', 'https://feeds.feedburner.com/venturebeat/SZYF'
  ],
  sports: [
    'https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040', 'https://www.bbc.com/sport/rss.xml', 'https://indianexpress.com/section/sports/feed/', 'https://www.marca.com/en/rss.html'
  ],
  business: [
    'https://feeds.bbci.co.uk/news/business/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', 'https://www.forbes.com/business/feed/', 'https://economictimes.indiatimes.com/rssfeedstopstories.cms', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'
  ],
  science: [
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', 'https://www.sciencedaily.com/rss/all.xml', 'https://www.nature.com/nature.rss'
  ],
  health: [
    'https://feeds.bbci.co.uk/news/health/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', 'https://www.medicalnewstoday.com/rss', 'https://feeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC'
  ],
  entertainment: [
    'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', 'https://variety.com/feed/', 'https://www.hollywoodreporter.com/feed/', 'https://www.bollywoodhungama.com/rss/news.xml'
  ],
  hindi: [
    'https://feeds.feedburner.com/ndtvnews-latest', 'https://www.amarujala.com/rss/breaking-news.xml', 'https://navbharattimes.indiatimes.com/rssfeedstopstories.cms'
  ],
  spanish: [
    'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada'
  ],
  french: [
    'https://www.lefigaro.fr/rss/figaro_actualites.xml', 'https://www.france24.com/fr/rss'
  ],
  german: [
    'https://www.zeit.de/news/index', 'https://rss.sueddeutsche.de/rss/Topthemen'
  ],
  arabic: [
    'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9', 'https://arabic.rt.com/rss/'
  ],
  chinese: [
    'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', 'https://cn.nytimes.com/rss/'
  ],
  russian: [
    'https://tass.com/rss/v2.xml', 'https://russian.rt.com/rss/'
  ],
  portuguese: [
    'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', 'https://g1.globo.com/rss/g1/'
  ],
  japanese: [
    'https://www3.nhk.or.jp/rss/news/cat0.xml', 'https://rss.asahi.com/rss/asahi/newsheadlines.rdf'
  ]
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
    
    // Category-specific high quality fallbacks to avoid fake/duplicate posters
    const fallbacks = {
        world: 'https://images.unsplash.com/photo-1526470498-9ae73c66517b?w=800&q=80',
        politics: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
        technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
        sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
        business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
        science: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
        health: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80',
        entertainment: 'https://images.unsplash.com/photo-1603199506016-b9a594b593c0?w=800&q=80',
        hindi: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80',
        spanish: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&q=80',
        french: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
        german: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80',
        arabic: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
        chinese: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80',
        russian: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=800&q=80',
        portuguese: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
        japanese: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80'
    };
    return fallbacks[category] || fallbacks.world;
}

(async () => {
    console.log('🚀 सुपर स्क्रैपर (Top 10 Languages) शुरू...');
    let categorizedNews = {};
    let idCounter = 1;
    
    for (const [category, urls] of Object.entries(FEEDS)) {
        categorizedNews[category] = [];
        for (const url of urls) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                feed.items.forEach(item => {
                    if (categorizedNews[category].length >= 100) return; // Max 100 per category
                    const content = item['content:encoded'] || item.content || item.description || '';
                    const cleanDesc = content.replace(/<[^>]*>?/gm, '').trim();
                    if(!item.title || !cleanDesc) return;
                    
                    categorizedNews[category].push({
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
                console.log(`✅ ${category}: ${url.split('/')[2]} (Total: ${categorizedNews[category].length})`);
            } catch(e) { console.log(`❌ Skip: ${url.split('/')[2]}`); }
        }
    }
    
    // Flatten and remove duplicates
    let all = Object.values(categorizedNews).flat();
    const unique = Array.from(new Map(all.map(a => [a.title, a])).values());
    
    fs.writeFileSync('news.json', JSON.stringify(unique, null, 2));
    console.log(`🎉 सफल! कुल ${unique.length} अनोखी न्यूज़ (100 per category) सेव हो गईं।`);
})();
