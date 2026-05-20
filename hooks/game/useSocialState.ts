import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  post_type: string;
  game_id: string | null;
  hole_number: number | null;
  created_at: string;
  visibility: string;
  profiles?: { display_name: string; avatar_url: string | null };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  group_name?: string;
  participants: { user_id: string; display_name: string; avatar_url: string | null }[];
  last_message?: { content: string; created_at: string; sender_id: string };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const useSocialState = (userId: string | null) => {
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [friendsFeedPosts, setFriendsFeedPosts] = useState<Post[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadFeed = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profiles separately since FK points to auth.users not profiles
      const userIds = [...new Set((posts || []).map(p => p.user_id))];
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
        : { data: [] };
      const profilesMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
      (profilesData || []).forEach(p => { profilesMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });

      const postIds = (posts || []).map(p => p.id);
      if (postIds.length === 0) { setFeedPosts([]); return; }

      const [likesRes, userLikesRes, commentsRes] = await Promise.all([
        supabase.from("post_likes").select("post_id").in("post_id", postIds),
        supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
        supabase.from("post_comments").select("post_id").in("post_id", postIds),
      ]);

      const likesMap: Record<string, number> = {};
      (likesRes.data || []).forEach(l => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1; });
      const commentsMap: Record<string, number> = {};
      (commentsRes.data || []).forEach(c => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });
      const userLikedSet = new Set((userLikesRes.data || []).map(l => l.post_id));

      setFeedPosts((posts || []).map(p => ({
        ...p,
        post_type: p.post_type as string,
        profiles: profilesMap[p.user_id] || { display_name: "Unknown", avatar_url: null },
        likes_count: likesMap[p.id] || 0,
        comments_count: commentsMap[p.id] || 0,
        is_liked: userLikedSet.has(p.id),
      })));
    } catch (err) {
      console.error("Error loading feed:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadFriendsFeed = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Get friend IDs first
      const { data: friendRows } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      const friendIds = (friendRows || []).map(f =>
        f.user_id === userId ? f.friend_id : f.user_id
      );

      if (friendIds.length === 0) { setFriendsFeedPosts([]); setLoading(false); return; }

      // Get friends' posts that are public or friends_only (RLS enforces access)
      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .in("user_id", friendIds)
        .in("visibility", ["public", "friends_only"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const userIds = [...new Set((posts || []).map(p => p.user_id))];
      const { data: profilesData } = userIds.length > 0
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
        : { data: [] };
      const profilesMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
      (profilesData || []).forEach(p => { profilesMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });

      const postIds = (posts || []).map(p => p.id);
      if (postIds.length === 0) { setFriendsFeedPosts([]); setLoading(false); return; }

      const [likesRes, userLikesRes, commentsRes] = await Promise.all([
        supabase.from("post_likes").select("post_id").in("post_id", postIds),
        supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
        supabase.from("post_comments").select("post_id").in("post_id", postIds),
      ]);

      const likesMap: Record<string, number> = {};
      (likesRes.data || []).forEach(l => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1; });
      const commentsMap: Record<string, number> = {};
      (commentsRes.data || []).forEach(c => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });
      const userLikedSet = new Set((userLikesRes.data || []).map(l => l.post_id));

      setFriendsFeedPosts((posts || []).map(p => ({
        ...p,
        post_type: p.post_type as string,
        profiles: profilesMap[p.user_id] || { display_name: "Unknown", avatar_url: null },
        likes_count: likesMap[p.id] || 0,
        comments_count: commentsMap[p.id] || 0,
        is_liked: userLikedSet.has(p.id),
      })));
    } catch (err) {
      console.error("Error loading friends feed:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);
  const loadUserPosts = useCallback(async (profileUserId: string) => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) { console.error(error); return; }

    // Fetch profile separately
    const { data: profileData } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", profileUserId).maybeSingle();
    const profile = profileData || { display_name: "Unknown", avatar_url: null };

    const postIds = (data || []).map(p => p.id);
    if (postIds.length === 0) { setUserPosts([]); return; }

    const [likesRes, userLikesRes, commentsRes] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      userId ? supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", userId) : Promise.resolve({ data: [] }),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
    ]);

    const likesMap: Record<string, number> = {};
    (likesRes.data || []).forEach(l => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1; });
    const commentsMap: Record<string, number> = {};
    (commentsRes.data || []).forEach(c => { commentsMap[c.post_id] = (commentsMap[c.post_id] || 0) + 1; });
    const userLikedSet = new Set(((userLikesRes as any).data || []).map((l: any) => l.post_id));

    setUserPosts((data || []).map(p => ({
      ...p,
      post_type: p.post_type as string,
      profiles: profile,
      likes_count: likesMap[p.id] || 0,
      comments_count: commentsMap[p.id] || 0,
      is_liked: userLikedSet.has(p.id),
    })));
  }, [userId]);

  const loadFollowData = useCallback(async () => {
    if (!userId) return;
    const [followersRes, followingRes] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("following_id", userId),
      supabase.from("follows").select("following_id").eq("follower_id", userId),
    ]);
    setFollowers((followersRes.data || []).map(f => f.follower_id));
    setFollowing((followingRes.data || []).map(f => f.following_id));
  }, [userId]);

  const followUser = async (targetId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setFollowing(prev => [...prev, targetId]);
    toast({ title: "Following!" });
  };

  const unfollowUser = async (targetId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setFollowing(prev => prev.filter(id => id !== targetId));
    toast({ title: "Unfollowed" });
  };

  const createPost = async (content: string, imageFile?: File, gameId?: string, holeNumber?: number, postType: string = "text", visibility: string = "public") => {
    if (!userId) return;

    let imageUrl: string | null = null;
    if (imageFile) {
      const filePath = `${userId}/${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage.from("post-images").upload(filePath, imageFile);
      if (uploadError) { toast({ title: "Upload error", description: uploadError.message, variant: "destructive" }); return; }
      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(filePath);
      imageUrl = urlData.publicUrl;
      postType = "photo";
    }

    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      content,
      image_url: imageUrl,
      post_type: postType as any,
      game_id: gameId || null,
      hole_number: holeNumber || null,
      visibility,
    });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Posted! ⛳" });
    if (visibility === "public") {
      await loadFeed();
    } else {
      await loadFriendsFeed();
    }
  };

  const toggleLike = async (postId: string) => {
    if (!userId) return;
    const post = feedPosts.find(p => p.id === postId) || userPosts.find(p => p.id === postId);
    if (!post) return;

    if (post.is_liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    }

    const updatePost = (p: Post) => p.id === postId ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 } : p;
    setFeedPosts(prev => prev.map(updatePost));
    setUserPosts(prev => prev.map(updatePost));
  };

  const loadComments = async (postId: string): Promise<PostComment[]> => {
    const { data, error } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    
    const userIds = [...new Set((data || []).map(c => c.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
      : { data: [] };
    const profilesMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profilesMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
    
    return (data || []).map(c => ({ ...c, profiles: profilesMap[c.user_id] || { display_name: "Unknown", avatar_url: null } }));
  };

  const addComment = async (postId: string, content: string) => {
    if (!userId) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: userId, content });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    
    const updatePost = (p: Post) => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p;
    setFeedPosts(prev => prev.map(updatePost));
    setUserPosts(prev => prev.map(updatePost));
  };

  // DM functions
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    const { data: participantRows, error } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);
    if (error || !participantRows?.length) { setConversations([]); return; }

    const convIds = participantRows.map(p => p.conversation_id);
    const [allParticipantsRes, lastMessagesRes, convsRes] = await Promise.all([
      supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds),
      supabase.from("messages").select("conversation_id, content, created_at, sender_id").in("conversation_id", convIds).order("created_at", { ascending: false }),
      supabase.from("conversations").select("id, created_at, updated_at, group_name").in("id", convIds),
    ]);

    // Fetch profiles separately since there's no FK from conversation_participants to profiles
    const allUserIds = [...new Set((allParticipantsRes.data || []).map(p => p.user_id).filter(id => id !== userId))];
    let profilesMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", allUserIds);
      (profiles || []).forEach(p => { profilesMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
    }

    const lastMsgMap: Record<string, any> = {};
    (lastMessagesRes.data || []).forEach(m => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m;
    });

    const convs: Conversation[] = convIds.map(cid => {
      const convData = (convsRes.data || []).find(c => c.id === cid);
      return {
        id: cid,
        created_at: convData?.created_at || "",
        updated_at: convData?.updated_at || "",
        group_name: (convData as any)?.group_name || undefined,
        participants: (allParticipantsRes.data || [])
          .filter(p => p.conversation_id === cid && p.user_id !== userId)
          .map(p => ({ user_id: p.user_id, ...(profilesMap[p.user_id] || { display_name: "Unknown", avatar_url: null }) })),
        last_message: lastMsgMap[cid],
      };
    });

    convs.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setConversations(convs);
  }, [userId]);

  const startConversation = async (targetUserId: string): Promise<string | null> => {
    if (!userId) return null;

    // Check if 1:1 conversation already exists
    const { data: myConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", userId);
    if (myConvs?.length) {
      const { data: theirConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", targetUserId).in("conversation_id", myConvs.map(c => c.conversation_id));
      
      // Check it's a 1:1 (only 2 participants)
      if (theirConvs?.length) {
        for (const tc of theirConvs) {
          const { data: allP } = await supabase.from("conversation_participants").select("id").eq("conversation_id", tc.conversation_id);
          if (allP?.length === 2) {
            await loadConversations();
            return tc.conversation_id;
          }
        }
      }
    }

    const { data: conv, error } = await supabase.from("conversations").insert({}).select().single();
    if (error) { console.error(error); return null; }

    // Insert self first so RLS allows adding the other user
    await supabase.from("conversation_participants").insert({ conversation_id: conv.id, user_id: userId });
    await supabase.from("conversation_participants").insert({ conversation_id: conv.id, user_id: targetUserId });

    await loadConversations();
    return conv.id;
  };

  const createGroupChat = async (userIds: string[], name: string): Promise<string | null> => {
    if (!userId) return null;

    const { data: conv, error } = await supabase.from("conversations").insert({ group_name: name }).select().single();
    if (error) { console.error(error); return null; }

    // Insert self first so RLS allows adding others
    const { error: selfError } = await supabase.from("conversation_participants").insert({
      conversation_id: conv.id,
      user_id: userId,
    });
    if (selfError) { console.error(selfError); return null; }

    // Now add other participants
    const otherParticipants = userIds.map(uid => ({
      conversation_id: conv.id,
      user_id: uid,
    }));
    const { error: pError } = await supabase.from("conversation_participants").insert(otherParticipants);
    if (pError) { console.error(pError); return null; }

    // Send initial system-like message with group name
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: userId,
      content: `Created group "${name}" 🏌️`,
    });

    await loadConversations();
    toast({ title: `Group "${name}" created!` });
    return conv.id;
  };

  const sendMessage = async (conversationId: string, content: string) => {
    if (!userId) return;
    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: userId, content });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await loadConversations(); // refresh last message
  };

  const loadMessages = async (conversationId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  };

  useEffect(() => {
    if (userId) {
      loadFollowData();
    }
  }, [userId, loadFollowData]);

  const deletePost = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      toast({ title: "Error", description: "Could not delete post", variant: "destructive" });
      return;
    }
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    setFriendsFeedPosts(prev => prev.filter(p => p.id !== postId));
    setUserPosts(prev => prev.filter(p => p.id !== postId));
    toast({ title: "Post deleted" });
  };

  return {
    feedPosts, friendsFeedPosts, userPosts, followers, following, conversations, loading,
    loadFeed, loadFriendsFeed, loadUserPosts, loadFollowData, followUser, unfollowUser,
    createPost, deletePost, toggleLike, loadComments, addComment,
    loadConversations, startConversation, createGroupChat, sendMessage, loadMessages,
  };
};
