import requests
import json
import time
import hashlib
from datetime import datetime
from xml.sax.saxutils import escape

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

# ==========================================================
# FETCH ALL SCHOLAR PUBLICATIONS
# ==========================================================

while True:

    params = {
        "engine": "google_scholar_author",
        "author_id": AUTHOR_ID,
        "hl": "en",
        "start": start,
        "sort": "pubdate",
        "api_key": API_KEY
    }

    print(f"Fetching page {page} (start={start})")

    response = requests.get(BASE_URL, params=params)

    if response.status_code != 200:
        print(f"Error {response.status_code}")
        print(response.text)
        break

    data = response.json()

    if author_info is None:
        author_info = data.get("author", {})
        citation_info = data.get("cited_by", {})

    articles = data.get("articles", [])

    for article in articles:

        title = article.get("title", "").strip()

        if title and title not in seen_titles:
            seen_titles.add(title)
            all_articles.append(article)

    print(f"Collected {len(articles)} articles")
    print(f"Running total: {len(all_articles)}")

    pagination = data.get("serpapi_pagination", {})

    if "next" not in pagination:
        print("No more pages found.")
        break

    start += len(articles)
    page += 1

    time.sleep(1)

# ==========================================================
# SAVE COMPLETE JSON
# ==========================================================

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

print(f"\nTotal unique articles: {len(all_articles)}")
print("Saved to scholar_complete.json")

# ==========================================================
# GENERATE RSS XML
# ==========================================================
# ==========================================================
# GENERATE RSS XML
# ==========================================================

rss_file = "scholar.xml"

profile_url = (
    f"https://scholar.google.com/citations"
    f"?hl=en&user={AUTHOR_ID}"
    f"&view_op=list_works&sortby=pubdate"
)

profile_url_xml = escape(profile_url)

author_name = author_info.get(
    "name",
    "Google Scholar Author"
)

thumbnail = author_info.get(
    "thumbnail",
    "https://scholar.google.com/favicon.ico"
)

# ==========================================================
# BUILD CHANNEL DESCRIPTION
# ==========================================================

affiliation = author_info.get(
    "affiliations",
    ""
)

interest_titles = []

for interest in author_info.get(
    "interests",
    []
):
    if isinstance(interest, dict):
        interest_titles.append(
            interest.get("title", "")
        )

total_citations = ""
h_index = ""
i10_index = ""

try:

    stats = citation_info.get(
        "table",
        []
    )

    total_citations = (
        stats[0]["citations"]["all"]
    )

    h_index = (
        stats[1]["h_index"]["all"]
    )

    i10_index = (
        stats[2]["i10_index"]["all"]
    )

except Exception:
    pass

description_parts = []

if affiliation:
    description_parts.append(
        affiliation
    )

if total_citations != "":
    description_parts.append(
        f"Cited by {total_citations}"
    )

if h_index != "":
    description_parts.append(
        f"h-index {h_index}"
    )

if i10_index != "":
    description_parts.append(
        f"i10-index {i10_index}"
    )

description_parts.extend(
    interest_titles
)

channel_description = " - ".join(
    description_parts
)

# ==========================================================
# RSS HEADER
# ==========================================================

rss_xml = []

rss_xml.append(
    '<?xml version="1.0" encoding="UTF-8"?>'
)

rss_xml.append(
    '<rss '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:content="http://purl.org/rss/1.0/modules/content/" '
    'xmlns:atom="http://www.w3.org/2005/Atom" '
    'xmlns:media="http://search.yahoo.com/mrss/" '
    'version="2.0">'
)

rss_xml.append("<channel>")

rss_xml.append(
    f"<title><![CDATA[{author_name}]]></title>"
)

rss_xml.append(
    f"<description><![CDATA[{channel_description}]]></description>"
)

rss_xml.append(
    f"<link>{profile_url_xml}</link>"
)

# ==========================================================
# AUTHOR IMAGE
# ==========================================================

rss_xml.append("<image>")

rss_xml.append(
    f"<url>{escape(thumbnail)}</url>"
)

rss_xml.append(
    f"<title>{escape(author_name)}</title>"
)

rss_xml.append(
    f"<link>{profile_url_xml}</link>"
)

rss_xml.append("</image>")

rss_xml.append(
    "<generator>Custom Scholar RSS Generator</generator>"
)

rss_xml.append(
    "<lastBuildDate>"
    + datetime.utcnow().strftime(
        "%a, %d %b %Y %H:%M:%S GMT"
    )
    + "</lastBuildDate>"
)

rss_xml.append(
    f'<atom:link href="{profile_url_xml}" '
    'rel="self" '
    'type="application/rss+xml"/>'
)

rss_xml.append(
    "<language><![CDATA[en]]></language>"
)
# ==========================================================
# RSS ITEMS
# ==========================================================

for article in all_articles:

    title = article.get(
        "title",
        ""
    ).strip()

    if not title:
        continue

    authors = article.get(
        "authors",
        ""
    ).strip()

    publication = article.get(
        "publication",
        ""
    ).strip()

    link = article.get(
        "link",
        ""
    ).strip()

    citations = (
        article.get(
            "cited_by",
            {}
        ).get(
            "value"
        )
    )

    description = (
        f"{authors}, {publication}"
    )

    if citations:
        description += (
            f" - Cited by {citations}"
        )

    citation_id = article.get(
        "citation_id"
    )

    if citation_id:

        guid = hashlib.md5(
            citation_id.encode(
                "utf-8"
            )
        ).hexdigest()

    else:

        guid = hashlib.md5(
            title.encode(
                "utf-8"
            )
        ).hexdigest()

    year = str(
        article.get(
            "year",
            ""
        )
    ).strip()

    rss_xml.append("<item>")

    rss_xml.append(
        f"<title><![CDATA[{title}]]></title>"
    )

    rss_xml.append(
        f"<description><![CDATA[{description}]]></description>"
    )

    rss_xml.append(
        f"<link>{escape(link)}</link>"
    )

    rss_xml.append(
        f'<guid isPermaLink="false">{guid}</guid>'
    )

    rss_xml.append(
        "<dc:creator><![CDATA[scholar.google.com]]></dc:creator>"
    )

    if year:
        rss_xml.append(
            f"<pubDate>{year}</pubDate>"
        )

    rss_xml.append("</item>")

rss_xml.append("</channel>")
rss_xml.append("</rss>")

with open(
    rss_file,
    "w",
    encoding="utf-8"
) as f:

    f.write(
        "\n".join(rss_xml)
    )

print(f"RSS feed saved to {rss_file}")
