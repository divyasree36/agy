import time
import re
from datetime import datetime, timezone
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Feed URL
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "last_fetched": 0,
    "ttl": 300  # 5 minutes
}

def parse_feed_content(content_bytes):
    """Parses feed XML bytes and splits entry HTML contents by h3/h4 headings."""
    feed = feedparser.parse(content_bytes)
    items = []
    
    for entry_idx, entry in enumerate(feed.entries):
        # Extract date from entry
        entry_title = entry.get("title", "Unknown Date")
        entry_link = entry.get("link", "https://docs.cloud.google.com/bigquery/docs/release-notes")
        entry_updated = entry.get("updated", entry.get("published", ""))
        
        # Get content
        content_val = entry.get("summary", entry.get("description", ""))
        if not content_val and "content" in entry:
            content_val = entry.content[0].value
            
        if not content_val:
            continue
            
        soup = BeautifulSoup(content_val, "html.parser")
        
        current_category = "General"
        current_elements = []
        item_idx = 0
        
        def add_item(cat, elems, s_idx):
            if not elems:
                return
            # Reconstruct HTML block
            html_str = "".join(str(e) for e in elems)
            
            # Format clean plain text (no tags, clean whitespace)
            clean_soup = BeautifulSoup(html_str, "html.parser")
            
            # Update links inside HTML to open in a new tab
            for link in clean_soup.find_all("a"):
                link["target"] = "_blank"
                link["rel"] = "noopener noreferrer"
            
            updated_html = "".join(str(c) for c in clean_soup.children)
            
            text_str = clean_soup.get_text().strip()
            text_str = re.sub(r"\s+", " ", text_str)
            
            items.append({
                "id": f"{entry_idx}_{s_idx}",
                "date": entry_title,
                "updated": entry_updated,
                "category": cat.strip(),
                "html": updated_html,
                "text": text_str,
                "link": entry_link
            })

        for child in soup.children:
            if child.name in ["h3", "h4"]:
                if current_elements:
                    add_item(current_category, current_elements, item_idx)
                    item_idx += 1
                    current_elements = []
                current_category = child.get_text().strip()
            elif child.name:
                current_elements.append(child)
                
        if current_elements:
            add_item(current_category, current_elements, item_idx)
            
    return items

def get_release_notes(force_refresh=False):
    """Fetches and parses release notes with in-memory caching."""
    now = time.time()
    
    if not force_refresh and cache["data"] is not None and (now - cache["last_fetched"] < cache["ttl"]):
        return cache["data"], cache["last_fetched"], False
        
    # Fetch from source
    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()
    
    parsed_items = parse_feed_content(response.content)
    
    # Update cache
    cache["data"] = parsed_items
    cache["last_fetched"] = now
    
    return parsed_items, now, True

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def api_release_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        data, last_fetched_time, is_fresh = get_release_notes(force_refresh)
        formatted_time = datetime.fromtimestamp(last_fetched_time, tz=timezone.utc).isoformat()
        return jsonify({
            "status": "success",
            "last_fetched": formatted_time,
            "is_fresh": is_fresh,
            "count": len(data),
            "data": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
