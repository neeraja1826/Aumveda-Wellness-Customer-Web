
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  ArrowRight,
  Award,
  ChevronRight,
  Flower2,
  Leaf,
  PackageSearch,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";

import ProductGrid from "../components/products/ProductGrid";
import ProductSort from "../components/products/ProductSort";
import FAQChatbot from "../components/chatbot/FAQChatbot";

import {
  getCategories,
  getProducts,
} from "../services/productService";
import {
  getFeaturedProducts,
  getNewArrivals,
} from "../services/homeService";

import "../styles/products.css";

/* ============================================================
   AUMVEDA — PRODUCTS PAGE

   IMPROVEMENTS
   - Category changes without full-page reload
   - Subcategory changes without full-page reload
   - Keep products in memory
   - Avoid unnecessary API refetches
   - Preserve scroll position
   - Maintain React Router URL synchronization
   - Preserve product grid and existing design
   - Retain all existing filters
   - Best Sellers / New Arrivals
   - Promotional carousel
   - Mobile filter drawer
============================================================ */

const MAX_VISIBLE_SUBCATEGORIES = 5;
const AD_AFTER_PRODUCTS = 8;
const AD_INTERVAL_MS = 2500;
const NEW_ARRIVALS_DAYS = 60;

/*
  Cache the catalogue outside the component.

  This prevents an unnecessary initial loading screen
  if React Router remounts Products while the customer
  navigates between categories.
*/

let catalogueCache = null;
let catalogueRequest = null;

const AD_CAMPAIGNS = [
  {
    id: "hair",
    theme: "sage",
    eyebrow: "THE HAIR CARE EDIT",
    title: "Nourish Your Roots.",
    highlight: "Naturally.",
    description:
      "Discover botanical oils, masks and everyday hair nourishment.",
    button: "Shop Hair Care",
    categoryNames: ["Hair Care"],
    searchTerms: [
      "hair",
      "bhringraj",
      "amla",
      "shampoo",
      "scalp",
      "coconut",
    ],
  },
  {
    id: "skin",
    theme: "rose",
    eyebrow: "THE SKIN CARE EDIT",
    title: "Glow With Nature.",
    highlight: "Every Day.",
    description:
      "Explore thoughtfully selected serums, creams and gentle skin care.",
    button: "Shop Skin Care",
    categoryNames: ["Skin Care"],
    searchTerms: [
      "skin",
      "face",
      "serum",
      "sandalwood",
      "aloe",
      "neem",
    ],
  },
  {
    id: "immunity",
    theme: "gold",
    eyebrow: "THE INNER WELLNESS EDIT",
    title: "Wellness Begins",
    highlight: "Within.",
    description:
      "Explore herbal wellness essentials for your daily routine.",
    button: "Shop Immunity",
    categoryNames: ["Immunity"],
    searchTerms: [
      "immunity",
      "ashwagandha",
      "brahmi",
      "capsule",
      "triphala",
    ],
  },
  {
    id: "wellness",
    theme: "blue",
    eyebrow: "THE DAILY WELLNESS EDIT",
    title: "Make Every Day",
    highlight: "A Ritual.",
    description:
      "Find herbal teas, daily essentials and moments of mindful care.",
    button: "Shop Wellness",
    categoryNames: ["Wellness"],
    searchTerms: [
      "wellness",
      "tea",
      "detox",
      "tulsi",
      "herbal",
      "daily",
    ],
  },
];

/* ============================================================
   GENERAL UTILITIES
============================================================ */

