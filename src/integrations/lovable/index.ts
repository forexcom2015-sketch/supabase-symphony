import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions,
    ) => {
      const supabaseProvider =
        provider === "lovable" || provider === "microsoft" ? "google" : provider;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as "google" | "apple",
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin + "/login",
          queryParams: opts?.extraParams,
        },
      });
      if (error) return { error, redirected: false };
      return { redirected: !!data.url, error: null, tokens: null };
    },
  },
};
