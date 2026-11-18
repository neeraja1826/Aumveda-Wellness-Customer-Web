const APPLIED_COUPON_STORAGE_KEY = "aumveda_applied_coupon";

export function getAppliedCoupon() {
  try {
    const stored = sessionStorage.getItem(APPLIED_COUPON_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Unable to read the applied coupon:", error);
    return null;
  }
}

export function saveAppliedCoupon(coupon) {
  sessionStorage.setItem(
    APPLIED_COUPON_STORAGE_KEY,
    JSON.stringify(coupon)
  );
}

export function clearAppliedCoupon() {
  sessionStorage.removeItem(APPLIED_COUPON_STORAGE_KEY);
}
