'use client';

/**
 * apps/web/components/icp/molecules/PrefillForm.tsx
 *
 * Molecule: <PrefillForm> — Intent 01 product import form (state-B prefilled).
 *
 * Slice:    S-07 T02 — Frontend Cluster
 *
 * Source:   `docs/mockups/intent-01/intent-01-state-B-prefilled.html` lines 855-947
 *           (per D-29 LAW Mockup filename is LAW)
 *           Form section layout: lines 859-908 (Thông tin sản phẩm) +
 *                                 910-943 (Giá & Kho)
 *
 * Decisions applied:
 * - **C-S07-D**: 3 NEW SSE events form_prefill + market_trend + shopee_compare
 *   shipped Phiên Sx07-D; this molecule CONSUMES form_prefill payload.
 * - **C-S07-L** (Phiên Sx07-B LOCK): `confidence_per_field` has ONLY 4 keys
 *   `title/brand/category/size`. `alternatives` has ONLY 2 keys `title/size`.
 *   FE renders badges per mockup state-B (2 visible: title 98% + section-level
 *   "Thuộc tính" 92%) and state-F (4 yellow badges below 70%).
 * - **C-S07-O** (NEW Phiên Sx07-F option iii-a): "Thêm" button triggers
 *   on-demand AI suggestions via POST /api/v1/intent/{rid}/suggest-attrs
 *   (Sx07-G hotfix); spinner "Aida đang nghĩ..." ~7s; 3 chips render with
 *   example_values for tap-pick UI.
 * - **C-S07-Q** (NEW Phiên Sx07-F): ProductDraftSchema lives in
 *   `@icp/shared-types/products` — zodResolver consumer here.
 * - **D-S04-11 LAW**: `brand` is top-level Postgres + Vespa column. FE remap
 *   `form_prefill.attributes.brand` → top-level `brand` form field. Submit
 *   value has `brand` at top-level (NOT nested in attributes). See Warning #2.
 * - **S-03 LoginForm precedent** (T06 Phiên N+2): useForm + Controller +
 *   zodResolver pattern locked + Form/FormField/FormItem/FormControl/FormMessage
 *   shadcn UI primitives.
 * - **D-29 LAW**: JSDoc cites mockup filename verbatim
 * - **C-07** navigation-agnostic — `onSubmit` callback only
 * - **C-15** 'use client' — uses useForm hook + useState chips
 * - **C-18** Tier 4 Tailwind utility inline
 *
 * **Composition** (mockup state-B):
 *   Section 1 "Thông tin sản phẩm" — 4 inputs:
 *     - title (full width, confidence badge top-right)
 *     - brand + category (2-col row)
 *     - attributes chips (4-5 from form_prefill.attributes excl. brand)
 *         + "Thêm" button → on-demand AI suggest → 3 NEW chips
 *   Section 2 "Giá & Kho" — 3 inputs:
 *     - price (full width with ₫ prefix)
 *     - stock + sku (2-col row)
 *   Hidden: description (passthrough) + image_data (BE-internal)
 *   Submit: "Đăng sản phẩm" button (pink-grad lg)
 *
 * **Alt-chip swap** (state-F low-confidence): when `formPrefill.alternatives.title`
 * or `.size` is non-empty, render alt-chips below the field. Click chip →
 * replace field value via `setValue()`.
 *
 * **Submit value shape** (per Warning #2 + B1 spec):
 * ```ts
 * {
 *   title, brand,            // top-level (brand LIFTED from attributes)
 *   category, price, stock, sku,
 *   attributes: { size, type, variant, color, ...userChips },  // NO brand
 *   description,
 * }
 * ```
 *
 * Reach: S-07 V-SLICE Import (Intent 01) — single use site at /intent-01 page.
 */

import * as React from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ProductDraftSchema,
  type ProductDraft,
} from '@icp/shared-types';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button, Icon, Spinner } from '@/components/icp/atoms';
import { cn } from '@/lib/utils';

