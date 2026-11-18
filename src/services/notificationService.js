import api from "./api";

export async function getCustomerNotifications({
  limit = 10,
  offset = 0,
  signal,
} = {}) {
  const result = await api.get("/notifications", {
    params: { limit, offset },
    signal,
  });

  if (
    !result ||
    !Array.isArray(result.items) ||
    !Number.isInteger(result.unread_count) ||
    !Number.isInteger(result.total)
  ) {
    throw new Error("The notification response was invalid.");
  }

  return {
    items: result.items,
    unreadCount: result.unread_count,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function markCustomerNotificationRead(notificationId) {
  if (!notificationId) {
    throw new Error("Notification ID is required.");
  }

  return api.patch(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
  );
}

export async function markAllCustomerNotificationsRead() {
  return api.patch("/notifications/read-all", {});
}
