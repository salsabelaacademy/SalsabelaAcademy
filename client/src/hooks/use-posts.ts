import {useLanguage} from "@/hooks/use-language";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post } from "@shared/schema";

const adminHeaders = () => ({
  "Content-Type": "application/json",
});

const nc = { cache: "no-store" as RequestCache };
const bust = () => `_t=${Date.now()}`;

export function usePosts(lang?: string, limit?: number) {
  return useQuery<Post[]>({
    queryKey: limit ? ["/api/posts", lang ?? "all", limit] : ["/api/posts", lang ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (lang) params.set("lang", lang);
      if (limit) params.set("limit", String(limit));
      params.set("_t", String(Date.now()));
      const res = await fetch(`/api/posts?${params}`, nc);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    staleTime: limit ? 60_000 : 0,
  });
}

export function useAdminPosts() {
  return useQuery<Post[]>({
    queryKey: ["/api/posts", "admin"],
    queryFn: async () => {
      const res = await fetch("/api/posts?all=1", {
        credentials: "include",
        ...nc,
      });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    staleTime: 0,
  });
}

export function usePost(slug: string) {
  const {language}=useLanguage();
  return useQuery<Post>({
    queryKey: ["/api/posts/slug", slug, language],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}?lang=${language}`, nc);
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: !!slug,
    staleTime: 0,
  });
}

export function usePostById(id: number | null) {
  return useQuery<Post>({
    queryKey: ["/api/posts/id", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/id/${id}`, {
        credentials: "include",
        ...nc,
      });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Post>) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: adminHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to create");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/posts"] }),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Post> }) => {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: adminHeaders(),
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/posts"] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/posts"] }),
  });
}
