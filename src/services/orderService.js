
import { supabase } from "./supabase";

/* ============================================================
   AUMVEDA — CUSTOMER ORDER SERVICE

   CART CHECKOUT
   BUY NOW CHECKOUT
   MY ORDERS
   ORDER DETAILS

   Uses the existing working API configuration.
============================================================ */

const API_BASE_URL = String(
  import.meta.env.VITE_CUSTOMER_API_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

/* ============================================================
   AUTHENTICATION
============================================================ */

async function getAccessToken() {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      "Unable to verify your session."
    );
  }

  const token = data?.session?.access_token;

  if (!token) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  return token;
}

/* ============================================================
   API REQUEST HELPER
============================================================ */

async function requestOrders(
  path,
  {
    method = "GET",
    body,
    signal,
    responseType = "json"
  } = {}
) {
  if (!API_BASE_URL) {
    throw new Error(
      "Customer Backend URL is not configured. " +
      "Set VITE_CUSTOMER_API_URL in your frontend .env file."
    );
  }

  const token = await getAccessToken();

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {})
        },
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
        signal
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Unable to confirm the server response. " +
      "Please check My Orders before trying again.",
      { cause: error }
    );
  }

  if (response.ok && responseType === "blob") {
    return response.blob();
  }

  let result;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    const detail = result?.detail;

    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(entry => entry?.msg)
              .filter(Boolean)
              .join(". ")
          : typeof result?.message === "string"
            ? result.message
            : response.status === 401
              ? "Your session has expired. Please sign in again."
              : response.status === 403
                ? "You are not authorized to access this order."
                : response.status === 404
                  ? "Order not found."
                  : response.status === 409
                    ? "The product is unavailable or stock is insufficient."
                    : "Unable to process your order.";

    throw new Error(message);
  }

  if (result?.status === "error") {
    throw new Error(
      result?.message ||
      "The order request was unsuccessful."
    );
  }

  return result;
}

/* ============================================================
   CONFIRM SUCCESSFUL ORDER RESPONSE
============================================================ */

function confirmOrder(result) {
  const order = result?.data;

  if (
    !order ||
    order.success !== true ||
    !order.order_id
  ) {
    throw new Error(
      "The server did not confirm order creation. " +
      "Please check My Orders before trying again."
    );
  }

  return order;
}

/* ============================================================
   1. GET CUSTOMER ORDERS
============================================================ */

export async function getCustomerOrders(signal) {
  const result = await requestOrders(
    "/orders",
    { signal }
  );

  if (Array.isArray(result)) {
    return result;
  }

  return Array.isArray(result?.data)
    ? result.data
    : [];
}

/* ============================================================
   2. GET CUSTOMER ORDER DETAILS
============================================================ */

export async function getCustomerOrderDetails(
  orderId,
  signal
) {
  if (!orderId) {
    throw new Error(
      "Order ID is required."
    );
  }

  const result = await requestOrders(
    `/orders/${encodeURIComponent(orderId)}`,
    { signal }
  );

  return result?.data || result;
}

/* ============================================================
   3. CREATE CART ORDER — CASH ON DELIVERY
============================================================ */

export async function createCustomerOrder({
  addressId,
  paymentMethod = "cod",
  couponCode = null,
  couponPlacement = null
}) {
  if (!addressId) {
    throw new Error(
      "Please select a delivery address."
    );
  }

  if (paymentMethod !== "cod") {
    throw new Error(
      "Only Cash on Delivery is currently supported."
    );
  }

  const result = await requestOrders(
    "/orders",
    {
      method: "POST",
      body: {
        address_id: addressId,
        payment_method: "cod",
        coupon_code: couponCode,
        coupon_placement: couponPlacement
      }
    }
  );

  return confirmOrder(result);
}

export async function validateCustomerCoupon({
  code,
  placement
}) {
  const result = await requestOrders(
    "/orders/coupons/validate",
    {
      method: "POST",
      body: {
        code,
        placement
      }
    }
  );

  return result?.data || result;
}

/* ============================================================
   4. CREATE BUY NOW ORDER — CASH ON DELIVERY

   Orders only the selected variant.
   Does not use the customer's cart.
============================================================ */

export async function createBuyNowOrder({
  addressId,
  variantId,
  quantity,
  paymentMethod = "cod"
}) {
  if (!addressId) {
    throw new Error(
      "Please select a delivery address."
    );
  }

  if (!variantId) {
    throw new Error(
      "The selected product variant is missing. " +
      "Please return to Products and select it again."
    );
  }

  const orderQuantity = Number(quantity);

  if (
    !Number.isInteger(orderQuantity) ||
    orderQuantity < 1 ||
    orderQuantity > 100
  ) {
    throw new Error(
      "Select a valid quantity between 1 and 100."
    );
  }

  if (paymentMethod !== "cod") {
    throw new Error(
      "Only Cash on Delivery is currently supported."
    );
  }

  const result = await requestOrders(
    "/orders/buy-now",
    {
      method: "POST",
      body: {
        address_id: addressId,
        variant_id: variantId,
        quantity: orderQuantity,
        payment_method: "cod"
      }
    }
  );

  return confirmOrder(result);
}

export async function downloadCustomerOrderInvoice(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  return requestOrders(
    `/orders/${encodeURIComponent(orderId)}/invoice`,
    { responseType: "blob" }
  );
}

export async function getCustomerOrderReturnRequests(orderId) {
  const query = orderId
    ? `?order_id=${encodeURIComponent(orderId)}`
    : "";
  const result = await requestOrders(`/returns${query}`);
  const requests = Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result?.data)
      ? result.data
      : null;

  if (!requests) {
    throw new Error(
      "The return requests response was not in the expected format."
    );
  }

  return requests;
}

export async function createCustomerReturnRequest({
  orderId,
  orderItemId,
  requestType = "return",
  requestedQuantity = 1,
  reason,
  description
}) {
  if (!orderId || !orderItemId) {
    throw new Error("Order and order item IDs are required.");
  }

  if (!["return", "replacement"].includes(requestType)) {
    throw new Error("Choose return or replacement.");
  }

  const quantity = Number(requestedQuantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Enter a valid return quantity.");
  }

  const cleanReason = String(reason || "").trim();
  if (!cleanReason) {
    throw new Error("Please select a reason for your request.");
  }

  return requestOrders("/returns", {
    method: "POST",
    body: {
      order_id: orderId,
      order_item_id: orderItemId,
      request_type: requestType,
      requested_quantity: quantity,
      reason: cleanReason,
      ...(String(description || "").trim()
        ? { description: String(description).trim() }
        : {})
    }
  });
}
