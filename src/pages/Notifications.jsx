import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import {
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "../services/notificationService";

import "../styles/notifications.css";

const PAGE_SIZE = 20;

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getNotificationDestination(notification) {
  if (notification.reference_type === "order" && notification.reference_id) {
    return `/orders/${encodeURIComponent(notification.reference_id)}`;
  }

  if (notification.reference_type === "return_request") {
    return "/orders";
  }

  return null;
}

export default function Notifications() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationData, setNotificationData] = useState({
    userId: null,
    items: [],
    total: 0,
    unreadCount: 0,
    loaded: false,
  });
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasCurrentData = notificationData.userId === userId;
  const notifications = hasCurrentData ? notificationData.items : [];
  const total = hasCurrentData ? notificationData.total : 0;
  const unreadCount = hasCurrentData ? notificationData.unreadCount : 0;
  const isInitialLoading =
    !hasCurrentData || !notificationData.loaded;
  const selectedNotificationId = searchParams.get("notification");
  const selectedNotification = notifications.find(
    (notification) => String(notification.id) === selectedNotificationId,
  );

  const refreshNotifications = useCallback(
    async (signal) => {
      if (!userId) return;

      setRefreshing(true);
      try {
        const result = await getCustomerNotifications({
          limit: PAGE_SIZE,
          signal,
        });

        setNotificationData((previous) => {
          const previousItems =
            previous.userId === userId ? previous.items : [];
          const freshIds = new Set(
            result.items.map((notification) => String(notification.id)),
          );
          const olderItems = previousItems.filter(
            (notification) => !freshIds.has(String(notification.id)),
          );

          return {
            userId,
            items: [...result.items, ...olderItems],
            total: result.total,
            unreadCount: result.unreadCount,
            loaded: true,
          };
        });
        setError("");
      } catch (requestError) {
        if (requestError?.name !== "AbortError") {
          console.error("Unable to load customer notifications:", requestError);
          setError(
            requestError?.message || "Unable to load notifications right now.",
          );
          setNotificationData((previous) =>
            previous.userId === userId
              ? { ...previous, loaded: true }
              : {
                  userId,
                  items: [],
                  total: 0,
                  unreadCount: 0,
                  loaded: true,
                },
          );
        }
      } finally {
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated || !userId) return undefined;

    const controller = new AbortController();
    const refresh = () => refreshNotifications(controller.signal);
    refresh();

    const intervalId = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [authLoading, isAuthenticated, refreshNotifications, userId]);

  async function loadMoreNotifications() {
    if (!userId || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = await getCustomerNotifications({
        limit: PAGE_SIZE,
        offset: notifications.length,
      });

      setNotificationData((previous) => {
        const existingIds = new Set(
          previous.userId === userId
            ? previous.items.map((notification) => String(notification.id))
            : [],
        );

        return {
          userId,
          items: [
            ...(previous.userId === userId ? previous.items : []),
            ...result.items.filter(
              (notification) => !existingIds.has(String(notification.id)),
            ),
          ],
          total: result.total,
          unreadCount: result.unreadCount,
          loaded: true,
        };
      });
      setError("");
    } catch (requestError) {
      console.error("Unable to load more customer notifications:", requestError);
      setError(
        requestError?.message || "Unable to load more notifications right now.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function openNotification(notification) {
    setSearchParams({ notification: String(notification.id) });
    if (notification.is_read) return;

    try {
      await markCustomerNotificationRead(notification.id);
      setNotificationData((previous) =>
        previous.userId === userId
          ? {
              ...previous,
              items: previous.items.map((item) =>
                item.id === notification.id ? { ...item, is_read: true } : item,
              ),
              unreadCount: Math.max(0, previous.unreadCount - 1),
            }
          : previous,
      );
      setError("");
    } catch (requestError) {
      console.error("Unable to mark notification as read:", requestError);
      setError(
        requestError?.message || "Unable to mark this notification as read.",
      );
    }
  }

  async function markAllRead() {
    try {
      await markAllCustomerNotificationsRead();
      setNotificationData((previous) =>
        previous.userId === userId
          ? {
              ...previous,
              items: previous.items.map((item) => ({ ...item, is_read: true })),
              unreadCount: 0,
            }
          : previous,
      );
      setError("");
    } catch (requestError) {
      console.error("Unable to mark all notifications as read:", requestError);
      setError(
        requestError?.message || "Unable to mark notifications as read.",
      );
    }
  }

  function closeNotification() {
    setSearchParams({});
  }

  if (authLoading) {
    return (
      <main className="notifications-page">
        <div className="notifications-page__state" role="status">
          <span className="discovery-page__spinner" />
          <p>Loading your account...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="notifications-page">
        <div className="notifications-page__state">
          <Bell size={30} aria-hidden="true" />
          <h1>Sign in to view notifications</h1>
          <p>Your order and account updates will appear here.</p>
          <Link
            className="notifications-page__primary-link"
            to="/login"
            state={{ from: { pathname: "/notifications" } }}
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="notifications-page">
      <div className="notifications-page__container">
        <header className="notifications-page__header">
          <div>
            <span className="notifications-page__eyebrow">
              <Bell size={15} aria-hidden="true" />
              YOUR ACCOUNT
            </span>
            <h1>Notifications</h1>
            <p>Stay up to date with your orders and account activity.</p>
          </div>
          <div className="notifications-page__toolbar">
            <button
              className="notifications-page__toolbar-button"
              type="button"
              onClick={() => refreshNotifications()}
              disabled={refreshing}
              aria-label="Refresh notifications"
              title="Refresh notifications"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "is-spinning" : ""}
                aria-hidden="true"
              />
            </button>
            <button
              className="notifications-page__toolbar-button notifications-page__mark-all"
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0 || isInitialLoading}
            >
              <CheckCheck size={16} aria-hidden="true" />
              Mark all as read
            </button>
          </div>
        </header>

        {error && (
          <div className="notifications-page__error" role="alert">
            {error}
          </div>
        )}

        <div className="notifications-page__summary" aria-live="polite">
          <span>
            {total} {total === 1 ? "notification" : "notifications"}
          </span>
          {unreadCount > 0 && (
            <span className="notifications-page__unread-count">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div
          className={`notifications-page__content ${
            selectedNotificationId
              ? "notifications-page__content--detail-open"
              : ""
          }`}
        >
          <section
            className="notifications-page__list"
            aria-label="All notifications"
          >
            {isInitialLoading ? (
              <div className="notifications-page__state" role="status">
                <span className="discovery-page__spinner" />
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notifications-page__state">
                <Bell size={28} aria-hidden="true" />
                <h2>No notifications yet</h2>
                <p>We will let you know when there is an update.</p>
              </div>
            ) : (
              <>
                <ul>
                  {notifications.map((notification) => {
                    const isSelected =
                      String(notification.id) === selectedNotificationId;

                    return (
                      <li key={notification.id}>
                        <button
                          className={`notifications-page__item ${
                            notification.is_read
                              ? ""
                              : "notifications-page__item--unread"
                          } ${
                            isSelected
                              ? "notifications-page__item--selected"
                              : ""
                          }`}
                          type="button"
                          onClick={() => openNotification(notification)}
                          aria-current={isSelected ? "true" : undefined}
                        >
                          <span className="notifications-page__item-indicator">
                            {notification.is_read ? (
                              <Check size={15} aria-hidden="true" />
                            ) : (
                              <span aria-label="Unread" />
                            )}
                          </span>
                          <span className="notifications-page__item-copy">
                            <span className="notifications-page__item-title">
                              {notification.title}
                            </span>
                            <span className="notifications-page__item-message">
                              {notification.message}
                            </span>
                            <span className="notifications-page__item-time">
                              <Clock3 size={13} aria-hidden="true" />
                              {formatNotificationTime(notification.created_at)}
                            </span>
                          </span>
                          <ChevronRight
                            className="notifications-page__item-arrow"
                            size={18}
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {notifications.length < total && (
                  <button
                    className="notifications-page__load-more"
                    type="button"
                    onClick={loadMoreNotifications}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load older notifications"}
                  </button>
                )}
              </>
            )}
          </section>

          <section
            className="notifications-page__detail"
            aria-label="Notification details"
            aria-live="polite"
          >
            {selectedNotification ? (
              <article>
                <button
                  className="notifications-page__detail-back"
                  type="button"
                  onClick={closeNotification}
                >
                  Back to all notifications
                </button>
                <span className="notifications-page__detail-eyebrow">
                  {selectedNotification.is_read ? "Notification" : "Unread"}
                </span>
                <h2>{selectedNotification.title}</h2>
                <time dateTime={selectedNotification.created_at}>
                  {formatNotificationTime(selectedNotification.created_at)}
                </time>
                <p>{selectedNotification.message}</p>
                {getNotificationDestination(selectedNotification) && (
                  <button
                    className="notifications-page__primary-link"
                    type="button"
                    onClick={() =>
                      navigate(
                        getNotificationDestination(selectedNotification),
                      )
                    }
                  >
                    {selectedNotification.reference_type === "order"
                      ? "View order"
                      : "View my orders"}
                  </button>
                )}
              </article>
            ) : selectedNotificationId ? (
              <div className="notifications-page__state">
                <h2>Notification not found</h2>
                <p>Load older notifications to find this update.</p>
                <button type="button" onClick={closeNotification}>
                  Back to notifications
                </button>
              </div>
            ) : (
              <div className="notifications-page__detail-empty">
                <Bell size={30} aria-hidden="true" />
                <h2>Choose a notification</h2>
                <p>Select an update to read its full details.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
