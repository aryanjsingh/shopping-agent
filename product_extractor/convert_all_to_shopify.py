#!/usr/bin/env python3
"""Convert all local product CSV datasets into Shopify import CSVs."""

from __future__ import annotations

import argparse
import csv
import html
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any


SKIP_FILENAMES = {
    "product_template.csv",
    "amz_ca_total_products_data_processed.csv",
    "final.csv",
    "laptopCleanData.csv",
}

SKIP_DIR_PARTS = {
    "output",
    "__pycache__",
    "archive-3",
}

INR_TO_USD = 0.012


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def read_template_headers(template_path: Path) -> list[str]:
    with template_path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.reader(file)
        headers = next(reader, [])
    if not headers:
        raise ValueError(f"Template CSV has no header: {template_path}")
    return headers


def slugify(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")[:100] or "product"


def parse_number(value: str | None, default: float = 0.0) -> float:
    if not value:
        return default
    cleaned = (
        value.replace(",", "")
        .replace("₹", "")
        .replace("$", "")
        .replace("INR", "")
        .strip()
    )
    if not cleaned:
        return default
    try:
        return float(cleaned)
    except ValueError:
        return default


def normalize_price(value: str | None, *, currency: str = "usd") -> str:
    number = parse_number(value)
    if currency.lower() == "inr":
        number *= INR_TO_USD
    return f"{number:.2f}" if number > 0 else "0.00"


def has_positive_price(price: str) -> bool:
    return parse_number(price) > 0


def first_value(row: dict[str, str], names: list[str]) -> str:
    for name in names:
        value = clean_text(row.get(name))
        if value:
            return value
    return ""


def rating_from_stars(row: dict[str, str]) -> str:
    direct = first_value(row, ["rating", "stars"])
    if direct:
        number = parse_number(direct)
        return f"{number:.2f}".rstrip("0").rstrip(".") if number else ""

    total = 0
    weighted = 0
    for stars in range(1, 6):
        count = int(parse_number(first_value(row, [f"{stars} Stars", f"{stars} stars"])))
        total += count
        weighted += stars * count
    if total == 0:
        return ""
    rating = weighted / total
    return f"{rating:.2f}".rstrip("0").rstrip(".")


def total_ratings(row: dict[str, str]) -> str:
    direct = first_value(row, ["Total Ratings", "total_ratings", "reviews"])
    if direct:
        return str(int(parse_number(direct)))

    total = 0
    for stars in range(1, 6):
        total += int(parse_number(first_value(row, [f"{stars} Stars", f"{stars} stars"])))
    return str(total) if total else ""


def specs_from_row(row: dict[str, str], excluded: set[str]) -> list[tuple[str, str]]:
    common_excluded = {
        "rating",
        "stars",
        "Total Ratings",
        "total_ratings",
        "reviews",
        "1 Stars",
        "2 Stars",
        "3 Stars",
        "4 Stars",
        "5 Stars",
        "1 stars",
        "2 stars",
        "3 stars",
        "4 stars",
        "5 stars",
        "ppi",
        "screen_area_in2",
        "battery_per_gb_ram",
        "watt_per_mah",
        "Other info",
        "other_info",
    }
    specs: list[tuple[str, str]] = []
    for key, value in row.items():
        if key in excluded or key in common_excluded:
            continue
        value = clean_text(value)
        if not value or value in {"-1", "-1.0", "0.0", "0", "[]", "{}"}:
            continue
        value = format_spec_value(key, value)
        if value:
            specs.append((key, value))
    return specs[:24]


def format_spec_value(key: str, value: str) -> str:
    boolean_keys = {
        "Dual_Sim",
        "5G",
        "NFC",
        "WiFi",
        "IR_Blaster",
        "card_supported",
        "have_ssd",
        "have_hdd",
    }
    if key in boolean_keys:
        return "Yes" if value in {"1", "1.0", "True", "true", "Yes", "yes"} else "No"

    if value in {"True", "true"}:
        return "Yes"
    if value in {"False", "false"}:
        return "No"

    if key in {"display_frequency", "Refresh Rate (Hz)"}:
        number = parse_number(value)
        return f"{number:g}Hz" if number else value

    if key in {"display_size", "display_size_inch", "Screen size (inches)"}:
        number = parse_number(value)
        return f"{number:g} inches" if number else value

    if key == "capacity":
        number = parse_number(value)
        return f"{number:g} mAh" if number else value

    if key == "battery_watt":
        number = parse_number(value)
        return f"{number:g}W" if number else value

    if key == "Processor_GHz":
        number = parse_number(value)
        return f"{number:g}GHz" if number else value

    if key in {"RAM", "ram"}:
        number = parse_number(value)
        return f"{number:g}GB" if number else value

    if key == "ROM":
        number = parse_number(value)
        return f"{number:g}GB" if number else value

    if key == "storage_capacity_gb":
        number = parse_number(value)
        return f"{number:g}GB" if number else value

    if key == "Resolution":
        numbers = re.findall(r"\d+(?:\.\d+)?", value)
        if len(numbers) >= 2:
            return f"{float(numbers[0]):g} x {float(numbers[1]):g}"
        return value.strip("[]")

    if key in {"Front_camera", "Rear_camera"}:
        numbers = re.findall(r"\d+(?:\.\d+)?", value)
        if numbers:
            suffix = "MP"
            return " + ".join(f"{float(number):g}{suffix}" for number in numbers)
        return value.strip("[]")

    return value


def human_label(key: str) -> str:
    replacements = {
        "os": "Operating system",
        "rating": "Rating",
        "battery_watt": "Charging wattage",
        "charging_type": "Charging type",
        "Dual_Sim": "Dual SIM",
        "5G": "5G",
        "NFC": "NFC",
        "WiFi": "Wi-Fi",
        "IR_Blaster": "IR blaster",
        "Processor_Name": "Processor",
        "Processor_GHz": "Processor speed",
        "num_core": "CPU cores",
        "Front_camera": "Front camera",
        "Rear_camera": "Rear camera",
        "No_of_rear_cameras": "Rear cameras",
        "display_size": "Display size",
        "display_frequency": "Refresh rate",
        "card_supported": "Card supported",
        "ppi": "Pixels per inch",
        "screen_area_in2": "Screen area",
        "battery_per_gb_ram": "Battery per GB RAM",
        "watt_per_mah": "Watt per mAh",
        "brand_name": "Brand",
        "ram": "RAM",
        "processor_type": "Processor",
        "processor_brand": "Processor brand",
        "storage_capacity_gb": "Storage",
        "have_ssd": "SSD",
        "have_hdd": "HDD",
        "graphics_capacity": "Graphics",
        "display_size_inch": "Display size",
        "display_type": "Display type",
    }
    if key in replacements:
        return replacements[key]
    key = key.replace("_", " ").replace("-", " ")
    key = key.replace("Wi Fi", "Wi-Fi").replace("Wifi", "Wi-Fi")
    key = re.sub(r"\s+", " ", key).strip()
    return key[:1].upper() + key[1:]


def html_description(title: str, category: str, row: dict[str, str], excluded: set[str]) -> str:
    specs = specs_from_row(row, excluded)
    parts = [
        f"<p>{html.escape(title)}</p>"
    ]
    rating = rating_from_stars(row)
    ratings = total_ratings(row)
    facts = []
    if rating or ratings:
        if rating:
            facts.append(f"Rating: {html.escape(rating)} out of 5")
        if ratings:
            facts.append(f"Total ratings: {html.escape(ratings)}")
    if specs:
        for key, value in specs:
            facts.append(f"{html.escape(human_label(key))}: {html.escape(value)}")
    if facts:
        bullets = "".join(f"<li>{fact}</li>" for fact in facts)
        parts.append(f"<ul>{bullets}</ul>")
    return "".join(parts)


def make_shopify_row(
    *,
    headers: list[str],
    source_row: dict[str, str],
    title: str,
    category: str,
    vendor: str,
    price: str,
    image_url: str,
    sku_seed: str,
    source_label: str,
    excluded_spec_keys: set[str],
) -> dict[str, str]:
    row = {header: "" for header in headers}
    sku = slugify(sku_seed or title).upper()[:64]
    handle = slugify(f"{title}-{sku}")
    tags = sorted({category, source_label, "electronics-demo"})
    rating = rating_from_stars(source_row)
    if rating and parse_number(rating) >= 4.5:
        tags.append("high-rating")

    values = {
        "Title": title,
        "URL handle": handle,
        "Description": html_description(title, category, source_row, excluded_spec_keys),
        "Vendor": vendor or "Demo Electronics Catalog",
        "Product category": "Electronics",
        "Type": category,
        "Tags": ", ".join(tags),
        "Published on online store": "TRUE",
        "Status": "Active",
        "SKU": sku,
        "Option1 name": "Title",
        "Option1 value": "Default Title",
        "Price": price,
        "Charge tax": "TRUE",
        "Inventory tracker": "shopify",
        "Inventory quantity": "25",
        "Continue selling when out of stock": "DENY",
        "Weight value (grams)": "500",
        "Weight unit for display": "g",
        "Requires shipping": "TRUE",
        "Fulfillment service": "manual",
        "Product image URL": image_url,
        "Image position": "1" if image_url else "",
        "Image alt text": title if image_url else "",
        "Gift card": "FALSE",
        "SEO title": title[:70],
        "SEO description": re.sub(r"<[^>]+>", " ", title)[:320],
        "Google Shopping / Google product category": "Electronics",
        "Google Shopping / Manufacturer part number (MPN)": sku,
        "Google Shopping / Ad group name": category,
        "Google Shopping / Ads labels": source_label,
        "Google Shopping / Condition": "New",
        "Google Shopping / Custom product": "FALSE",
        "Google Shopping / Custom label 0": category,
        "Google Shopping / Custom label 1": source_label,
    }
    for key, value in values.items():
        if key in row:
            row[key] = value
    return row


def convert_gadgets_file(path: Path, headers: list[str], category: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    excluded = {
        "url",
        "link",
        "Picture URL",
        "picture",
        "Brand",
        "Product Name",
        "Model",
        "Model Name",
        "Company",
        "Price in India",
    }
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for raw in reader:
            title = first_value(raw, ["Product Name", "Model", "Model Name", "name"])
            if not title:
                brand = first_value(raw, ["Brand", "Company", "brand_name"])
                model = first_value(raw, ["Model", "Model Name"])
                title = clean_text(f"{brand} {model}")
            if not title:
                continue
            price = normalize_price(
                first_value(raw, ["Price in India", "price"]),
                currency="inr",
            )
            if not has_positive_price(price):
                continue
            rows.append(
                make_shopify_row(
                    headers=headers,
                    source_row=raw,
                    title=title,
                    category=category,
                    vendor=first_value(raw, ["Brand", "Company", "brand_name"]),
                    price=price,
                    image_url=first_value(raw, ["Picture URL", "picture"]),
                    sku_seed=first_value(raw, ["Model", "Model Name", "Product Name", "name"]),
                    source_label="gadgets360",
                    excluded_spec_keys=excluded,
                )
            )
    return rows


def convert_mobile_final(path: Path, headers: list[str]) -> list[dict[str, str]]:
    rows = []
    excluded = {"model", "brand", "price_numeric"}
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for raw in reader:
            title = first_value(raw, ["model"])
            if not title:
                continue
            price = normalize_price(
                first_value(raw, ["price_numeric"]),
                currency="inr",
            )
            if not has_positive_price(price):
                continue
            rows.append(
                make_shopify_row(
                    headers=headers,
                    source_row=raw,
                    title=title,
                    category="mobiles",
                    vendor=first_value(raw, ["brand"]),
                    price=price,
                    image_url="",
                    sku_seed=title,
                    source_label="mobile-specs",
                    excluded_spec_keys=excluded,
                )
            )
    return rows


def convert_laptop_clean(path: Path, headers: list[str]) -> list[dict[str, str]]:
    rows = []
    excluded = {"brand_name", "name", "price"}
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for raw in reader:
            title = re.sub(r"<[^>]+>", " ", first_value(raw, ["name"]))
            title = html.unescape(clean_text(title))
            if not title:
                continue
            price = normalize_price(first_value(raw, ["price"]), currency="inr")
            if not has_positive_price(price):
                continue
            rows.append(
                make_shopify_row(
                    headers=headers,
                    source_row=raw,
                    title=title,
                    category="laptops",
                    vendor=first_value(raw, ["brand_name"]),
                    price=price,
                    image_url="",
                    sku_seed=title,
                    source_label="laptop-clean-data",
                    excluded_spec_keys=excluded,
                )
            )
    return rows


def convert_sales_file(path: Path, headers: list[str]) -> list[dict[str, str]]:
    products: OrderedDict[str, dict[str, Any]] = OrderedDict()
    with path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for raw in reader:
            title = first_value(raw, ["Product"])
            if not title or title == "Product":
                continue
            item = products.setdefault(
                title,
                {
                    "row": raw,
                    "quantity": 0,
                    "price": first_value(raw, ["Price Each"]),
                },
            )
            item["quantity"] += int(parse_number(first_value(raw, ["Quantity Ordered"])))

    rows = []
    for title, item in products.items():
        raw = dict(item["row"])
        raw["Historical units sold"] = str(item["quantity"])
        rows.append(
            make_shopify_row(
                headers=headers,
                source_row=raw,
                title=title,
                category=infer_sales_category(title),
                vendor="Demo Electronics Catalog",
                price=normalize_price(item["price"]),
                image_url="",
                sku_seed=title,
                source_label="sales-2019",
                excluded_spec_keys={"Order ID", "Product", "Order Date", "Purchase Address"},
            )
        )
    return rows


def infer_sales_category(title: str) -> str:
    lower = title.lower()
    if "laptop" in lower:
        return "laptops"
    if "monitor" in lower:
        return "monitors"
    if "headphones" in lower or "airpods" in lower:
        return "headphones"
    if "iphone" in lower or "phone" in lower:
        return "mobiles"
    if "tv" in lower:
        return "televisions"
    if "battery" in lower or "cable" in lower:
        return "accessories"
    return "electronics"


def dedupe_rows(rows: list[dict[str, str]], seen: set[str]) -> list[dict[str, str]]:
    unique_rows = []
    for row in rows:
        key = slugify(
            "|".join(
                [
                    row.get("Title", ""),
                    row.get("Vendor", ""),
                    row.get("Type", ""),
                    row.get("SKU", ""),
                ]
            )
        )
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)
    return unique_rows


def write_rows(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def category_from_filename(path: Path) -> str:
    return path.stem.replace("_and_", "_").replace("_", " ").replace("-", " ").strip()


def should_skip(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    if path.name in SKIP_FILENAMES:
        return True
    return any(part in SKIP_DIR_PARTS for part in relative.parts)


def convert_file(path: Path, root: Path, headers: list[str]) -> list[dict[str, str]]:
    relative = path.relative_to(root)
    if relative.parts and relative.parts[0] == "archive-3":
        return convert_sales_file(path, headers)
    if path.name == "final.csv":
        return convert_mobile_final(path, headers)
    if path.name == "laptopCleanData.csv":
        return convert_laptop_clean(path, headers)
    return convert_gadgets_file(path, headers, category_from_filename(path))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert all visible product CSVs to Shopify CSVs."
    )
    parser.add_argument("--root", default=".", help="Product extractor root.")
    parser.add_argument("--template", default="product_template.csv")
    parser.add_argument(
        "--output-dir",
        default="output/classified-shopify",
        help="Output folder preserving source classification.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    headers = read_template_headers(root / args.template)
    output_dir = root / args.output_dir

    total_files = 0
    total_rows = 0
    seen_products: set[str] = set()
    for source_path in sorted(root.rglob("*.csv")):
        if should_skip(source_path, root):
            continue
        rows = convert_file(source_path, root, headers)
        rows = dedupe_rows(rows, seen_products)
        if not rows:
            continue
        relative = source_path.relative_to(root)
        output_path = output_dir / relative.with_suffix(".shopify.csv")
        write_rows(output_path, headers, rows)
        total_files += 1
        total_rows += len(rows)
        print(f"{len(rows)}\t{output_path.relative_to(root)}")

    print(f"Converted {total_rows} products across {total_files} CSV files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
