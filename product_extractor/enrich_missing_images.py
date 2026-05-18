#!/usr/bin/env python3
"""Fill missing Shopify image URLs in generated product CSVs.

Default mode uses local catalog rows that already have images. Optional web mode
uses DuckDuckGo image search for rows still missing images.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


STOPWORDS = {
    "and",
    "for",
    "with",
    "the",
    "product",
    "laptop",
    "mobile",
    "phone",
    "smartphone",
    "inch",
    "inches",
    "black",
    "white",
    "grey",
    "gray",
}


def tokenize(value: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", value.lower())
    return {token for token in tokens if len(token) > 2 and token not in STOPWORDS}


def score_match(target: set[str], candidate: set[str]) -> float:
    if not target or not candidate:
        return 0.0
    overlap = len(target & candidate)
    return overlap / max(len(target), len(candidate))


def read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames or []
        rows = list(reader)
    return headers, rows


def write_rows(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def build_local_image_index(csv_paths: list[Path]) -> list[dict[str, object]]:
    index = []
    for path in csv_paths:
        _, rows = read_rows(path)
        for row in rows:
            image_url = (row.get("Product image URL") or "").strip()
            title = (row.get("Title") or "").strip()
            if not image_url or not title:
                continue
            index.append(
                {
                    "title": title,
                    "tokens": tokenize(title),
                    "image_url": image_url,
                }
            )
    return index


def best_local_image(title: str, index: list[dict[str, object]], min_score: float) -> str:
    target = tokenize(title)
    best_score = 0.0
    best_url = ""
    for item in index:
        candidate_tokens = item["tokens"]
        if not isinstance(candidate_tokens, set):
            continue
        score = score_match(target, candidate_tokens)
        if score > best_score:
            best_score = score
            best_url = str(item["image_url"])
    return best_url if best_score >= min_score else ""


def fetch_url(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def duckduckgo_image_search(query: str) -> str:
    search_url = f"https://duckduckgo.com/?q={quote(query)}&iax=images&ia=images"
    html = fetch_url(search_url)
    match = re.search(r"vqd=['\"]?([^'\"&]+)", html)
    if not match:
        return ""
    vqd = match.group(1)
    params = urlencode(
        {
            "l": "us-en",
            "o": "json",
            "q": query,
            "vqd": vqd,
            "f": ",,,",
            "p": "1",
        }
    )
    data = fetch_url(f"https://duckduckgo.com/i.js?{params}")
    payload = json.loads(data)
    for result in payload.get("results", []):
        image_url = result.get("image") or result.get("thumbnail")
        if image_url:
            return str(image_url)
    return ""


def enrich_file(
    path: Path,
    *,
    local_index: list[dict[str, object]],
    min_score: float,
    use_web: bool,
    delay: float,
    max_web: int,
    dry_run: bool,
) -> tuple[int, int, int]:
    headers, rows = read_rows(path)
    if "Product image URL" not in headers:
        return (0, 0, 0)

    local_filled = 0
    web_filled = 0
    missing = 0
    web_count = 0
    for row in rows:
        if (row.get("Product image URL") or "").strip():
            continue

        missing += 1
        title = (row.get("Title") or "").strip()
        if not title:
            continue

        image_url = best_local_image(title, local_index, min_score)
        if image_url:
            row["Product image URL"] = image_url
            row["Image position"] = row.get("Image position") or "1"
            row["Image alt text"] = row.get("Image alt text") or title
            local_filled += 1
            continue

        if use_web and web_count < max_web:
            query = f"{title} product image"
            image_url = duckduckgo_image_search(query)
            web_count += 1
            if image_url:
                row["Product image URL"] = image_url
                row["Image position"] = row.get("Image position") or "1"
                row["Image alt text"] = row.get("Image alt text") or title
                web_filled += 1
            time.sleep(delay)

    if not dry_run and (local_filled or web_filled):
        write_rows(path, headers, rows)

    return (missing, local_filled, web_filled)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fill missing image URLs in Shopify CSVs.")
    parser.add_argument(
        "--root",
        default="output/classified-shopify",
        help="Folder containing generated Shopify CSVs.",
    )
    parser.add_argument(
        "--target",
        action="append",
        help="Specific CSV to enrich. Repeatable. Defaults to all CSVs under root.",
    )
    parser.add_argument("--min-score", type=float, default=0.45)
    parser.add_argument("--web", action="store_true", help="Use web image search fallback.")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--max-web", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root)
    csv_paths = sorted(root.rglob("*.csv"))
    targets = [Path(path) for path in args.target] if args.target else csv_paths
    local_index = build_local_image_index(csv_paths)

    total_missing = 0
    total_local = 0
    total_web = 0
    for path in targets:
        missing, local_filled, web_filled = enrich_file(
            path,
            local_index=local_index,
            min_score=args.min_score,
            use_web=args.web,
            delay=args.delay,
            max_web=args.max_web,
            dry_run=args.dry_run,
        )
        total_missing += missing
        total_local += local_filled
        total_web += web_filled
        print(
            f"{path}: missing={missing}, local_filled={local_filled}, "
            f"web_filled={web_filled}"
        )

    print(
        f"Total missing={total_missing}, local_filled={total_local}, "
        f"web_filled={total_web}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
