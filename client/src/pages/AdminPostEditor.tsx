import i18n from '@/lib/i18n';
import {useTranslation} from 'react-i18next';
import {editorUiKey} from '@/lib/editor-ui-translations';
function editorLabel(value:string){const key=editorUiKey[value as keyof typeof editorUiKey];return key?i18n.t('editorUi.'+key):value;}
import { useState, useEffect, useCallback, useRef } from "react";
import { BrandLoading } from '@/components/BrandLoading';
import { Link, useLocation, useRoute } from "wouter";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapImage from "@tiptap/extension-image";
import { useCreatePost, useUpdatePost, usePostById } from "@/hooks/use-posts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link2, Quote, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Strikethrough, Minus, Code, Save, Eye, ArrowLeft,
  Loader2, CheckCircle2, Type, AlignJustify, Clock,
  Target, BarChart3,
} from "lucide-react";
import logoIcon from "@assets/logo1.png";

// ── SEO Score ────────────────────────────────────────────────────────────────
function calcSeoScore(title: string, metaDescription: string, wordCount: number, coverImage: string, slug: string) {
  let score = 0;
  const checks: { label: string; ok: boolean; tip: string }[] = [];

  // Title: ideal 40-65 chars
  const tl = title.length;
  const titleOk = tl >= 40 && tl <= 65;
  score += titleOk ? 25 : tl > 0 ? 12 : 0;
  checks.push({ label: "Title length", ok: titleOk, tip: titleOk ? editorLabel("Perfect (40-65 chars)") : i18n.t("review.seoTitleTip",{count:tl}) });

  // Meta description: ideal 120-155 chars
  const ml = metaDescription.length;
  const metaOk = ml >= 120 && ml <= 155;
  score += metaOk ? 25 : ml > 80 ? 13 : ml > 0 ? 6 : 0;
  checks.push({ label: "Meta description", ok: metaOk, tip: metaOk ? editorLabel("Perfect (120-155 chars)") : ml === 0 ? editorLabel("Missing — add a description") : i18n.t("review.seoMetaTip",{count:ml}) });

  // Content length
  const contentOk = wordCount >= 400;
  score += wordCount >= 400 ? 25 : wordCount >= 200 ? 15 : wordCount >= 80 ? 7 : 0;
  checks.push({ label: "Content length", ok: contentOk, tip: i18n.t(contentOk ? "review.seoGoodContent" : "review.seoContentTip",{count:wordCount}) });

  // Cover image
  const imageOk = !!coverImage;
  score += imageOk ? 15 : 0;
  checks.push({ label: "Cover image", ok: imageOk, tip: imageOk ? "Cover image set" : "Add a cover image" });

  // Slug set and not auto-generated
  const slugOk = !!slug && slug.length > 3;
  score += slugOk ? 10 : 0;
  checks.push({ label: "URL slug", ok: slugOk, tip: slugOk ? "Slug looks good" : "Set a descriptive URL slug" });

  return { score, checks };
}

