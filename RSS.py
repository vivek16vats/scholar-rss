import requests
import json
import time
import os

API_KEY = os.environ.get("SERPAPI_KEY")

if not API_KEY:
    raise ValueError(
        "SERPAPI_KEY environment variable not found."
    )

AUTHOR_ID = "TKbYqt0AAAAJ"

BASE_URL = "https://serpapi.com/search.json"

all_articles = []
seen_titles = set()

author_info = None
citation_info = None

start = 0
page = 1

while True:

    params = {
        "engine": "google_scholar_author",
        "author_id": AUTHOR_ID,
        "hl": "en",
        "start": start,
        "sort": "pubdate",
        "api_key": API_KEY
    }

    print(f"Fetching page {page}")

    response = requests.get(
        BASE_URL,
        params=params,
        timeout=60
    )

    response.raise_for_status()

    data = response.json()

    if author_info is None:
        author_info = data.get("author", {})
        citation_info = data.get("cited_by", {})

    articles = data.get("articles", [])

    for article in articles:

        title = article.get(
            "title",
            ""
        ).strip()

        if title and title not in seen_titles:

            seen_titles.add(title)

            all_articles.append(article)

    pagination = data.get(
        "serpapi_pagination",
        {}
    )

    if "next" not in pagination:
        break

    start += len(articles)

    page += 1

    time.sleep(1)

final_result = {
    "author": author_info,
    "cited_by": citation_info,
    "total_articles": len(all_articles),
    "articles": all_articles
}

with open(
    "scholar_complete.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        final_result,
        f,
        indent=2,
        ensure_ascii=False
    )

print(
    f"Saved {len(all_articles)} publications."
)
