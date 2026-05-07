"use client";

import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Receipt,
  Search,
  Shirt,
  Trash2,
} from "lucide-react";

import {
  createCategoryAction,
  createOrderAction,
  createProductAction,
} from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePosCart, formatXof, type CartItem } from "@/hooks/use-pos-cart";
import { useTicketScannerFocus } from "@/hooks/use-ticket-scanner-focus";
import { addHardwareLog } from "@/lib/hardware/debug-log";
import { escPosUsbPrinter } from "@/lib/hardware/escpos/usb-printer";
import { buildEscPosTicket } from "@/lib/hardware/ticket-builder";
import { categoryIconMap, categoryIconOptions } from "@/lib/pos/icon-map";
import { getCompanySettings } from "@/lib/settings/company";

type PaymentMethod = "CASH" | "CARD" | "CREDIT";
type PaymentTiming = "PAY_NOW" | "PAY_ON_PICKUP";

type CatalogOption = { id: string; label: string; priceModifier: number };
type CatalogProduct = {
  id: string;
  name: string;
  barcode: string;
  imageUrl?: string | null;
  basePrice: number;
  options: CatalogOption[];
};
type CatalogCategory = { id: string; name: string; icon: string; products: CatalogProduct[] };
type ClientLite = { id: string; fullName: string; phone: string | null; email: string | null; totalOrders: number };
type PrintPayload = {
  orderId: string;
  companyName: string;
  dueDate: string;
  total: number;
  paymentMethod: string;
  items: CartItem[];
};
const EXPRESS_FEE_DH = 100;

type CaisseClientProps = { categories: CatalogCategory[]; clients: ClientLite[]; dataError?: string };

