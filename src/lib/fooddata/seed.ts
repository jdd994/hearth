// fooddata/seed.ts
// Tier 0: a small, curated, BUNDLED food database — common whole foods with
// per-100g nutrients. Lookups against this are fully offline and fully private:
// nobody learns what you searched, let alone ate. This is the airtight rung.
//
// This is a SEED, not the destination. It's ~30 everyday foods so the whole
// log-and-see-your-day flow works today. It will be replaced/augmented by the
// full USDA FoodData Central import (public domain) via a prep script — see
// ../../FOOD_DATA.md. Macros here are USDA-ballpark and reliable; some trace
// micronutrients are left at 0 in the seed and get filled by the real import.
//
// Values are per 100g. `portions` give friendly amounts (a cup, an egg, a slice).

import type { Food, Nutrients } from "../nutrition";

// Compact builder: fill what we're confident about; unspecified nutrients are 0.
function food(
  id: string,
  name: string,
  portions: [string, number][],
  per100g: Partial<Nutrients>
): Food {
  const base: Nutrients = {
    kcal: 0, protein: 0, carbs: 0, sugars: 0, fibre: 0, fat: 0, satFat: 0,
    sodium: 0, potassium: 0, calcium: 0, iron: 0, vitC: 0, vitD: 0,
  };
  return {
    id: `seed:${id}`,
    name,
    source: "seed",
    portions: portions.map(([label, grams]) => ({ label, grams })),
    per100g: { ...base, ...per100g },
  };
}

