# Product Extractor

Converts local electronics/product CSV datasets into Shopify product-import CSVs using `product_template.csv`.

## Convert All Classified CSVs

```bash
cd product_extractor
python3 convert_all_to_shopify.py
```

Output:

```text
output/classified-shopify/
```

The output keeps the source classification:

- `archive-2/*.csv` stays under `output/classified-shopify/archive-2/`
- `archive-3/*.csv` stays under `output/classified-shopify/archive-3/`
- root CSV files stay at the output root

Generated Shopify CSV files end with `.shopify.csv`.

## Enrich Missing Images

Most `archive-2` product catalogs already include image URLs. If a generated
CSV still has missing images, first try local image matching:

```bash
python3 enrich_missing_images.py
```

Optional web fallback:

```bash
python3 enrich_missing_images.py --web --max-web 100
```

## Notes

- `product_template.csv` controls the output columns.
- `archive-2` files are treated as categorized product catalogs.
- `archive-3` monthly sales files are converted into unique product catalogs per month.
- Generated output is ignored by git.
