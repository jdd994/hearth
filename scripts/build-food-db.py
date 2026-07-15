#!/usr/bin/env python3
"""
build-food-db.py — turn USDA FoodData Central (SR Legacy, public domain) into the
compact food database Hearth bundles and searches (public/foods.json).

Why this exists: milestone 1 shipped a ~30-food hand seed. This replaces it with
the ~7,800 real whole foods of SR Legacy, so search is actually useful — while
keeping the tier-0 promise: the data ships WITH the app, so lookups stay fully
offline and private. See ../FOOD_DATA.md.

Usage:
  1. Download SR Legacy CSV from https://fdc.nal.usda.gov/download-datasets
     (FoodData_Central_sr_legacy_food_csv_*.zip) and unzip it.
  2. python3 build-food-db.py <unzipped-dir> ../public/foods.json

Output is a compact columnar JSON (keys + rows) to keep it small; the client
decodes it in fooddata/index.ts. Values are per 100g (USDA's basis), rounded to
2 dp (the data is approximate; more precision would be false).
"""
import csv, json, sys, os

# USDA nutrient.csv `id` -> our nutrient key (mapping confirmed against nutrient.csv).
NUTRIENT_ID = {
    1008: "kcal", 1003: "protein", 1005: "carbs", 2000: "sugars", 1079: "fibre",
    1004: "fat", 1258: "satFat", 1093: "sodium", 1092: "potassium", 1087: "calcium",
    1089: "iron", 1162: "vitC", 1114: "vitD",
}
KEYS = ["kcal", "protein", "carbs", "sugars", "fibre", "fat", "satFat",
        "sodium", "potassium", "calcium", "iron", "vitC", "vitD"]

def main(src_dir, out_path):
    food_csv = os.path.join(src_dir, "food.csv")
    fn_csv = os.path.join(src_dir, "food_nutrient.csv")

    # 1. foods: fdc_id -> description
    names = {}
    with open(food_csv, newline="") as f:
        for r in csv.DictReader(f):
            names[r["fdc_id"]] = r["description"].strip()
    print(f"foods: {len(names)}")

    # 2. nutrient values (stream the big file, keep only nutrients we track)
    vals = {}  # fdc_id -> {key: amount}
    with open(fn_csv, newline="") as f:
        for r in csv.DictReader(f):
            try:
                nid = int(r["nutrient_id"])
            except (ValueError, KeyError):
                continue
            key = NUTRIENT_ID.get(nid)
            if not key:
                continue
            fdc = r["fdc_id"]
            if fdc not in names:
                continue
            try:
                amt = float(r["amount"])
            except (ValueError, KeyError):
                continue
            vals.setdefault(fdc, {})[key] = amt

    # 3. build rows; require an energy value (drops foods with no usable data)
    def num(x):
        v = round(x, 2)
        return int(v) if v == int(v) else v

    rows = []
    for fdc, nut in vals.items():
        if "kcal" not in nut:
            continue
        rows.append([fdc, names[fdc], [num(nut.get(k, 0.0)) for k in KEYS]])

    rows.sort(key=lambda r: r[1].lower())
    out = {"keys": KEYS, "foods": rows}
    with open(out_path, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(out_path)
    print(f"wrote {len(rows)} foods -> {out_path} ({size // 1024} KB)")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
