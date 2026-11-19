import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Headphones,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Star,
  Truck,
  XCircle
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getCustomerOrderDetails } from "../services/orderService";
import {
  getReviewImageError,
  getCustomerOrderReviews,
  submitProductReview,
} from "../services/reviewService";
import { OrderManagementActions } from "./Orders";

import "../styles/orders.css";

const TRACKING_STEPS = [
  "Placed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered"
];

function formatMoney(value, currency = "INR") {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch {
    return `₹${safeAmount.toFixed(2)}`;
  }
}

function normalizeStatus(value) {
  return String(value || "placed")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function readableStatus(value) {
  return normalizeStatus(value)
    .split("_")
    .map(word => word ? word[0].toUpperCase() + word.slice(1) : "")
    .join(" ");
}

function getStatusTone(value) {
  const status = normalizeStatus(value);
  if (["delivered", "completed", "paid", "success"].includes(status)) {
    return "success";
  }
  if (["cancelled", "canceled", "failed", "refunded"].includes(status)) {
    return "danger";
  }
  if (
    [
      "shipped",
      "partially_shipped",
      "out_for_delivery",
      "confirmed",
      "processing",
      "packed"
    ].includes(status)
  ) {
    return "progress";
  }
  return "pending";
}

function getTrackingProgress(status) {
  const value = normalizeStatus(status);
  if (["delivered", "completed"].includes(value)) return 4;
  if (value === "out_for_delivery") return 3;
  if (["shipped", "partially_shipped"].includes(value)) return 2;
  if (["confirmed", "processing", "packed"].includes(value)) return 1;
  return 0;
}

function getOrderNumber(order) {
  if (!order) return "";
  const number = String(order.order_number || order.id || "");
  if (number.startsWith("#")) return number;
  return number.startsWith("AUM-") ? `#${number}` : `#AUM-${number}`;
}

function OrderTracking({ status }) {
  const value = normalizeStatus(status);
  const isCancelled = ["cancelled", "canceled"].includes(value);
  const isReturned = value === "returned";

  if (isCancelled || isReturned) {
    const Icon = isCancelled ? XCircle : RotateCcw;
    return (
      <section className={`order-detail__card order-tracking order-tracking--${isCancelled ? "danger" : "warning"}`}>
        <div className="order-detail__section-heading">
          <Icon size={18} />
          <h2>Order Tracking</h2>
        </div>
        <strong>{isCancelled ? "Order Cancelled" : "Order Returned"}</strong>
        <p>
          {isCancelled
            ? "This order has been cancelled and will not be delivered."
            : "This order has been marked as returned."}
        </p>
      </section>
    );
  }

  const activeStep = getTrackingProgress(value);
  const progress = `${(activeStep / (TRACKING_STEPS.length - 1)) * 100}%`;

  return (
    <section className="order-detail__card order-tracking">
      <div className="order-detail__section-heading">
        <Truck size={18} />
        <h2>Order Tracking</h2>
      </div>
      <div
        className="order-tracking__steps"
        style={{ "--order-tracking-progress": progress }}
      >
        {TRACKING_STEPS.map((step, index) => (
          <div
            className={
              "order-tracking__step" +
              (index <= activeStep ? " order-tracking__step--complete" : "")
            }
            key={step}
          >
            <span className="order-tracking__node">
              {index <= activeStep ? (
                <Check size={14} />
              ) : index === 2 || index === 3 ? (
                <Truck size={14} />
              ) : null}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AddressLines({ address }) {
  if (!address || typeof address !== "object") {
    return <p className="orders-muted">No delivery address was provided.</p>;
  }

  const lines = [
    address.recipient_name || address.full_name || address.name,
    address.phone,
    [address.address_line1, address.address_line2].filter(Boolean).join(", "),
    [
      address.city,
      address.state,
      address.postal_code || address.pincode,
      address.country
    ]
      .filter(Boolean)
      .join(", ")
  ].filter(Boolean);

  return lines.length ? (
    <address className="orders-address">
      {lines.map((line, index) => <span key={`${index}-${line}`}>{line}</span>)}
    </address>
  ) : (
    <p className="orders-muted">No delivery address was provided.</p>
  );
}

function OrderProduct({ item, currency, canReview, review }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewImage, setReviewImage] = useState(null);
  const [reviewImagePreview, setReviewImagePreview] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const reviewImageInputRef = useRef(null);
  const productId = item.product_id ?? item.product?.id;
  const images = item.product?.product_images || [];
  const productSlug =
    item.product?.slug || item.product_slug || item.slug;
  const productPath = productSlug
    ? `/products/${encodeURIComponent(productSlug)}`
    : null;
  const image =
    item.image_url ||
    item.product?.image_url ||
    images.find(entry => entry.is_primary)?.image_url ||
    images[0]?.image_url;
  const quantity = Number(item.quantity) || 1;
  const lineTotal =
    item.total_price == null
      ? (Number(item.unit_price) || 0) * quantity
      : item.total_price;
  const productName =
    item.product_name || item.product?.name || "Ayurvedic Botanical";
  const displayedReview = submittedReview || review;

  useEffect(() => () => {
    if (reviewImagePreview) {
      URL.revokeObjectURL(reviewImagePreview);
    }
  }, [reviewImagePreview]);

  async function handleSubmitReview(event) {
    event.preventDefault();

    try {
      setReviewSubmitting(true);
      setReviewError("");
      const result = await submitProductReview({
        productId,
        orderItemId: item.id,
        rating: reviewRating,
        title: reviewTitle,
        reviewText,
        image: reviewImage,
      });
      if (!result?.data) {
        throw new Error("The server did not return the saved review.");
      }
      setSubmittedReview(result.data);
      setReviewOpen(false);
      setReviewImage(null);
      setReviewImagePreview("");
      if (reviewImageInputRef.current) {
        reviewImageInputRef.current.value = "";
      }
    } catch (submitError) {
      console.error("Order review submission failed:", submitError);
      setReviewError(
        submitError?.message || "Unable to submit your review."
      );
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div className="order-detail__product-entry">
      <div className="order-detail__product">
        <div className="order-detail__product-image">
          {image ? (
            productPath ? (
              <Link to={productPath} aria-label={`View ${productName}`} className="order-detail__product-link">
                <img src={image} alt="" />
              </Link>
            ) : (
              <img src={image} alt="" />
            )
          ) : (
            <Package size={23} />
          )}
        </div>
        <div className="order-detail__product-info">
          {productPath ? (
            <Link className="order-detail__product-name" to={productPath}>
              {productName}
            </Link>
          ) : (
            <strong>{productName}</strong>
          )}
          {item.variant_name && <span>{item.variant_name}</span>}
          <span>Qty: {quantity}</span>
        </div>
        <strong className="order-detail__product-price">
          {formatMoney(lineTotal, currency)}
        </strong>
      </div>

      {(displayedReview || (canReview && item.id && productId)) && (
        <div className="order-detail__review">
          {displayedReview ? (
            <article className="order-detail__review-card">
              <div
                className="order-detail__review-stars"
                role="img"
                aria-label={`${displayedReview.rating} out of 5 stars`}
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    size={15}
                    fill={star <= Number(displayedReview.rating) ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <strong>Your review</strong>
              {displayedReview.title && <h3>{displayedReview.title}</h3>}
              {displayedReview.review_text && <p>{displayedReview.review_text}</p>}
              {displayedReview.image_url && (
                <img
                  className="order-detail__review-image"
                  src={displayedReview.image_url}
                  alt="Your review"
                  loading="lazy"
                />
              )}
              {displayedReview.created_at && (
                <time dateTime={displayedReview.created_at}>
                  {new Date(displayedReview.created_at).toLocaleDateString("en-IN")}
                </time>
              )}
            </article>
          ) : (
            <>
              <button
                type="button"
                className="order-detail__review-toggle"
                onClick={() => {
                  setReviewOpen(value => !value);
                  setReviewError("");
                }}
                aria-expanded={reviewOpen}
                disabled={reviewSubmitting}
              >
                <Star size={15} />
                {reviewOpen ? "Cancel review" : "Write a review"}
              </button>

              {reviewOpen && (
                <form
                  className="order-detail__review-form"
                  onSubmit={handleSubmitReview}
                >
                  <div
                    className="order-detail__review-stars"
                    role="group"
                    aria-label="Your rating"
                  >
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        aria-pressed={reviewRating === star}
                        onClick={() => setReviewRating(star)}
                        disabled={reviewSubmitting}
                      >
                        <Star
                          size={20}
                          fill={star <= reviewRating ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                  <label>
                    Title (optional)
                    <input
                      value={reviewTitle}
                      onChange={event => setReviewTitle(event.target.value)}
                      maxLength={150}
                      placeholder="Summarize your experience"
                      disabled={reviewSubmitting}
                    />
                  </label>
                  <label>
                    Your review
                    <textarea
                      value={reviewText}
                      onChange={event => setReviewText(event.target.value)}
                      maxLength={3000}
                      rows={3}
                      placeholder="Share your experience with this product"
                      disabled={reviewSubmitting}
                    />
                  </label>
                  <label>
                    Add a photo (optional)
                    <input
                      ref={reviewImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={event => {
                        const file = event.target.files?.[0] || null;
                        const imageError = getReviewImageError(file);
                        if (imageError) {
                          setReviewError(imageError);
                          event.target.value = "";
                          return;
                        }
                        setReviewImage(file);
                        setReviewImagePreview(
                          file ? URL.createObjectURL(file) : ""
                        );
                        setReviewError("");
                      }}
                      disabled={reviewSubmitting}
                    />
                  </label>
                  {reviewImagePreview && (
                    <div className="order-detail__review-image-preview">
                      <img src={reviewImagePreview} alt="Review upload preview" />
                      <button
                        type="button"
                        onClick={() => {
                          setReviewImage(null);
                          setReviewImagePreview("");
                          if (reviewImageInputRef.current) {
                            reviewImageInputRef.current.value = "";
                          }
                        }}
                        disabled={reviewSubmitting}
                      >
                        Remove photo
                      </button>
                    </div>
                  )}
                  {reviewError && (
                    <p className="order-detail__review-error" role="alert">
                      {reviewError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="order-detail__review-submit"
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? "Submitting..." : "Submit review"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, strong = false }) {
  return (
    <div className={`order-detail__row${strong ? " order-detail__row--strong" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [retryKey, setRetryKey] = useState(0);
  const [reviewRetryKey, setReviewRetryKey] = useState(0);
  const [resultState, setResultState] = useState({
    key: "",
    order: null,
    error: ""
  });
  const requestKey = `${user?.id || ""}:${orderId || ""}:${retryKey}`;
  const reviewRequestKey =
    `${user?.id || ""}:${orderId || ""}:${reviewRetryKey}`;
  const [reviewResultState, setReviewResultState] = useState({
    key: "",
    reviews: null,
    error: ""
  });

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id) return undefined;

    const controller = new AbortController();
    let active = true;

    getCustomerOrderDetails(orderId, controller.signal)
      .then(result => {
        if (active) {
          setResultState({ key: requestKey, order: result, error: "" });
        }
      })
      .catch(requestError => {
        if (!active || requestError?.name === "AbortError") return;
        console.error("Customer order detail loading failed:", requestError);
        setResultState({
          key: requestKey,
          order: null,
          error: requestError?.message || "Unable to load order details."
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [authLoading, isAuthenticated, orderId, requestKey, user?.id]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id || !orderId) {
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    getCustomerOrderReviews(orderId, controller.signal)
      .then(reviews => {
        if (active) {
          setReviewResultState({
            key: reviewRequestKey,
            reviews,
            error: ""
          });
        }
      })
      .catch(requestError => {
        if (!active || requestError?.name === "AbortError") return;
        console.error("Customer order reviews loading failed:", requestError);
        setReviewResultState({
          key: reviewRequestKey,
          reviews: null,
          error: requestError?.message || "Unable to load your order reviews."
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    authLoading,
    isAuthenticated,
    orderId,
    reviewRequestKey,
    user?.id
  ]);

  const currentResult =
    resultState.key === requestKey ? resultState : null;
  const order = currentResult?.order;
  const error = currentResult?.error || "";
  const currentReviewResult =
    reviewResultState.key === reviewRequestKey
      ? reviewResultState
      : null;
  const orderReviews = currentReviewResult?.reviews ?? null;
  const reviewLookupError = currentReviewResult?.error || "";

  if (authLoading || (isAuthenticated && !currentResult)) {
    return (
      <main className="orders-page orders-page--state">
        <div className="orders-state" role="status">
          <span className="orders-spinner" />
          <p>Loading order details...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="orders-page orders-page--state">
        <div className="orders-state">
          <div className="orders-state__icon"><CreditCard size={26} /></div>
          <h1>Sign In Required</h1>
          <p>Sign in to view details for this order.</p>
          <Link className="orders-primary-link" to="/login">Sign In</Link>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="orders-page orders-page--state">
        <div className="orders-state">
          <div className="orders-state__icon">
            {error ? <XCircle size={26} /> : <Package size={26} />}
          </div>
          <h1>{error ? "Order Error" : "Order Not Found"}</h1>
          <p>{error || "This order could not be located in your history."}</p>
          {error ? (
            <button
              className="orders-primary-link"
              onClick={() => setRetryKey(value => value + 1)}
              type="button"
            >
              Try Again
            </button>
          ) : (
            <Link className="orders-primary-link" to="/orders">
              Back to Orders
            </Link>
          )}
        </div>
      </main>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const reviewsByOrderItemId = new Map(
    (orderReviews || []).map(review => [
      String(review.order_item_id),
      review
    ])
  );
  const currency = order.currency || "INR";
  const orderNumber = getOrderNumber(order);
  const orderStatus = readableStatus(order.status || "placed");

  return (
    <main className="orders-page">
      <div className="orders-container order-detail">
        <Link className="orders-page__back" to="/orders">
          <ArrowLeft size={15} />
          Back to My Orders
        </Link>

        <header className="order-detail__header">
          <div>
            <span className="orders-page__eyebrow">PURCHASE HISTORY</span>
            <h1>Order Details</h1>
            <p>{orderNumber}</p>
          </div>
          <div className="order-detail__header-actions">
            <span className={`orders-status orders-status--${getStatusTone(order.status)}`}>
              <CheckCircle2 size={14} />
              {orderStatus}
            </span>
            <button
              type="button"
              className="orders-refresh-button"
              onClick={() => {
                setRetryKey(value => value + 1);
                setReviewRetryKey(value => value + 1);
              }}
              aria-label="Refresh order details"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </header>

        <section className="order-detail__card">
          <div className="order-detail__section-heading">
            <Package size={18} />
            <h2>Purchased Products</h2>
          </div>
          {orderReviews === null && !reviewLookupError && (
            <p className="order-detail__review-query" role="status">
              Checking for your reviews...
            </p>
          )}
          {reviewLookupError && (
            <div className="order-detail__review-query order-detail__review-query--error" role="alert">
              <span>{reviewLookupError}</span>
              <button
                type="button"
                className="order-detail__review-toggle"
                onClick={() => setReviewRetryKey(value => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {items.length ? (
            <div className="order-detail__products">
              {items.map((item, index) => (
                <OrderProduct
                  item={item}
                  currency={currency}
                  canReview={
                    normalizeStatus(order.status) === "delivered" &&
                    Array.isArray(orderReviews)
                  }
                  review={reviewsByOrderItemId.get(String(item.id))}
                  key={item.id || `${item.product_id || "item"}-${index}`}
                />
              ))}
            </div>
          ) : (
            <p className="orders-muted">Item details are not available for this order.</p>
          )}
          <div className="order-detail__meta">
            <div>
              <span>ORDER ID</span>
              <strong>{orderNumber}</strong>
            </div>
            <div>
              <span>STATUS</span>
              <strong>{orderStatus}</strong>
            </div>
          </div>
        </section>

        <OrderTracking status={order.status} />

        <div className="order-detail__grid">
          <section className="order-detail__card">
            <div className="order-detail__section-heading">
              <CreditCard size={18} />
              <h2>Payment Summary</h2>
            </div>
            <div className="order-detail__rows">
              <DetailRow label="Subtotal" value={formatMoney(order.subtotal, currency)} />
              {Number(order.shipping) > 0 && (
                <DetailRow label="Shipping" value={formatMoney(order.shipping, currency)} />
              )}
              {order.coupon_code && (
                <DetailRow label="Coupon" value={order.coupon_code} />
              )}
              {Number(order.discount ?? order.discount_amount) > 0 && (
                <DetailRow
                  label={order.coupon_code ? "Coupon discount" : "Discount"}
                  value={`− ${formatMoney(order.discount ?? order.discount_amount, currency)}`}
                />
              )}
              {Number(order.tax) > 0 && (
                <DetailRow label="Tax" value={formatMoney(order.tax, currency)} />
              )}
              <DetailRow
                label="Grand Total"
                value={formatMoney(order.total_amount, currency)}
                strong
              />
              <DetailRow
                label="Payment Method"
                value={String(order.payment_method || "COD").replace(/[_-]/g, " ")}
              />
              {order.payment_status && (
                <DetailRow
                  label="Payment Status"
                  value={String(order.payment_status).replace(/[_-]/g, " ")}
                />
              )}
            </div>
          </section>

          <section className="order-detail__card">
            <div className="order-detail__section-heading">
              <MapPin size={18} />
              <h2>Delivery Address</h2>
            </div>
            <AddressLines address={order.shipping_address} />
          </section>
        </div>

        <OrderManagementActions order={order} />

        <Link className="order-detail__help" to="/contact">
          <span className="order-detail__help-icon"><Headphones size={20} /></span>
          <span>
            <strong>Need help with this order?</strong>
            <small>Get support for returns, exchanges or other queries.</small>
          </span>
          <ArrowLeft className="order-detail__help-arrow" size={17} />
        </Link>
      </div>
    </main>
  );
}