export function CaisseClient({ categories, clients, dataError }: CaisseClientProps) {
  const companySettings = getCompanySettings();
  const [catalogCategories, setCatalogCategories] = useState(categories);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [selectedOptionByProductId, setSelectedOptionByProductId] = useState<Record<string, string>>({});
  const [customerQuery, setCustomerQuery] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>("PAY_NOW");
  const [expressFee, setExpressFee] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [printError, setPrintError] = useState("");
  const [managementMessage, setManagementMessage] = useState("");
  const [catalogManagementOpen, setCatalogManagementOpen] = useState(false);
  const [isRetryingDb, setIsRetryingDb] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("Package");
  const [categoryIconField, setCategoryIconField] = useState("Package");

  const selectCategoryIcon = (value: string) => {
    if (!categoryIconMap[value]) return;
    setCategoryIcon(value);
    setCategoryIconField(value);
  };

  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategoryId, setProductCategoryId] = useState(categories[0]?.id ?? "");
  const [productOptionLabel, setProductOptionLabel] = useState("Lavage + Repassage");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [isImageDragActive, setIsImageDragActive] = useState(false);

  const cart = usePosCart();
  const cartItems = cart.items;

  const allProducts = useMemo(
    () => catalogCategories.flatMap((category) => category.products),
    [catalogCategories],
  );
  const displayedProducts = useMemo(() => {
    const category = catalogCategories.find((entry) => entry.id === activeCategory);
    if (!category) return [];
    return category.products;
  }, [activeCategory, catalogCategories]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const articleCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
    return { subtotal, articleCount };
  }, [cartItems]);

  const [productSearch, setProductSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return displayedProducts;
    return displayedProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q),
    );
  }, [displayedProducts, productSearch]);

  /** Prix TTC dans le panier : ventilation TVA 20 % (montants arrondis). */
  const priceBreakdown = useMemo(() => {
    const totalTTC = totals.subtotal;
    const tva = totalTTC > 0 ? Math.round((totalTTC * 20) / 120) : 0;
    const ht = totalTTC - tva;
    return { ht, tva, totalTTC };
  }, [totals.subtotal]);

  const { scannerInputRef } = useTicketScannerFocus({
    onScan: (code) => {
      cart.addByBarcode(code, allProducts);
    },
  });

  const getSelectedOptionId = (productId: string, defaultOptionId: string) =>
    selectedOptionByProductId[productId] ?? defaultOptionId;

  const handleAddProduct = (productId: string) => {
    const product = allProducts.find((entry) => entry.id === productId);
    if (!product || product.options.length === 0) return;
    const selectedId = getSelectedOptionId(product.id, product.options[0].id);
    const option = product.options.find((entry) => entry.id === selectedId) ?? product.options[0];
    cart.addItem({ product, option });
  };

  const tryPrint = async (payload: PrintPayload) => {
    const escposBuffer = buildEscPosTicket(payload);
    await escPosUsbPrinter.print(escposBuffer);
  };

  const finalizeAfterPrinted = () => {
    cart.clearCart();
    setCustomerQuery("");
    setNewCustomerName("");
    setDueDate("");
    setPaymentMethod("CASH");
    setPaymentTiming("PAY_NOW");
    setExpressFee(0);
    setPrintError("");
    setTimeout(() => setSheetOpen(false), 500);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0 || !dueDate) return setPrintError("Veuillez renseigner la date de rendu et ajouter au moins un article.");
    setIsSubmitting(true);
    setCheckoutMessage("");
    setPrintError("");
    try {
      const order = await createOrderAction({
        clientName: newCustomerName || customerQuery,
        dueDate,
        paymentMethod: paymentTiming === "PAY_ON_PICKUP" ? "CREDIT" : paymentMethod,
        expressFee,
        items: cartItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          optionLabel: item.optionLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      const printPayload: PrintPayload = {
        orderId: order.orderNumber,
        companyName: companySettings.companyName,
        dueDate,
        total: totals.subtotal + expressFee,
        paymentMethod: paymentTiming === "PAY_ON_PICKUP" ? "CREDIT" : paymentMethod,
        items: cartItems,
      };
      addHardwareLog("info", `Commande ${order.orderNumber} enregistree.`);
      try {
        await tryPrint(printPayload);
      } catch (printFailure) {
        const message =
          printFailure instanceof Error ? printFailure.message : "Imprimante indisponible.";
        setPrintError(`Impression indisponible: ${message}`);
        addHardwareLog("error", `Impression non bloquante pour ${order.orderNumber}: ${message}`);
      }
      setCheckoutMessage("Commande enregistrée avec succès.");
      finalizeAfterPrinted();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setPrintError(`Echec: ${message}`);
      addHardwareLog("error", `Erreur encaissement: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const created = await createCategoryAction({ name: categoryName, icon: categoryIcon });
      setCatalogCategories((prev) => [...prev, { ...created, products: [] }]);
      setActiveCategory(created.id);
      setProductCategoryId(created.id);
      setCategoryName("");
      setManagementMessage(`Categorie "${created.name}" ajoutee.`);
    } catch (error) {
      setManagementMessage(error instanceof Error ? error.message : "Erreur creation categorie.");
    }
  };

  const handleCreateProduct = async () => {
    const normalizedName = productName.trim();
    const normalizedOptionLabel = productOptionLabel.trim();
    const normalizedImageUrl = productImageUrl.trim();
    const parsedPrice = Number(productPrice);

    if (!normalizedName) {
      setManagementMessage("Le nom de l'article est requis.");
      return;
    }
    if (!productCategoryId) {
      setManagementMessage("Choisissez d'abord une categorie.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setManagementMessage("Le prix de base doit etre superieur a 0.");
      return;
    }
    if (!normalizedOptionLabel) {
      setManagementMessage("Le libelle de l'option est requis.");
      return;
    }
    try {
      const created = await createProductAction({
        name: normalizedName,
        basePrice: parsedPrice,
        categoryId: productCategoryId,
        optionLabel: normalizedOptionLabel,
        imageUrl: normalizedImageUrl || undefined,
      });
      setCatalogCategories((prev) =>
        prev.map((category) =>
          category.id === created.categoryId
            ? { ...category, products: [...category.products, created] }
            : category,
        ),
      );
      // Ensure the newly created product is immediately visible in the catalog panel.
      setActiveCategory(created.categoryId);
      setProductName("");
      setProductPrice("");
      setProductOptionLabel("Lavage + Repassage");
      setProductImageUrl("");
      setManagementMessage(`Article "${created.name}" ajoute.`);
    } catch (error) {
      setManagementMessage(error instanceof Error ? error.message : "Erreur ajout article.");
    }
  };

  const handleDbRetry = async () => {
    setIsRetryingDb(true);
    setManagementMessage("Tentative de reconnexion a la base...");
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    window.location.reload();
  };

  const onImageSelected = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setManagementMessage("Veuillez selectionner un fichier image valide.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setProductImageUrl(result);
        setManagementMessage("Image chargee avec succes.");
      }
    };
    reader.onerror = () => setManagementMessage("Impossible de lire l'image selectionnee.");
    reader.readAsDataURL(file);
  };

  const handleImageInput = (event: ChangeEvent<HTMLInputElement>) => {
    onImageSelected(event.target.files?.[0]);
  };

  const handleImageDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsImageDragActive(false);
    onImageSelected(event.dataTransfer.files?.[0]);
  };

  const openCheckoutWithMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setPaymentTiming(method === "CREDIT" ? "PAY_ON_PICKUP" : "PAY_NOW");
    setExpressFee(0);
    if (cartItems.length > 0) setSheetOpen(true);
  };

  return (
    <div className="flex min-h-0 w-full max-w-none flex-1 flex-col gap-0 overflow-hidden bg-slate-100 lg:h-full lg:min-h-0">
      <input ref={scannerInputRef} aria-label="Scanner barcode input" className="pointer-events-none absolute h-0 w-0 opacity-0" tabIndex={-1} />

      {dataError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          Base de donnees inaccessible: {dataError}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={handleDbRetry} disabled={isRetryingDb}>
              {isRetryingDb ? "Reconnexion..." : "Reessayer la connexion"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0">
        {/* Mobile: un seul scroll (fond uniforme) ; desktop: hauteur fixe, scroll interne aux panneaux */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-slate-100 [scrollbar-gutter:stable] lg:min-h-0 lg:overflow-hidden lg:bg-transparent">
        <div
          className={`grid min-h-0 w-full min-w-0 flex-1 flex-shrink-0 grid-cols-1 divide-y divide-slate-200 overflow-hidden rounded-none border-0 bg-white shadow-none lg:h-full lg:min-h-0 lg:max-h-full lg:flex-1 lg:grid-rows-1 lg:divide-x lg:divide-y-0 ${
            catalogManagementOpen
              ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]"
              : "lg:grid-cols-[4.5rem_minmax(0,1fr)_min(100%,22rem)] xl:grid-cols-[4.5rem_minmax(0,1fr)_24rem]"
          }`}
        >
          <div className="flex flex-row gap-1.5 overflow-x-auto overscroll-x-contain p-2 lg:h-full lg:min-h-0 lg:flex lg:w-full lg:flex-col lg:items-center lg:gap-2 lg:overflow-y-auto lg:overflow-x-visible lg:overscroll-y-contain lg:bg-slate-50/90 lg:p-2 lg:py-4">
            {catalogCategories.map((category) => {
              const Icon = categoryIconMap[category.icon] ?? categoryIconMap.Package;
              const isActive = category.id === activeCategory;
              return (
                <button
                  key={category.id}
                  type="button"
                  title={category.name}
                  aria-label={category.name}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                    isActive ? "bg-sky-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>

          <div className="flex min-h-[16rem] flex-1 flex-col bg-white lg:h-full lg:min-h-0 lg:overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Catégorie</p>
              <div className="relative w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Rechercher un article..."
                  className="min-h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-slate-50 p-4 [-webkit-overflow-scrolling:touch]">
              {filteredProducts.length === 0 ? (
                <div className="flex min-h-[12rem] flex-col items-center justify-center px-4 text-center text-slate-500">
                  <p className="text-base font-medium">Aucun article trouvé.</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-400">Modifiez la recherche ou sélectionnez une autre catégorie.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3 sm:gap-4">
                  {filteredProducts.map((product) => {
                    const defaultOption = product.options[0];
                    if (!defaultOption) return null;
                    const selectedId = getSelectedOptionId(product.id, defaultOption.id);
                    const selectedOption = product.options.find((entry) => entry.id === selectedId) ?? defaultOption;
                    const displayedPrice = Math.max(0, product.basePrice + selectedOption.priceModifier);
                    return (
                      <div
                        key={product.id}
                        onPointerUp={(event) => {
                          const target = event.target as HTMLElement;
                          if (target.closest("[data-no-card-add='true']")) return;
                          handleAddProduct(product.id);
                        }}
                        className="relative flex w-full max-w-[200px] flex-col overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-md shadow-sky-100/50"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleAddProduct(product.id);
                          }
                        }}
                      >
                        <div className="relative w-full shrink-0">
                          <div className="relative aspect-[5/3] w-full overflow-hidden bg-slate-50">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-full w-full min-h-0 object-cover object-center"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-300">
                                <Shirt className="h-9 w-9 stroke-[1.25]" aria-hidden />
                                <span className="text-[11px] font-medium text-slate-400">Aucune photo</span>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            data-no-card-add="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAddProduct(product.id);
                            }}
                            className="absolute bottom-0 right-3 z-10 flex h-11 w-11 translate-y-1/2 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/35 transition hover:bg-sky-600 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                            aria-label={`Ajouter ${product.name} au panier`}
                          >
                            <Plus className="h-5 w-5" strokeWidth={2.5} />
                          </button>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-6">
                          <h3 className="max-w-full truncate text-left text-base font-bold leading-snug tracking-tight text-slate-900">
                            {product.name}
                          </h3>

                          {product.options.length > 1 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Options de service">
                              {product.options.map((option) => {
                                const isOptionSelected = option.id === selectedId;
                                const optionPrice = Math.max(0, product.basePrice + option.priceModifier);
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    data-no-card-add="true"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedOptionByProductId((prev) => ({ ...prev, [product.id]: option.id }));
                                    }}
                                    className={`rounded-full border px-2 py-1 text-left text-[11px] font-semibold leading-tight transition ${
                                      isOptionSelected
                                        ? "border-sky-400 bg-sky-50 text-sky-900"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                  >
                                    <span>{option.label}</span>
                                    <span className="ml-1 tabular-nums text-slate-500">{formatXof(optionPrice)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}

                          <div className="mt-3 flex min-w-0 items-center justify-end gap-2">
                            <span className="shrink-0 text-lg font-bold tracking-tight text-sky-500 tabular-nums">
                              {formatXof(displayedPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {!catalogManagementOpen ? (
          <aside className="flex max-h-[min(70vh,32rem)] min-h-0 flex-col overflow-hidden bg-white lg:h-full lg:max-h-none">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">Commande en cours</h2>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {totals.articleCount}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-sky-300">
                    <Receipt className="h-10 w-10" />
                  </div>
                  <p className="text-base font-semibold text-slate-800">Aucun article</p>
                  <p className="mt-1 max-w-[14rem] text-sm text-slate-500">
                    Sélectionnez des articles pour démarrer une commande.
                  </p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.optionLabel}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{formatXof(item.unitPrice)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.removeItem(item.id)}
                        className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        aria-label="Retirer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cart.decrementItem(item.id)}
                        className="min-h-10 min-w-10 px-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cart.incrementItem(item.id)}
                        className="min-h-10 min-w-10 px-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <p className="ml-auto text-sm font-semibold text-slate-800">
                        {formatXof(item.unitPrice * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total</span>
                <span className="font-medium tabular-nums">{formatXof(priceBreakdown.ht)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA (20 %)</span>
                <span className="font-medium tabular-nums">{formatXof(priceBreakdown.tva)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold text-sky-600">
                <span>Total</span>
                <span className="tabular-nums">{formatXof(priceBreakdown.totalTTC)}</span>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 px-4 pb-2">
              <Button
                type="button"
                variant="outline"
                disabled={cartItems.length === 0}
                onClick={() => openCheckoutWithMethod("CASH")}
                className={`min-h-14 rounded-2xl border-slate-200 text-base font-semibold ${
                  paymentMethod === "CASH" && cartItems.length > 0 ? "border-sky-400 bg-sky-50 text-sky-900" : ""
                }`}
              >
                <Banknote className="mr-2 h-5 w-5" />
                Espèces
              </Button>
              <Button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => openCheckoutWithMethod("CARD")}
                className={`min-h-14 rounded-2xl text-base font-semibold ${
                  paymentMethod === "CARD" && cartItems.length > 0
                    ? "bg-sky-600 hover:bg-sky-700"
                    : "bg-sky-500 hover:bg-sky-600"
                } text-white`}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Carte
              </Button>
            </div>

            <div className="shrink-0 px-4 pb-4">
              <button
                type="button"
                onClick={() => cart.clearCart()}
                disabled={cartItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                Vider la commande
              </button>
            </div>
          </aside>
          ) : null}
        </div>

      <details
        open={catalogManagementOpen}
        onToggle={(event) => setCatalogManagementOpen(event.currentTarget.open)}
        className="group flex-shrink-0 border-t border-slate-200 bg-slate-50/80 shadow-sm lg:max-h-[min(52vh,480px)] lg:overflow-y-auto lg:overscroll-contain"
      >
        <summary className="cursor-pointer list-none px-4 py-4 font-semibold text-slate-800 marker:hidden md:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Gestion catégories et articles
            <span className="text-xs font-normal text-slate-500 group-open:hidden">Afficher</span>
            <span className="hidden text-xs font-normal text-slate-500 group-open:inline">Masquer</span>
          </span>
        </summary>
        <Card className="border-0 shadow-none">
          <CardHeader className="sr-only">
            <CardTitle>Gestion catalogue</CardTitle>
            <CardDescription>Ajout rapide depuis la caisse.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 border-t border-slate-100 px-5 pb-5 pt-0 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Nouvelle catégorie</p>
            <div className="space-y-1.5">
              <label htmlFor="nouvelle-categorie-nom" className="text-xs font-medium text-slate-600">
                Nom de la catégorie
              </label>
              <input
                id="nouvelle-categorie-nom"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Ex. : Robes, Pantalons…"
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="nouvelle-categorie-icone" className="text-xs font-medium text-slate-600">
                Icône
              </label>
              <input
                id="nouvelle-categorie-icone"
                name="categorieIcone"
                list="liste-icones-categorie"
                autoComplete="off"
                value={categoryIconField}
                onChange={(event) => {
                  const next = event.target.value;
                  setCategoryIconField(next);
                  if (categoryIconMap[next]) {
                    setCategoryIcon(next);
                  }
                }}
                onBlur={() => {
                  if (!categoryIconMap[categoryIconField]) {
                    setCategoryIconField(categoryIcon);
                  }
                }}
                placeholder="Clé technique ou liste (Package, Shirt…)"
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
              <datalist id="liste-icones-categorie">
                {categoryIconOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelFr}
                  </option>
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2 pt-1">
                {categoryIconOptions.map((opt) => {
                  const Icon = categoryIconMap[opt.value] ?? categoryIconMap.Package;
                  const selected = categoryIcon === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.labelFr}
                      aria-label={opt.labelFr}
                      aria-pressed={selected}
                      onClick={() => selectCategoryIcon(opt.value)}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border text-slate-700 transition ${
                        selected
                          ? "border-sky-500 bg-sky-100 text-sky-900 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">Sélection rapide : cliquez une icône ou saisissez la clé technique (Package, Shirt…).</p>
            </div>
            <Button onClick={handleCreateCategory} className="w-full" disabled={Boolean(dataError)}>
              Ajouter la catégorie
            </Button>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Nouvel article</p>
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="Nom de l&apos;article"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
            />
            <label className="text-xs font-medium text-slate-600">Catégorie</label>
            <select
              value={productCategoryId}
              onChange={(event) => setProductCategoryId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
            >
              {catalogCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <label className="text-xs font-medium text-slate-600">Prix de base</label>
            <input
              value={productPrice}
              onChange={(event) => setProductPrice(event.target.value)}
              placeholder="Prix de base"
              type="number"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
            />
            <label className="text-xs font-medium text-slate-600">Option de service</label>
            <input
              value={productOptionLabel}
              onChange={(event) => setProductOptionLabel(event.target.value)}
              placeholder="Ex. : Lavage + repassage"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
            />
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsImageDragActive(true);
              }}
              onDragLeave={() => setIsImageDragActive(false)}
              onDrop={handleImageDrop}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
                isImageDragActive
                  ? "border-sky-500 bg-sky-50 text-sky-800"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              <input type="file" accept="image/*" className="hidden" onChange={handleImageInput} />
              <p className="text-sm font-semibold">Glissez-déposez une image</p>
              <p className="text-xs text-slate-500">ou cliquez pour sélectionner un fichier</p>
            </label>
            {productImageUrl ? (
              <div className="space-y-2">
                <img src={productImageUrl} alt="Aperçu article" className="h-24 w-full rounded-lg border border-slate-200 object-cover" />
                <Button type="button" variant="outline" onClick={() => setProductImageUrl("")} className="w-full">
                  Retirer l&apos;image
                </Button>
              </div>
            ) : null}
            <Button onClick={handleCreateProduct} className="w-full" disabled={Boolean(dataError)}>
              Ajouter l&apos;article
            </Button>
          </div>
          {managementMessage ? <p className="lg:col-span-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-800">{managementMessage}</p> : null}
        </CardContent>
      </Card>
      </details>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Tunnel de commande</SheetTitle>
            <SheetDescription>Finalisez la commande client avant impression du ticket.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Client</label>
              <input
                list="clients-list"
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Rechercher un client existant..."
                className="min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              />
              <datalist id="clients-list">
                {clients.map((client) => (
                  <option key={client.id} value={client.fullName} />
                ))}
              </datalist>
              <input
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                placeholder="Ou ajouter un nouveau client"
                className="min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Date de rendu prévue</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Mode de paiement</label>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  const next = event.target.value as PaymentMethod;
                  setPaymentMethod(next);
                  if (next === "CREDIT") setPaymentTiming("PAY_ON_PICKUP");
                }}
                disabled={paymentTiming === "PAY_ON_PICKUP"}
                className="min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
              >
                <option value="CASH">Espèces</option>
                <option value="CARD">Carte bancaire</option>
                <option value="CREDIT">Crédit</option>
              </select>
            </div>
            {paymentMethod !== "CREDIT" ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Statut paiement</label>
                <select
                  value={paymentTiming}
                  onChange={(event) => {
                    const next = event.target.value as PaymentTiming;
                    setPaymentTiming(next);
                    if (next === "PAY_ON_PICKUP") setPaymentMethod("CREDIT");
                  }}
                  className="min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
                >
                  <option value="PAY_NOW">Payé</option>
                  <option value="PAY_ON_PICKUP">Payé lors du retrait</option>
                </select>
              </div>
            ) : null}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold">Service express</p>
              <p className="text-xs text-slate-500">Ajoute automatiquement {formatXof(EXPRESS_FEE_DH)} à la commande.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpressFee((prev) => (prev > 0 ? 0 : EXPRESS_FEE_DH))}
              >
                {expressFee > 0 ? "Retirer Express" : "Ajouter Express"}
              </Button>
              <p className="text-sm font-medium text-slate-700">
                Total avec express: {formatXof(totals.subtotal + expressFee)}
              </p>
            </div>
            {checkoutMessage ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                {checkoutMessage}
              </p>
            ) : null}
            {printError ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                {printError}
              </p>
            ) : null}
            <Button
              size="lg"
              className="min-h-14 w-full rounded-xl bg-emerald-600 text-base hover:bg-emerald-700"
              onClick={handleCheckout}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {isSubmitting ? "Traitement..." : "Enregistrer la commande"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