function toSlug(title: string): string {
  if (/[\u0600-\u06FF]/.test(title)) {
    return `post-${Date.now().toString(36)}`;
  }
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function ToolbarBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={editorLabel(title)} aria-label={editorLabel(title)}
      disabled={disabled}
      className={`relative group min-h-11 min-w-11 p-1.5 rounded-md text-sm transition-all ${
        active
          ? "bg-primary/15 text-primary shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] font-medium text-white bg-slate-800 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {editorLabel(title)}
      </span>
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />;
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Toolbar({ editor, wordCount }: { editor: ReturnType<typeof useEditor>; wordCount: number }) {
  const {t}=useTranslation();
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt(editorLabel("Paste image URL:"));
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt(editorLabel("Link URL:"), prev);
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-t-xl">
      {/* History */}
      <ToolbarGroup>
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}>
          <Undo2 className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)" disabled={!editor.can().redo()}>
          <Redo2 className="w-4 h-4" />
        </ToolbarBtn>
      </ToolbarGroup>

      <Divider />

      {/* Headings */}
      <ToolbarGroup>
        {([1, 2, 3] as const).map(level => (
          <ToolbarBtn
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive("heading", { level })}
            title={i18n.t("review.headingLevel",{level})}
          >
            <span className="font-bold text-[11px] w-5 inline-flex items-center justify-center">H{level}</span>
          </ToolbarBtn>
        ))}
        <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph") && !editor.isActive("heading")} title="Paragraph">
          <Type className="w-4 h-4" />
        </ToolbarBtn>
      </ToolbarGroup>

      <Divider />

      {/* Text formatting */}
      <ToolbarGroup>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
          <Code className="w-4 h-4" />
        </ToolbarBtn>
      </ToolbarGroup>

      <Divider />

      {/* Alignment */}
      <ToolbarGroup>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify className="w-4 h-4" />
        </ToolbarBtn>
      </ToolbarGroup>

      <Divider />

      {/* Lists & Blocks */}
      <ToolbarGroup>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider Line">
          <Minus className="w-4 h-4" />
        </ToolbarBtn>
      </ToolbarGroup>

      <Divider />

      {/* Media */}
      <ToolbarGroup>
        <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Insert Link">
          <Link2 className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={addImage} title="Insert Image">
          <ImageIcon className="w-4 h-4" />
        </ToolbarBtn>
      </ToolbarGroup>

      {/* Word count — right-aligned */}
      <div className="ml-auto flex items-center gap-2 pl-2">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
          {t("review.wordCount",{count:wordCount})}
        </span>
      </div>
    </div>
  );
}

export default function AdminPostEditor() {
  const {t,i18n:locale} = useTranslation();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [isNew] = useRoute("/admin/new");
  const [, params] = useRoute("/admin/edit/:id");
  const editId = params?.id ? parseInt(params.id) : null;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [coverImage, setCoverImage] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [status, setStatus] = useState<"published" | "draft">("draft");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState("");
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: editPost, isLoading: loadingPost } = usePostById(editId);
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ dropcursor: false, link: false, underline: false }),
      TiptapLink.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: () => editorLabel("Start writing your article here… Use the toolbar above to add headings, bold text, quotes, and more."),
      }),
      TiptapImage.configure({ inline: false }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose-editor focus:outline-none min-h-[520px] px-8 py-6",
        "aria-label": editorLabel("Article content"),
      },
    },
    onUpdate({ editor }) {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setIsDirty(true);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({editorProps: {...editor.options.editorProps, attributes: {...editor.options.editorProps.attributes, "aria-label": editorLabel("Article content")}}});
    editor.view.dispatch(editor.state.tr);
  }, [editor, locale.language]);

  useEffect(() => {
    if (editPost && editor) {
      setTitle(editPost.title);
      setSlug(editPost.slug);
      setLanguage(editPost.language as "en" | "ar");
      setCoverImage(editPost.coverImage || "");
      setMetaDescription(editPost.metaDescription || "");
      setStatus(editPost.status as "published" | "draft");
      setSlugEdited(true);
      editor.commands.setContent(editPost.content);
      const text = editor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    }
  }, [editPost, editor]);

  useEffect(() => {
    if (!slugEdited && title) {
      setSlug(toSlug(title));
    }
  }, [title, slugEdited]);

  // Mark dirty on any change
  useEffect(() => { setIsDirty(true); }, [title, slug, language, coverImage, metaDescription, status]);

  // Auto-save every 30 seconds if dirty + has title + editing existing post
  useEffect(() => {
    if (!isDirty || !title.trim() || !editId || !editor) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        const content = editor.getHTML();
        await updatePost.mutateAsync({ id: editId, data: {
          title: title.trim(), content, language, slug,
          coverImage: coverImage || null,
          metaDescription: metaDescription || null,
          status,
        }});
        setIsDirty(false);
        setLastAutoSaved(new Date());
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Auto-save failed");
      } finally {
        setAutoSaving(false);
      }
    }, 30_000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [isDirty, title, slug, language, coverImage, metaDescription, status, editId]);

  const handleSave = useCallback(async (overrideStatus?: "published" | "draft") => {
    if (!title.trim() || !editor) return;
    setError("");
    const content = editor.getHTML();
    const finalStatus = overrideStatus ?? status;
    const data = {
      title: title.trim(), content, language, slug,
      coverImage: coverImage || null,
      metaDescription: metaDescription || null,
      status: finalStatus,
    };

    try {
      if (editId) {
        await updatePost.mutateAsync({ id: editId, data });
      } else {
        await createPost.mutateAsync(data as any);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save post");
      return;
    }
    setIsDirty(false);
    setSaved(true);
    navigate("/admin");
  }, [title, editor, language, slug, coverImage, metaDescription, status, editId]);

  const isPending = createPost.isPending || updatePost.isPending;
  const isLoading = !!editId && loadingPost;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  const { score: seoScore, checks: seoChecks } = calcSeoScore(title, metaDescription, wordCount, coverImage, slug);
  const seoColor = seoScore >= 75 ? "text-green-600 dark:text-green-400" : seoScore >= 45 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
  const seoBarColor = seoScore >= 75 ? "bg-green-500" : seoScore >= 45 ? "bg-amber-400" : "bg-red-400";

  const autoSaveLabel = autoSaving
    ? t("review.editorSaving")
    : lastAutoSaved
    ? t("review.savedAt",{time:new Intl.DateTimeFormat(locale.language,{timeStyle:"short"}).format(lastAutoSaved)})
    : isDirty && editId
    ? editorLabel("Unsaved changes")
    : "";

  if (authLoading || !user || user.role !== "admin") {
    return <BrandLoading compact />;
  }

  return (
    <div className="academy-admin-page academy-editor-page min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button aria-label={editorLabel("Back to articles")} variant="ghost" size="icon" className="h-11 w-11 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <img src={logoIcon} alt={t("p4.brand")} className="h-7 w-7 rounded-lg object-cover" />
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-slate-900 dark:text-slate-100 text-sm">
                {editorLabel(isNew ? "New Post" : "Edit Post")}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {wordCount > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {t("review.reading",{count:wordCount,minutes:readingTime})}
                  </span>
                )}
                {autoSaveLabel && (
                  <span className="text-[10px] flex items-center gap-1 text-slate-400 dark:text-slate-500">
                    {wordCount > 0 && <span className="text-slate-300 dark:text-slate-600">·</span>}
                    {autoSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Clock className="w-2.5 h-2.5" />}
                    {autoSaveLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {slug && status === "published" && (
            <Link href={`${language === locale.language ? "" : language === "ar" ? "~/ar" : "~"}/blog/${slug}`}>
              <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex dark:border-slate-700 dark:text-slate-300 h-8 text-xs">
                <Eye className="w-3.5 h-3.5" />
                {editorLabel("Preview")}
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 dark:border-slate-700 dark:text-slate-300 h-8 text-xs"
            onClick={() => handleSave("draft")}
            aria-label={editorLabel("Save Draft")}
            disabled={isPending || !title.trim()}
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{editorLabel("Save Draft")}</span>
          </Button>
          <Button
            className="btn-primary gap-1.5 h-8 text-xs"
            size="sm"
            onClick={() => handleSave("published")}
            disabled={isPending || !title.trim()}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : null}
            {editorLabel(saved ? "Saved!" : "Publish")}
          </Button>
        </div>
      </header>

      {error && <div role="alert" className="mx-auto mt-5 max-w-5xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{t("review.saveFailed")}</div>}
      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <BrandLoading compact />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main editor column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-8 pt-7 pb-5">
                <input
                  aria-label={editorLabel("Article title…")} value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={editorLabel("Article title\u2026")}
                  maxLength={120}
                  className="w-full text-[28px] font-display font-bold text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder-slate-300 dark:placeholder-slate-600 border-none resize-none leading-tight"
                  dir={language === "ar" ? "rtl" : "ltr"}
                />
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{t("review.characters",{count:title.length})} / 120</span>
                  {slug && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                      /blog/<span className="text-primary">{slug}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rich Text Editor */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <Toolbar editor={editor} wordCount={wordCount} />
              <div
                className="blog-editor-content"
                dir={language === "ar" ? "rtl" : "ltr"}
              >
                <EditorContent editor={editor} />
              </div>
              {/* Bottom status bar with word goal */}
              <div className="px-8 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {t(language === "ar" ? "p4.arabic" : "p4.english")}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {t("review.editorShortcuts")}
                  </span>
                </div>
                {/* Word goal progress */}
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-slate-400 shrink-0" />
                  <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (wordCount / 500) * 100)}%`,
                        background: wordCount >= 500 ? "#22c55e" : wordCount >= 300 ? "#f59e0b" : "#94a3b8",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap font-mono">
                    {wordCount}/500
                    {wordCount >= 500 && " ✓"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Publish settings */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                {editorLabel("Publish Settings")}
              </h3>
              <div className="space-y-4">
                {/* Status toggle */}
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">{editorLabel("Status")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["published", "draft"] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`h-9 rounded-lg text-xs font-semibold border transition-all ${
                          status === s
                            ? s === "published"
                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {editorLabel(s === "published" ? "Published" : "Draft")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language toggle */}
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">{editorLabel("Language")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["en", "ar"] as const).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        className={`h-9 rounded-lg text-xs font-semibold border transition-all ${
                          language === lang
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {t(lang === "en" ? "p4.english" : "p4.arabic")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SEO & URL */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                {editorLabel("SEO & URL")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">{editorLabel("URL Slug")}</label>
                  <Input
                    value={slug}
                    onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
                    placeholder={t("review.slugExample")}
                    className="h-8 text-xs font-mono bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">salsabela.com/blog/<span className="text-primary font-mono">{slug || "…"}</span></p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{editorLabel("Meta Description")}</label>
                  <Textarea
                    value={metaDescription}
                    onChange={e => setMetaDescription(e.target.value)}
                    placeholder={editorLabel("Brief description for search engines\u2026")}
                    className="text-xs resize-none min-h-[72px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 leading-relaxed"
                    maxLength={160}
                  />
                  <div className="flex justify-between mt-1">
                    <span className={`text-[10px] ${metaDescription.length >= 120 && metaDescription.length <= 155 ? "text-green-600 dark:text-green-400" : metaDescription.length > 155 ? "text-red-500" : "text-slate-400"}`}>
                      {t(metaDescription.length === 0 ? "review.notSet" : metaDescription.length < 120 ? "review.tooShort" : metaDescription.length > 155 ? "review.tooLong" : "review.goodLength")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{metaDescription.length}/160</span>
                  </div>
                </div>

                {/* Google Search Preview */}
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">
                    {editorLabel("Google Preview")}
                  </label>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-0.5">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                      salsabela.com › blog › <span className="text-green-700 dark:text-green-500">{slug || "article-slug"}</span>
                    </p>
                    <p className="text-[13px] font-medium text-blue-700 dark:text-blue-400 leading-snug line-clamp-1">
                      {title || editorLabel("Article Title")} | {t("p4.brand")}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {metaDescription || <span className="italic text-slate-400 dark:text-slate-500">{editorLabel("No description yet.")}</span>}
                    </p>
                  </div>
                </div>

                {/* SEO Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> {editorLabel("SEO Score")}
                    </label>
                    <span className={`text-sm font-bold tabular-nums ${seoColor}`}>{seoScore}/100</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${seoBarColor}`}
                      style={{ width: `${seoScore}%` }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {seoChecks.map(c => (
                      <div key={editorLabel(c.label)} className="flex items-start gap-2">
                        <span className={`mt-0.5 text-[11px] shrink-0 ${c.ok ? "text-green-500" : "text-slate-300 dark:text-slate-600"}`}>
                          {c.ok ? "●" : "○"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-medium block ${c.ok ? "text-green-600 dark:text-green-400" : "text-slate-500 dark:text-slate-400"}`}>
                            {editorLabel(c.label)}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{editorLabel(c.tip)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cover Image */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                {editorLabel("Cover Image")}
              </h3>
              <Input
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                placeholder="https://…"
                className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100"
              />
              {coverImage ? (
                <div className="mt-3 rounded-xl overflow-hidden h-32 border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={coverImage}
                    alt={editorLabel("Cover preview")}
                    className="w-full h-full object-cover"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                </div>
              ) : (
                <div className="mt-3 rounded-xl h-20 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <span className="text-[11px] text-slate-400">{editorLabel("Paste an image URL above")}</span>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="space-y-2">
              <Button
                className="w-full btn-primary h-10 gap-2"
                onClick={() => handleSave("published")}
                disabled={isPending || !title.trim()}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
                {editorLabel(saved ? "Published!" : "Publish Post")}
              </Button>
              <Button
                variant="outline"
                className="w-full h-9 gap-2 dark:border-slate-700 dark:text-slate-300 text-sm"
                onClick={() => handleSave("draft")}
                disabled={isPending || !title.trim()}
              >
                <Save className="w-3.5 h-3.5" />
                {editorLabel("Save as Draft")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
