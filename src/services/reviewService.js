import api from "./api";

export async function getProductReviews(productId) {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  const response = await api.get(
    `/reviews/product/${encodeURIComponent(productId)}`
  );

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

export async function submitProductReview({
  productId,
  rating,
  title,
  reviewText,
}) {
  if (!productId) {
    throw new Error("Product ID is required.");
  }

  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    throw new Error("Choose a rating from 1 to 5 stars.");
  }

  if (!String(title || "").trim() && !String(reviewText || "").trim()) {
    throw new Error("Please enter a title or written feedback.");
  }

  const response = await api.post("/reviews", {
    product_id: productId,
    rating: Number(rating),
    title: String(title || "").trim() || null,
    review_text: String(reviewText || "").trim() || null,
  });

  return response;
}
