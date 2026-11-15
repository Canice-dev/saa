export type CatalogImportValues = {
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  stockQuantity: number;
  searchTerms: string | null;
};

export function validateCatalogImportRow(raw: Record<string, string>) {
  const value = (key: string) => (raw[key] ?? "").trim();
  const errors: string[] = [];
  const sku = value("sku");
  const name = value("name");
  const priceInput = value("price");
  const currencyInput = value("currency") || "NGN";
  const stockInput = value("stock_quantity") || "0";
  const price = Number(priceInput);
  const stockQuantity = Number(stockInput);

  if (!sku) errors.push("SKU is required");
  if (sku.length > 120) errors.push("SKU must be 120 characters or fewer");
  if (!name) errors.push("Product name is required");
  if (name.length > 240) errors.push("Product name must be 240 characters or fewer");
  if (!priceInput || !/^\d+(?:\.\d{1,2})?$/.test(priceInput) || !Number.isFinite(price) || price < 0 || price > 9_999_999_999.99) {
    errors.push("Price must be from 0 to 9,999,999,999.99, with up to 2 decimal places");
  }
  if (!/^[a-zA-Z]{3}$/.test(currencyInput)) {
    errors.push("Currency must be a 3-letter code, such as NGN");
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    errors.push("Stock quantity must be a whole number greater than or equal to 0");
  }
  if (value("description").length > 5000) errors.push("Description must be 5,000 characters or fewer");
  if (value("category").length > 120) errors.push("Category must be 120 characters or fewer");
  if (value("search_terms").length > 1000) errors.push("Search terms must be 1,000 characters or fewer");

  const normalized: CatalogImportValues = {
    sku,
    name,
    description: value("description") || null,
    category: value("category") || null,
    price,
    currency: currencyInput.toUpperCase(),
    stockQuantity,
    searchTerms: value("search_terms") || null,
  };

  return { sku: sku || null, normalized, errors };
}

export const catalogCsvHeaders = [
  "sku",
  "name",
  "description",
  "category",
  "price",
  "currency",
  "stock_quantity",
  "search_terms",
] as const;
