import { PageBackdrop } from "@/components/PageBackdrop";
import { Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { usePosts } from "@/hooks/use-posts";
import { useLanguage } from "@/hooks/use-language";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, ArrowRight, ArrowLeft, PenLine } from "lucide-react";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").slice(0, 160);
}

function formatDate(date: string | Date, locale: string): string {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-pulse">
      <div className="h-52 bg-slate-200 dark:bg-slate-700" />
      <div className="p-6 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
        <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/3 mt-4" />
      </div>
    </div>
  );
}

export default function Blog() {
  const { isRTL } = useLanguage();
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split("-")[0];
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: posts = [], isLoading, isError, refetch } = usePosts(lang);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="academy-hero-surface pt-32 pb-16 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 dark:from-primary/10"><PageBackdrop variant="journal" />
        <div className="container-wide text-center">
          <div data-reveal
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <PenLine className="w-4 h-4" />
              {t("pageUi.Blog.Salsabela_Academy_Blog")}
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t("pageUi.Blog.Articles_Islamic_Knowledge")}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t("pageUi.Blog.Educational_articles_on_Quran_sciences_Tajweed_Arabic_language_an")}
            </p>
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-16">
        <div className="container-wide">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : isError ? (<div role="alert"><p>{t("p4.failed")}</p><button className="btn-primary" onClick={()=>refetch()}>{t("restore.retry")}</button></div>) : posts.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <PenLine className="w-10 h-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {t("pageUi.Blog.No_articles_yet")}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t("pageUi.Blog.Check_back_soon_for_new_content")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <article data-reveal
                  key={post.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  {/* Cover */}
                  {post.coverImage ? (
                    <div className="h-52 overflow-hidden">
                      <img loading="lazy" decoding="async" width={640} height={400}
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-52 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <PenLine className="w-12 h-12 text-primary/30" />
                    </div>
                  )}

                  <div className="p-6 flex flex-col flex-1 text-start">
                    {/* Meta */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(post.createdAt!, lang)}
                      </span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {t("pageUi.Blog.EN")}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 leading-snug">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 leading-relaxed flex-1 mb-4">
                      {post.metaDescription || stripHtml(post.content || "")}
                    </p>

                    <Link href={`/blog/${post.slug}`}>
                      <button className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:gap-3 transition-all">
                        {t("pageUi.Blog.Read_More")}
                        <Arrow className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
