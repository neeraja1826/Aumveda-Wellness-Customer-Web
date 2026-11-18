import api from "./api";

export async function getWishlist() {
  const response = await api.get("/wishlist");

  if (!Array.isArray(response?.data)) {
    throw new Error("The wishlist response was not in the expected format.");
  }

  return response.data;
}

export async function addWishlistItem(productId) {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  return api.post(`/wishlist/${encodeURIComponent(productId)}`);
}

export async function removeWishlistItem(productId) {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  return api.delete(`/wishlist/${encodeURIComponent(productId)}`);
}
