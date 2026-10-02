import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useCourses() {
  return useQuery({
    queryKey: [api.courses.list.path],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(api.courses.list.path);
      if (!res.ok) throw new Error("Failed to fetch courses");
      return api.courses.list.responses[200].parse(await res.json());
    },
  });
}

export function useCourse(id: number | string) {
  return useQuery({
    queryKey: [api.courses.get.path, id],
    queryFn: async () => {
      // Note: In a real app we'd use buildUrl, but for simple ID replacement:
      const path = api.courses.get.path.replace(":id", encodeURIComponent(String(id)));
      const res = await fetch(path);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch course");
      }
      return api.courses.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
