import feedparser
import requests
import json
import os
import re
import sys

PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")

# कैटेगरी के साथ टॉप न्यूज़ RSS फीड्स
RSS_SOURCES = [
    {"category": "World", "url": "http://feeds.bbci.co.uk/news/rss.xml"},
    {"category": "World", "url": "https://rss.cnn.com/rss/edition.rss"},
    {"category": "India", "url": "https://feeds.feedburner.com/ndtvnews-top-stories"},
    {"category": "India", "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"},
    {"category": "India", "url": "https://www.thehindu.com/news/national/feeder/default.rss"},
    {"category": "India", "url": "https://www.indiatoday.in/rss/home"},
    {"category": "India", "url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"},
    {"category": "Tech", "url": "https://techcrunch.com/feed/"},
    {"category": "Tech", "url": "https://www.theverge.com/rss/index.xml"},
    {"category": "Business", "url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms"},
    {"category": "Sports", "url": "https://www.espncricinfo.com/rss/content/story/feeds/0.xml"}
]

if not PERPLEXITY_API_KEY:
    print("ERROR: PERPLEXITY_API_KEY not found!")
    sys.exit(1)

def clean_html(raw_html):
    return re.sub(r'<[^>]+>', '', raw_html).strip()

def upgrade_to_hd(img_url):
    if not img_url:
        return "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1280&q=90"
    # BBC की लो-रेज़ोल्यूशन इमेज को Full HD में बदलें
    img_url = img_url.replace("/standard/240/", "/standard/1024/")
    img_url = img_url.replace("/standard/480/", "/standard/1024/")
    # NDTV और अन्य साइट्स के थंबनेल को HD में अपग्रेड करें
    img_url = re.sub(r'width=\d+', 'width=1280', img_url)
    img_url = re.sub(r'height=\d+', 'height=720', img_url)
    return img_url

def extract_hd_image(entry):
    img_url = None
    # 1. Media Content से हाई-रेज़ोल्यूशन इमेज निकालें
    if 'media_content' in entry and len(entry.media_content) > 0:
        best = max(entry.media_content, key=lambda x: int(x.get('width', 0) or 0))
        img_url = best.get('url')
    # 2. Media Thumbnail से निकालें
    if not img_url and 'media_thumbnail' in entry and len(entry.media_thumbnail) > 0:
        img_url = entry.media_thumbnail[0].get('url')
    # 3. Links से निकालें
    if not img_url and 'links' in entry:
        for link in entry.links:
            if 'image' in link.get('type', ''):
                img_url = link.get('href')
    # 4. Summary या Content HTML के अंदर छिपे <img> टैग से HD इमेज निकालें (India Today, TechCrunch, Verge के लिए)
    if not img_url:
        html_blob = entry.get('summary', '') + str(entry.get('content', ''))
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html_blob)
        if match:
            img_url = match.group(1)

    return upgrade_to_hd(img_url)

def rewrite_with_perplexity(title, summary):
    clean_sum = clean_html(summary)
    url = "https://api.perplexity.ai/chat/completions"
    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": "You are an elite viral news journalist. Rewrite the given news headline and summary into an engaging, detailed, human-like viral news story in simple English. Do not include citations like [1] or [2]."
            },
            {
                "role": "user",
                "content": f"Headline: {title}\nDetails: {clean_sum}"
            }
        ],
        "temperature": 0.5
    }
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"API Error: {e}")
        return clean_sum

def main():
    print("Syncing HD Posters & Multi-Category Viral News...")
    all_news = []
    
    for source in RSS_SOURCES:
        cat = source["category"]
        url = source["url"]
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:12]:
                title = clean_html(entry.get("title", "No Title"))
                summary = entry.get("summary", "")
                link = entry.get("link", "")
                published = entry.get("published", "")
                hd_image = extract_hd_image(entry)
                
                if any(n['title'] == title for n in all_news):
                    continue
                
                print(f"[{cat}] Humanizing: {title}")
                human_content = rewrite_with_perplexity(title, summary)
                
                all_news.append({
                    "category": cat,
                    "title": title,
                    "content": human_content,
                    "image": hd_image,
                    "published": published,
                    "source_link": link
                })
        except Exception as e:
            print(f"Error parsing {url}: {e}")

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(all_news, f, ensure_ascii=False, indent=4)
    print(f"SUCCESS: {len(all_news)} articles saved with Full HD Posters across all categories!")

if __name__ == "__main__":
    main()
