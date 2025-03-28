import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Extract the base URL and any query parameters
    const baseUrl = queryKey[0] as string;
    let url = baseUrl;
    
    // Handle query parameters in the QueryKey
    if (queryKey.length > 1 && queryKey[1]) {
      // If the second part of the query key is a string, assume it's already a query string
      if (typeof queryKey[1] === 'string' && queryKey[1].length > 0) {
        url = `${baseUrl}?${queryKey[1]}`;
      } 
      // If it's an object, convert it to a query string
      else if (typeof queryKey[1] === 'object' && queryKey[1] !== null) {
        const params = new URLSearchParams();
        Object.entries(queryKey[1] as Record<string, string>).forEach(([key, value]) => {
          params.append(key, value);
        });
        if (params.toString()) {
          url = `${baseUrl}?${params.toString()}`;
        }
      }
    }
    
    console.log("Fetching URL:", url);
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
