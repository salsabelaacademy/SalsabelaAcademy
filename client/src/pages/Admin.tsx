import { useState, useEffect } from "react";
import { BrandLoading } from '@/components/BrandLoading';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from "wouter";
import { useAdminPosts, useDeletePost } from "@/hooks/use-posts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText, Plus, Pencil, Trash2, Eye, LogOut, Globe,
  CheckCircle2, Clock, AlertCircle, Loader2
} from "lucide-react";
import logoIcon from "@assets/logo1.png";

function formatDate(d: string | Date, language: string) {
  return new Date(d).toLocaleDateString(language, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function Admin() {
  const { t, i18n } = useTranslation();
  const tr = (key: string) => t('p4.cms.' + key);
  const [, navigate] = useLocation();
  const { user, loading, logout } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const { data: posts = [], isLoading, error: postsError } = useAdminPosts();
  const deletePost = useDeletePost();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleDelete(id: number) {
    setActionError("");
    try {
      await deletePost.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error) {
      setActionError(t("p4.failed"));
    }
  }

  if (loading || !user || user.role !== "admin") {
    return <BrandLoading compact />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src={logoIcon} alt={t("p4.brand")} className="h-9 w-9 rounded-lg object-cover" />
          <div>
            <h1 className="font-display font-bold text-slate-900 dark:text-slate-100 leading-none">
              {t("review.contentManagement")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t("review.contentManagement")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/blog">
            <Button variant="outline" size="sm" className="gap-2 dark:border-slate-700 dark:text-slate-300">
              <Eye className="w-4 h-4" />
              {t("p4.blog")}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-500 gap-2">
            <LogOut className="w-4 h-4" />
            {t("p4.signout")}
          </Button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-10">
        {(actionError || postsError) && (
          <div role="alert" className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError || t("p4.failed")}
          </div>
        )}
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: tr("total"), value: posts.length, icon: FileText, color: "text-primary" },
            { label: tr("published"), value: posts.filter(p => p.status === "published").length, icon: CheckCircle2, color: "text-green-500" },
            { label: tr("drafts"), value: posts.filter(p => p.status === "draft").length, icon: Clock, color: "text-amber-500" },
            { label: t("p4.arabic"), value: posts.filter(p => p.language === "ar").length, icon: Globe, color: "text-blue-500" },
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">

              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Posts list header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">{tr('all')}</h2>
          <Link href="/admin/new">
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" />
              {tr('new')}
            </Button>
          </Link>
        </div>

        {/* Posts table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoading compact />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center">

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{tr('empty')}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              {tr('start')}
            </p>
            <Link href="/admin/new">
              <Button className="btn-primary gap-2">
                <Plus className="w-4 h-4" />
                {tr('new')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">{tr('title')}</th>
                    <th className="text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-4 hidden sm:table-cell">{tr('language')}</th>
                    <th className="text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-4 hidden md:table-cell">{tr('status')}</th>
                    <th className="text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-4 hidden lg:table-cell">{tr('date')}</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {posts.map(post => (
                    <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">{post.title}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">/blog/{post.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {t("pageUi.Admin.English")}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        {post.status === "published" ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> {tr('published')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> {tr('draft')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{new Date(post.createdAt!).toLocaleDateString(i18n.language)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`${post.language === i18n.language ? "" : post.language === "ar" ? "~/ar" : "~"}/blog/${post.slug}`} target="_blank">
                            <Button variant="ghost" size="icon" aria-label={tr('preview')} className="h-11 w-11 text-slate-400 hover:text-primary">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/admin/edit/${post.id}`}>
                            <Button variant="ghost" size="icon" aria-label={tr('edit')} className="h-11 w-11 text-slate-400 hover:text-primary">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          {deleteConfirm === post.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleDelete(post.id)}
                                disabled={deletePost.isPending}
                              >
                                {deletePost.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : tr('delete')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                {tr('cancel')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => setDeleteConfirm(post.id)}
                              aria-label={tr('delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
