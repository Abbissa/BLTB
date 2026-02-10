#!/usr/bin/env python3
"""
Letterboxd Data Processor
Generates incremental JSON from Letterboxd ZIP exports and enriches with movie posters from RSS.
Usage:
    python process_letterboxd.py --zip path/to/export.zip [--output data.json] [--fetch-posters]
"""

import json
import csv
import zipfile
import sys
import os
from pathlib import Path
from datetime import datetime
import argparse
import feedparser
from collections import defaultdict
import requests
from urllib.parse import quote

class LetterboxdProcessor:
    def __init__(self, output_file='web/data.json', fetch_posters=False):
        self.output_file = Path(output_file)
        self.fetch_posters = fetch_posters
        self.data = self._load_existing_data()
        
    def _load_existing_data(self):
        """Load existing data.json if it exists"""
        if self.output_file.exists():
            try:
                with open(self.output_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                print(f"Warning: Could not load existing {self.output_file}. Starting fresh.")
                return {"users": {}, "movies": {}, "lastUpdated": None}
        return {"users": {}, "movies": {}, "lastUpdated": None}
    
    def _parse_csv(self, csv_text):
        """Parse CSV content"""
        reader = csv.DictReader(csv_text.strip().split('\n'))
        return list(reader) if reader else []
    
    def process_zip(self, zip_path, username=None):
        """Process a single Letterboxd ZIP export"""
        zip_path = Path(zip_path)
        if not zip_path.exists():
            raise FileNotFoundError(f"ZIP file not found: {zip_path}")
        
        # Extract username from ZIP filename if not provided
        if not username:
            # Format: letterboxd-username-YYYY-MM-DD.zip
            filename = zip_path.stem
            parts = filename.replace('letterboxd-', '').split('-')
            print(f"Extracted parts from filename: {parts}")
            # Try to remove date suffix (YYYY-MM-DD)
            if len(parts) >= 3:
                # Join parts, removing last 3 (date)
                # keep from the first - until the last 3 parts (date)
                username = '-'.join(parts[:-6]) if len(parts) > 6 else parts[0]
            else:
                username = parts[0] if parts else filename
        
        print(f"Processing ZIP: {zip_path.name}")
        print(f"Username: {username}")
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_file:
                user_data = {
                    "name": username,
                    "watched": [],
                    "ratings": [],
                    "reviews": [],
                    "watchlist": [],
                    "likes": [],
                    "enabled": True,
                    "updatedAt": datetime.now().isoformat()
                }
                
                # CSV file mappings
                csv_files = {
                    'watched.csv': 'watched',
                    'ratings.csv': 'ratings',
                    'reviews.csv': 'reviews',
                    'watchlist.csv': 'watchlist',
                    'likes/films.csv': 'likes'
                }
                
                for csv_filename, key in csv_files.items():
                    try:
                        csv_content = zip_file.read(csv_filename).decode('utf-8')
                        user_data[key] = self._parse_csv(csv_content)
                        print(f"  ✓ {key}: {len(user_data[key])} items")
                    except KeyError:
                        print(f"  - {key}: not found")
                
                # Store user data
                # prevent error from using str as index
                # self.data["users"][username] = user_data
                # find the user in the list
                for u in self.data["users"]:
                    if u["name"] == username:
                        u["watched"] = user_data["watched"]
                        u["ratings"] = user_data["ratings"]
                        u["reviews"] = user_data["reviews"]
                        u["watchlist"] = user_data["watchlist"]
                        u["likes"] = user_data["likes"]
                        u["enabled"] = True
                        u["updatedAt"] = datetime.now().isoformat()
                        break
                else:
                    # if user not found, append new user
                    self.data["users"].append(user_data)
                
                # Process movies and fetch posters if enabled
                self._process_movies(user_data, username)
                
                self.data["lastUpdated"] = datetime.now().isoformat()
                self.save_data()
                
                print(f"✓ User '{username}' processed successfully\n")
                return True
                
        except zipfile.BadZipFile:
            print(f"✗ Invalid ZIP file: {zip_path}")
            return False
    def get_user_data(obj, username, data ):
        for u in obj["users"]:
            if u["name"] == username:
                 u["data"] = data
        return None


    def _process_movies(self, user_data, username):
        """Extract and store unique movies from user data"""
        movies_added = 0
        
        # Get all movies from watched list
        for film in user_data['watched']:
            movie_key = f"{film.get('Name', '')}|{film.get('Year', '')}"
            
            if movie_key not in self.data["movies"]:
                self.data["movies"][movie_key] = {
                    "name": film.get('Name', ''),
                    "year": film.get('Year', ''),
                    "uri": film.get('Letterboxd URI', ''),
                    "poster": None,
                    "users": []
                }
                movies_added += 1
            
            # Add user reference if not already there
            if username not in [u["name"] for u in self.data["movies"][movie_key]["users"]]:
                rating = None
                for r in user_data['ratings']:
                    if r.get('Name') == film.get('Name') and r.get('Year') == film.get('Year'):
                        rating = r.get('Rating')
                        break
                
                self.data["movies"][movie_key]["users"].append({
                    "name": username,
                    "rating": rating,
                    "watched": True
                })
        
        # Add watchlist movies
        for film in user_data['watchlist']:
            movie_key = f"{film.get('Name', '')}|{film.get('Year', '')}"
            
            if movie_key not in self.data["movies"]:
                self.data["movies"][movie_key] = {
                    "name": film.get('Name', ''),
                    "year": film.get('Year', ''),
                    "uri": film.get('Letterboxd URI', ''),
                    "poster": None,
                    "users": []
                }
                movies_added += 1
        
        print(f"  Movies processed: {movies_added} new")
        
        # Fetch posters if enabled
        if self.fetch_posters:
            self._fetch_missing_posters()
    
    def _fetch_missing_posters(self):
        """Fetch movie posters from RSS feeds and URLs"""
        movies_without_poster = [k for k, v in self.data["movies"].items() if not v.get("poster")]
        
        if not movies_without_poster:
            print("  All movies already have posters")
            return
        
        print(f"  Fetching posters for {len(movies_without_poster)} movies...")
        
        for movie_key in movies_without_poster[:10]:  # Limit to avoid rate limiting
            movie = self.data["movies"][movie_key]
            poster_url = self._get_poster_from_letterboxd_uri(movie["uri"])
            
            if poster_url:
                self.data["movies"][movie_key]["poster"] = poster_url
                print(f"    ✓ {movie['name']} ({movie['year']})")
            else:
                print(f"    - {movie['name']} ({movie['year']}): no poster found")
    
    def _get_poster_from_letterboxd_uri(self, uri):
        """Extract poster image from Letterboxd URI"""
        if not uri:
            return None
        
        try:
            # Letterboxd URIs look like: https://letterboxd.com/film/movie-name/
            # We can fetch the page and extract the poster image
            response = requests.get(uri, timeout=5)
            if response.status_code == 200:
                # Look for poster image in og:image meta tag
                import re
                match = re.search(r'<meta property="og:image" content="([^"]+)"', response.text)
                if match:
                    return match.group(1)
        except Exception as e:
            print(f"      Error fetching poster: {e}")
        
        return None
    
    def save_data(self):
        """Save data to JSON file"""
        self.output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert to format expected by JavaScript
        js_data = {
            "users": [],
            "movies": {},
            "lastUpdated": self.data["lastUpdated"]
        }
        
        # Convert users dict to list
        for user in self.data["users"]:
            js_data["users"].append(user)
        
        # Convert movies dict, keeping only top-level data
        for movie_key, movie_data in self.data["movies"].items():
            js_data["movies"][movie_key] = movie_data
        
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(js_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Data saved to {self.output_file}")
    
    def get_summary(self):
        """Print summary of loaded data"""
        total_users = len(self.data["users"])
        total_movies = len(self.data["movies"])
        movies_with_poster = sum(1 for m in self.data["movies"].values() if m.get("poster"))
        
        print("\n" + "="*50)
        print("LETTERBOXD DATA SUMMARY")
        print("="*50)
        print(f"Users loaded: {total_users}")
        print(f"Total movies: {total_movies}")
        print(f"Movies with posters: {movies_with_poster}")
        if self.data["lastUpdated"]:
            print(f"Last updated: {self.data['lastUpdated']}")
        print("="*50 + "\n")

def main():
    parser = argparse.ArgumentParser(
        description='Process Letterboxd ZIP exports and generate JSON with movie data'
    )
    parser.add_argument('--zip', type=str, help='Path to ZIP export file')
    parser.add_argument('--user', type=str, help='Custom username (optional)')
    parser.add_argument('--output', type=str, default='web/data.json',
                       help='Output JSON file path (default: web/data.json)')
    parser.add_argument('--fetch-posters', action='store_true',
                       help='Fetch movie posters from Letterboxd (requires requests library)')
    parser.add_argument('--batch', type=str, help='Process multiple ZIPs from directory')
    
    args = parser.parse_args()
    
    processor = LetterboxdProcessor(output_file=args.output, fetch_posters=args.fetch_posters)
    
    if args.zip:
        processor.process_zip(args.zip, args.user)
    elif args.batch:
        batch_dir = Path(args.batch)
        if not batch_dir.is_dir():
            print(f"Error: {batch_dir} is not a directory")
            sys.exit(1)
        
        zip_files = list(batch_dir.glob('*.zip'))
        if not zip_files:
            print(f"No ZIP files found in {batch_dir}")
            sys.exit(1)
        
        print(f"Found {len(zip_files)} ZIP files\n")
        for zip_file in zip_files:
            processor.process_zip(str(zip_file))
    else:
        parser.print_help()
        sys.exit(0)
    
    processor.get_summary()

if __name__ == '__main__':
    main()
