import api from "./api";

import {
  cachedPublicRequest,
  createPublicCacheKey,
  invalidatePublicCache,
} from "./publicRequestCache";

const PRODUCT_TTL = 5 * 60 * 1000;
const CATEGORY_TTL = 30 * 60 * 1000;

/* ==========================================================
   PRODUCTS
========================================================== */

export async function getProducts(params = {}) {
  const cacheKey = createPublicCacheKey(
    "products:list",
    params
  );

  return cachedPublicRequest(
    cacheKey,
    async () => {
      try {
        const response = await api.get(
          "/products",
          {
            params,
          }
        );

        return Array.isArray(response)
          ? response
          : response?.data || [];
      } catch (error) {
        console.error(
          "Get products API failed:",
          error
        );

        throw error;
      }
    },
    {
      ttl: PRODUCT_TTL,
      persist: true,
    }
  );
}

/* ==========================================================
   CATEGORIES
========================================================== */

export async function getCategories() {
  return cachedPublicRequest(
    "products:categories",
    async () => {
      try {
        const response = await api.get(
          "/categories"
        );

        return Array.isArray(response)
          ? response
          : response?.data || [];
      } catch (error) {
        console.error(
          "Get categories API failed:",
          error
        );

        throw error;
      }
    },
    {
      ttl: CATEGORY_TTL,
      persist: true,
    }
  );
}

/* ==========================================================
   PRODUCT DETAILS
========================================================== */

export async function getProductBySlug(slug) {
  if (!slug) {
    throw new Error(
      "Product slug is required"
    );
  }

  const cacheKey = createPublicCacheKey(
    "products:detail",
    {
      slug,
    }
  );

  return cachedPublicRequest(
    cacheKey,
    async () => {
      try {
        const response = await api.get(
          `/products/${encodeURIComponent(slug)}`
        );

        return Array.isArray(response)
          ? response[0]
          : response?.data || response;
      } catch (error) {
        console.error(
          "Get product details failed:",
          error
        );

        throw error;
      }
    },
    {
      ttl: PRODUCT_TTL,
      persist: true,
    }
  );
}

/* ==========================================================
   RECENTLY VIEWED - RECORD PRODUCT VIEW
========================================================== */

export async function recordRecentlyViewedProduct(
  productId
) {
  if (!productId) {
    throw new Error(
      "Product ID is required to record a view."
    );
  }

  try {
    const response = await api.post(
      `/products/${encodeURIComponent(productId)}/view`,
      {}
    );

    return response?.data ?? response;
  } catch (error) {
    console.error(
      "Record recently viewed product failed:",
      error
    );

    throw error;
  }
}

/* ==========================================================
   RECENTLY VIEWED PRODUCTS
========================================================== */

export async function getRecentlyViewedProducts() {
  try {
    const response = await api.get(
      "/products/recently-viewed"
    );

    if (Array.isArray(response)) {
      return response;
    }

    if (
      Array.isArray(
        response?.data
      )
    ) {
      return response.data;
    }

    return [];
  } catch (error) {
    console.error(
      "Get recently viewed products failed:",
      error
    );

    throw error;
  }
}

/* ==========================================================
   CACHE INVALIDATION
========================================================== */

export function invalidateProductCache() {
  invalidatePublicCache(
    "products:"
  );
}