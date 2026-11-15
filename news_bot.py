import feedparser
import requests
import json
import os
import sys

PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")

# 50+ Top News RSS Feeds (BBC, NDTV, Times of India, TechCrunch, CNN, etc.)
RSS_URLS = [
    "http://feeds.bbci.co.uk/news/rss.xml",
    "https://feeds.feedburner.com/ndtvnews-top-stories",
    "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://indianexpress.com/section/india/feed/",
    "https://www.indiatoday.in/rss/home",
    "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
    "https://rss.cnn.com/rss/edition.rss",
    "https://techcrunch.com/feed/",
    "https://www.theverge.com/rss/index.xml"
]

if not PERPLEXITY_API_KEY:
    print("ERROR: PERPLEXITY_API_KEY not found!")
    sys.exit(1)

def rewrite_with_perplexity(title, summary):
    url = "https://api.perplexity.ai/chat/completions"
    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": "You are an elite, viral news journalist. Rewrite the given news headline and summary into an engaging, comprehensive, highly readable, human-like viral news story in simple English. Make it catchy. Do not include citations like [1] or [2]."
            },
            {
                "role": "user",
                "content": f"Headline: {title}\nDetails: {summary}"
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
        return summary

def extract_image(entry):
    # RSS फीड से असली न्यूज़ पोस्टर/इमेज ढूँढना
    if 'media_content' in entry and len(entry.media_content) > 0:
        return entry.media_content[0].get('url')
    if 'media_thumbnail' in entry and len(entry.media_thumbnail) > 0:
        return entry.media_thumbnail[0].get('url')
    if 'links' in entry:
        for link in entry.links:
            if 'image' in link.get('type', ''):
                return link.get('href')
    # डिफ़ॉल्ट वायरल न्यूज़ बैनर यदि इमेज न मिले
    return "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800"

def main():
    print("Fetching news from multiple top RSS sources...")
    all_news = []
    
    for url in RSS_URLS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:15]: # हर सोर्स से टॉप 15 खबरें
                title = entry.get("title", "No Title")
                summary = entry.get("summary", "")
                link = entry.get("link", "")
                published = entry.get("published", "")
                image_url = extract_image(entry)
                
                # डुप्लीकेट रोके
                if any(n['title'] == title for n in all_news):
                    continue
                
                print(f"Processing & Humanizing: {title}")
                human_content = rewrite_with_perplexity(title, summary)
                
                all_news.append({
                    "title": title,
                    "content": human_content,
                    "image": image_url,
                    "published": published,
                    "source_link": link
                })
        except Exception as e:
            print(f"Error parsing {url}: {e}")

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(all_news, f, ensure_ascii=False, indent=4)
    print(f"SUCCESS: news.json generated with {len(all_news)} viral news articles and posters!")

if __name__ == "__main__":
    main()
