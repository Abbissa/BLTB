#!/usr/bin/env python3
"""Letterboxd Web Scraper

Fetch user data by scraping Letterboxd pages instead of ZIP export.

Usage:
    python scrape_letterboxd.py --user username [--output data.json]

The script gathers the user's watched films, ratings, reviews, watchlist, and likes
by visiting the appropriate pages and also parses the RSS feed for details such
as watch dates and review text. Output is saved in JSON format similar to
`process_letterboxd.py`.
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import cloudscraper
import feedparser
from bs4 import BeautifulSoup


class LetterboxdScraper:
    def __init__(self, output_file="web/data.json", fetch_posters=False):
        self.output_file = Path(output_file)
        self.fetch_posters = fetch_posters
        self.scraper = cloudscraper.create_scraper()
        self.data = self._load_existing_data()

    def _load_existing_data(self):
        if self.output_file.exists():
            try:
                with open(self.output_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                print(f"Warning: could not load existing {self.output_file}, starting fresh")
        return {"users": [], "movies": {}, "lastUpdated": None}

    def scrape_user(self, username):
        print(f"Scraping data for user '{username}'")
        user_data = {
            "name": username,
            "watched": [],
            "ratings": [],
            "reviews": [],
            "watchlist": [],
            "likes": [],
            "enabled": True,
            "updatedAt": datetime.now().isoformat(),
        }

        # collection from pages
        user_data["watched"] = self._scrape_page(username, "films")
        user_data["watchlist"] = self._scrape_page(username, "watchlist")
        user_data["likes"] = self._scrape_page(username, "likes/films")

        # enrich with RSS for dates, ratings, reviews, likes
        self._parse_rss(username, user_data)

        self._store_user(user_data)
        self._process_movies(user_data, username)
        if self.fetch_posters:
            self._fetch_missing_posters()
        self.data["lastUpdated"] = datetime.now().isoformat()
        self.save_data()
        print(f"Scraping finished for '{username}'\n")

    def _scrape_page(self, username, page_path):
        """Generic helper to walk through paginated griditem listings."""
        items = []
        page = 1
        while True:
            url = f"https://letterboxd.com/{username}/{page_path}/page/{page}/"
            resp = self.scraper.get(url)
            if resp.status_code != 200:
                break
            soup = BeautifulSoup(resp.text, "html.parser")
            grid = soup.select("li.griditem")
            if not grid:
                break
            for li in grid:
                comp = li.select_one("div[data-item-name]")
                if not comp:
                    continue
                nameyear = comp.get("data-item-name", "").strip()
                if not nameyear:
                    continue
                name, year = self._parse_name_year(nameyear)
                link = comp.get("data-item-link", "")
                uri = urljoin("https://letterboxd.com", link)
                if uri == "https://letterboxd.com":
                    continue
                # try to pick up rating from the nearby span
                rating = None
                rate_span = li.find("span", class_=re.compile(r"rated-\d+"))
                if rate_span:
                    cls = " ".join(rate_span.get("class", []))
                    m = re.search(r"rated-(\d+)", cls)
                    if m:
                        try:
                            rating = str(int(m.group(1)) / 2)
                        except ValueError:
                            rating = None
                item = {"Name": name, "Year": year, "Letterboxd URI": uri}
                if rating is not None:
                    item["Rating"] = rating
                items.append(item)
            page += 1
        print(f"  {page_path}: {len(items)} items scraped")
        return items

    def _parse_name_year(self, nameyear):
        # data-item-name is like "Title (2023)"
        m = re.match(r"^(.*)\s+\((\d{4})\)$", nameyear.strip())
        if m:
            return m.group(1).strip(), m.group(2)
        return nameyear, ""

    def _parse_rss(self, username, user_data):
        url = f"https://letterboxd.com/{username}/rss/"
        feed = feedparser.parse(url)
        for entry in feed.entries:
            film_title = entry.get("letterboxd_filmtitle", "")
            film_year = entry.get("letterboxd_filmyear", "")
            watched_date = entry.get("letterboxd_watcheddate", "")
            member_rating = entry.get("letterboxd_memberrating", "")
            member_like = entry.get("letterboxd_memberlike", "")
            review_html = entry.get("summary", "")
            review_text = self._extract_review_text(review_html)

            movie = {"Name": film_title, "Year": film_year, "Letterboxd URI": entry.get("link", "")}

            # update watched list if missing
            if film_title and not any(
                w.get("Name") == film_title and w.get("Year") == film_year
                for w in user_data["watched"]
            ):
                user_data["watched"].append({**movie, "Date": watched_date})

            # ratings
            if member_rating:
                if not any(
                    r.get("Name") == film_title and r.get("Year") == film_year
                    for r in user_data["ratings"]
                ):
                    user_data["ratings"].append({**movie, "Date": watched_date, "Rating": member_rating})

            # reviews
            if review_text and "Watched" not in review_text:
                if not any(
                    r.get("Name") == film_title and r.get("Year") == film_year
                    for r in user_data["reviews"]
                ):
                    user_data["reviews"].append({**movie, "Review": review_text})

            # likes
            if member_like == "Yes":
                if not any(
                    l.get("Name") == film_title and l.get("Year") == film_year
                    for l in user_data["likes"]
                ):
                    user_data["likes"].append(movie)

        print(f"  rss feed entries: {len(feed.entries)} parsed")

    def _fetch_missing_posters(self):
        """Fetch movie posters for any entries that lack one."""
        movies_without = [k for k, v in self.data["movies"].items() if not v.get("poster")]
        if not movies_without:
            print("  All movies already have posters")
            return
        print(f"  Fetching posters for {len(movies_without)} movies...")
        import time, random
        for movie_key in movies_without:
            time.sleep(random.uniform(8, 12))
            movie = self.data["movies"][movie_key]
            url = self._get_poster_from_letterboxd_uri(movie.get("uri"))
            if url:
                self.data["movies"][movie_key]["poster"] = url
                print(f"    {movie['name']} ({movie['year']}) poster fetched")
            else:
                print(f"    {movie['name']} ({movie['year']}): no poster")

    def _get_poster_from_letterboxd_uri(self, uri):
        if not uri:
            return None
        try:
            resp = self.scraper.get(uri, timeout=5)
            if resp.status_code == 200:
                import re
                m = re.search(r'<meta property="og:image" content="([^\"]+)"', resp.text)
                if m:
                    return m.group(1)
        except Exception as e:
            print(f"      error fetching poster: {e}")
        return None

    def _extract_review_text(self, html):
        # simple regex to grab text inside second <p>
        import re

        matches = re.findall(r"<p>(.*?)</p>", html)
        if len(matches) > 1:
            return matches[1]
        elif matches:
            return matches[0]
        return ""

    def _store_user(self, user_data):
        # merge the scraped user data into existing data.json without erasing other users
        for u in self.data["users"]:
            if u["name"] == user_data["name"]:
                # combine lists, avoiding duplicates
                for key in ["watched", "ratings", "reviews", "watchlist", "likes"]:
                    existing = u.get(key, [])
                    new = user_data.get(key, [])
                    for item in new:
                        if not any(
                            item.get("Name") == e.get("Name") and item.get("Year") == e.get("Year")
                            for e in existing
                        ):
                            existing.append(item)
                    u[key] = existing
                # preserve enabled flag if absent
                u["enabled"] = user_data.get("enabled", u.get("enabled", True))
                u["updatedAt"] = user_data.get("updatedAt", u.get("updatedAt"))
                break
        else:
            # new user, just append
            self.data["users"].append(user_data)

    # we can reuse movie processing logic from original
    def _process_movies(self, user_data, username):
        movies_added = 0
        for film in user_data.get("watched", []):
            movie_key = f"{film.get('Name','')}|{film.get('Year','')}"
            if movie_key not in self.data["movies"]:
                self.data["movies"][movie_key] = {
                    "name": film.get("Name", ""),
                    "year": film.get("Year", ""),
                    "uri": film.get("Letterboxd URI", ""),
                    "poster": None,
                    "users": [],
                }
                movies_added += 1
            # add user reference
            if username not in [u["name"] for u in self.data["movies"][movie_key]["users"]]:
                rating = None
                for r in user_data.get("ratings", []):
                    if r.get("Name") == film.get("Name") and r.get("Year") == film.get("Year"):
                        rating = r.get("Rating")
                        break
                self.data["movies"][movie_key]["users"].append({
                    "name": username,
                    "rating": rating,
                    "watched": True,
                })
        # note: watchlist and likes could also be added here if desired

    def save_data(self):
        self.output_file.parent.mkdir(parents=True, exist_ok=True)
        js_data = {"users": [], "movies": {}, "lastUpdated": self.data["lastUpdated"]}
        for u in self.data["users"]:
            js_data["users"].append(u)
        for k, v in self.data["movies"].items():
            js_data["movies"][k] = v
        with open(self.output_file, "w", encoding="utf-8") as f:
            json.dump(js_data, f, indent=2, ensure_ascii=False)
        print(f"Data saved to {self.output_file}")

    def get_summary(self):
        total_users = len(self.data["users"])
        total_movies = len(self.data["movies"])
        movies_with_poster = sum(1 for m in self.data["movies"].values() if m.get("poster"))
        print("\n" + "=" * 50)
        print("LETTERBOXD SCRAPE SUMMARY")
        print("=" * 50)
        print(f"Users loaded: {total_users}")
        print(f"Total movies: {total_movies}")
        print(f"Movies with posters: {movies_with_poster}")
        if self.data.get("lastUpdated"):
            print(f"Last updated: {self.data['lastUpdated']}")
        print("=" * 50 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Letterboxd user information via web pages"
    )
    parser.add_argument("--user", type=str, required=True, help="Letterboxd username to scrape")
    parser.add_argument("--output", type=str, default="web/data.json", help="Output JSON file")
    parser.add_argument("--fetch-posters", action="store_true", help="Fetch movie posters from Letterboxd page")
    args = parser.parse_args()

    scraper = LetterboxdScraper(output_file=args.output, fetch_posters=args.fetch_posters)
    scraper.scrape_user(args.user)
    scraper.get_summary()


if __name__ == "__main__":
    main()
