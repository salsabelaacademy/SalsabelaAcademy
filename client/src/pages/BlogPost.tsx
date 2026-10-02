import { useTranslation } from "react-i18next";
import { useRoute, Link } from "wouter";
import { useEffect, useMemo } from "react";
import DOMPurify, { type Config } from "dompurify";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { usePost } from "@/hooks/use-posts";
import { useLanguage } from "@/hooks/use-language";
import { ArrowLeft, ArrowRight, Calendar, Globe } from "lucide-react";

const richTextSanitizeConfig: Config = {
  ALLOWED_TAGS: [
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "blockquote", "pre", "code",
    "ul", "ol", "li", "a", "img", "span",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class", "dir", "width", "height", "style",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|(?:\/|#|\.{1,2}\/)|[a-z0-9][a-z0-9+.-]*(?:[/?#]|$))/i,
};

function formatDate(date: string | Date, locale: string): string {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SkeletonPost() {
  return (
    <div className="animate-pulse space-y-6 max-w-3xl mx-auto">
      <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      <div className="space-y-3 px-4">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/6" />
      </div>
    </div>
  );
}

export default function BlogPost() {
  const { t } = useTranslation();
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const { isRTL } = useLanguage();
  const lang = isRTL ? "ar" : "en";
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const { data: post, isLoading, isError } = usePost(slug);
  const sanitizedContent = useMemo(
    () => typeof window === "undefined" ? (post?.content ?? "") : DOMPurify.sanitize(post?.content ?? "", richTextSanitizeConfig),
    [post?.content],
  );

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | Salsabela Academy`;

      const setMeta = (selector: string, content: string) => {
        let el = document.querySelector(selector);
        if (!el) {
          el = document.createElement("meta");
          const attr = selector.includes("[name=") ? "name" : "property";
          const val = selector.match(/["']([^"']+)["']/)?.[1] ?? "";
          el.setAttribute(attr, val);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };

      const desc = post.metaDescription || "";
      const titleFull = `${post.title} | Salsabela Academy`;

      setMeta('meta[name="description"]', desc);
      setMeta('meta[property="og:title"]', titleFull);
      setMeta('meta[property="og:description"]', desc);
      setMeta('meta[property="og:image"]', post.coverImage || "/logo-icon.png");
      setMeta('meta[name="twitter:title"]', titleFull);
      setMeta('meta[name="twitter:description"]', desc);
    }
  }, [post]);

  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.metaDescription || "",
        image: post.coverImage || "",
        datePublished: post.createdAt,
        dateModified: post.updatedAt,
        author: {
          "@type": "Organization",
          name: "Salsabela Academy",
        },
        publisher: {
          "@type": "Organization",
          name: "Salsabela Academy",
          logo: { "@type": "ImageObject", url: "/favicon.ico" },
        },
        inLanguage: post.language === "ar" ? "ar-SA" : "en-US",
      }
    : null;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      {/* JSON-LD */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <div className="pt-28 pb-20">
        <div className="container-wide max-w-4xl">

          {/* Back button */}
          <Link href="/blog">
            <button className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors text-sm font-medium mb-8">
              <BackArrow className="w-4 h-4" />
              {t("pageUi.BlogPost.Back_to_Blog")}
            </button>
          </Link>

          {isLoading && <SkeletonPost />}

          {isError && (
            <div className="text-center py-24">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {t("pageUi.BlogPost.Article_Not_Found")}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {t("pageUi.BlogPost.We_couldn_t_find_the_article_you_re_looking_for")}
              </p>
              <Link href="/blog">
                <button className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors">
                  {t("pageUi.BlogPost.Go_to_Blog")}
                </button>
              </Link>
            </div>
          )}

          {post && (
            <article data-reveal
              dir={post.language === "ar" ? "rtl" : "ltr"}
            >
              {/* Cover image */}
              {post.coverImage && (
                <div className="w-full h-72 md:h-96 rounded-2xl overflow-hidden mb-8">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post.createdAt!, post.language)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                    {t("pageUi.BlogPost.English")}
                  </span>
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
                {post.title}
              </h1>


              {/* Divider */}
              <hr className="border-slate-100 dark:border-slate-800 my-8" />

              {/* Content */}
              <div
                className="blog-content dark:blog-content-dark"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </article>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