export const SEED_FOODS: Food[] = [
  food("oats", "Rolled oats (dry)", [["1 cup", 90], ["½ cup", 45]],
    { kcal: 389, protein: 16.9, carbs: 66.3, sugars: 0.99, fibre: 10.6, fat: 6.9, satFat: 1.2, sodium: 2, potassium: 429, iron: 4.7 }),
  food("banana", "Banana", [["1 medium", 118], ["1 small", 90]],
    { kcal: 89, protein: 1.1, carbs: 22.8, sugars: 12.2, fibre: 2.6, fat: 0.3, sodium: 1, potassium: 358, vitC: 8.7 }),
  food("egg", "Egg", [["1 large", 50], ["2 large", 100]],
    { kcal: 143, protein: 12.6, carbs: 0.7, sugars: 0.4, fat: 9.5, satFat: 3.1, sodium: 142, calcium: 56, iron: 1.8, vitD: 2 }),
  food("chicken-breast", "Chicken breast, cooked", [["1 breast", 120], ["100 g", 100]],
    { kcal: 165, protein: 31, carbs: 0, fat: 3.6, satFat: 1, sodium: 74, potassium: 256, iron: 1 }),
  food("white-rice", "White rice, cooked", [["1 cup", 158], ["½ cup", 79]],
    { kcal: 130, protein: 2.7, carbs: 28, sugars: 0.1, fibre: 0.4, fat: 0.3, sodium: 1, potassium: 35 }),
  food("brown-rice", "Brown rice, cooked", [["1 cup", 195], ["½ cup", 98]],
    { kcal: 123, protein: 2.7, carbs: 25.6, sugars: 0.4, fibre: 1.6, fat: 1, sodium: 4, potassium: 86 }),
  food("milk-2", "Milk, 2%", [["1 cup", 244], ["½ cup", 122]],
    { kcal: 50, protein: 3.3, carbs: 4.8, sugars: 5, fat: 2, satFat: 1.3, sodium: 47, calcium: 120, vitD: 1.1 }),
  food("greek-yogurt", "Greek yogurt, plain", [["1 cup", 245], ["150 g pot", 150]],
    { kcal: 59, protein: 10, carbs: 3.6, sugars: 3.2, fat: 0.4, satFat: 0.1, sodium: 36, calcium: 110 }),
  food("almonds", "Almonds", [["¼ cup", 35], ["10 nuts", 12]],
    { kcal: 579, protein: 21.2, carbs: 21.6, sugars: 4.4, fibre: 12.5, fat: 49.9, satFat: 3.8, sodium: 1, potassium: 733, calcium: 269, iron: 3.7 }),
  food("peanut-butter", "Peanut butter", [["1 tbsp", 16], ["2 tbsp", 32]],
    { kcal: 588, protein: 25, carbs: 20, sugars: 9, fibre: 6, fat: 50, satFat: 10, sodium: 459, potassium: 649 }),
  food("apple", "Apple", [["1 medium", 182], ["1 small", 149]],
    { kcal: 52, protein: 0.3, carbs: 13.8, sugars: 10.4, fibre: 2.4, fat: 0.2, sodium: 1, potassium: 107, vitC: 4.6 }),
  food("broccoli", "Broccoli, cooked", [["1 cup", 156], ["½ cup", 78]],
    { kcal: 35, protein: 2.4, carbs: 7.2, sugars: 1.4, fibre: 3.3, fat: 0.4, sodium: 41, potassium: 293, calcium: 40, vitC: 65 }),
  food("salmon", "Salmon, cooked", [["1 fillet", 150], ["100 g", 100]],
    { kcal: 208, protein: 20, carbs: 0, fat: 13, satFat: 3.1, sodium: 59, potassium: 363, vitD: 11 }),
  food("olive-oil", "Olive oil", [["1 tbsp", 14], ["1 tsp", 5]],
    { kcal: 884, protein: 0, carbs: 0, fat: 100, satFat: 13.8, sodium: 2 }),
  food("bread-whole", "Whole-wheat bread", [["1 slice", 40], ["2 slices", 80]],
    { kcal: 247, protein: 13, carbs: 41, sugars: 6, fibre: 7, fat: 3.4, satFat: 0.7, sodium: 450, iron: 2.5 }),
  food("avocado", "Avocado", [["½ fruit", 100], ["¼ fruit", 50]],
    { kcal: 160, protein: 2, carbs: 8.5, sugars: 0.7, fibre: 6.7, fat: 14.7, satFat: 2.1, sodium: 7, potassium: 485 }),
  food("sweet-potato", "Sweet potato, baked", [["1 medium", 130], ["1 cup", 200]],
    { kcal: 90, protein: 2, carbs: 20.7, sugars: 6.5, fibre: 3.3, fat: 0.2, sodium: 36, potassium: 475, vitC: 19.6 }),
  food("black-beans", "Black beans, cooked", [["1 cup", 172], ["½ cup", 86]],
    { kcal: 132, protein: 8.9, carbs: 23.7, sugars: 0.3, fibre: 8.7, fat: 0.5, sodium: 1, potassium: 355, iron: 2.1 }),
  food("cheddar", "Cheddar cheese", [["1 slice", 28], ["30 g", 30]],
    { kcal: 403, protein: 25, carbs: 1.3, sugars: 0.5, fat: 33, satFat: 21, sodium: 621, calcium: 721 }),
  food("spinach", "Spinach, raw", [["1 cup", 30], ["100 g", 100]],
    { kcal: 23, protein: 2.9, carbs: 3.6, sugars: 0.4, fibre: 2.2, fat: 0.4, sodium: 79, potassium: 558, calcium: 99, iron: 2.7, vitC: 28 }),
  food("tomato", "Tomato", [["1 medium", 123], ["1 slice", 20]],
    { kcal: 18, protein: 0.9, carbs: 3.9, sugars: 2.6, fibre: 1.2, fat: 0.2, sodium: 5, potassium: 237, vitC: 14 }),
  food("potato", "Potato, baked", [["1 medium", 173], ["1 small", 100]],
    { kcal: 93, protein: 2.5, carbs: 21.1, sugars: 1.2, fibre: 2.2, fat: 0.1, sodium: 10, potassium: 535, vitC: 9.6 }),
  food("pasta", "Pasta, cooked", [["1 cup", 140], ["½ cup", 70]],
    { kcal: 158, protein: 5.8, carbs: 30.9, sugars: 0.6, fibre: 1.8, fat: 0.9, sodium: 1, potassium: 44 }),
  food("ground-beef", "Ground beef, 85%, cooked", [["1 patty", 85], ["100 g", 100]],
    { kcal: 250, protein: 26, carbs: 0, fat: 15, satFat: 5.8, sodium: 72, potassium: 318, iron: 2.7 }),
  food("tofu", "Tofu, firm", [["½ block", 126], ["100 g", 100]],
    { kcal: 144, protein: 15.8, carbs: 2.8, sugars: 0.6, fibre: 2.3, fat: 8.7, satFat: 1.3, sodium: 14, calcium: 350, iron: 2.7 }),
  food("lentils", "Lentils, cooked", [["1 cup", 198], ["½ cup", 99]],
    { kcal: 116, protein: 9, carbs: 20, sugars: 1.8, fibre: 7.9, fat: 0.4, sodium: 2, potassium: 369, iron: 3.3 }),
  food("orange", "Orange", [["1 medium", 131], ["1 large", 184]],
    { kcal: 47, protein: 0.9, carbs: 11.8, sugars: 9.4, fibre: 2.4, fat: 0.1, sodium: 0, potassium: 181, calcium: 40, vitC: 53 }),
  food("carrot", "Carrot", [["1 medium", 61], ["1 cup", 128]],
    { kcal: 41, protein: 0.9, carbs: 9.6, sugars: 4.7, fibre: 2.8, fat: 0.2, sodium: 69, potassium: 320, vitC: 5.9 }),
  food("butter", "Butter", [["1 tbsp", 14], ["1 tsp", 5]],
    { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, satFat: 51, sodium: 11, vitD: 1.5 }),
  food("honey", "Honey", [["1 tbsp", 21], ["1 tsp", 7]],
    { kcal: 304, protein: 0.3, carbs: 82.4, sugars: 82.1, fat: 0, sodium: 4 }),
  food("coffee", "Coffee, black", [["1 cup", 240], ["1 mug", 350]],
    { kcal: 1, protein: 0.1, carbs: 0, fat: 0, sodium: 2, potassium: 49 }),
];
