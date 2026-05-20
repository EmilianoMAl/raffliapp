import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface FriendProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: FriendProfile;
  receiver?: FriendProfile;
}

export const useFriends = (userId: string | null) => {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadFriends = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("friends")
        .select("*")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (error) throw error;

      const friendIds = (data || []).map(f =>
        f.user_id === userId ? f.friend_id : f.user_id
      );

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", friendIds);

      setFriends(profiles || []);
    } catch (err) {
      console.error("Error loading friends:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadRequests = useCallback(async () => {
    if (!userId) return;

    const [inRes, outRes] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("*")
        .eq("receiver_id", userId)
        .eq("status", "pending"),
      supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", userId)
        .eq("status", "pending"),
    ]);

    // Fetch sender profiles for incoming
    const senderIds = (inRes.data || []).map(r => r.sender_id);
    const receiverIds = (outRes.data || []).map(r => r.receiver_id);
    const allIds = [...new Set([...senderIds, ...receiverIds])];

    let profilesMap: Record<string, FriendProfile> = {};
    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", allIds);
      (profiles || []).forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    setIncomingRequests(
      (inRes.data || []).map(r => ({
        ...r,
        sender: profilesMap[r.sender_id],
      }))
    );
    setOutgoingRequests(
      (outRes.data || []).map(r => ({
        ...r,
        receiver: profilesMap[r.receiver_id],
      }))
    );
  }, [userId]);

  const searchUsers = async (query: string, blockedIds?: Set<string>): Promise<FriendProfile[]> => {
    if (!query.trim() || !userId) return [];

    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .ilike("display_name", `%${query}%`)
      .neq("id", userId)
      .limit(20);

    if (blockedIds && blockedIds.size > 0) {
      return (data || []).filter(u => !blockedIds.has(u.id));
    }
    return data || [];
  };

  const sendFriendRequest = async (targetId: string, blockedIds?: Set<string>) => {
    if (!userId) return;

    // Check if blocked
    if (blockedIds?.has(targetId)) {
      toast({ title: "Cannot send request to this user", variant: "destructive" });
      return;
    }

    // Check if already friends
    const isFriend = friends.some(f => f.id === targetId);
    if (isFriend) {
      toast({ title: "Already friends!" });
      return;
    }

    // Check if a pending request already exists
    const isPending = outgoingRequests.some(r => r.receiver_id === targetId);
    if (isPending) {
      toast({ title: "Request already sent", description: "Waiting for them to accept." });
      return;
    }

    // Send a pending friend request (must be accepted by receiver)
    const { error } = await supabase.from("friend_requests").insert({
      sender_id: userId,
      receiver_id: targetId,
      status: "pending",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Notify the other user about the request
    await supabase.from("notifications").insert({
      user_id: targetId,
      type: "friend_request",
      title: "New friend request!",
      body: "Someone wants to be your friend 🏌️",
      reference_id: userId,
    });

    toast({ title: "Friend request sent! 📨" });
    await loadRequests();
  };

  const acceptRequest = async (requestId: string, senderId: string) => {
    if (!userId) return;

    const { error: updateError } = await supabase
      .from("friend_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
      return;
    }

    // Create bidirectional friendship
    const { error: friendError } = await supabase.from("friends").insert([
      { user_id: userId, friend_id: senderId },
    ]);

    if (friendError) {
      console.error("Error creating friendship:", friendError);
    }

    // Notify sender
    await supabase.from("notifications").insert({
      user_id: senderId,
      type: "friend_accepted",
      title: "Friend request accepted!",
      body: "You have a new friend!",
      reference_id: userId,
    });

    toast({ title: "Friend added! 🎉" });
    await Promise.all([loadFriends(), loadRequests()]);
  };

  const declineRequest = async (requestId: string) => {
    await supabase
      .from("friend_requests")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    toast({ title: "Request declined" });
    await loadRequests();
  };

  const removeFriend = async (friendId: string) => {
    if (!userId) return;

    await supabase
      .from("friends")
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

    toast({ title: "Friend removed" });
    await loadFriends();
  };

  useEffect(() => {
    if (userId) {
      loadFriends();
      loadRequests();
    }
  }, [userId, loadFriends, loadRequests]);

  // Realtime subscription for friend requests
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("friend-requests")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "friend_requests",
      }, () => {
        loadRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, loadRequests]);

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    searchUsers,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    loadFriends,
    loadRequests,
  };
};
