import feedparser
import requests
import json
import os
import sys

PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")
RSS_URL = "http://feeds.bbci.co.uk/news/rss.xml"

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
                "content": "You are an elite, viral news journalist. Rewrite the given news headline and summary into an engaging, comprehensive, highly readable, human-like viral news story in simple English. Make it catchy and trending. Do not include citations like [1] or [2]."
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
        print(f"API Error for '{title}': {e}")
        return summary

def main():
    print("Fetching top stories from BBC RSS...")
    feed = feedparser.parse(RSS_URL)
    if not feed.entries:
        print("No entries found in RSS.")
        sys.exit(0)

    news_list = []
    # यहाँ आप चाहें तो संख्या बढ़ा सकते हैं (जैसे 100 तक, हालांकि API लिमिट का ध्यान रखें)
    for entry in feed.entries[:20]:
        title = entry.get("title", "No Title")
        summary = entry.get("summary", "")
        link = entry.get("link", "")
        published = entry.get("published", "")
        
        print(f"Processing & Humanizing: {title}")
        human_content = rewrite_with_perplexity(title, summary)
        
        news_list.append({
            "title": title,
            "content": human_content,
            "published": published,
            "source_link": link
        })

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(news_list, f, ensure_ascii=False, indent=4)
    print("SUCCESS: news.json generated with humanized viral news!")

if __name__ == "__main__":
    main()