/**
 * `form_prefill` SSE event payload shape (subset of fields PrefillForm consumes).
 * Mirrors `SseFormPrefillEvent` in `packages/shared-types/src/sse/intent-stream.ts:533-541`
 * plus helper extras `title`/`description` (passthrough acceptable).
 */
export interface FormPrefillPayload {
  /** Canonical category (or 'unknown'). */
  category: string;
  /** Vision-derived attributes; includes nested `brand` per Warning #2. */
  attributes: Record<string, unknown>;
  /** Per-field confidence — 4 keys only per C-S07-L LOCK. */
  confidence_per_field?: {
    title?: number;
    brand?: number;
    category?: number;
    size?: number;
  };
  /** Alternative values — 2 keys only per C-S07-L LOCK. */
  alternatives?: {
    title?: string[];
    size?: string[];
  };
  /** AI-suggested price (VND integer). */
  suggested_price?: number;
  /** Helper extras (NOT in Zod schema, passthrough acceptable per C-S07-D). */
  title?: string;
  description?: string;
}

/** One suggested attribute chip from the AI suggest-attrs endpoint. */
export interface SuggestedAttributeChip {
  key: string;
  label_vn: string;
  example_values: string[];
}

export interface PrefillFormProps {
  /** request_id for AI suggest-attrs endpoint correlation. */
  requestId: string;
  /** SSE form_prefill payload. */
  formPrefill: FormPrefillPayload;
  /** Submit handler — called with validated ProductDraft (brand top-level). */
  onSubmit: SubmitHandler<ProductDraft>;
  /**
   * Optional callback for the "Thêm" button — triggers on-demand AI chip
   * suggestion via POST /api/v1/intent/{rid}/suggest-attrs.
   * If absent, "Thêm" button shows but is decorative (no-op).
   *
   * Should resolve with the 3 chip suggestions or throw on failure.
   */
  onRequestSuggestAttrs?: (
    category: string,
    existingAttrs: Record<string, string>,
  ) => Promise<SuggestedAttributeChip[]>;
  /** External submit loading state (set true during postAction submit_draft). */
  loading?: boolean;
  /** Optional className passthrough. */
  className?: string;
}

/** Map field key → Vietnamese display label for attribute chips. */
const ATTR_LABEL_VN: Record<string, string> = {
  size: 'Dung tích',
  type: 'Loại',
  variant: 'Biến thể',
  color: 'Màu',
  origin: 'Xuất xứ',
  expiry: 'HSD',
  expiry_window: 'HSD',
  taste_profile: 'Vị',
  sweetness: 'Độ ngọt',
  saltiness: 'Độ mặn',
  spice_level: 'Độ cay',
  ingredients: 'Thành phần',
};

/** Confidence threshold per C-S07-L LOCK — below 0.7 = state-F low-confidence. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Pretty-print percent: 0.985 → "99%". */
function pctText(v: number | undefined): string {
  if (typeof v !== 'number') return '';
  return `${Math.round(v * 100)}%`;
}

