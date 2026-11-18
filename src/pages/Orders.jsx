
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  MapPin,
  Package,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Truck,
  UserRound,
  Wallet,
  XCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import {
  createCustomerReturnRequest,
  downloadCustomerOrderInvoice,
  getCustomerOrders,
  getCustomerOrderDetails,
  getCustomerOrderReturnRequests
} from "../services/orderService";

import "../styles/orders.css";

/* ============================================================
   AUMVEDA CUSTOMER ORDERS

   - Authenticated order history
   - Dynamic status filters
   - Expandable order details
   - Ordered products
   - Delivery address
   - Payment information
   - Status history
   - Refresh without closing expanded orders
   - Preserve selected status filter
   - Fetch latest details when reopening orders
============================================================ */

const CURRENCY_FALLBACK = "INR";

const STATUS_ICONS = {
  placed: ShoppingBag,
  pending: Package,
  confirmed: CheckCircle2,
  processing: Package,
  packed: Package,
  shipped: Truck,
  partially_shipped: Truck,
  out_for_delivery: Truck,
  delivered: PackageCheck,
  completed: PackageCheck,
  cancelled: XCircle,
  canceled: XCircle,
  failed: XCircle,
  returned: Package
};

function normalizeStatus(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function readableStatus(value) {
  return normalizeStatus(value)
    .split("_")
    .map(word =>
      word ? word[0].toUpperCase() + word.slice(1) : ""
    )
    .join(" ");
}

function getLatestReturnRequestByOrder(requests) {
  return requests.reduce((latestByOrder, request) => {
    if (!request?.order_id) return latestByOrder;

    const key = String(request.order_id);
    const existing = latestByOrder.get(key);
    const requestTime = Date.parse(
      request.updated_at || request.created_at || ""
    );
    const existingTime = Date.parse(
      existing?.updated_at || existing?.created_at || ""
    );

    if (
      !existing ||
      (Number.isFinite(requestTime) &&
        (!Number.isFinite(existingTime) || requestTime > existingTime))
    ) {
      latestByOrder.set(key, request);
    }

    return latestByOrder;
  }, new Map());
}

function formatReturnRequestType(requestType) {
  return requestType === "replacement" ? "Exchange" : "Return";
}

function formatReturnRequestStatus(request) {
  const status = normalizeStatus(request.status);

  if (status === "under_review" || status === "approved") {
    return "Request processing";
  }
  if (status === "replacement_processing") {
    return "Exchange processing";
  }
  if (status === "completed") {
    return request.request_type === "replacement"
      ? "Exchange complete"
      : "Refund complete";
  }
  if (status === "rejected") {
    return "Request declined";
  }

  return readableStatus(status);
}

function ReturnRequestTracking({ request }) {
  const isExchange = request.request_type === "replacement";
  const status = normalizeStatus(request.status);
  const steps = [
    "Request submitted",
    "Pickup scheduled",
    "Item received",
    isExchange ? "Exchange processing" : "Refund processing",
    isExchange ? "Exchange complete" : "Refund complete"
  ];
  const activeStepByStatus = {
    requested: 0,
    under_review: 0,
    approved: 0,
    pickup_scheduled: 1,
    item_received: 2,
    replacement_processing: 3,
    refund_processing: 3,
    completed: 4
  };

  if (status === "rejected" || status === "cancelled") {
    return (
      <div className="orders-return-tracking orders-return-tracking--terminal">
        <strong>{formatReturnRequestType(request.request_type)} request {status}</strong>
        <p>
          {status === "rejected"
            ? "This request could not be completed."
            : "The request was cancelled."}
        </p>
      </div>
    );
  }

  const activeStep = activeStepByStatus[status] ?? 0;
  const progress = `${(activeStep / (steps.length - 1)) * 100}%`;

  return (
    <div className="orders-return-tracking">
      <strong>{isExchange ? "Exchange tracking" : "Refund tracking"}</strong>
      <ol
        className="order-tracking__steps"
        style={{ "--order-tracking-progress": progress }}
      >
        {steps.map((step, index) => (
          <li
            className={"order-tracking__step" +
              (index <= activeStep ? " order-tracking__step--complete" : "")}
            aria-current={index === activeStep ? "step" : undefined}
            key={step}
          >
            <span className="order-tracking__node" aria-hidden="true">
              {index <= activeStep ? <Check size={14} /> : null}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p>
        {isExchange
          ? "Track the pickup of your original item and delivery of the exchange here."
          : "Track your item pickup and refund progress here."}
      </p>
    </div>
  );
}

function formatMoney(value, currency = CURRENCY_FALLBACK) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: String(currency || CURRENCY_FALLBACK).trim(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch {
    return `₹${safeAmount.toFixed(2)}`;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit" }
      : {})
  });
}

function formatPaymentMethod(value) {
  const method = normalizeStatus(value);

  if (method === "cod") return "Cash on Delivery";
  if (method === "online") return "Online Payment";

  return readableStatus(method);
}

function getStatusTone(status) {
  const value = normalizeStatus(status);

  if (
    ["delivered", "completed", "paid", "success"].includes(value)
  ) {
    return "success";
  }

  if (
    ["cancelled", "canceled", "failed", "refunded"].includes(value)
  ) {
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
    ].includes(value)
  ) {
    return "progress";
  }

  return "pending";
}

function StatusBadge({ status }) {
  const Icon =
    STATUS_ICONS[normalizeStatus(status)] || Package;

  return (
    <span
      className={`orders-status orders-status--${getStatusTone(status)}`}
    >
      <Icon size={13} />
      {readableStatus(status)}
    </span>
  );
}

function DetailRow({ label, value, strong = false }) {
  return (
    <div className="orders-detail-row">
      <span>{label}</span>
      <strong
        className={
          strong ? "orders-detail-row--strong" : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

function AddressDetails({ address }) {
  if (!address || typeof address !== "object") {
    return (
      <p className="orders-muted">
        Not available
      </p>
    );
  }

  const recipient =
    address.recipient_name ||
    address.recipientName ||
    address.full_name ||
    address.fullName ||
    address.name ||
    "";

  const phone = address.phone || "";

  const line1 =
    address.address_line1 ||
    address.addressLine1 ||
    address.line1 ||
    "";

  const line2 =
    address.address_line2 ||
    address.addressLine2 ||
    address.line2 ||
    "";

  const location = [
    address.city,
    address.state,
    address.postal_code ||
      address.postalCode ||
      address.pincode
  ]
    .filter(Boolean)
    .join(", ");

  const country = address.country || "";

  const lines = [
    recipient,
    phone,
    line1,
    line2,
    location,
    country
  ].filter(Boolean);

  if (!lines.length) {
    return (
      <p className="orders-muted">
        Not available
      </p>
    );
  }

  return (
    <address className="orders-address">
      {lines.map((line, index) => (
        <span key={`${index}-${line}`}>
          {line}
        </span>
      ))}
    </address>
  );
}

function OrderItems({ items, currency }) {
  if (!Array.isArray(items) || !items.length) {
    return (
      <p className="orders-muted">
        Item details are not available for this order.
      </p>
    );
  }

  return (
    <div className="orders-items">
      {items.map((item, index) => (
        <div
          className="orders-item"
          key={item.id || `${item.product_id}-${index}`}
        >
          <div className="orders-item__icon">
            <Package size={20} />
          </div>

          <div className="orders-item__information">
            <strong>
              {item.product_name || "Product"}
            </strong>

            {item.variant_name && (
              <small>
                {item.variant_name}
              </small>
            )}

            {item.sku && (
              <small>
                SKU: {item.sku}
              </small>
            )}

            <span>
              Qty: {item.quantity} ×{" "}
              {formatMoney(item.unit_price, currency)}
            </span>
          </div>

          <div className="orders-item__right">
            <strong>
              {formatMoney(
                item.total_price,
                currency
              )}
            </strong>

            {item.status && (
              <span>
                {readableStatus(item.status)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderHistory({ history, currentStatus }) {
  const entries = Array.isArray(history)
    ? [...history].sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      )
    : [];

  if (!entries.length) {
    return (
      <div className="orders-history-empty">
        <StatusBadge status={currentStatus} />
        <p>
          Detailed tracking updates are not available yet.
        </p>
      </div>
    );
  }

  return (
    <ol className="orders-timeline">
      {entries.map((entry, index) => (
        <li
          className="orders-timeline__item"
          key={entry.id || index}
        >
          <span className="orders-timeline__dot" />

          <div>
            <strong>
              {readableStatus(entry.status)}
            </strong>

            <small>
              {formatDate(
                entry.created_at,
                true
              )}
            </small>

            {entry.notes && (
              <p>
                {entry.notes}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function OrderPayments({ payments, order }) {
  const entries = Array.isArray(payments)
    ? payments
    : [];

  if (!entries.length) {
    return (
      <div className="orders-payment-summary">
        <DetailRow
          label="Payment Method"
          value={formatPaymentMethod(
            order.payment_method
          )}
        />

        <DetailRow
          label="Payment Status"
          value={readableStatus(
            order.payment_status
          )}
        />
      </div>
    );
  }

  return (
    <div className="orders-payment-list">
      {entries.map((payment, index) => (
        <div
          className="orders-payment-entry"
          key={payment.id || index}
        >
          <DetailRow
            label="Method"
            value={formatPaymentMethod(
              payment.payment_method
            )}
          />

          <DetailRow
            label="Amount"
            value={formatMoney(
              payment.amount,
              payment.currency || order.currency
            )}
          />

          <DetailRow
            label="Status"
            value={readableStatus(
              payment.status
            )}
          />

          <DetailRow
            label="Date"
            value={formatDate(
              payment.created_at
            )}
          />
        </div>
      ))}
    </div>
  );
}

export function OrderManagementActions({ order }) {
  const [returnRequests, setReturnRequests] = useState([]);
  const [returnLoading, setReturnLoading] = useState(true);
  const [returnError, setReturnError] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [formItemId, setFormItemId] = useState(null);
  const [requestType, setRequestType] = useState("return");
  const [requestedQuantity, setRequestedQuantity] = useState("1");
  const [reason, setReason] = useState("damaged_product");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  useEffect(() => {
    let active = true;

    getCustomerOrderReturnRequests(order.id)
      .then(requests => {
        if (active) setReturnRequests(requests);
      })
      .catch(requestError => {
        console.error("Order return requests failed:", requestError);
        if (active) {
          setReturnError(
            requestError?.message ||
            "Unable to load return details."
          );
        }
      })
      .finally(() => {
        if (active) setReturnLoading(false);
      });

    return () => {
      active = false;
    };
  }, [order.id]);

  async function handleInvoiceDownload() {
    try {
      setInvoiceLoading(true);
      setInvoiceError("");

      const invoice = await downloadCustomerOrderInvoice(order.id);
      const url = window.URL.createObjectURL(invoice);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${order.order_number || order.id}-invoice.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      console.error("Order invoice download failed:", downloadError);
      setInvoiceError(
        downloadError?.message ||
        "Unable to download the invoice."
      );
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function handleReturnSubmit(event, item) {
    event.preventDefault();
    const quantity = Number(requestedQuantity);
    const availableQuantity = Number(item.quantity) || 0;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > availableQuantity
    ) {
      setSubmitError(
        `Enter a quantity between 1 and ${availableQuantity}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      setSubmitSuccess("");

      await createCustomerReturnRequest({
        orderId: order.id,
        orderItemId: item.id,
        requestType,
        requestedQuantity: quantity,
        reason,
        description
      });

      const requests =
        await getCustomerOrderReturnRequests(order.id);
      setReturnRequests(requests);
      setFormItemId(null);
      setDescription("");
      setRequestedQuantity("1");
      setSubmitSuccess("Your request has been submitted.");
    } catch (requestError) {
      console.error("Order return request failed:", requestError);
      setSubmitError(
        requestError?.message ||
        "Unable to submit your request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const canRequestReturn =
    normalizeStatus(order.status) === "delivered";

  return (
    <section className="orders-expanded-section orders-actions-section">
      <div className="orders-section-heading">
        <RotateCcw size={17} />
        <h3>Invoices & Returns</h3>
      </div>

      <button
        type="button"
        className="orders-action-button"
        onClick={handleInvoiceDownload}
        disabled={invoiceLoading}
      >
        <Download size={15} />
        {invoiceLoading ? "Preparing invoice..." : "Download Invoice"}
      </button>
      {invoiceError && (
        <p className="orders-action-error" role="alert">{invoiceError}</p>
      )}

      {returnLoading ? (
        <p className="orders-muted">Loading return information...</p>
      ) : returnError ? (
        <p className="orders-action-error" role="alert">{returnError}</p>
      ) : canRequestReturn || returnRequests.length > 0 ? (
        <div className="orders-return-list">
          {items.map((item, index) => {
            const existingRequest = returnRequests.find(
              request =>
                String(request.order_item_id) === String(item.id)
            );
            const isOpen = String(formItemId) === String(item.id);

            return (
              <div
                className="orders-return-item"
                key={item.id || `${item.product_id}-${index}`}
              >
                <div>
                  <strong>{item.product_name || "Ordered product"}</strong>
                  {existingRequest ? (
                    <>
                      <span>
                        {formatReturnRequestType(existingRequest.request_type)} request
                        {" · "}
                        {formatReturnRequestStatus(existingRequest)}
                      </span>
                      <ReturnRequestTracking request={existingRequest} />
                    </>
                  ) : (
                    <span>Qty: {item.quantity}</span>
                  )}
                </div>

                {!existingRequest && item.id && canRequestReturn && (
                  <>
                    <button
                      type="button"
                      className="orders-action-button orders-action-button--secondary"
                      onClick={() => {
                        setFormItemId(isOpen ? null : item.id);
                        setRequestType("return");
                        setRequestedQuantity("1");
                        setReason("damaged_product");
                        setDescription("");
                        setSubmitError("");
                        setSubmitSuccess("");
                      }}
                    >
                      {isOpen ? "Cancel" : "Request Return or Exchange"}
                    </button>

                    {isOpen && (
                      <form
                        className="orders-return-form"
                        onSubmit={event => handleReturnSubmit(event, item)}
                      >
                        <label>
                          Request type
                          <select
                            value={requestType}
                            onChange={event => setRequestType(event.target.value)}
                          >
                            <option value="return">Return</option>
                            <option value="replacement">Exchange</option>
                          </select>
                        </label>
                        <label>
                          Quantity (max {item.quantity})
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={requestedQuantity}
                            onChange={event => setRequestedQuantity(event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Reason
                          <select
                            value={reason}
                            onChange={event => setReason(event.target.value)}
                          >
                            <option value="damaged_product">Damaged product</option>
                            <option value="wrong_item">Wrong item</option>
                            <option value="quality_issue">Quality issue</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label>
                          Additional details (optional)
                          <textarea
                            rows="3"
                            maxLength="1000"
                            value={description}
                            onChange={event => setDescription(event.target.value)}
                          />
                        </label>
                        {submitError && (
                          <p className="orders-action-error" role="alert">{submitError}</p>
                        )}
                        <button
                          type="submit"
                          className="orders-action-button"
                          disabled={submitting}
                        >
                          {submitting ? "Submitting..." : "Submit Request"}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {submitSuccess && (
            <p className="orders-action-success" role="status">{submitSuccess}</p>
          )}
        </div>
      ) : (
        <p className="orders-muted">
          Return and exchange requests are available after delivery.
        </p>
      )}
    </section>
  );
}

function OrderExpandedDetails({
  details,
  loading,
  error,
  onRetry
}) {
  if (loading && !details) {
    return (
      <div className="orders-expanded-loading">
        <span className="orders-spinner" />
        Loading order details...
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="orders-inline-error">
        <p>{error}</p>

        <button
          type="button"
          onClick={onRetry}
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      </div>
    );
  }

  if (!details) return null;

  const currentOrder = details;
  const currency =
    currentOrder.currency || CURRENCY_FALLBACK;

  return (
    <div className="orders-expanded">
      {loading && (
        <div
          className="orders-expanded-loading"
          aria-live="polite"
        >
          <span className="orders-spinner" />
          Updating order details...
        </div>
      )}

      {error && (
        <div
          className="orders-inline-error"
          role="alert"
        >
          <p>{error}</p>

          <button
            type="button"
            onClick={onRetry}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )}

      <section className="orders-expanded-section">
        <div className="orders-section-heading">
          <ShoppingBag size={17} />
          <h3>Ordered Products</h3>
        </div>

        <OrderItems
          items={currentOrder.items}
          currency={currency}
        />
      </section>

      <OrderManagementActions order={currentOrder} />

      <div className="orders-expanded-grid">
        <section className="orders-expanded-section">
          <div className="orders-section-heading">
            <MapPin size={17} />
            <h3>Delivery Address</h3>
          </div>

          <AddressDetails
            address={currentOrder.shipping_address}
          />
        </section>

        <section className="orders-expanded-section">
          <div className="orders-section-heading">
            <CreditCard size={17} />
            <h3>Payment Details</h3>
          </div>

          <OrderPayments
            payments={currentOrder.payments}
            order={currentOrder}
          />
        </section>
      </div>

      <div className="orders-expanded-grid">
        <section className="orders-expanded-section">
          <div className="orders-section-heading">
            <Truck size={17} />
            <h3>Order Updates</h3>
          </div>

          <OrderHistory
            history={currentOrder.status_history}
            currentStatus={currentOrder.status}
          />
        </section>

        <section className="orders-expanded-section">
          <div className="orders-section-heading">
            <Wallet size={17} />
            <h3>Order Summary</h3>
          </div>

          <div className="orders-amount-summary">
            <DetailRow
              label="Subtotal"
              value={formatMoney(
                currentOrder.subtotal,
                currency
              )}
            />

            <DetailRow
              label="Shipping"
              value={formatMoney(
                currentOrder.shipping,
                currency
              )}
            />

            <DetailRow
              label="Discount"
              value={`−${formatMoney(
                currentOrder.discount,
                currency
              )}`}
            />

            <DetailRow
              label="Tax"
              value={formatMoney(
                currentOrder.tax,
                currency
              )}
            />

            <div className="orders-total-line">
              <strong>
                Total
              </strong>

              <strong>
                {formatMoney(
                  currentOrder.total_amount,
                  currency
                )}
              </strong>
            </div>
          </div>
        </section>
      </div>

      {currentOrder.customer_notes && (
        <section className="orders-expanded-section">
          <div className="orders-section-heading">
            <h3>
              Order Notes
            </h3>
          </div>

          <p className="orders-notes">
            {currentOrder.customer_notes}
          </p>
        </section>
      )}
    </div>
  );
}

function OrderCard({
  order,
  returnRequest,
  onOpen,
  expanded,
  details,
  loading,
  error,
  onToggle,
  onRetry
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0];
  const productImages = firstItem?.product?.product_images || [];
  const productImage =
    firstItem?.image_url ||
    firstItem?.product?.image_url ||
    productImages.find(image => image.is_primary)?.image_url ||
    productImages[0]?.image_url;
  const productName =
    firstItem?.product_name ||
    firstItem?.product?.name ||
    "Order items";
  const quantity = Number(firstItem?.quantity) || 1;
  const itemAmount =
    firstItem?.total_price ??
    (Number(firstItem?.unit_price) || 0) * quantity;
  const orderTotal =
    order.total_amount ??
    order.total_price ??
    order.total ??
    order.grand_total ??
    items.reduce(
      (sum, item) =>
        sum +
        (Number(item.total_price) ||
          (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)),
      0
    );

  return (
    <article
      className="orders-card orders-card--clickable"
      role="link"
      tabIndex={0}
      aria-label={`Open order ${order.order_number || order.id}`}
      onClick={onOpen}
      onKeyDown={event => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="orders-card__header">
        <div className="orders-card__identity">
          <span className="orders-card__eyebrow">
            ORDER NUMBER
          </span>

          <h2>
            {order.order_number || order.id}
          </h2>
        </div>

        <StatusBadge status={order.status} />
      </div>

      {returnRequest && (
        <div className="orders-card__return-status">
          <RotateCcw size={14} />
          <span>
            {returnRequest.request_type === "replacement"
            ? "Exchange"
              : "Return"}{" "}
            status: <strong>{formatReturnRequestStatus(returnRequest)}</strong>
          </span>
        </div>
      )}

      <div className="orders-card__product">
        <div className="orders-card__product-image">
          {productImage ? (
            <img src={productImage} alt="" />
          ) : (
            <Package size={23} />
          )}
        </div>
        <div className="orders-card__product-info">
          <strong>{productName}</strong>
          {firstItem?.variant_name && <span>{firstItem.variant_name}</span>}
          {firstItem && (
            <span>
              Qty: {quantity} · {formatMoney(itemAmount, order.currency)}
            </span>
          )}
          {items.length > 1 && (
            <span>
              +{items.length - 1} more{" "}
              {items.length === 2 ? "item" : "items"}
            </span>
          )}
        </div>
      </div>

      <div className="orders-card__details">
        <div>
          <CalendarDays size={15} />

          <span>
            {formatDate(order.created_at)}
          </span>
        </div>

        <div>
          <CreditCard size={15} />

          <span>
            {formatPaymentMethod(
              order.payment_method
            )}
          </span>
        </div>

        <div>
          <Wallet size={15} />

          <span>
            Payment:{" "}
            {readableStatus(
              order.payment_status
            )}
          </span>
        </div>
      </div>

      <div className="orders-card__footer">
        <div className="orders-card__total">
          <span>
            Order Total
          </span>

          <strong>
            {formatMoney(
              orderTotal,
              order.currency
            )}
          </strong>
        </div>

        <div className="orders-card__actions">
          <button
            type="button"
            className="orders-card__quick-toggle"
            onClick={event => {
              event.stopPropagation();
              onToggle(order.id);
            }}
            aria-expanded={expanded}
          >
            {expanded ? "Hide quick view" : "Quick view"}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {expanded && (
        <OrderExpandedDetails
          details={details}
          loading={loading}
          error={error}
          onRetry={() => onRetry(order.id)}
        />
      )}
    </article>
  );
}

/* ============================================================
   MAIN ORDERS PAGE
============================================================ */

function Orders() {
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading,
    isAuthenticated
  } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [returnRequestsByOrder, setReturnRequestsByOrder] = useState(new Map());
  const [returnStatusError, setReturnStatusError] = useState("");

  const hasLoadedOrders = useRef(false);
  const latestDetailRequest = useRef({});
  const detailsController = useRef({});

  const [filter, setFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const [expandedOrderId, setExpandedOrderId] =
    useState(null);

  const [detailsById, setDetailsById] =
    useState({});

  const [detailLoadingId, setDetailLoadingId] =
    useState(null);

  const [detailErrors, setDetailErrors] =
    useState({});

  /* ============================================================
     LOAD CUSTOMER ORDERS
  ============================================================ */

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user?.id) {
      setOrders([]);
      setReturnRequestsByOrder(new Map());
      setReturnStatusError("");
      setLoading(false);
      setRefreshing(false);
      hasLoadedOrders.current = false;
      return;
    }

    const controller = new AbortController();

    async function loadOrders() {
      const firstLoad = !hasLoadedOrders.current;

      if (firstLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      setReturnStatusError("");

      try {
        const [ordersResult, returnRequestsResult] = await Promise.allSettled([
          getCustomerOrders(controller.signal),
          getCustomerOrderReturnRequests()
        ]);

        if (controller.signal.aborted) return;
        if (ordersResult.status === "rejected") {
          throw ordersResult.reason;
        }

        setOrders(ordersResult.value);
        hasLoadedOrders.current = true;

        if (returnRequestsResult.status === "fulfilled") {
          setReturnRequestsByOrder(
            getLatestReturnRequestByOrder(returnRequestsResult.value)
          );
        } else {
          console.error(
            "Customer order return status loading failed:",
            returnRequestsResult.reason
          );
          setReturnRequestsByOrder(new Map());
          setReturnStatusError(
            "Return request statuses could not be loaded."
          );
        }

      } catch (requestError) {
        if (controller.signal.aborted) return;

        console.error(
          "Customer order loading failed:",
          requestError
        );

        setError(
          requestError?.message ||
          "Unable to load your orders."
        );

      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadOrders();

    return () => {
      controller.abort();
    };

  }, [
    authLoading,
    isAuthenticated,
    user?.id,
    refreshKey
  ]);

  /* ============================================================
     CLEAN UP DETAIL REQUESTS
  ============================================================ */

  useEffect(() => {
    return () => {
      Object.values(
        detailsController.current
      ).forEach(controller => {
        controller.abort();
      });

      detailsController.current = {};
    };
  }, [user?.id]);

  /* ============================================================
     DYNAMIC STATUS FILTERS
  ============================================================ */

  const filters = useMemo(() => {
    const statusValues = [
      ...new Set(
        orders.map(order =>
          normalizeStatus(order.status)
        )
      )
    ];

    return [
      {
        value: "all",
        label: "All Orders"
      },

      ...statusValues.sort().map(
        statusValue => ({
          value: statusValue,
          label: readableStatus(statusValue)
        })
      )
    ];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") {
      return orders;
    }

    return orders.filter(
      order =>
        normalizeStatus(order.status) === filter
    );
  }, [orders, filter]);

  /* ============================================================
     LOAD FRESH ORDER DETAILS
  ============================================================ */

  async function loadOrderDetails(orderId) {
    // Cancel an older request for the same order.
    detailsController.current[orderId]?.abort();

    const controller = new AbortController();

    detailsController.current[orderId] =
      controller;

    const requestId =
      (latestDetailRequest.current[orderId] || 0) + 1;

    latestDetailRequest.current[orderId] =
      requestId;

    const isCurrent = () =>
      !controller.signal.aborted &&
      latestDetailRequest.current[orderId] ===
        requestId;

    try {
      setDetailLoadingId(orderId);

      setDetailErrors(previous => ({
        ...previous,
        [orderId]: ""
      }));

      const result =
        await getCustomerOrderDetails(
          orderId,
          controller.signal
        );

      if (!isCurrent()) return;

      // Update the expanded order's data.
      setDetailsById(previous => ({
        ...previous,
        [orderId]: result
      }));

      // Keep its order card status in sync too.
      if (result?.status) {
        setOrders(previous =>
          previous.map(order =>
            order.id === orderId
              ? {
                  ...order,
                  status: result.status,
                  updated_at: result.updated_at
                }
              : order
          )
        );
      }

    } catch (requestError) {
      if (
        !isCurrent() ||
        requestError?.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Customer order details failed:",
        requestError
      );

      setDetailErrors(previous => ({
        ...previous,
        [orderId]:
          requestError?.message ||
          "Unable to load order details."
      }));

    } finally {
      if (isCurrent()) {
        setDetailLoadingId(current =>
          current === orderId
            ? null
            : current
        );

        delete detailsController.current[orderId];
      }
    }
  }

  /* ============================================================
     EXPAND / COLLAPSE ORDER
  ============================================================ */

  function handleToggle(orderId) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(orderId);

    // Always fetch fresh tracking information
    // when opening or reopening an order.
    loadOrderDetails(orderId);
  }

  /* ============================================================
     REFRESH WITHOUT RESETTING THE PAGE
  ============================================================ */

  function refreshOrders() {
    if (loading || refreshing) {
      return;
    }

    // Preserve:
    // - selected filter
    // - expanded order
    // - current order details
    setRefreshKey(value => value + 1);

    if (expandedOrderId) {
      loadOrderDetails(expandedOrderId);
    }
  }

  /* ============================================================
     AUTHENTICATION LOADING
  ============================================================ */

  if (authLoading) {
    return (
      <main className="orders-page orders-page--state">
        <div className="orders-state">
          <span className="orders-spinner" />

          <p>
            Checking your account...
          </p>
        </div>
      </main>
    );
  }

  /* ============================================================
     NOT SIGNED IN
  ============================================================ */

  if (!isAuthenticated) {
    return (
      <main className="orders-page orders-page--state">
        <div className="orders-state">
          <div className="orders-state__icon">
            <UserRound size={28} />
          </div>

          <h1>
            Sign In to View Orders
          </h1>

          <p>
            Access your purchases, delivery information
            and order updates in one place.
          </p>

          <Link
            to="/login"
            className="orders-primary-link"
          >
            Sign In
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  /* ============================================================
     MAIN PAGE
  ============================================================ */

  return (
    <main className="orders-page">
      <div className="orders-container">

        {/* PAGE HEADER */}

        <header className="orders-page__header">
          <div>
            <Link
              to="/profile"
              className="orders-page__back"
            >
              <ArrowLeft size={15} />
              Back to Account
            </Link>

            <span className="orders-page__eyebrow">
              MY ACCOUNT
            </span>

            <h1>
              My Orders
            </h1>

            <p>
              View your purchases and stay updated
              on your order status.
            </p>
          </div>

          <button
            type="button"
            className="orders-refresh-button"
            onClick={refreshOrders}
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </header>

        {/* SUMMARY */}

        <section className="orders-overview">
          <div className="orders-overview__icon">
            <ShoppingBag size={23} />
          </div>

          <div>
            <span>
              YOUR ORDER HISTORY
            </span>

            <strong>
              {loading
                ? "Loading orders..."
                : `${orders.length} ${
                    orders.length === 1
                      ? "Order"
                      : "Orders"
                  }`}
            </strong>
          </div>
        </section>

        {/* REFRESH ERROR */}

        {error && orders.length > 0 && (
          <div
            className="orders-inline-error"
            role="alert"
          >
            <p>
              Could not refresh orders: {error}
            </p>

            <button
              type="button"
              onClick={refreshOrders}
            >
              <RefreshCw size={14} />
              Try Again
            </button>
          </div>
        )}

        {/* LOADING / ERROR / EMPTY STATES */}

        {loading ? (
          <div className="orders-state orders-state--inline">
            <span className="orders-spinner" />
            <p>
              Loading your orders...
            </p>
          </div>

        ) : error && orders.length === 0 ? (
          <div className="orders-state orders-state--inline">
            <div className="orders-state__icon">
              <XCircle size={26} />
            </div>

            <h2>
              Unable to Load Orders
            </h2>

            <p>{error}</p>

            <button
              type="button"
              className="orders-primary-link"
              onClick={refreshOrders}
            >
              <RefreshCw size={15} />
              Try Again
            </button>
          </div>

        ) : orders.length === 0 ? (
          <div className="orders-state orders-state--inline">
            <div className="orders-state__icon">
              <Package size={28} />
            </div>

            <h2>
              No Orders Yet
            </h2>

            <p>
              Your purchases will appear here once
              you place an order.
            </p>

            <Link
              to="/products"
              className="orders-primary-link"
            >
              Explore Products
              <ArrowRight size={16} />
            </Link>
          </div>

        ) : (
          <>
            {/* STATUS FILTERS */}

            <div className="orders-filters">
              {filters.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    "orders-filter" +
                    (filter === option.value
                      ? " orders-filter--active"
                      : "")
                  }
                  onClick={() =>
                    setFilter(option.value)
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* RESULT COUNT */}

            <div className="orders-results-count">
              Showing {filteredOrders.length} of{" "}
              {orders.length} orders
            </div>

            {/* ORDER CARDS */}

            {returnStatusError && (
              <p className="orders-action-error" role="status">
                {returnStatusError}
              </p>
            )}

            {filteredOrders.length ? (
              <div className="orders-list">
                {filteredOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    returnRequest={returnRequestsByOrder.get(String(order.id))}
                    onOpen={() =>
                      navigate(`/orders/${encodeURIComponent(order.id)}`)
                    }
                    expanded={
                      expandedOrderId === order.id
                    }
                    details={
                      detailsById[order.id]
                    }
                    loading={
                      detailLoadingId === order.id
                    }
                    error={
                      detailErrors[order.id]
                    }
                    onToggle={handleToggle}
                    onRetry={loadOrderDetails}
                  />
                ))}
              </div>

            ) : (
              <div className="orders-filter-empty">
                <Package size={25} />

                <h3>
                  No Matching Orders
                </h3>

                <p>
                  There are no orders with this status.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setFilter("all")
                  }
                >
                  View All Orders
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default Orders;
