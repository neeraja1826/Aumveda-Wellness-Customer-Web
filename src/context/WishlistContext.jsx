/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import {
  addWishlistItem,
  getWishlist,
  removeWishlistItem,
} from "../services/wishlistService";

const WishlistContext = createContext(null);
const WISHLIST_KEY = "aumveda_wishlist";

function readGuestWishlist() {
  try {
    const saved = localStorage.getItem(WISHLIST_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed)
      ? [...new Set(parsed.filter(Boolean).map(String))]
      : [];
  } catch (error) {
    console.error("Guest wishlist loading failed:", error);
    return [];
  }
}

function writeGuestWishlist(ids) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("aumveda-wishlist-updated"));
}

function getProductIds(products) {
  return products
    .map((product) => product?.id)
    .filter(Boolean)
    .map(String);
}

export function WishlistProvider({ children }) {
  const {
    isAuthenticated,
    loading: authLoading,
    user,
  } = useAuth();
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const wishlistIdsRef = useRef([]);
  const loadRequestRef = useRef(0);

  const updateWishlistIds = useCallback((ids) => {
    const nextIds = [...new Set(ids.filter(Boolean).map(String))];
    wishlistIdsRef.current = nextIds;
    setWishlistIds(nextIds);
    window.dispatchEvent(new CustomEvent("aumveda-wishlist-updated"));
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    const requestId = ++loadRequestRef.current;
    let active = true;

    async function loadWishlist() {
      setLoading(true);
      setError("");

      try {
        if (!isAuthenticated) {
          if (active && requestId === loadRequestRef.current) {
            updateWishlistIds(readGuestWishlist());
          }
          return;
        }

        updateWishlistIds([]);
        const products = await getWishlist();
        const accountIds = getProductIds(products);
        const guestIds = readGuestWishlist();

        for (const productId of guestIds) {
          if (accountIds.includes(productId)) continue;
          await addWishlistItem(productId);
          accountIds.push(productId);
        }

        if (guestIds.length > 0) {
          localStorage.removeItem(WISHLIST_KEY);
        }

        if (active && requestId === loadRequestRef.current) {
          updateWishlistIds(accountIds);
        }
      } catch (loadError) {
        console.error("Wishlist loading failed:", loadError);
        if (active && requestId === loadRequestRef.current) {
          setError(loadError.message || "Unable to load your wishlist.");
        }
      } finally {
        if (active && requestId === loadRequestRef.current) {
          setLoading(false);
        }
      }
    }

    loadWishlist();

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user?.id, updateWishlistIds]);

  const isWishlisted = useCallback(
    (productId) =>
      Boolean(
        productId &&
          wishlistIds.some((id) => id === String(productId))
      ),
    [wishlistIds]
  );

  const addToWishlist = useCallback(
    async (productId) => {
      if (!productId) {
        throw new Error("Product ID is required.");
      }

      const normalizedId = String(productId);
      if (wishlistIdsRef.current.includes(normalizedId)) return;

      setError("");
      if (isAuthenticated) {
        await addWishlistItem(normalizedId);
        updateWishlistIds([...wishlistIdsRef.current, normalizedId]);
        return;
      }

      const nextIds = [...wishlistIdsRef.current, normalizedId];
      writeGuestWishlist(nextIds);
      updateWishlistIds(nextIds);
    },
    [isAuthenticated, updateWishlistIds]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      if (!productId) {
        throw new Error("Product ID is required.");
      }

      const normalizedId = String(productId);
      if (!wishlistIdsRef.current.includes(normalizedId)) return;

      setError("");
      if (isAuthenticated) {
        await removeWishlistItem(normalizedId);
      }

      const nextIds = wishlistIdsRef.current.filter(
        (id) => id !== normalizedId
      );
      if (!isAuthenticated) {
        writeGuestWishlist(nextIds);
      }
      updateWishlistIds(nextIds);
    },
    [isAuthenticated, updateWishlistIds]
  );

  const toggleWishlist = useCallback(
    async (productId) => {
      if (wishlistIdsRef.current.includes(String(productId))) {
        await removeFromWishlist(productId);
        return;
      }

      await addToWishlist(productId);
    },
    [addToWishlist, removeFromWishlist]
  );

  const clearWishlist = useCallback(async () => {
    setError("");
    if (isAuthenticated) {
      for (const productId of [...wishlistIdsRef.current]) {
        await removeWishlistItem(productId);
        updateWishlistIds(
          wishlistIdsRef.current.filter((id) => id !== productId)
        );
      }
    } else {
      writeGuestWishlist([]);
    }
    updateWishlistIds([]);
  }, [isAuthenticated, updateWishlistIds]);

  const value = useMemo(
    () => ({
      wishlistIds,
      wishlistCount: wishlistIds.length,
      loading,
      error,
      isWishlisted,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      clearWishlist,
    }),
    [
      wishlistIds,
      loading,
      error,
      isWishlisted,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      clearWishlist,
    ]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }

  return context;
}
