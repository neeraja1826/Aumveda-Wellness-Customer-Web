import api from "./api";

const ALLOWED_REVIEW_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function getReviewImageError(image) {
  if (!image) {
    return "";
  }

  if (!ALLOWED_REVIEW_IMAGE_TYPES.has(image.type?.toLowerCase())) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  return "";
}


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

export async function getCustomerOrderReviews(orderId, signal) {
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  const response = await api.get(
    `/reviews/order/${encodeURIComponent(orderId)}`,
    { signal }
  );

  if (!Array.isArray(response?.data)) {
    throw new Error("The order reviews response was not in the expected format.");
  }

  return response.data;
}

export async function submitProductReview({
  productId,
  rating,
  title,
  reviewText,
  orderItemId,
  image,
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

  const payload = {
    product_id: productId,
    rating: Number(rating),
    title: String(title || "").trim() || null,
    review_text: String(reviewText || "").trim() || null,
    ...(orderItemId ? { order_item_id: orderItemId } : {}),
  };

  if (image) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    formData.append("image", image);
    return api.post("/reviews", formData);
  }

  return api.post("/reviews", payload);
}