function toId(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractList(response) {
  if (Array.isArray(response)) {
    return response;
  }

  const candidates = [
    response?.data?.data?.products,
    response?.data?.data?.categories,
    response?.data?.products,
    response?.data?.categories,
    response?.data?.data,
    response?.data,
    response?.products,
    response?.categories,
    response?.items,
  ];

  return candidates.find(Array.isArray) || [];
}

function dateTimestamp(value) {
  if (!value) return null;

  const result = Date.parse(value);

  return Number.isFinite(result)
    ? result
    : null;
}

/* ============================================================
   API DATA CACHE

   Category filtering is client-side.
   The product catalogue does not refetch just because
   the URL's category or subcategory changes.
============================================================ */

async function fetchCatalogue(force = false) {
  if (!force && catalogueCache) {
    return catalogueCache;
  }

  if (catalogueRequest) {
    return catalogueRequest;
  }

  catalogueRequest = Promise.all([
    getProducts(),
    getCategories(),
  ])
    .then(([productResponse, categoryResponse]) => {
      const result = {
        products: extractList(productResponse),
        categories: extractList(categoryResponse),
      };

      catalogueCache = result;

      return result;
    })
    .finally(() => {
      catalogueRequest = null;
    });

  return catalogueRequest;
}

/* ============================================================
   CATEGORY HELPERS
============================================================ */

function getParentId(category) {
  return toId(
    category?.parent_id ??
    category?.parent_category_id ??
    category?.parentCategoryId ??
    category?.parent?.id ??
    category?.parent_category?.id ??
    ""
  );
}

function normalizeCategories(source) {
  const result = new Map();

  function visit(items, inheritedParent = "") {
    if (!Array.isArray(items)) {
      return;
    }

    for (const category of items) {
      if (!category?.id) {
        continue;
      }

      const id = toId(category.id);

      if (!result.has(id)) {
        result.set(id, {
          ...category,
          id,
          _parentId:
            getParentId(category) ||
            inheritedParent,
        });
      }

      visit(category.children, id);
      visit(category.subcategories, id);
      visit(category.sub_categories, id);
    }
  }

  visit(source);

  return [...result.values()];
}

function createCategoryTree(categories) {
  const byId = new Map(
    categories.map((category) => [
      category.id,
      category,
    ])
  );

  const roots = [];
  const children = new Map();

  for (const category of categories) {
    const parent = category._parentId;

    if (
      parent &&
      parent !== category.id &&
      byId.has(parent)
    ) {
      const group = children.get(parent) || [];

      group.push(category);
      children.set(parent, group);
    } else {
      roots.push(category);
    }
  }

  function sortCategories(a, b) {
    const aOrder = Number(
      a.sort_order ?? a.display_order
    );

    const bOrder = Number(
      b.sort_order ?? b.display_order
    );

    if (
      Number.isFinite(aOrder) &&
      Number.isFinite(bOrder) &&
      aOrder !== bOrder
    ) {
      return aOrder - bOrder;
    }

    return String(a.name || "").localeCompare(
      String(b.name || "")
    );
  }

  roots.sort(sortCategories);

  children.forEach((items) => {
    items.sort(sortCategories);
  });

  function descendants(id) {
    const result = new Set();
    const stack = [toId(id)];

    while (stack.length > 0) {
      const current = stack.pop();

      if (result.has(current)) {
        continue;
      }

      result.add(current);

      for (const child of children.get(current) || []) {
        stack.push(child.id);
      }
    }

    return result;
  }

  function rootOf(id) {
    let current = byId.get(toId(id));

    const visited = new Set();

    while (
      current &&
      current._parentId &&
      byId.has(current._parentId) &&
      !visited.has(current.id)
    ) {
      visited.add(current.id);

      current = byId.get(current._parentId);
    }

    return current?.id || "";
  }

  return {
    byId,
    roots,
    children,
    descendants,
    rootOf,
  };
}

function getProductCategoryIds(product) {
  const ids = new Set();

  function add(value) {
    if (value == null || value === "") {
      return;
    }

    if (typeof value === "object") {
      add(value.id ?? value.category_id);
      return;
    }

    ids.add(toId(value));
  }

  add(product.category_id);
  add(product.category);

  if (Array.isArray(product.category_ids)) {
    product.category_ids.forEach(add);
  }

  if (Array.isArray(product.categories)) {
    product.categories.forEach(add);
  }

  return ids;
}

/* ============================================================
   PRODUCT HELPERS
============================================================ */

function getDefaultVariant(product) {
  const variants = Array.isArray(
    product?.product_variants
  )
    ? product.product_variants
    : [];

  const activeVariants = variants.filter(
    (variant) => variant.is_active !== false
  );

  return (
    activeVariants.find(
      (variant) =>
        variant.is_default === true ||
        variant.attributes?.is_default === true
    ) ||
    activeVariants[0] ||
    product?.variant ||
    null
  );
}

function productPrice(product) {
  return toNumber(
    product.price ??
    getDefaultVariant(product)?.price ??
    0
  );
}

function comparePrice(product) {
  return toNumber(
    product.compare_at_price ??
    getDefaultVariant(product)?.compare_at_price ??
    product.original_price ??
    0
  );
}

function productInStock(product) {
  if (product.in_stock === false) {
    return false;
  }

  if (product.in_stock === true) {
    return true;
  }

  const stock =
    product.stock_quantity ??
    getDefaultVariant(product)?.stock_quantity;

  return (
    stock == null ||
    toNumber(stock) > 0
  );
}

function productHasOffer(product) {
  const price = productPrice(product);
  const original = comparePrice(product);

  return price > 0 && original > price;
}

function productRating(product) {
  return toNumber(
    product.average_rating ??
    product.rating ??
    0
  );
}

function getProductImage(product) {
  if (typeof product?.image === "string") {
    return product.image;
  }

  return (
    product?.image?.image_url ||
    product?.image_url ||
    product?.thumbnail_url ||
    product?.product_images?.find(
      (image) => image?.is_primary
    )?.image_url ||
    product?.product_images?.[0]?.image_url ||
    ""
  );
}

function isActiveProduct(product) {
  return (
    !product.status ||
    String(product.status).toLowerCase() === "active"
  );
}

function getSalesCount(product) {
  const values = [
    product.sales_count,
    product.total_sold,
    product.sold_count,
    product.units_sold,
    product.completed_sales_count,
  ];

  const value = values.find(
    (item) =>
      item !== null &&
      item !== undefined &&
      item !== ""
  );

  if (value === undefined) {
    return null;
  }

  const count = Number(value);

  return Number.isFinite(count)
    ? Math.max(0, count)
    : null;
}

function hasBestSellerEvidence(product) {
  return (
    product.is_best_seller === true ||
    product.is_bestseller === true ||
    (
      getSalesCount(product) !== null &&
      getSalesCount(product) > 0
    )
  );
}

function isNewArrival(product, now) {
  const createdAt = dateTimestamp(
    product.created_at
  );

  if (createdAt === null) {
    return false;
  }

  const elapsed = now - createdAt;

  return (
    elapsed >= 0 &&
    elapsed <= NEW_ARRIVALS_DAYS * 86400000
  );
}

/* ============================================================
   FILTER SIDEBAR
============================================================ */

function ProductsFilterSidebar({
  categoryTree,
  selectedRoot,
  categoryCounts,
  totalProducts,
  onCategoryChange,
  maximumPrice,
  priceLimit,
  onPriceChange,
  inStockOnly,
  onStockChange,
  offersOnly,
  onOffersChange,
  minRating,
  onRatingChange,
  onClear,
}) {
  const displayedPrice =
    priceLimit === null
      ? maximumPrice
      : Math.min(priceLimit, maximumPrice);

  return (
    <div className="product-filters">
      <div className="product-filters__heading">
        <span>REFINE YOUR SHOPPING</span>
        <h2>Filters</h2>
      </div>

      <div className="product-filters__group">
        <h3>Categories</h3>

        <div className="product-filters__list">
          <button
            type="button"
            className={
              "product-filter-item" +
              (
                selectedRoot === "all"
                  ? " is-active"
                  : ""
              )
            }
            onClick={() => onCategoryChange("all")}
            aria-pressed={selectedRoot === "all"}
          >
            <ShoppingBag size={14} />
            <span>All Products</span>
            <small>{totalProducts}</small>
          </button>

          {categoryTree.roots.map((category) => {
            const active =
              selectedRoot === category.id;

            return (
              <button
                type="button"
                key={category.id}
                className={
                  "product-filter-item product-filter-item--main" +
                  (active ? " is-active" : "")
                }
                onClick={() =>
                  onCategoryChange(category.id)
                }
                aria-pressed={active}
              >
                <span>{category.name}</span>
                <small>
                  {categoryCounts[category.id] || 0}
                </small>
                <ChevronRight size={14} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="product-filters__group">
        <div className="product-filters__group-title">
          <h3>Price Range</h3>
          <Tag size={14} />
        </div>

        <div className="product-filters__price-labels">
          <span>₹0</span>

          <strong>
            ₹{displayedPrice.toLocaleString("en-IN")}
          </strong>
        </div>

        <input
          className="product-filters__range"
          type="range"
          min={0}
          max={maximumPrice}
          step={maximumPrice <= 1000 ? 25 : 50}
          value={displayedPrice}
          aria-label="Maximum product price"
          onChange={(event) =>
            onPriceChange(Number(event.target.value))
          }
        />

        <p className="product-filters__hint">
          Products priced up to ₹
          {displayedPrice.toLocaleString("en-IN")}
        </p>
      </div>

      <div className="product-filters__group">
        <h3>Availability</h3>

        <label className="product-filters__checkbox">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(event) =>
              onStockChange(event.target.checked)
            }
          />
          <span>In Stock Only</span>
        </label>
      </div>

      <div className="product-filters__group">
        <h3>Special Offers</h3>

        <label className="product-filters__checkbox">
          <input
            type="checkbox"
            checked={offersOnly}
            onChange={(event) =>
              onOffersChange(event.target.checked)
            }
          />
          <span>Discounted Products</span>
        </label>
      </div>

      <div className="product-filters__group">
        <h3>Customer Rating</h3>

        <div className="product-filters__rating-options">
          {[0, 4, 3, 2].map((rating) => (
            <label
              key={rating}
              className="product-filters__radio"
            >
              <input
                type="radio"
                name="catalog-rating"
                checked={minRating === rating}
                onChange={() =>
                  onRatingChange(rating)
                }
              />

              <span>
                {rating === 0
                  ? "All Ratings"
                  : `${rating}★ & above`}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="product-filters__clear"
        onClick={onClear}
      >
        <RotateCcw size={14} />
        Reset All Filters
      </button>
    </div>
  );
}

/* ============================================================
   SUBCATEGORY NAVIGATION
============================================================ */

function SubcategoryStrip({
  category,
  subcategories,
  selectedId,
  onChange,
}) {
  if (
    !category ||
    subcategories.length === 0
  ) {
    return null;
  }

  const firstFive = subcategories.slice(
    0,
    MAX_VISIBLE_SUBCATEGORIES
  );

  const selectedOutside = subcategories.find(
    (item) =>
      item.id === selectedId &&
      !firstFive.some(
        (visible) => visible.id === item.id
      )
  );

  const visible = selectedOutside
    ? [
        ...firstFive.slice(
          0,
          MAX_VISIBLE_SUBCATEGORIES - 1
        ),
        selectedOutside,
      ]
    : firstFive;

  return (
    <nav
      className="products-subcategories"
      aria-label={`${category.name} subcategories`}
    >
      <span className="products-subcategories__label">
        Explore
      </span>

      <div className="products-subcategories__list">
        <button
          type="button"
          className={
            "products-subcategories__chip" +
            (!selectedId ? " is-active" : "")
          }
          onClick={() => onChange("")}
          aria-pressed={!selectedId}
        >
          All {category.name}
        </button>

        {visible.map((item) => (
          <button
            type="button"
            key={item.id}
            className={
              "products-subcategories__chip" +
              (
                selectedId === item.id
                  ? " is-active"
                  : ""
              )
            }
            onClick={() => onChange(item.id)}
            aria-pressed={selectedId === item.id}
          >
            {item.name}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ============================================================
   PROMOTIONAL CAMPAIGNS
============================================================ */

function buildAdSlides(products, categories, tree) {
  const uniqueProducts = [];
  const seen = new Set();

  for (const product of products) {
    if (
      !product?.id ||
      !product?.slug ||
      !getProductImage(product)
    ) {
      continue;
    }

    const id = toId(product.id);

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    uniqueProducts.push(product);
  }

  return AD_CAMPAIGNS.map((campaign) => {
    const category = tree.roots.find((item) =>
      campaign.categoryNames.some(
        (name) =>
          slugify(item.name) === slugify(name)
      )
    );

    const categoryIds = category
      ? tree.descendants(category.id)
      : new Set();

    const directMatches = [];
    const keywordMatches = [];

    for (const product of uniqueProducts) {
      const ids = getProductCategoryIds(product);

      const categoryMatch = [...ids].some(
        (id) => categoryIds.has(id)
      );

      const searchable = [
        product.name,
        product.short_description,
        ...categories
          .filter((item) => ids.has(item.id))
          .map((item) => item.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const keywordMatch =
        campaign.searchTerms.some(
          (term) => searchable.includes(term)
        );

      if (categoryMatch) {
        directMatches.push(product);
      } else if (keywordMatch) {
        keywordMatches.push(product);
      }
    }

    const matchingProducts = category
      ? directMatches
      : keywordMatches;

    const selectedProducts =
      matchingProducts.slice(0, 3);

    const destination = category
      ? `/products?category=${encodeURIComponent(
          category.id
        )}`
      : `/products?search=${encodeURIComponent(
          campaign.searchTerms[0]
        )}`;

    return {
      ...campaign,
      products: selectedProducts,
      destination,
    };
  }).filter(
    (slide) => slide.products.length > 0
  );
}

/* ============================================================
   CATALOG PROMOTIONAL CAROUSEL
============================================================ */

function CatalogAdvertisement({
  products = [],
  categories = [],
  tree,
}) {
  const [activeSlide, setActiveSlide] =
    useState(0);

  const [paused, setPaused] =
    useState(false);

  const [reducedMotion, setReducedMotion] =
    useState(false);

  const slides = useMemo(
    () => buildAdSlides(products, categories, tree),
    [products, categories, tree]
  );

  const slideSignature = slides
    .map((slide) => slide.id)
    .join("|");

  useEffect(() => {
    setActiveSlide(0);
  }, [slideSignature]);

  useEffect(() => {
    if (!window.matchMedia) {
      return undefined;
    }

    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const update = () => {
      setReducedMotion(media.matches);
    };

    update();

    media.addEventListener?.("change", update);

    return () => {
      media.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    if (
      paused ||
      reducedMotion ||
      slides.length < 2
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setActiveSlide(
          (current) =>
            (current + 1) % slides.length
        );
      }
    }, AD_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    paused,
    reducedMotion,
    slides.length,
  ]);

  if (slides.length === 0) {
    return null;
  }

  const currentIndex =
    activeSlide % slides.length;

  const currentSlide =
    slides[currentIndex];

  return (
    <section
      className={
        "products-catalog-ad " +
        `products-catalog-ad--${currentSlide.theme}`
      }
      aria-label="AUMVEDA category promotions"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget
          )
        ) {
          setPaused(false);
        }
      }}
    >
      <div
        className="products-catalog-ad__decoration"
        aria-hidden="true"
      />

      <div
        className="products-catalog-ad__slide"
        key={currentSlide.id}
        aria-label={
          `Promotion ${currentIndex + 1} of ${slides.length}`
        }
        aria-roledescription="slide"
      >
        <div className="products-catalog-ad__copy">
          <span className="products-catalog-ad__eyebrow">
            <Leaf size={13} />
            {currentSlide.eyebrow}
          </span>

          <Link
            to={currentSlide.destination}
            className="products-catalog-ad__heading-link"
            preventScrollReset
          >
            <h3>
              {currentSlide.title}
              <em>{currentSlide.highlight}</em>
            </h3>
          </Link>

          <p>{currentSlide.description}</p>

          <Link
            to={currentSlide.destination}
            className="products-catalog-ad__button"
            preventScrollReset
          >
            {currentSlide.button}
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="products-catalog-ad__images">
          {currentSlide.products.map(
            (product, index) => (
              <Link
                key={product.id}
                to={`/products/${encodeURIComponent(
                  product.slug
                )}`}
                className={
                  "products-catalog-ad__product " +
                  `products-catalog-ad__product--${index + 1}`
                }
                aria-label={`View ${product.name}`}
                title={product.name}
              >
                <img
                  src={getProductImage(product)}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </Link>
            )
          )}
        </div>
      </div>

      <div className="products-catalog-ad__pagination">
        {slides.map((slide, index) => (
          <button
            type="button"
            key={slide.id}
            className={
              "products-catalog-ad__dot" +
              (
                index === currentIndex
                  ? " is-active"
                  : ""
              )
            }
            style={{
              "--dot-theme":
                slide.theme === "sage"
                  ? "#386445"
                  : slide.theme === "rose"
                    ? "#B25E6A"
                    : slide.theme === "gold"
                      ? "#A87930"
                      : "#5979A9",
            }}
            aria-label={`Show ${slide.eyebrow}`}
            aria-pressed={index === currentIndex}
            onClick={() => setActiveSlide(index)}
          />
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   PRODUCTS PAGE
============================================================ */

export default function Products() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  /*
    Data is initialized from the module cache when
    available, preventing a full loading skeleton
    during a route remount.
  */

  const [products, setProducts] = useState(
    () => catalogueCache?.products || []
  );

  const [categories, setCategories] = useState(
    () => catalogueCache?.categories || []
  );

  const [loading, setLoading] = useState(
    () => !catalogueCache
  );

  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const [sortBy, setSortBy] =
    useState("popular");

  const [discoveryMode, setDiscoveryMode] =
    useState("all");

  const [featuredProductIds, setFeaturedProductIds] =
    useState(() => new Set());

  const [newArrivalIds, setNewArrivalIds] =
    useState(() => new Set());

  const [priceLimit, setPriceLimit] =
    useState(null);

  const [inStockOnly, setInStockOnly] =
    useState(false);

  const [offersOnly, setOffersOnly] =
    useState(false);

  const [minRating, setMinRating] =
    useState(0);

  const [
    mobileFiltersOpen,
    setMobileFiltersOpen,
  ] = useState(false);

  /*
    Used to restore the previous scroll position
    after category/subcategory URL navigation.
  */

  const pendingScrollRef = useRef(null);

  const previousQueryRef = useRef(
    searchParams.toString()
  );

  const queryString = searchParams.toString();

  const searchQuery =
    searchParams.get("search") || "";

  /* ==========================================================
     INITIAL DATA FETCH

     Only initial mount or explicit retry.

     Not dependent on:
     - category
     - subcategory
     - search params
     - sorting
     - filters
  ========================================================== */

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!catalogueCache) {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetchCatalogue(
          retry > 0
        );

        if (!active) {
          return;
        }

        setProducts(response.products);
        setCategories(response.categories);
      } catch (requestError) {
        if (!active) {
          return;
        }

        console.error(
          "[AUMVEDA] Products loading failed:",
          requestError
        );

        setError(
          "Unable to load products. Please try again."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    let active = true;

    async function loadDiscoverySets() {
      try {
        const [featuredResponse, arrivalsResponse] =
          await Promise.all([
            getFeaturedProducts(),
            getNewArrivals(),
          ]);

        if (!active) {
          return;
        }

        const nextFeatured = new Set(
          (Array.isArray(featuredResponse)
            ? featuredResponse
            : featuredResponse?.data || [])
            .map((product) => String(product?.id))
            .filter(Boolean)
        );

        const nextArrivals = new Set(
          (Array.isArray(arrivalsResponse)
            ? arrivalsResponse
            : arrivalsResponse?.data || [])
            .map((product) => String(product?.id))
            .filter(Boolean)
        );

        setFeaturedProductIds(nextFeatured);
        setNewArrivalIds(nextArrivals);
      } catch (requestError) {
        console.warn(
          "[AUMVEDA] Discovery product metadata failed:",
          requestError
        );
      }
    }

    loadDiscoverySets();

    return () => {
      active = false;
    };
  }, []);

  /* ==========================================================
     PRESERVE SCROLL ON FILTER NAVIGATION

     The URL can update, but the browser must not
     jump to the top of the page.
  ========================================================== */

  useLayoutEffect(() => {
    const currentQuery = queryString;

    if (
      previousQueryRef.current === currentQuery
    ) {
      return;
    }

    previousQueryRef.current = currentQuery;

    const pending = pendingScrollRef.current;

    if (!pending) {
      return;
    }

    pendingScrollRef.current = null;

    const restore = () => {
      window.scrollTo({
        top: pending.y,
        left: pending.x,
        behavior: "instant",
      });
    };

    restore();

    const frame = window.requestAnimationFrame(
      restore
    );

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [queryString]);

  /* ==========================================================
     URL UPDATE WITHOUT SCROLL RESET
  ========================================================== */

  const updateCatalogParams = useCallback(
    (modify) => {
      const next = new URLSearchParams(
        searchParams
      );

      modify(next);

      if (
        next.toString() === searchParams.toString()
      ) {
        return;
      }

      pendingScrollRef.current = {
        x: window.scrollX,
        y: window.scrollY,
      };

      setSearchParams(next, {
        preventScrollReset: true,
        replace: false,
      });
    },
    [searchParams, setSearchParams]
  );

  /* ==========================================================
     MOBILE DRAWER
  ========================================================== */

  useEffect(() => {
    if (!mobileFiltersOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMobileFiltersOpen(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [mobileFiltersOpen]);

  /* ==========================================================
     CATEGORY TREE
  ========================================================== */

  const normalizedCategories = useMemo(
    () => normalizeCategories(categories),
    [categories]
  );

  const tree = useMemo(
    () => createCategoryTree(
      normalizedCategories
    ),
    [normalizedCategories]
  );

  const categoryNames = useMemo(
    () =>
      Object.fromEntries(
        normalizedCategories.map((category) => [
          category.id,
          category.name,
        ])
      ),
    [normalizedCategories]
  );

  const resolveCategory = useCallback(
    (value) => {
      if (!value) {
        return "";
      }

      const query = String(value)
        .trim()
        .toLowerCase();

      return (
        normalizedCategories.find(
          (category) =>
            category.id.toLowerCase() === query ||
            slugify(category.name) === query ||
            slugify(category.slug || "") === query
        )?.id || ""
      );
    },
    [normalizedCategories]
  );

  const categoryId = resolveCategory(
    searchParams.get("category")
  );

  const subcategoryId = resolveCategory(
    searchParams.get("subcategory")
  );

  const selectedRoot = categoryId
    ? tree.rootOf(categoryId)
    : "all";

  const selectedMainCategory =
    tree.byId.get(selectedRoot) || null;

  const availableSubcategories = useMemo(
    () => {
      if (selectedRoot === "all") {
        return [];
      }

      const allowed =
        tree.descendants(selectedRoot);

      return normalizedCategories.filter(
        (category) =>
          category.id !== selectedRoot &&
          allowed.has(category.id)
      );
    },
    [
      selectedRoot,
      tree,
      normalizedCategories,
    ]
  );

  const selectedSubcategory = useMemo(
    () => {
      if (selectedRoot === "all") {
        return "";
      }

      const candidate =
        subcategoryId ||
        (
          categoryId !== selectedRoot
            ? categoryId
            : ""
        );

      return availableSubcategories.some(
        (category) =>
          category.id === candidate
      )
        ? candidate
        : "";
    },
    [
      selectedRoot,
      subcategoryId,
      categoryId,
      availableSubcategories,
    ]
  );

  const effectiveCategory =
    selectedSubcategory || selectedRoot;

  /* ==========================================================
     CATEGORY COUNTS
  ========================================================== */

  const categoryCounts = useMemo(() => {
    const counts = {};

    for (const category of normalizedCategories) {
      const allowed =
        tree.descendants(category.id);

      counts[category.id] = products.filter(
        (product) =>
          [...getProductCategoryIds(product)].some(
            (id) => allowed.has(id)
          )
      ).length;
    }

    return counts;
  }, [
    products,
    normalizedCategories,
    tree,
  ]);

  /* ==========================================================
     MAXIMUM PRICE
  ========================================================== */

  const maximumPrice = useMemo(() => {
    const highest = products.reduce(
      (max, product) =>
        Math.max(max, productPrice(product)),
      0
    );

    return Math.max(
      500,
      Math.ceil(highest / 100) * 100
    );
  }, [products]);

  /* ==========================================================
     SALES / DATE METADATA
  ========================================================== */

  const hasSalesMetadata = useMemo(
    () =>
      products.some(
        (product) =>
          getSalesCount(product) !== null ||
          typeof product.is_best_seller === "boolean" ||
          typeof product.is_bestseller === "boolean"
      ),
    [products]
  );

  const hasCreationDates = useMemo(
    () =>
      products.some(
        (product) =>
          dateTimestamp(product.created_at) !== null
      ),
    [products]
  );

  /* ==========================================================
     CLIENT-SIDE FILTERING

     IMPORTANT:
     Filtering changes the products array without
     making another network request.

     Existing page layout remains mounted.
  ========================================================== */

  const filteredProducts = useMemo(() => {
    let result = products.filter(
      isActiveProduct
    );

    /* CATEGORY */

    if (effectiveCategory !== "all") {
      const allowed = tree.descendants(
        effectiveCategory
      );

      result = result.filter(
        (product) =>
          [...getProductCategoryIds(product)].some(
            (id) => allowed.has(id)
          )
      );
    }

    /* SEARCH */

    const query =
      searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((product) => {
        const names = [
          ...getProductCategoryIds(product),
        ]
          .map((id) => categoryNames[id])
          .filter(Boolean);

        const searchable = [
          product.name,
          product.short_description,
          product.description,
          ...names,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      });
    }

    /* PRICE */

    if (priceLimit !== null) {
      result = result.filter(
        (product) =>
          productPrice(product) <= priceLimit
      );
    }

    /* STOCK */

    if (inStockOnly) {
      result = result.filter(
        productInStock
      );
    }

    /* OFFERS */

    if (offersOnly) {
      result = result.filter(
        productHasOffer
      );
    }

    /* RATING */

    if (minRating > 0) {
      result = result.filter(
        (product) =>
          productRating(product) >= minRating
      );
    }

    /* BEST SELLERS */

    if (discoveryMode === "best-sellers") {
      result = result.filter((product) => {
        const productId = String(product.id);

        return (
          product.is_featured === true ||
          featuredProductIds.has(productId) ||
          hasBestSellerEvidence(product)
        );
      });

      result.sort((a, b) => {
        const aCount =
          getSalesCount(a) ?? 0;

        const bCount =
          getSalesCount(b) ?? 0;

        if (featuredProductIds.has(String(a.id)) !==
            featuredProductIds.has(String(b.id))) {
          return featuredProductIds.has(String(b.id)) ? 1 : -1;
        }

        if (bCount !== aCount) {
          return bCount - aCount;
        }

        if (
          a.is_best_seller === true &&
          b.is_best_seller !== true
        ) {
          return -1;
        }

        if (
          b.is_best_seller === true &&
          a.is_best_seller !== true
        ) {
          return 1;
        }

        return productRating(b) -
          productRating(a);
      });
    }

    /* NEW ARRIVALS */

    else if (
      discoveryMode === "new-arrivals"
    ) {
      const now = Date.now();

      result = result.filter((product) => {
        const productId = String(product.id);

        return (
          newArrivalIds.has(productId) ||
          product.is_new_arrival === true ||
          isNewArrival(product, now)
        );
      });

      result.sort(
        (a, b) =>
          (
            dateTimestamp(b.created_at) ??
            (
              newArrivalIds.has(String(b.id)) ?
                now :
                0
            )
          ) -
          (
            dateTimestamp(a.created_at) ??
            (
              newArrivalIds.has(String(a.id)) ?
                now :
                0
            )
          )
      );
    }

    /* DEFAULT POPULAR SORT */

    else {
      result = [...result].sort((a, b) => {
        if (sortBy !== "popular") {
          return 0;
        }

        const score = (product) =>
          productRating(product) * 1000 +
          toNumber(product.review_count);

        return score(b) - score(a);
      });
    }

    /* EXPLICIT SORT */

    if (sortBy !== "popular") {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "price_low":
            return productPrice(a) -
              productPrice(b);

          case "price_high":
            return productPrice(b) -
              productPrice(a);

          case "rating":
            return productRating(b) -
              productRating(a);

          case "name":
            return String(a.name || "")
              .localeCompare(
                String(b.name || "")
              );

          default:
            return 0;
        }
      });
    }

    return result;
  }, [
    products,
    effectiveCategory,
    tree,
    searchQuery,
    categoryNames,
    priceLimit,
    inStockOnly,
    offersOnly,
    minRating,
    sortBy,
    discoveryMode,
    featuredProductIds,
    newArrivalIds,
  ]);

  /* ==========================================================
     CATEGORY ACTIONS

     React Router updates the address bar,
     but the browser doesn't reload the document.
  ========================================================== */

  function changeCategory(id) {
    updateCatalogParams((params) => {
      if (id === "all") {
        params.delete("category");
      } else {
        params.set("category", id);
      }

      params.delete("subcategory");
    });
  }

  function changeSubcategory(id) {
    if (selectedRoot === "all") {
      return;
    }

    updateCatalogParams((params) => {
      params.set(
        "category",
        selectedRoot
      );

      if (id) {
        params.set("subcategory", id);
      } else {
        params.delete("subcategory");
      }
    });
  }

  function removeSearch() {
    updateCatalogParams((params) => {
      params.delete("search");
    });
  }

  /* ==========================================================
     CLEAR FILTERS
  ========================================================== */

  function clearFilters() {
    setSortBy("popular");
    setDiscoveryMode("all");
    setPriceLimit(null);
    setInStockOnly(false);
    setOffersOnly(false);
    setMinRating(0);

    updateCatalogParams((params) => {
      params.delete("category");
      params.delete("subcategory");
      params.delete("search");
    });
  }

  /* ==========================================================
     FILTER DETAILS
  ========================================================== */

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedRoot !== "all" ||
    Boolean(selectedSubcategory) ||
    priceLimit !== null ||
    inStockOnly ||
    offersOnly ||
    minRating > 0 ||
    discoveryMode !== "all";

  const filterProps = {
    categoryTree: tree,
    selectedRoot,
    categoryCounts,
    totalProducts: products.length,
    onCategoryChange: changeCategory,
    maximumPrice,
    priceLimit,
    onPriceChange: setPriceLimit,
    inStockOnly,
    onStockChange: setInStockOnly,
    offersOnly,
    onOffersChange: setOffersOnly,
    minRating,
    onRatingChange: setMinRating,
    onClear: clearFilters,
  };

  const currentCategoryName =
    selectedSubcategory
      ? categoryNames[selectedSubcategory]
      : selectedRoot !== "all"
        ? categoryNames[selectedRoot]
        : "";

  /* ==========================================================
     PROMOTIONAL POSITION
  ========================================================== */

  const showAdvertisement =
    !loading &&
    !error &&
    filteredProducts.length >
      AD_AFTER_PRODUCTS;

  const firstProducts = showAdvertisement
    ? filteredProducts.slice(
        0,
        AD_AFTER_PRODUCTS
      )
    : filteredProducts;

  const remainingProducts = showAdvertisement
    ? filteredProducts.slice(
        AD_AFTER_PRODUCTS
      )
    : [];

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  let emptyTitle = "No products found";

  let emptyMessage =
    "Try adjusting your selected filters.";

  if (
    discoveryMode === "best-sellers" &&
    !hasSalesMetadata
  ) {
    emptyTitle =
      "Best Sellers coming soon";

    emptyMessage =
      "Verified sales rankings are not yet available from the product catalog. Browse all products in the meantime.";
  } else if (
    discoveryMode === "best-sellers"
  ) {
    emptyTitle =
      "No Best Sellers found";

    emptyMessage =
      "No products match the selected categories and bestseller criteria.";
  } else if (
    discoveryMode === "new-arrivals" &&
    !hasCreationDates
  ) {
    emptyTitle =
      "New Arrivals coming soon";

    emptyMessage =
      "Product creation dates are not yet included in the catalog response.";
  } else if (
    discoveryMode === "new-arrivals"
  ) {
    emptyTitle =
      "No new arrivals found";

    emptyMessage =
      "There are no products added within the last 60 days that match your filters.";
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <main className="products-page">
      <section className="products-shop">

        {/* SIDEBAR */}

        <aside className="products-shop__sidebar">
          <ProductsFilterSidebar
            {...filterProps}
          />
        </aside>

        {/* MAIN COLLECTION */}

        <div className="products-shop__main">
          <div className="products-collection-heading">
            <div>
              <span className="products-collection-heading__eyebrow">
                CURATED FOR YOU
              </span>

              <h1>
                {currentCategoryName ||
                  "Explore Our Collection"}
              </h1>

              <p>
                Discover naturally inspired wellness
                essentials for everyday living.
              </p>
            </div>
          </div>

          {/* SUBCATEGORIES */}

          <SubcategoryStrip
            category={selectedMainCategory}
            subcategories={availableSubcategories}
            selectedId={selectedSubcategory}
            onChange={changeSubcategory}
          />

          {/* TOOLBAR */}

          <div className="products-toolbar">
            <div className="products-toolbar__left">
              <button
                type="button"
                className="products-mobile-filter"
                onClick={() =>
                  setMobileFiltersOpen(true)
                }
              >
                <SlidersHorizontal size={16} />
                Filters
              </button>

              <div className="products-result-count">
                <strong>
                  {loading
                    ? "—"
                    : filteredProducts.length}
                </strong>

                <span>
                  {filteredProducts.length === 1
                    ? " product"
                    : " products"}
                </span>
              </div>

              {currentCategoryName && (
                <span className="products-current-category">
                  {currentCategoryName}
                </span>
              )}
            </div>

            <div className="products-toolbar__right">
              {/* BEST SELLERS */}

              <button
                type="button"
                className={
                  "products-toolbar-action products-toolbar-action--quick" +
                  (
                    discoveryMode === "best-sellers"
                      ? " is-active"
                      : ""
                  )
                }
                onClick={() =>
                  setDiscoveryMode((current) =>
                    current === "best-sellers"
                      ? "all"
                      : "best-sellers"
                  )
                }
                aria-pressed={
                  discoveryMode === "best-sellers"
                }
                title="Discover products with verified bestseller data"
              >
                <Award
                  size={16}
                  strokeWidth={1.8}
                />

                <span className="products-toolbar-action__label">
                  Best Sellers
                </span>
              </button>

              {/* NEW ARRIVALS */}

              <button
                type="button"
                className={
                  "products-toolbar-action products-toolbar-action--quick" +
                  (
                    discoveryMode === "new-arrivals"
                      ? " is-active"
                      : ""
                  )
                }
                onClick={() =>
                  setDiscoveryMode((current) =>
                    current === "new-arrivals"
                      ? "all"
                      : "new-arrivals"
                  )
                }
                aria-pressed={
                  discoveryMode === "new-arrivals"
                }
                title="Discover recently added products"
              >
                <Flower2
                  size={16}
                  strokeWidth={1.8}
                />

                <span className="products-toolbar-action__label">
                  New Arrivals
                </span>
              </button>

              {/* SORT */}

              <ProductSort
                value={sortBy}
                onChange={setSortBy}
              />
            </div>
          </div>

          {/* SEARCH SUMMARY */}

          {searchQuery.trim() && (
            <div className="products-search-summary">
              Search results for
              <strong>“{searchQuery}”</strong>
            </div>
          )}

          {/* ACTIVE FILTERS */}

          {hasActiveFilters && (
            <div className="products-active-filters">
              {selectedRoot !== "all" && (
                <span>
                  Category:
                  <strong>
                    {categoryNames[selectedRoot]}
                  </strong>
                </span>
              )}

              {selectedSubcategory && (
                <span>
                  Subcategory:
                  <strong>
                    {categoryNames[selectedSubcategory]}
                  </strong>
                </span>
              )}

              {priceLimit !== null && (
                <span>
                  Up to
                  <strong>
                    ₹{priceLimit.toLocaleString(
                      "en-IN"
                    )}
                  </strong>
                </span>
              )}

              {inStockOnly && (
                <span>In Stock</span>
              )}

              {offersOnly && (
                <span>Offers Only</span>
              )}

              {minRating > 0 && (
                <span>
                  {minRating}★ & above
                </span>
              )}

              {discoveryMode === "best-sellers" && (
                <span>
                  <Award size={12} />
                  Best Sellers
                </span>
              )}

              {discoveryMode === "new-arrivals" && (
                <span>
                  <Flower2 size={12} />
                  New Arrivals
                </span>
              )}

              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={removeSearch}
                >
                  <X size={12} />
                  Remove Search
                </button>
              )}

              <button
                type="button"
                onClick={clearFilters}
              >
                <RotateCcw size={12} />
                Clear All
              </button>
            </div>
          )}

          {/* ================================================
              PRODUCT RESULTS

              Only the product results change when
              filters, categories or sort values change.

              The parent layout stays rendered.
          ================================================ */}

          <div
            className="products-results-region"
            aria-live="polite"
            aria-busy={loading}
          >
            {loading ? (
              <div className="products-loading-grid">
                {Array.from({
                  length: 8,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="product-skeleton"
                  >
                    <div className="product-skeleton__image" />

                    <div className="product-skeleton__line product-skeleton__line--title" />

                    <div className="product-skeleton__line" />

                    <div className="product-skeleton__line product-skeleton__line--short" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="products-state">
                <PackageSearch size={38} />

                <h3>Collection unavailable</h3>

                <p>{error}</p>

                <button
                  type="button"
                  onClick={() =>
                    setRetry((value) => value + 1)
                  }
                >
                  Try Again
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="products-state">
                <PackageSearch size={38} />

                <h3>{emptyTitle}</h3>

                <p>{emptyMessage}</p>

                <button
                  type="button"
                  onClick={clearFilters}
                >
                  View All Products
                </button>
              </div>
            ) : (
              <div className="products-catalog-results">
                <ProductGrid
                  products={firstProducts}
                />

                {showAdvertisement && (
                  <CatalogAdvertisement
                    products={products}
                    categories={
                      normalizedCategories
                    }
                    tree={tree}
                  />
                )}

                {remainingProducts.length > 0 && (
                  <ProductGrid
                    products={remainingProducts}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MOBILE FILTER DRAWER */}

      {mobileFiltersOpen && (
        <div
          className="products-filter-overlay"
          onClick={() =>
            setMobileFiltersOpen(false)
          }
        >
          <aside
            className="products-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Product filters"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="products-filter-drawer__header">
              <div>
                <span>SHOP AUMVEDA</span>
                <h3>Refine Collection</h3>
              </div>

              <button
                type="button"
                aria-label="Close filters"
                onClick={() =>
                  setMobileFiltersOpen(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <ProductsFilterSidebar
              {...filterProps}
              onCategoryChange={(id) => {
                changeCategory(id);
                setMobileFiltersOpen(false);
              }}
              onClear={() => {
                clearFilters();
                setMobileFiltersOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      <FAQChatbot />
    </main>
  );
}
