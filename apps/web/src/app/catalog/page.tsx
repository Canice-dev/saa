"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  Boxes,
  Check,
  CircleAlert,
  FileSpreadsheet,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  MobileWorkspaceBar,
  WorkspaceSidebar,
} from "@/components/workspace-sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { catalogCsvHeaders } from "@/lib/catalog/import-validation";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  stockQuantity: number;
  searchTerms: string | null;
  updatedAt: string;
};
type Preview = {
  id: string;
  fileName: string;
  status: "review" | "imported";
  totalRows: number;
  updateExisting: boolean;
  counts: { total: number; invalid: number; valid: number };
  previewLimit: number;
  rows: Array<{
    rowNumber: number;
    sku: string | null;
    raw: Record<string, string>;
    normalized: Record<string, unknown>;
    errors: string[];
    exists: boolean;
  }>;
};
type UploadState = "idle" | "uploading" | "review" | "applying" | "done";
const aliases: Record<string, string> = {
  "stock quantity": "stock_quantity",
  stock: "stock_quantity",
  "search terms": "search_terms",
};

function normalizeHeader(header: string) {
  const normalized = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return aliases[normalized.replace(/_/g, " ")] ?? normalized;
}

async function streamCsv(
  file: File,
  onHeader: (headers: string[]) => Promise<void>,
  onRow: (row: Record<string, string>, rowNumber: number) => Promise<void>,
  onProgress: (ratio: number) => void,
) {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let header: string[] | null = null;
  let fields: string[] = [];
  let cell = "";
  let inQuotes = false;
  let pendingQuote = false;
  let skipLf = false;
  let rowNumber = 0;
  let bytesRead = 0;

  async function finishRow() {
    const row = [...fields, cell];
    fields = [];
    cell = "";
    if (!row.some((value) => value.trim() !== "")) return;
    rowNumber += 1;
    if (!header) {
      header = row.map(normalizeHeader);
      if (new Set(header).size !== header.length)
        throw new Error("The CSV has duplicate column names.");
      const missing = ["sku", "name", "price"].filter(
        (key) => !header?.includes(key),
      );
      if (missing.length)
        throw new Error(
          `Missing required columns: ${missing.join(", ")}. Download the template for the expected columns.`,
        );
      await onHeader(header);
      return;
    }
    await onRow(
      Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])),
      rowNumber,
    );
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      const chunk = decoder.decode(value, { stream: true });
      for (let index = 0; index < chunk.length; index += 1) {
        const character = chunk[index];
        if (pendingQuote) {
          pendingQuote = false;
          if (character === '"') {
            cell += '"';
            if (cell.length > 20000)
              throw new Error(
                "A CSV cell is too large. Keep each cell under 20,000 characters.",
              );
            continue;
          }
          inQuotes = false;
        }
        if (skipLf) {
          skipLf = false;
          if (character === "\n") continue;
        }
        if (inQuotes) {
          if (character === '"') {
            if (index + 1 < chunk.length) {
              if (chunk[index + 1] === '"') {
                cell += '"';
                index += 1;
              } else inQuotes = false;
            } else pendingQuote = true;
          } else cell += character;
          if (cell.length > 20000)
            throw new Error(
              "A CSV cell is too large. Keep each cell under 20,000 characters.",
            );
          continue;
        }
        if (character === '"' && cell.length === 0) inQuotes = true;
        else if (character === ",") {
          fields.push(cell);
          cell = "";
        } else if (character === "\n" || character === "\r") {
          await finishRow();
          if (character === "\r") skipLf = true;
        } else cell += character;
        if (cell.length > 20000)
          throw new Error(
            "A CSV cell is too large. Keep each cell under 20,000 characters.",
          );
      }
      onProgress(Math.min(0.99, bytesRead / Math.max(1, file.size)));
    }
    decoder.decode();
    if (pendingQuote) {
      pendingQuote = false;
      inQuotes = false;
    }
    if (inQuotes) throw new Error("The CSV has an unclosed quoted value.");
    if (fields.length || cell.length) await finishRow();
    if (!header) throw new Error("The CSV file is empty.");
    if (rowNumber < 2)
      throw new Error("The CSV has a header but no product rows.");
  } finally {
    reader.releaseLock();
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Something went wrong. Try again.",
    );
  return payload as T;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    price: "",
    currency: "NGN",
    stock_quantity: "0",
    search_terms: "",
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [editorError, setEditorError] = useState("");

  const loadProducts = useCallback(async () => {
    const response = await fetch(
      `/api/catalog/products?q=${encodeURIComponent(search)}`,
      { cache: "no-store" },
    );
    return readJson<{ products: Product[]; total: number }>(response);
  }, [search]);
  useEffect(() => {
    let current = true;
    void loadProducts()
      .then((data) => {
        if (!current) return;
        setProducts(data.products);
        setProductTotal(data.total);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setError(
          cause instanceof Error ? cause.message : "Could not load products.",
        );
      });
    return () => {
      current = false;
    };
  }, [loadProducts]);

  function downloadTemplate() {
    const csv = `${catalogCsvHeaders.join(",")}\r\n`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-assistant-catalog-template.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const loadPreview = useCallback(async (importId: string) => {
    const response = await fetch(`/api/catalog/imports/${importId}`, {
      cache: "no-store",
    });
    const data = await readJson<Omit<Preview, "id">>(response);
    setPreview({ ...data, id: importId });
  }, []);

  useEffect(() => {
    void fetch("/api/catalog/imports", { cache: "no-store" })
      .then((response) => readJson<{ importId: string | null }>(response))
      .then(async ({ importId }) => {
        if (!importId) return;
        await loadPreview(importId);
        setUploadState("review");
      })
      .catch(() => undefined);
  }, [loadPreview]);

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    setResultMessage("");
    setPreview(null);
    setProgress(0);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(
        "Choose a .csv file. Export a spreadsheet as CSV from Excel or Google Sheets.",
      );
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError(
        "This CSV is larger than 100 MB. Split it into smaller files and import them separately.",
      );
      return;
    }
    setUploadState("uploading");
    let importId: string | undefined;
    let batch: Array<{ rowNumber: number; values: Record<string, string> }> =
      [];
    try {
      await streamCsv(
        file,
        async () => {
          const response = await fetch("/api/catalog/imports", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fileName: file.name }),
          });
          importId = (await readJson<{ importId: string }>(response)).importId;
        },
        async (values, rowNumber) => {
          if (JSON.stringify(values).length > 30000)
            throw new Error(
              `CSV row ${rowNumber} is too large. Keep each row under 30,000 characters.`,
            );
          batch.push({ rowNumber, values });
          if (
            (batch.length >= 100 || JSON.stringify(batch).length >= 750000) &&
            importId
          ) {
            await readJson(
              await fetch(`/api/catalog/imports/${importId}/rows`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ rows: batch }),
              }),
            );
            batch = [];
          }
        },
        setProgress,
      );
      if (!importId) throw new Error("Could not start the import.");
      if (batch.length)
        await readJson(
          await fetch(`/api/catalog/imports/${importId}/rows`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ rows: batch }),
          }),
        );
      await readJson(
        await fetch(`/api/catalog/imports/${importId}/finalize`, {
          method: "POST",
        }),
      );
      await loadPreview(importId);
      setUpdateExisting(true);
      setProgress(1);
      setUploadState("review");
    } catch (cause) {
      if (importId) {
        await fetch(`/api/catalog/imports/${importId}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }
      setUploadState("idle");
      const detail =
        cause instanceof Error
          ? cause.message
          : "Could not read this CSV file.";
      setError(
        importId
          ? `${detail} No products were imported. Select the file again to retry.`
          : detail,
      );
    }
  }

  async function applyImport() {
    if (!preview) return;
    setUploadState("applying");
    setError("");
    try {
      while (true) {
        const response = await fetch(
          `/api/catalog/imports/${preview.id}/apply`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ updateExisting }),
          },
        );
        const batch = await readJson<{ done: boolean }>(response);
        if (batch.done) break;
      }
      const productData = await loadProducts();
      setProducts(productData.products);
      setProductTotal(productData.total);
      await loadPreview(preview.id);
      setUploadState("done");
      setResultMessage(
        `Import complete. ${preview.counts.valid.toLocaleString()} valid rows were processed.`,
      );
    } catch (cause) {
      setUploadState("review");
      setError(
        cause instanceof Error
          ? cause.message
          : "Import paused. You can safely resume it.",
      );
    }
  }

  function resetImport() {
    setUploadState("idle");
    setPreview(null);
    setProgress(0);
    setError("");
    setResultMessage("");
  }
  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
    }
  };

  function openProductEditor(product?: Product) {
    setError("");
    setEditorError("");
    setEditingProduct(product ?? null);
    setProductForm(
      product
        ? {
            sku: product.sku,
            name: product.name,
            description: product.description ?? "",
            category: product.category ?? "",
            price: String(product.price),
            currency: product.currency,
            stock_quantity: String(product.stockQuantity),
            search_terms: product.searchTerms ?? "",
          }
        : {
            sku: "",
            name: "",
            description: "",
            category: "",
            price: "",
            currency: "NGN",
            stock_quantity: "0",
            search_terms: "",
          },
    );
    setEditorOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setEditorError("");
    try {
      const response = await fetch("/api/catalog/products", {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(editingProduct ? { productId: editingProduct.id } : {}),
          values: productForm,
        }),
      });
      await readJson(response);
      setEditorOpen(false);
      const productData = await loadProducts();
      setProducts(productData.products);
      setProductTotal(productData.total);
      setResultMessage(editingProduct ? "Product updated." : "Product added.");
    } catch (cause) {
      setEditorError(
        cause instanceof Error ? cause.message : "Could not save this product.",
      );
    } finally {
      setSavingProduct(false);
    }
  }

  return (
    <main className="app-shell" id="catalog">
      <WorkspaceSidebar active="catalog" />
      <section className="main-panel catalog-main-panel">
        <MobileWorkspaceBar title="Catalog" />
        <div className="page-content catalog-page-content">
          <header className="catalog-heading">
            <div>
              <p className="date-kicker">Business</p>
              <h1>
                Catalog<span className="heading-period">.</span>
              </h1>
              <p className="welcome-subtitle">
                Keep product descriptions, prices, and stock ready for accurate
                customer answers.
              </p>
            </div>
            <div className="catalog-heading-actions">
              <Button
                className="catalog-template-button"
                variant="outline"
                onClick={downloadTemplate}
              >
                <ArrowDownToLine /> Download CSV template
              </Button>
              <Button onClick={() => openProductEditor()}>
                <Plus /> Add product
              </Button>
            </div>
          </header>

          <section
            className={`catalog-import-panel${preview ? " catalog-import-panel--review" : ""}`}
            aria-labelledby="catalog-import-title"
          >
            <div className="catalog-import-copy">
              <span className="catalog-import-icon">
                <FileSpreadsheet size={19} />
              </span>
              <div>
                <h2 id="catalog-import-title">Add products in bulk</h2>
                <p>
                  Upload a CSV, check every row, then import. Existing products
                  match by SKU.
                </p>
              </div>
            </div>
            {(uploadState === "idle" || uploadState === "done") && (
              <label className="catalog-upload-button">
                <Upload size={16} /> Choose CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    void handleFile(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            )}
            {uploadState === "uploading" && (
              <div className="catalog-upload-progress" role="status">
                <LoaderCircle size={17} className="catalog-spinner" />
                <span>Reading and checking rows…</span>
                <div className="catalog-progress-track">
                  <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
                </div>
              </div>
            )}
            {preview &&
              (uploadState === "review" ||
                uploadState === "applying" ||
                uploadState === "done") && (
                <div className="catalog-review">
                  <div className="catalog-review-heading">
                    <div>
                      <strong>{preview.fileName}</strong>
                      <span>
                        {preview.counts.total.toLocaleString()} product rows
                      </span>
                    </div>
                    <button
                      className="catalog-reset-button"
                      type="button"
                      onClick={resetImport}
                      aria-label="Close import preview"
                      title="Close preview"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <div className="catalog-review-stats">
                    <div>
                      <strong>{preview.counts.valid.toLocaleString()}</strong>
                      <span>Ready to import</span>
                    </div>
                    <div
                      className={
                        preview.counts.invalid ? "catalog-stat--error" : ""
                      }
                    >
                      <strong>{preview.counts.invalid.toLocaleString()}</strong>
                      <span>Rows to fix</span>
                    </div>
                    <div>
                      <strong>
                        {preview.rows
                          .filter(
                            (row) => row.exists && row.errors.length === 0,
                          )
                          .length.toLocaleString()}
                      </strong>
                      <span>SKU matches in preview</span>
                    </div>
                  </div>
                  <div className="catalog-table-wrap catalog-preview-wrap">
                    <table className="catalog-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>SKU</th>
                          <th>Product</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={row.rowNumber}>
                            <td>{row.rowNumber}</td>
                            <td className="catalog-mono">{row.sku || "—"}</td>
                            <td>
                              {String(
                                row.normalized.name || row.raw.name || "—",
                              )}
                            </td>
                            <td>
                              {row.normalized.price === undefined
                                ? "—"
                                : money(
                                    Number(row.normalized.price),
                                    String(row.normalized.currency || "NGN"),
                                  )}
                            </td>
                            <td>
                              {row.normalized.stockQuantity === undefined
                                ? "—"
                                : String(row.normalized.stockQuantity)}
                            </td>
                            <td>
                              {row.errors.length ? (
                                <span
                                  className="catalog-row-error"
                                  title={row.errors.join("; ")}
                                >
                                  <CircleAlert size={14} />
                                  {row.errors[0]}
                                </span>
                              ) : row.exists ? (
                                <span className="catalog-row-match">
                                  SKU match
                                </span>
                              ) : (
                                <span className="catalog-row-valid">
                                  <Check size={14} />
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.counts.total > preview.previewLimit && (
                      <p className="catalog-preview-note">
                        Showing the first {preview.previewLimit} rows. All{" "}
                        {preview.counts.total.toLocaleString()} rows were
                        validated.
                      </p>
                    )}
                  </div>
                  <div className="catalog-review-footer">
                    <label className="catalog-update-choice">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(event) =>
                          setUpdateExisting(event.target.checked)
                        }
                        disabled={
                          uploadState === "applying" || uploadState === "done"
                        }
                      />
                      <span>
                        <strong>Update products with matching SKUs</strong>
                        <small>
                          Turn this off to keep existing product details
                          unchanged.
                        </small>
                      </span>
                    </label>
                    <div className="catalog-review-actions">
                      {uploadState === "done" ? (
                        <span className="catalog-complete">
                          <Check size={15} /> Imported
                        </span>
                      ) : (
                        <Button
                          onClick={() => void applyImport()}
                          disabled={
                            uploadState === "applying" ||
                            preview.counts.valid === 0
                          }
                        >
                          {uploadState === "applying" ? (
                            <>
                              <LoaderCircle className="catalog-spinner" />{" "}
                              Importing…
                            </>
                          ) : (
                            <>
                              <PackagePlus /> Import{" "}
                              {preview.counts.valid.toLocaleString()} products
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </section>

          {error && (
            <div
              className="catalog-message catalog-message--error"
              role="alert"
            >
              <CircleAlert size={16} />
              {error}
            </div>
          )}
          {resultMessage && (
            <div
              className="catalog-message catalog-message--success"
              role="status"
            >
              <Check size={16} />
              {resultMessage}
            </div>
          )}

          <section
            className="catalog-products-section"
            aria-labelledby="catalog-products-title"
          >
            <div className="catalog-products-heading">
              <div>
                <h2 id="catalog-products-title">
                  Products <span>{productTotal.toLocaleString()}</span>
                </h2>
                <p>
                  Structured product details for exact price and stock answers.
                </p>
              </div>
              <label className="catalog-search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search name, SKU, or category"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search products"
                />
              </label>
            </div>
            {products.length ? (
              <div className="catalog-table-wrap">
                <table className="catalog-table catalog-products-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>In stock</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                        </td>
                        <td className="catalog-mono">{product.sku}</td>
                        <td>{product.category || "—"}</td>
                        <td>
                          {money(Number(product.price), product.currency)}
                        </td>
                        <td>{product.stockQuantity.toLocaleString()}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${product.name}`}
                            title="Edit product"
                            onClick={() => openProductEditor(product)}
                          >
                            <Pencil />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {productTotal > products.length && (
                  <p className="catalog-preview-note">
                    Showing {products.length} of {productTotal.toLocaleString()}{" "}
                    products. Search to narrow the list.
                  </p>
                )}
              </div>
            ) : (
              <div className="catalog-products-empty">
                <span>
                  <Boxes size={21} />
                </span>
                <h3>
                  {search
                    ? "No products match that search"
                    : "Your catalog is ready for its first products"}
                </h3>
                <p>
                  {search
                    ? "Try a different product name, SKU, or category."
                    : "Download the template, fill it in a spreadsheet, and upload it here. Products stay reviewable before import."}
                </p>
                {!search && (
                  <Button variant="outline" onClick={() => openProductEditor()}>
                    <Plus /> Add a product
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="catalog-editor-dialog">
          <form onSubmit={(event) => void saveProduct(event)}>
            <DialogHeader className="catalog-editor-header">
              <DialogTitle>
                {editingProduct ? "Edit product" : "Add a product"}
              </DialogTitle>
              <DialogDescription>
                Keep these details accurate so the assistant can answer product
                questions.
              </DialogDescription>
            </DialogHeader>
            <div className="catalog-editor-fields">
              {editorError && (
                <p className="catalog-editor-error" role="alert">
                  <CircleAlert size={15} />
                  {editorError}
                </p>
              )}
              <label>
                Product name
                <input
                  required
                  maxLength={240}
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm({ ...productForm, name: event.target.value })
                  }
                />
              </label>
              <label>
                SKU
                <input
                  required
                  maxLength={120}
                  value={productForm.sku}
                  onChange={(event) =>
                    setProductForm({ ...productForm, sku: event.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={5000}
                  rows={3}
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Category
                <input
                  maxLength={120}
                  value={productForm.category}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      category: event.target.value,
                    })
                  }
                />
              </label>
              <div className="catalog-editor-row">
                <label>
                  Price
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        price: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Currency
                  <input
                    required
                    minLength={3}
                    maxLength={3}
                    value={productForm.currency}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        currency: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
                <label>
                  Stock
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock_quantity}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        stock_quantity: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Search terms
                <input
                  maxLength={1000}
                  placeholder="Synonyms customers might use"
                  value={productForm.search_terms}
                  onChange={(event) =>
                    setProductForm({
                      ...productForm,
                      search_terms: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <DialogFooter className="catalog-editor-footer">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingProduct}>
                {savingProduct ? (
                  <>
                    <LoaderCircle className="catalog-spinner" /> Saving…
                  </>
                ) : editingProduct ? (
                  "Save changes"
                ) : (
                  "Add product"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