/** Coerce attribute value to string (vision.analyze may return non-strings). */
function attrToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function PrefillForm({
  requestId,
  formPrefill,
  onSubmit,
  onRequestSuggestAttrs,
  loading = false,
  className,
}: PrefillFormProps) {
  // ─── Remap form_prefill.attributes.brand → top-level (D-S04-11 LAW) ────
  // Warning #2: vision.analyze returns brand NESTED in attributes; D-S04-11
  // LAW canonicalizes brand as TOP-LEVEL Postgres column + Vespa field.
  // FE must LIFT brand → top-level form field, then STRIP from attributes
  // map before submit.
  const {
    brand: initialBrand,
    ...attributesExcludingBrand
  } = formPrefill.attributes ?? {};

  // Coerce nested attribute values to strings for chip rendering
  const initialChips = React.useMemo<Array<{ key: string; value: string }>>(
    () =>
      Object.entries(attributesExcludingBrand).map(([k, v]) => ({
        key: k,
        value: attrToString(v),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(attributesExcludingBrand)],
  );

  const cpf = formPrefill.confidence_per_field ?? {};
  const alts = formPrefill.alternatives ?? {};

  // ─── react-hook-form setup ────────────────────────────────────────────
  const form = useForm<ProductDraft>({
    resolver: zodResolver(ProductDraftSchema),
    defaultValues: {
      title: formPrefill.title ?? '',
      brand: attrToString(initialBrand),
      category: formPrefill.category,
      price: formPrefill.suggested_price ?? 0,
      stock: 0,
      sku: '',
      description: formPrefill.description ?? '',
      attributes: Object.fromEntries(initialChips.map((c) => [c.key, c.value])),
      image_data: null,
      image_url: null,
    },
    mode: 'onBlur',
  });

  // ─── Chips local state ────────────────────────────────────────────────
  // Chips are independent from react-hook-form `attributes` field — merge
  // into final attributes map on submit (handleFinalSubmit below).
  const [chips, setChips] = React.useState(initialChips);

  // AI-suggested chips state (Sx07-G hotfix)
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestError, setSuggestError] = React.useState<string | null>(null);
  const [suggestedChips, setSuggestedChips] = React.useState<SuggestedAttributeChip[]>([]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleRemoveChip = React.useCallback((key: string) => {
    setChips((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const handleAddSuggestedChip = React.useCallback(
    (chip: SuggestedAttributeChip) => {
      // Default value: first example_value (merchant can edit later via chip click)
      const defaultValue = chip.example_values[0] ?? '';
      setChips((prev) => {
        // No duplicate keys
        if (prev.some((c) => c.key === chip.key)) return prev;
        return [...prev, { key: chip.key, value: defaultValue }];
      });
      // Remove from suggested list (one-shot UI)
      setSuggestedChips((prev) => prev.filter((c) => c.key !== chip.key));
    },
    [],
  );

  const handleRequestSuggest = React.useCallback(async () => {
    if (!onRequestSuggestAttrs || suggesting) return;
    setSuggestError(null);
    setSuggesting(true);
    try {
      const existingAttrs = Object.fromEntries(chips.map((c) => [c.key, c.value]));
      const result = await onRequestSuggestAttrs(formPrefill.category, existingAttrs);
      setSuggestedChips(result);
      if (result.length === 0) {
        setSuggestError('Aida chưa nghĩ ra gì thêm. Anh thử sau nhé.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi mạng';
      setSuggestError(`Em gặp lỗi: ${msg}`);
    } finally {
      setSuggesting(false);
    }
  }, [onRequestSuggestAttrs, suggesting, chips, formPrefill.category]);

  /** Apply an alt-chip (title or size) by overwriting the field value. */
  const handleApplyAlt = React.useCallback(
    (field: 'title' | 'size', value: string) => {
      if (field === 'title') {
        form.setValue('title', value, { shouldDirty: true, shouldValidate: true });
      } else {
        // 'size' lives in chips, not form field — update chips
        setChips((prev) => {
          const existing = prev.findIndex((c) => c.key === 'size');
          if (existing >= 0) {
            const next = prev.slice();
            next[existing] = { key: 'size', value };
            return next;
          }
          return [...prev, { key: 'size', value }];
        });
      }
    },
    [form],
  );

  /** Final submit — merge chips into attributes; brand stays top-level. */
  const handleFinalSubmit: SubmitHandler<ProductDraft> = React.useCallback(
    (values) => {
      const mergedAttributes: Record<string, string> = {};
      for (const { key, value } of chips) {
        if (key && value) mergedAttributes[key] = value;
      }
      onSubmit({
        ...values,
        attributes: mergedAttributes,
      });
    },
    [chips, onSubmit],
  );

  // ─── Render ───────────────────────────────────────────────────────────

  const titleConf = cpf.title;
  const titleAlts = alts.title ?? [];

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFinalSubmit)}
        className={cn('w-full flex flex-col gap-3', className)}
        noValidate
      >
        {/* ═══ Section 1: Thông tin sản phẩm ═══════════════════════════════ */}
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-icp-pink-900">
            <Icon name="image" size={13} className="text-icp-pink-700" />
            Thông tin sản phẩm
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-icp-pink-700 bg-icp-pink-50 px-2 py-0.5 rounded-full border-[0.5px] border-icp-pink-200">
            Aida điền
          </span>
        </div>

        <div className="rounded-2xl bg-white border-[0.5px] border-icp-pink-100 p-3.5 shadow-sm flex flex-col gap-3">
          {/* Title field with confidence badge */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between mb-1">
                  <FormLabel className="text-[12px] font-semibold text-icp-pink-900">
                    Tên sản phẩm <span className="text-rose-600">*</span>
                  </FormLabel>
                  {typeof titleConf === 'number' && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border-[0.5px]',
                        titleConf >= LOW_CONFIDENCE_THRESHOLD
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-800',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block w-1.5 h-1.5 rounded-full',
                          titleConf >= LOW_CONFIDENCE_THRESHOLD ? 'bg-emerald-500' : 'bg-amber-500',
                        )}
                      />
                      {pctText(titleConf)}
                    </span>
                  )}
                </div>
                <FormControl>
                  <Input
                    {...field}
                    disabled={loading}
                    placeholder="VD: Maggi nước tương 200ml"
                    className="h-10 border-icp-pink-200 focus-visible:ring-icp-pink-500"
                  />
                </FormControl>
                <FormMessage className="text-[11px]" />
                {/* Alt-chip swap for title (state-F) */}
                {titleAlts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {titleAlts.map((alt, i) => (
                      <button
                        key={`alt-title-${i}`}
                        type="button"
                        onClick={() => handleApplyAlt('title', alt)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border-[0.5px] border-amber-200 text-amber-800 text-[11px] font-medium hover:bg-amber-100 active:scale-[0.97] transition-all"
                      >
                        <Icon name="sparkles" size={10} />
                        {alt}
                      </button>
                    ))}
                  </div>
                )}
              </FormItem>
            )}
          />

          {/* Brand + Category row (2-col) */}
          <div className="grid grid-cols-2 gap-2.5">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-icp-pink-900">
                    Nhãn hiệu
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      disabled={loading}
                      placeholder="VD: Maggi"
                      className="h-10 border-icp-pink-200 focus-visible:ring-icp-pink-500"
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              rules={{ required: 'Bắt buộc' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-icp-pink-900">
                    Danh mục <span className="text-rose-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={loading}
                      placeholder="VD: nuoc_tuong"
                      className="h-10 border-icp-pink-200 focus-visible:ring-icp-pink-500"
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          {/* Attribute chips section */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-[12px] font-semibold text-icp-pink-900">
                Thuộc tính
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border-[0.5px] bg-emerald-50 border-emerald-200 text-emerald-700">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {chips.length} mục
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => {
                const labelVn = ATTR_LABEL_VN[chip.key] ?? chip.key;
                return (
                  <div
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-icp-pink-50 border-[0.5px] border-icp-pink-200 text-icp-pink-900 text-[12px]"
                  >
                    <span className="text-icp-pink-700">{labelVn} ·</span>
                    <span className="font-semibold">{chip.value || '—'}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChip(chip.key)}
                      aria-label={`Xóa ${labelVn}`}
                      disabled={loading}
                      className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-icp-pink-700 hover:bg-icp-pink-100"
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                );
              })}

              {/* "Thêm" button — C-S07-O on-demand AI chip suggestions */}
              <button
                type="button"
                onClick={handleRequestSuggest}
                disabled={loading || suggesting || !onRequestSuggestAttrs}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
                  'border-[1px] border-dashed border-icp-pink-300 text-icp-pink-700',
                  'text-[12px] font-semibold',
                  'hover:bg-icp-pink-50 active:scale-[0.97] transition-all',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {suggesting ? (
                  <>
                    <Spinner size="sm" color="pink" />
                    Aida đang nghĩ...
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={10} />
                    Thêm
                  </>
                )}
              </button>
            </div>

            {/* Suggest error */}
            {suggestError && (
              <p role="alert" className="mt-2 text-[11px] text-rose-700">
                {suggestError}
              </p>
            )}

            {/* Suggested chips ready to tap-add */}
            {suggestedChips.length > 0 && (
              <div className="mt-3 rounded-xl bg-gradient-to-br from-pink-50 to-orange-50 border-[0.5px] border-icp-pink-200 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-icp-pink-700 mb-1.5">
                  🤖 Aida gợi ý
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => handleAddSuggestedChip(chip)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border-[0.5px] border-icp-pink-300 text-icp-pink-900 text-[12px] font-medium hover:bg-icp-pink-50 active:scale-[0.97] transition-all"
                    >
                      <Icon name="plus" size={10} className="text-icp-pink-700" />
                      <span>{chip.label_vn}</span>
                      {chip.example_values[0] && (
                        <span className="text-icp-pink-700">· {chip.example_values[0]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Alt-chip swap for size (state-F) */}
            {alts.size && alts.size.length > 0 && (
              <div className="mt-2.5">
                <div className="text-[10px] font-semibold text-amber-700 mb-1">
                  Dung tích thay thế:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {alts.size.map((altSize, i) => (
                    <button
                      key={`alt-size-${i}`}
                      type="button"
                      onClick={() => handleApplyAlt('size', altSize)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border-[0.5px] border-amber-200 text-amber-800 text-[11px] font-medium hover:bg-amber-100 active:scale-[0.97] transition-all"
                    >
                      <Icon name="sparkles" size={10} />
                      {altSize}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Section 2: Giá & Kho ════════════════════════════════════════ */}
        <div className="flex items-center mt-1 mb-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-icp-pink-900">
            <Icon name="bottle" size={13} className="text-icp-pink-700" />
            Giá &amp; Kho
          </span>
        </div>

        <div className="rounded-2xl bg-white border-[0.5px] border-icp-pink-100 p-3.5 shadow-sm flex flex-col gap-3">
          {/* Price (full width, with ₫ prefix) */}
          <FormField
            control={form.control}
            name="price"
            rules={{
              required: 'Bắt buộc',
              min: { value: 0, message: 'Giá không được âm' },
            }}
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between mb-1">
                  <FormLabel className="text-[12px] font-semibold text-icp-pink-900">
                    Giá bán <span className="text-rose-600">*</span>
                  </FormLabel>
                  {typeof formPrefill.suggested_price === 'number' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border-[0.5px] border-emerald-200">
                      Đề xuất
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-icp-pink-700 font-mono text-[14px] font-semibold pointer-events-none z-10">
                    ₫
                  </span>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      disabled={loading}
                      placeholder="25000"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      onBlur={field.onBlur}
                      name={field.name}
                      className="pl-8 h-10 border-icp-pink-200 focus-visible:ring-icp-pink-500 font-mono"
                    />
                  </FormControl>
                </div>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          {/* Stock + SKU row (2-col) */}
          <div className="grid grid-cols-2 gap-2.5">
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-icp-pink-900">
                    Tồn kho
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      disabled={loading}
                      placeholder="VD: 50"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      onBlur={field.onBlur}
                      name={field.name}
                      className="h-10 border-icp-pink-200 focus-visible:ring-icp-pink-500 font-mono"
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-semibold text-icp-pink-900">
                    Mã SKU
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      disabled={loading}
                      placeholder="MGI-NT-200"
                      className="h-10 border-icp-pink-200 focus-visible:ring-icp-pink-500 font-mono"
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Hidden description (passthrough — BE consumes if non-empty) */}
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <input type="hidden" {...field} value={field.value ?? ''} />
          )}
        />

        {/* Submit CTA */}
        <Button
          type="submit"
          variant="pink-grad"
          size="lg"
          loading={loading || form.formState.isSubmitting}
          disabled={loading || form.formState.isSubmitting}
          leftIcon="sparkles"
          className="w-full mt-2"
          data-request-id={requestId}
        >
          Đăng sản phẩm
        </Button>
      </form>
    </Form>
  );
}
