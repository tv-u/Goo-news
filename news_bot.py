import feedparser
import requests
import json
import os
import sys

PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")
RSS_URL = "http://feeds.bbci.co.uk/news/rss.xml"

if not PERPLEXITY_API_KEY:
    print("ERROR: PERPLEXITY_API_KEY not found in environment variables!")
    sys.exit(1)

def rewrite_with_perplexity(title, summary):
    url = "https://api.perplexity.ai/chat/completions"
    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": "You are a professional news journalist. Rewrite the given news headline and summary into an engaging, detailed, human-like news report in simple, clear English. Do not include citations like [1] or [2]."
            },
            {
                "role": "user",
                "content": f"Headline: {title}\nDetails: {summary}"
            }
        ],
        "temperature": 0.4
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
        print(f"API Error for '{title}': {e}")
        return summary

def main():
    print("Fetching BBC RSS Feed...")
    feed = feedparser.parse(RSS_URL)
    if not feed.entries:
        print("No entries found in RSS feed.")
        sys.exit(1)

    news_list = []
    for entry in feed.entries[:6]:
        title = entry.get("title", "No Title")
        summary = entry.get("summary", "")
        link = entry.get("link", "")
        published = entry.get("published", "")
        
        print(f"Rewriting: {title}")
        human_content = rewrite_with_perplexity(title, summary)
        
        news_list.append({
            "title": title,
            "content": human_content,
            "published": published,
            "source_link": link
        })

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(news_list, f, ensure_ascii=False, indent=4)
    print("SUCCESS: news.json updated safely!")

if __name__ == "__main__":
    main()
