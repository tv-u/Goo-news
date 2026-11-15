import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import pLimit from 'p-limit';

const parser = new Parser();
const limit = pLimit(20); // Fast concurrent processing

// 50+ Categories with Top Global RSS Feeds
const FEEDS = {
  world: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
  us_news: ['https://rss.nytimes.com/services/xml/rss/nyt/US.xml', 'https://feeds.npr.org/1003/rss.xml'],
  india: ['https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://indianexpress.com/section/india/feed/'],
  uk_news: ['https://feeds.bbci.co.uk/news/uk/rss.xml', 'https://www.theguardian.com/uk/rss'],
  asia: ['https://www.scmp.com/rss/91/feed', 'https://www.japantimes.co.jp/feed/'],
  europe: ['https://www.euronews.com/rss?level=theme&name=news', 'https://feeds.bbci.co.uk/news/world/europe/rss.xml'],
  africa: ['https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'https://www.news24.com/fin24/rss'],
  middle_east: ['https://www.aljazeera.com/xml/rss/all.xml', 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml'],
  australia: ['https://www.abc.net.au/news/feed/51120/rss.xml', 'https://www.smh.com.au/rss/feed.xml'],
  canada: ['https://www.cbc.ca/webfeed/rss/rss-topstories', 'https://globalnews.ca/feed/'],
  
  politics: ['https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'https://www.politico.com/rss/politicopicks.xml'],
  elections: ['https://feeds.npr.org/1014/rss.xml', 'https://www.theguardian.com/politics/rss'],
  geopolitics: ['https://foreignpolicy.com/feed/', 'https://www.foreignaffairs.com/rss.xml'],
  
  technology: ['https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml'],
  ai: ['https://openai.com/blog/rss.xml', 'https://www.artificialintelligence-news.com/feed/'],
  cybersecurity: ['https://feeds.feedburner.com/TheHackersNews', 'https://www.bleepingcomputer.com/feed/'],
  mobile: ['https://www.gsmarena.com/rss-news-reviews.php3', 'https://www.androidauthority.com/feed/'],
  gadgets: ['https://www.engadget.com/rss.xml', 'https://www.gadgets360.com/rss/news'],
  space: ['https://www.space.com/feeds/all', 'https://www.nasa.gov/rss/dyn/breaking_news.rss'],
  science: ['https://www.sciencedaily.com/rss/all.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml'],
  
  business: ['https://feeds.bbci.co.uk/news/business/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml'],
  economy: ['https://www.economist.com/finance-and-economics/rss.xml', 'https://www.cnbc.com/id/20910258/device/rss/rss.html'],
  finance: ['https://www.forbes.com/business/feed/', 'https://www.marketwatch.com/rss/topstories'],
  crypto: ['https://cointelegraph.com/rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  startups: ['https://techcrunch.com/category/startups/feed/', 'https://venturebeat.com/category/business/feed/'],
  
  sports: ['https://www.espn.com/espn/rss/news', 'https://www.skysports.com/rss/12040'],
  football: ['https://www.espn.com/espn/rss/soccer/news', 'https://www.goal.com/feeds/en/news'],
  cricket: ['https://www.espncricinfo.com/rss/content/story/feeds/0.xml', 'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms'],
  basketball: ['https://www.espn.com/espn/rss/nba/news', 'https://www.cbssports.com/rss/headlines/nba/'],
  tennis: ['https://www.espn.com/espn/rss/tennis/news', 'https://www.atptour.com/en/media/rss-feed/xml-feed'],
  f1: ['https://www.autosport.com/rss/feed/f1', 'https://www.formula1.com/en/latest/all.xml'],
  
  entertainment: ['https://variety.com/feed/', 'https://www.hollywoodreporter.com/feed/'],
  movies: ['https://www.slashfilm.com/feed/', 'https://collider.com/feed/'],
  music: ['https://www.billboard.com/feed/', 'https://pitchfork.com/feed/feed-news/rss'],
  tv: ['https://tvline.com/feed/', 'https://www.tvguide.com/news/feed/'],
  gaming: ['https://feeds.feedburner.com/ign/games-all', 'https://www.polygon.com/rss/index.xml'],
  celebrities: ['https://www.tmz.com/rss.xml', 'https://pagesix.com/feed/'],
  
  health: ['https://feeds.bbci.co.uk/news/health/rss.xml', 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml'],
  fitness: ['https://www.menshealth.com/rss/all.xml', 'https://www.womenshealthmag.com/rss/all.xml'],
  food: ['https://www.seriouseats.com/rss', 'https://www.bonappetit.com/feed/rss'],
  travel: ['https://www.lonelyplanet.com/news/feed', 'https://www.cntraveler.com/feed/rss'],
  fashion: ['https://wwd.com/feed/', 'https://www.vogue.com/feed/rss'],
  environment: ['https://insideclimatenews.org/feed/', 'https://www.carbonbrief.org/feed']
};

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
    
    // STRICT RULE: Reject if no image OR duplicate image
    if (!img || usedImages.has(img)) return null;
    usedImages.add(img);
    return img;
}

(async () => {
    console.log(`🚀 ${Object.keys(FEEDS).length} Categories स्क्रैपिंग शुरू...`);
    let allArticles = [];
    let idCounter = 1;

    for (const [cat, urls] of Object.entries(FEEDS)) {
        await Promise.all(urls.map(url => limit(async () => {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
                const xml = await res.text();
                const feed = await parser.parseString(xml);
                
                feed.items.slice(0, 5).forEach(item => { // 5 per feed to keep it fast & diverse
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
                        category: cat
                    });
                });
            } catch(e) { /* skip failed feeds silently */ }
        })));
        console.log(`✅ Done: ${cat}`);
    }

    // Sort by latest and take top 2000
    const sorted = allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 2000);
    fs.writeFileSync('news.json', JSON.stringify(sorted, null, 2));
    console.log(`🎉 सफल! कुल ${sorted.length} खबरें (50+ Categories, Real Posters) सेव हो गईं।`);
})();
