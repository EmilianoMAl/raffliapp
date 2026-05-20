import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = (userId: string | null) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) { console.error(error); return; }

    const notifs = (data || []) as Notification[];
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.is_read).length);
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    if (!userId) return;
    await supabase.from("notifications").delete().eq("user_id", userId);
    setNotifications([]);
    setUnreadCount(0);
  };

  const deleteOne = async (notificationId: string) => {
    const notif = notifications.find(n => n.id === notificationId);
    await supabase.from("notifications").delete().eq("id", notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (notif && !notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, loadNotifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    deleteOne,
    loadNotifications,
  };
};
