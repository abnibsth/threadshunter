"use client";

import * as React from "react";
import useSWR from "swr";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api, Product, ProductPayload, swrFetcher } from "@/lib/api";
import { cn, truncateUrl } from "@/lib/utils";
import { PillButton } from "@/components/PillButton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const EMPTY_FORM: ProductPayload = {
  name: "",
  category: "Gadget",
  keywords: "",
  price_range: "",
  selling_points: "",
  affiliate_link: "",
  is_active: true,
};

export default function ProductsPage() {
  const { data: products, error, isLoading, mutate } = useSWR<Product[]>(
    "/api/products",
    swrFetcher
  );

  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [form, setForm] = React.useState<ProductPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  const categories = React.useMemo(() => {
    const unique = new Set<string>(["All"]);
    (products ?? []).forEach((p) => {
      if (p.category?.trim()) unique.add(p.category.trim());
    });
    return Array.from(unique);
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      const catMatch =
        selectedCategory === "All" ||
        p.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!catMatch) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q) ||
        p.selling_points.toLowerCase().includes(q)
      );
    });
  }, [products, search, selectedCategory]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      keywords: product.keywords,
      price_range: product.price_range,
      selling_points: product.selling_points,
      affiliate_link: product.affiliate_link,
      is_active: product.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || !form.affiliate_link.trim()) {
      setFormError("Nama produk dan Shopee Affiliate Link wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: ProductPayload = {
        ...form,
        name: form.name.trim(),
        category: form.category.trim() || "General",
        keywords: form.keywords.trim(),
        price_range: form.price_range.trim(),
        selling_points: form.selling_points.trim(),
        affiliate_link: form.affiliate_link.trim(),
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }

      await mutate();
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan produk."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (product: Product, nextState: boolean) => {
    await mutate(
      (current) =>
        current?.map((p) =>
          p.id === product.id ? { ...p, is_active: nextState } : p
        ),
      false
    );
    try {
      await api.updateProduct(product.id, { is_active: nextState });
      await mutate();
    } catch {
      await mutate();
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(
      `Hapus produk "${product.name}" dari katalog Shopee Affiliate?`
    );
    if (!confirmed) return;
    await api.deleteProduct(product.id);
    await mutate();
  };

  const handleCopyLink = async (product: Product) => {
    try {
      await navigator.clipboard.writeText(product.affiliate_link);
      setCopiedId(product.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6B00]">
            Shopee Affiliate Catalog
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Active Product Matrix
          </h1>
          <p className="text-sm text-[#9E9EA6] max-w-2xl">
            Kelola katalog link Shopee Affiliate beserta selling points kasual.
            AI akan mencocokkan postingan Threads hanya dengan produk berstatus{" "}
            <span className="text-white font-medium">Active</span>.
          </p>
        </div>

        <PillButton
          icon={<Plus className="h-4 w-4" />}
          onClick={openCreateModal}
        >
          Add Affiliate Product
        </PillButton>
      </div>

      {/* Search & Category Filter Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#26262A] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-[#FF6B00] text-white"
                    : "bg-[#151518] border border-[#26262A] text-[#9E9EA6] hover:text-white hover:border-[#FF6B00]/40"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#63636B]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk, niche, keyword..."
            aria-label="Search products"
            className="h-10 w-full rounded-full bg-[#151518] border border-[#26262A] pl-10 pr-4 text-sm text-white placeholder:text-[#63636B] focus-visible:outline-none focus-visible:border-[#FF6B00]"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-red-500/10 border border-red-500/30 p-5 flex items-center justify-between gap-4 text-sm text-red-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span>Gagal memuat katalog produk dari backend.</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[340px] rounded-2xl bg-[#151518] border border-[#26262A] p-6 animate-pulse space-y-4"
            >
              <div className="flex justify-between">
                <div className="h-5 w-20 rounded-full bg-[#26262A]" />
                <div className="h-6 w-11 rounded-full bg-[#26262A]" />
              </div>
              <div className="h-6 w-3/4 rounded bg-[#26262A]" />
              <div className="h-7 w-40 rounded bg-[#26262A]" />
              <div className="space-y-2 pt-2">
                <div className="h-4 w-full rounded bg-[#0B0B0C]" />
                <div className="h-4 w-5/6 rounded bg-[#0B0B0C]" />
                <div className="h-4 w-4/6 rounded bg-[#0B0B0C]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredProducts.length === 0 && (
        <div className="rounded-2xl bg-[#151518] border border-[#26262A] py-16 px-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B0B0C] border border-[#26262A] text-[#FF6B00]">
            <Package className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">
              Tidak ada produk ditemukan
            </h2>
            <p className="text-sm text-[#9E9EA6]">
              Tambahkan produk Shopee Affiliate pertamamu atau ubah kata kunci pencarian.
            </p>
          </div>
          <div className="pt-2">
            <PillButton icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
              Add Affiliate Product
            </PillButton>
          </div>
        </div>
      )}

      {/* Product Cards Grid */}
      {!isLoading && !error && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const bullets = product.selling_points
              .split(/[,;\n]+/)
              .map((s) => s.trim())
              .filter(Boolean);
            const kwList = product.keywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
              .slice(0, 4);

            return (
              <article
                key={product.id}
                className={cn(
                  "rounded-2xl bg-[#151518] border p-6 flex flex-col justify-between transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                  product.is_active
                    ? "border-[#26262A] hover:border-[#FF6B00]/50"
                    : "border-[#26262A]/60 opacity-65"
                )}
              >
                <div className="space-y-5">
                  {/* Top Row: Category Badge + Active Toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={product.is_active ? "orange" : "default"}>
                      {product.category}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#63636B]">
                        {product.is_active ? "ACTIVE" : "PAUSED"}
                      </span>
                      <Switch
                        checked={product.is_active}
                        aria-label={`Toggle active status for ${product.name}`}
                        onCheckedChange={(checked) =>
                          handleToggleActive(product, checked)
                        }
                      />
                    </div>
                  </div>

                  {/* Product Title + Bold Orange Price Range */}
                  <div className="space-y-1.5 border-b border-[#26262A] pb-4">
                    <h2 className="text-lg font-semibold text-white leading-snug">
                      {product.name}
                    </h2>
                    <p className="text-xl font-extrabold text-[#FF6B00] tracking-tight">
                      {product.price_range || "Flexible Price"}
                    </p>
                  </div>

                  {/* Bulleted Selling Points with Orange Check Icons */}
                  <ul className="space-y-2.5">
                    {bullets.length > 0 ? (
                      bullets.map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 text-sm text-[#9E9EA6]"
                        >
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF6B00]/15 text-[#FF6B00]">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                          <span className="leading-snug">{point}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-[#63636B]">
                        Belum ada selling points.
                      </li>
                    )}
                  </ul>

                  {/* Keywords */}
                  {kwList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {kwList.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-md bg-[#0B0B0C] border border-[#26262A] px-2 py-0.5 text-[11px] font-mono text-[#63636B]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: Truncated Shopee Link + Edit/Delete */}
                <div className="mt-6 pt-4 border-t border-[#26262A] space-y-3">
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[#0B0B0C] border border-[#26262A] px-3 py-2">
                    <a
                      href={product.affiliate_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#9E9EA6] hover:text-[#FF6B00] truncate"
                      title={product.affiliate_link}
                    >
                      {truncateUrl(product.affiliate_link, 30)}
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(product)}
                        aria-label="Copy Shopee affiliate link"
                        className="p-1 text-[#63636B] hover:text-white transition-colors"
                      >
                        {copiedId === product.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={product.affiliate_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open Shopee affiliate link"
                        className="p-1 text-[#63636B] hover:text-[#FF6B00] transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(product)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(product)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Product Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? "Edit Affiliate Product" : "Add Affiliate Product"}
        description="Masukkan detail produk dan shortlink Shopee Affiliate untuk dicocokkan oleh AI."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="prod-name" className="text-xs font-medium text-[#9E9EA6]">
                Product Name *
              </label>
              <Input
                id="prod-name"
                required
                placeholder="Anker Soundcore R50i TWS"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prod-cat" className="text-xs font-medium text-[#9E9EA6]">
                Category / Niche *
              </label>
              <Input
                id="prod-cat"
                required
                placeholder="Gadget, Skincare, Home Office..."
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="prod-price" className="text-xs font-medium text-[#9E9EA6]">
                Price Range
              </label>
              <Input
                id="prod-price"
                placeholder="Rp 150.000 - Rp 200.000"
                value={form.price_range}
                onChange={(e) => setForm({ ...form, price_range: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prod-link" className="text-xs font-medium text-[#9E9EA6]">
                Shopee Affiliate Link *
              </label>
              <Input
                id="prod-link"
                type="url"
                required
                className="font-mono text-xs"
                placeholder="https://s.shopee.co.id/..."
                value={form.affiliate_link}
                onChange={(e) =>
                  setForm({ ...form, affiliate_link: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prod-keywords" className="text-xs font-medium text-[#9E9EA6]">
              Matching Keywords (comma-separated)
            </label>
            <Input
              id="prod-keywords"
              placeholder="tws, earphone bluetooth, headset bass, tws 100 ribuan"
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="prod-points" className="text-xs font-medium text-[#9E9EA6]">
              Casual Selling Points (pisahkan dengan koma)
            </label>
            <Textarea
              id="prod-points"
              rows={3}
              placeholder="bass empuk, baterai total 30 jam, tahan air IPX5, mic jernih"
              value={form.selling_points}
              onChange={(e) =>
                setForm({ ...form, selling_points: e.target.value })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#0B0B0C] border border-[#26262A] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Active in AI Matching</p>
              <p className="text-xs text-[#63636B]">
                Hanya produk aktif yang dikirim ke prompt AI evaluator.
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              aria-label="Product active status"
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs text-red-400">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#26262A]">
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <PillButton type="submit" loading={submitting}>
              {editingProduct ? "Update Product" : "Save Product"}
            </PillButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
