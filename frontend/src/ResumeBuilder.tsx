import { useState, useCallback, useMemo, useEffect } from 'react';
import type { AnalysisResponse, AISuggestion } from './api';
import { downloadModifiedPdf, reAnalyzeResume, fetchAiSuggestions } from './api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  CheckCircle2,
  PlusCircle,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Sparkles,
  Target,
  Lightbulb,
  Zap,
  TrendingUp,
  Award,
  ChevronRight,
  Check,
  Eye,
  Pencil,
  Loader2,
  BarChart3,
  ShieldCheck,
  GitCompareArrows,
  XCircle,
  Brain,
  Replace,
  TextCursorInput,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SmartSuggestion {
  id: string;
  type: 'add_skill' | 'keyword' | 'improvement';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  textToInsert: string;
  applied: boolean;
}

interface ResumeBuilderProps {
  result: AnalysisResponse;
  originalPdf: File;
  jdText: string;
  onBack: () => void;
}

type BuilderStep = 'edit' | 'review';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const priorityOrder = { high: 0, medium: 1, low: 2 };

const priorityIcon = (p: string) => {
  if (p === 'high') return <Zap size={15} style={{ color: 'var(--danger)' }} />;
  if (p === 'medium') return <TrendingUp size={15} style={{ color: 'var(--warning)' }} />;
  return <Award size={15} style={{ color: 'var(--success)' }} />;
};

const priorityBadge = (p: string) => {
  const m: Record<string, { text: string; color: string }> = {
    high: { text: 'High', color: 'var(--danger)' },
    medium: { text: 'Med', color: 'var(--warning)' },
    low: { text: 'Low', color: 'var(--success)' },
  };
  return m[p] ?? m.low;
};

const scoreColor = (s: number) => (s >= 80 ? 'var(--success)' : s >= 55 ? 'var(--warning)' : 'var(--danger)');

const typeIcon = (t: string) => {
  if (t === 'rewrite') return <Replace size={14} />;
  if (t === 'add_content') return <TextCursorInput size={14} />;
  return <Target size={14} />;
};

/* Simple diff */
function computeDiffLines(original: string, modified: string) {
  const o = original.split('\n'), m = modified.split('\n');
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];
  let oi = 0, mi = 0;
  while (oi < o.length || mi < m.length) {
    if (oi < o.length && mi < m.length && o[oi] === m[mi]) { result.push({ type: 'same', text: o[oi] }); oi++; mi++; }
    else if (oi < o.length && !m.includes(o[oi])) { result.push({ type: 'removed', text: o[oi] }); oi++; }
    else if (mi < m.length && !o.includes(m[mi])) { result.push({ type: 'added', text: m[mi] }); mi++; }
    else { if (oi < o.length) { result.push({ type: 'removed', text: o[oi] }); oi++; } if (mi < m.length) { result.push({ type: 'added', text: m[mi] }); mi++; } }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Build rule-based suggestions                                       */
/* ------------------------------------------------------------------ */

function buildRuleSuggestions(result: AnalysisResponse): SmartSuggestion[] {
  const s: SmartSuggestion[] = [];
  result.skill_comparison.missing_skills.forEach((sk, i) => s.push({
    id: `skill-${i}`, type: 'add_skill', priority: 'high',
    title: `Add "${sk.name}"`, description: `Missing ${sk.category} skill from JD.`,
    textToInsert: sk.name, applied: false,
  }));
  Object.entries(result.skill_comparison.category_scores).forEach(([cat, sc], i) => {
    if (sc < 50) {
      const missing = result.skill_comparison.missing_skills.filter(x => x.category === cat).map(x => x.name);
      if (missing.length) s.push({
        id: `cat-${i}`, type: 'keyword', priority: 'medium',
        title: `Strengthen "${cat}"`, description: `Scored ${sc.toFixed(0)}% — add: ${missing.join(', ')}.`,
        textToInsert: missing.join(', '), applied: false,
      });
    }
  });
  s.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return s;
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function ResumeBuilder({ result, originalPdf, jdText, onBack }: ResumeBuilderProps) {
  const [resumeText, setResumeText] = useState(result.resume_text);
  const [suggestions, setSuggestions] = useState(() => buildRuleSuggestions(result));
  const [copied, setCopied] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor');

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<(AISuggestion & { applied: boolean })[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
  const [aiElapsed, setAiElapsed] = useState(0);
  const [sugTab, setSugTab] = useState<'rules' | 'ai'>('rules');

  // Review workflow
  const [step, setStep] = useState<BuilderStep>('edit');
  const [newScore, setNewScore] = useState<AnalysisResponse | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const hasChanges = resumeText !== result.resume_text;

  useEffect(() => { const u = URL.createObjectURL(originalPdf); setPdfPreviewUrl(u); return () => URL.revokeObjectURL(u); }, [originalPdf]);

  const appliedCount = suggestions.filter(s => s.applied).length;
  const totalAddable = suggestions.filter(s => s.type === 'add_skill' || s.type === 'keyword').length;
  const aiAppliedCount = aiSuggestions.filter(s => s.applied).length;

  /* --- Rule-based apply --- */
  const applySuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id !== id || s.applied) return s;
      if (s.type === 'add_skill' || s.type === 'keyword') {
        setResumeText(prev => {
          const rx = /(?:skills?|technical\s*skills?|core\s*competenc\w*)[:\s]*\n?/i;
          const m = prev.match(rx);
          if (m && m.index !== undefined) {
            const after = prev.slice(m.index + m[0].length);
            const ns = after.match(/\n\s*\n/);
            if (ns && ns.index !== undefined) { const at = m.index + m[0].length + ns.index; return prev.slice(0, at) + `, ${s.textToInsert}` + prev.slice(at); }
            return prev.slice(0, m.index + m[0].length) + after.trimEnd() + `, ${s.textToInsert}\n`;
          }
          return prev + `\n\nSkills\n${s.textToInsert}`;
        });
      }
      return { ...s, applied: true };
    }));
  }, []);

  const applyAll = useCallback(() => {
    suggestions.filter(s => !s.applied && (s.type === 'add_skill' || s.type === 'keyword')).forEach(s => applySuggestion(s.id));
  }, [suggestions, applySuggestion]);

  /* --- AI suggestion apply --- */
  const applyAiSuggestion = useCallback((index: number) => {
    setAiSuggestions(prev => prev.map((s, i) => {
      if (i !== index || s.applied) return s;
      if (s.type === 'rewrite' && s.original_text) {
        setResumeText(prev => prev.includes(s.original_text) ? prev.replace(s.original_text, s.improved_text) : prev);
      } else if (s.type === 'add_content') {
        setResumeText(prev => prev + '\n' + s.improved_text);
      } else if (s.type === 'keyword' && s.original_text) {
        setResumeText(prev => prev.includes(s.original_text) ? prev.replace(s.original_text, s.improved_text) : prev);
      }
      return { ...s, applied: true };
    }));
  }, []);

  const applyAllAi = useCallback(() => {
    aiSuggestions.forEach((_, i) => applyAiSuggestion(i));
  }, [aiSuggestions, applyAiSuggestion]);

  /* --- Fetch AI suggestions --- */
  const handleFetchAi = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => setAiElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      const { suggestions: data, model_used } = await fetchAiSuggestions(
        resumeText, jdText, result.ats_score,
        result.skill_comparison.matched_skills.map(s => s.name),
        result.skill_comparison.missing_skills.map(s => s.name),
      );
      setAiSuggestions(data.map(s => ({ ...s, applied: false })));
      setAiModelUsed(model_used);
      setSugTab('ai');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI suggestions failed');
    } finally {
      clearInterval(timer);
      setAiLoading(false);
    }
  }, [resumeText, jdText, result]);

  /* --- Review step --- */
  const handleReview = useCallback(() => { setStep('review'); setNewScore(null); setScoreError(null); }, []);
  const handleCheckScore = useCallback(async () => {
    setScoring(true); setScoreError(null);
    try { setNewScore(await reAnalyzeResume(resumeText, jdText)); } catch (e) { setScoreError(e instanceof Error ? e.message : 'Failed'); }
    finally { setScoring(false); }
  }, [resumeText, jdText]);

  const handleConfirmDownload = useCallback(async () => {
    setDownloading(true); setDownloadError(null);
    try {
      const blob = await downloadModifiedPdf(originalPdf, result.resume_text, resumeText);
      const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u;
      a.download = `${originalPdf.name.replace('.pdf', '')}_improved.pdf`; a.click(); URL.revokeObjectURL(u);
    } catch (e) { setDownloadError(e instanceof Error ? e.message : 'Failed'); }
    finally { setDownloading(false); }
  }, [originalPdf, result.resume_text, resumeText]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(resumeText);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [resumeText]);

  const diffLines = useMemo(() => computeDiffLines(result.resume_text, resumeText), [result.resume_text, resumeText]);
  const addedCount = diffLines.filter(l => l.type === 'added').length;
  const removedCount = diffLines.filter(l => l.type === 'removed').length;

  /* ================================================================ */
  return (
    <motion.section id="resume-builder" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }}>
      {/* ===== STEP INDICATOR ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
        <motion.button id="back-to-results" className="btn-primary" style={{ maxWidth: 130, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={onBack} whileTap={{ scale: 0.95 }}>
          <ArrowLeft size={14} /> Results
        </motion.button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <div onClick={() => setStep('edit')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-md)',
            background: step === 'edit' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)', color: step === 'edit' ? '#fff' : 'var(--text-muted)',
            fontWeight: step === 'edit' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <Pencil size={13} /> Edit & Optimize
          </div>
          <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
          <div onClick={() => hasChanges && handleReview()} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.8rem', borderRadius: 'var(--radius-md)',
            background: step === 'review' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)', color: step === 'review' ? '#fff' : 'var(--text-muted)',
            fontWeight: step === 'review' ? 600 : 400, cursor: hasChanges ? 'pointer' : 'not-allowed', opacity: hasChanges ? 1 : 0.45, transition: 'all 0.2s',
          }}>
            <ShieldCheck size={13} /> Review & Save
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ============================================================ */}
        {/*  STEP 1 — EDIT & OPTIMIZE                                     */}
        {/* ============================================================ */}
        {step === 'edit' && (
          <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}>
            {/* Top bar */}
            <div className="glass-card" style={{ padding: '0.75rem 1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{appliedCount + aiAppliedCount} suggestions applied</span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {/* AI Optimize button */}
                <motion.button
                  id="ai-optimize-btn"
                  className="btn-primary"
                  style={{ maxWidth: 200, padding: '0.35rem 0.7rem', fontSize: '0.78rem', background: aiLoading ? undefined : 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
                  onClick={handleFetchAi}
                  disabled={aiLoading}
                  whileTap={{ scale: 0.95 }}
                >
                  {aiLoading ? <><Loader2 size={13} className="loader" /> AI Analyzing…</> : <><Brain size={14} /> AI Optimize ✨</>}
                </motion.button>
                {totalAddable - appliedCount > 0 && (
                  <motion.button className="btn-primary" style={{ maxWidth: 140, padding: '0.35rem 0.6rem', fontSize: '0.76rem' }} onClick={applyAll} whileTap={{ scale: 0.95 }}>
                    <Zap size={12} /> Apply All ({totalAddable - appliedCount})
                  </motion.button>
                )}
                <motion.button
                  id="proceed-review"
                  className="btn-primary"
                  style={{ maxWidth: 160, padding: '0.35rem 0.6rem', fontSize: '0.76rem', opacity: hasChanges ? 1 : 0.35 }}
                  disabled={!hasChanges}
                  onClick={handleReview}
                  whileTap={{ scale: 0.95 }}
                >
                  Review <ArrowRight size={12} />
                </motion.button>
              </div>
            </div>

            {/* AI error */}
            {aiError && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', marginBottom: '0.75rem', color: 'var(--danger)', fontSize: '0.82rem' }}>
                <XCircle size={14} style={{ marginRight: 4 }} /> {aiError}
              </div>
            )}

            {/* Panel toggle */}
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem' }}>
              {[{ k: 'editor' as const, icon: <Pencil size={12} />, label: 'Editor' }, { k: 'preview' as const, icon: <Eye size={12} />, label: 'PDF Preview' }].map(p => (
                <button key={p.k} className={`skill-tag ${activePanel === p.k ? 'tag-matched' : 'tag-extra'}`} style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => setActivePanel(p.k)}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>

            {/* Main split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.15rem', alignItems: 'start' }}>
              {/* LEFT — Editor or Preview */}
              <div className="glass-card" style={{ padding: '1.1rem', minHeight: 520 }}>
                {activePanel === 'editor' ? (
                  <>
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      <Pencil size={14} /> Live Resume Editor
                    </h3>
                    <textarea id="resume-editor" value={resumeText} onChange={e => setResumeText(e.target.value)}
                      style={{ minHeight: 480, fontFamily: "'Inter', monospace", fontSize: '0.85rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>{resumeText.trim().split(/\s+/).length} words</span>
                      <span>{resumeText.length} chars</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      <Eye size={14} /> Original PDF
                    </h3>
                    {pdfPreviewUrl ? (
                      <iframe id="pdf-preview" src={pdfPreviewUrl} title="PDF Preview" style={{ width: '100%', height: 500, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'white' }} />
                    ) : <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
                  </>
                )}
              </div>

              {/* RIGHT — Suggestions panel */}
              <div style={{ position: 'sticky', top: '1rem' }}>
                <div className="glass-card" style={{ padding: '0.9rem', maxHeight: 'calc(100vh - 4rem)', overflowY: 'auto' }}>
                  {/* Suggestion tab toggle */}
                  <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.7rem' }}>
                    <button className={`skill-tag ${sugTab === 'rules' ? 'tag-matched' : 'tag-extra'}`} style={{ cursor: 'pointer', fontSize: '0.76rem', padding: '0.25rem 0.55rem' }} onClick={() => setSugTab('rules')}>
                      <Lightbulb size={12} style={{ marginRight: 3 }} /> Quick Fixes ({suggestions.length})
                    </button>
                    <button className={`skill-tag ${sugTab === 'ai' ? 'tag-matched' : 'tag-extra'}`} style={{ cursor: 'pointer', fontSize: '0.76rem', padding: '0.25rem 0.55rem' }} onClick={() => setSugTab('ai')}>
                      <Brain size={12} style={{ marginRight: 3 }} /> AI Powered ({aiSuggestions.length})
                    </button>
                  </div>

                  {/* RULE-BASED TAB */}
                  {sugTab === 'rules' && (
                    <AnimatePresence mode="popLayout">
                      {suggestions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.84rem', padding: '0.5rem 0' }}>No quick fix suggestions.</p>
                      ) : suggestions.map((sug, i) => (
                        <motion.div key={sug.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: sug.applied ? 0.4 : 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02 }}
                          className={`suggestion-box priority-${sug.priority}`} style={{ marginBottom: '0.45rem', ...(sug.applied ? { pointerEvents: 'none' as const } : {}) }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            {priorityIcon(sug.priority)}
                            <span style={{ fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>{sug.title}</span>
                            <span style={{ fontSize: '0.55rem', fontWeight: 600, textTransform: 'uppercase', color: priorityBadge(sug.priority).color, padding: '1px 4px', borderRadius: 3, background: `color-mix(in oklch, ${priorityBadge(sug.priority).color} 15%, transparent)` }}>
                              {priorityBadge(sug.priority).text}
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.35, marginBottom: 4 }}>{sug.description}</p>
                          {sug.applied ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontSize: '0.76rem', fontWeight: 600 }}><CheckCircle2 size={12} /> Applied</div>
                          ) : (
                            <motion.button className="btn-primary" style={{ maxWidth: '100%', padding: '0.25rem 0.5rem', fontSize: '0.73rem' }} onClick={() => applySuggestion(sug.id)} whileTap={{ scale: 0.95 }}>
                              <PlusCircle size={11} /> Apply <ChevronRight size={11} />
                            </motion.button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  {/* AI-POWERED TAB */}
                  {sugTab === 'ai' && (
                    <>
                      {aiSuggestions.length === 0 && !aiLoading && (
                        <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                          <Brain size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
                            Get AI-powered suggestions to dramatically improve your resume score.
                          </p>
                          <motion.button id="ai-fetch-panel" className="btn-primary" style={{ maxWidth: 220, margin: '0 auto', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
                            onClick={handleFetchAi} disabled={aiLoading} whileTap={{ scale: 0.95 }}>
                            <Brain size={15} /> Generate AI Suggestions
                          </motion.button>
                        </div>
                      )}

                      {aiLoading && (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                          <Loader2 size={28} className="loader" style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem' }} />
                          <p className="pulsing" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>AI is analyzing your resume…</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.4rem', opacity: 0.6 }}>{aiElapsed}s elapsed</p>
                        </div>
                      )}

                      {aiSuggestions.length > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{aiAppliedCount}/{aiSuggestions.length} applied</span>
                              {aiModelUsed && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2, opacity: 0.7 }}>
                                  Powered by {aiModelUsed.split('/').pop()?.replace(':free', '')}
                                </div>
                              )}
                            </div>
                            {aiSuggestions.some(s => !s.applied) && (
                              <motion.button className="btn-primary" style={{ maxWidth: 110, padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={applyAllAi} whileTap={{ scale: 0.95 }}>
                                <Zap size={11} /> Apply All
                              </motion.button>
                            )}
                          </div>

                          <AnimatePresence mode="popLayout">
                            {aiSuggestions.map((sug, i) => (
                              <motion.div key={`ai-${i}`} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: sug.applied ? 0.4 : 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                                className={`suggestion-box priority-${sug.priority}`}
                                style={{ marginBottom: '0.55rem', ...(sug.applied ? { pointerEvents: 'none' as const } : {}) }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                  {typeIcon(sug.type)}
                                  <span style={{ fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>{sug.title}</span>
                                  <span style={{ fontSize: '0.55rem', fontWeight: 600, textTransform: 'uppercase', color: priorityBadge(sug.priority).color, padding: '1px 4px', borderRadius: 3, background: `color-mix(in oklch, ${priorityBadge(sug.priority).color} 15%, transparent)` }}>
                                    {priorityBadge(sug.priority).text}
                                  </span>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.35, marginBottom: 5 }}>{sug.description}</p>

                                {/* Show original → improved preview */}
                                {sug.type === 'rewrite' && sug.original_text && (
                                  <div style={{ fontSize: '0.72rem', marginBottom: 5, padding: '0.4rem', borderRadius: 4, background: 'rgba(0,0,0,0.2)' }}>
                                    <div style={{ color: 'var(--danger)', textDecoration: 'line-through', opacity: 0.7, marginBottom: 3 }}>{sug.original_text.slice(0, 120)}{sug.original_text.length > 120 ? '…' : ''}</div>
                                    <div style={{ color: 'var(--success)' }}>{sug.improved_text.slice(0, 120)}{sug.improved_text.length > 120 ? '…' : ''}</div>
                                  </div>
                                )}
                                {sug.type === 'add_content' && sug.improved_text && (
                                  <div style={{ fontSize: '0.72rem', marginBottom: 5, padding: '0.4rem', borderRadius: 4, background: 'rgba(0,0,0,0.2)', color: 'var(--success)' }}>
                                    + {sug.improved_text.slice(0, 140)}{sug.improved_text.length > 140 ? '…' : ''}
                                  </div>
                                )}

                                {sug.applied ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontSize: '0.76rem', fontWeight: 600 }}><CheckCircle2 size={12} /> Applied</div>
                                ) : (
                                  <motion.button className="btn-primary" style={{ maxWidth: '100%', padding: '0.25rem 0.5rem', fontSize: '0.73rem' }} onClick={() => applyAiSuggestion(i)} whileTap={{ scale: 0.95 }}>
                                    <Wand2 size={11} /> Apply This <ChevronRight size={11} />
                                  </motion.button>
                                )}
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/*  STEP 2 — REVIEW & SAVE                                       */}
        {/* ============================================================ */}
        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.15rem', alignItems: 'start' }}>
              {/* LEFT — Diff */}
              <div className="glass-card" style={{ padding: '1.15rem' }}>
                <h3 style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                  <GitCompareArrows size={15} /> Changes Review
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    <span style={{ color: 'var(--success)' }}>+{addedCount}</span>{' '}
                    <span style={{ color: 'var(--danger)' }}>-{removedCount}</span> lines
                  </span>
                </h3>
                <div id="diff-view" style={{ maxHeight: 500, overflowY: 'auto', fontFamily: "'Inter', monospace", fontSize: '0.8rem', lineHeight: 1.55, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', padding: '0.65rem', background: 'rgba(0,0,0,0.2)' }}>
                  {diffLines.map((line, i) => (
                    <div key={i} style={{
                      padding: '1px 5px', borderRadius: 2, marginBottom: 1,
                      background: line.type === 'added' ? 'rgba(34,197,94,0.12)' : line.type === 'removed' ? 'rgba(239,68,68,0.12)' : 'transparent',
                      color: line.type === 'added' ? 'var(--success)' : line.type === 'removed' ? 'var(--danger)' : 'var(--text-secondary)',
                      textDecoration: line.type === 'removed' ? 'line-through' : 'none', opacity: line.type === 'same' ? 0.5 : 1,
                    }}>
                      <span style={{ userSelect: 'none', opacity: 0.5, marginRight: 6 }}>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span>
                      {line.text || '\u00A0'}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — Score & Confirm */}
              <div style={{ position: 'sticky', top: '1rem' }}>
                <div className="glass-card" style={{ padding: '1.1rem', marginBottom: '0.85rem' }}>
                  <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                    <BarChart3 size={15} /> Score Check
                  </h3>
                  {/* Original */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 1 }}>Original</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: scoreColor(result.ats_score) }}>{result.ats_score}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{result.score_label}</div>
                  </div>
                  {/* New score */}
                  {newScore ? (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)', border: `1px solid ${scoreColor(newScore.ats_score)}`, marginBottom: '0.85rem' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 1 }}>New Score</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ fontSize: '1.7rem', fontWeight: 700, color: scoreColor(newScore.ats_score) }}>{newScore.ats_score}</div>
                        {(() => { const d = newScore.ats_score - result.ats_score; if (d === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No change</span>; return <span style={{ color: d > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.9rem' }}>{d > 0 ? `↑ +${d.toFixed(1)}` : `↓ ${d.toFixed(1)}`}</span>; })()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{newScore.score_label}</div>
                      <div style={{ marginTop: '0.6rem' }}>
                        {[
                          { l: 'Skill', k: 'skill_score' as const }, 
                          { l: 'Content', k: 'sbert_score' as const }, 
                          { l: 'Keyword', k: 'tfidf_score' as const },
                          { l: 'Format', k: 'formatting_score' as const }
                        ].map(x => {
                          const ov = result.matching_scores[x.k], nv = newScore.matching_scores[x.k], d = nv - ov;
                          return <div key={x.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{x.l}</span>
                            <span><span style={{ color: 'var(--text-secondary)' }}>{ov.toFixed(1)}</span> <span style={{ color: 'var(--text-muted)', margin: '0 3px' }}>→</span> <span style={{ fontWeight: 600, color: d >= 0 ? 'var(--success)' : 'var(--danger)' }}>{nv.toFixed(1)}</span></span>
                          </div>;
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button id="check-score-btn" className="btn-primary" style={{ width: '100%', marginBottom: '0.85rem' }} onClick={handleCheckScore} disabled={scoring} whileTap={{ scale: 0.97 }}>
                      {scoring ? <><Loader2 size={15} className="loader" /> Checking…</> : <><BarChart3 size={15} /> Check New Score</>}
                    </motion.button>
                  )}
                  {scoreError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.6rem' }}><XCircle size={13} style={{ marginRight: 3 }} /> {scoreError}</div>}
                </div>

                {/* Confirm */}
                <div className="glass-card" style={{ padding: '1.1rem' }}>
                  <h3 style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                    <ShieldCheck size={15} /> Confirm & Save
                  </h3>
                  {downloadError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>⚠️ {downloadError}</div>}
                  <motion.button id="confirm-download-pdf" className="btn-primary" style={{ width: '100%', marginBottom: '0.5rem', padding: '0.6rem 0.9rem' }} onClick={handleConfirmDownload} disabled={downloading} whileTap={{ scale: 0.97 }}>
                    {downloading ? <><Loader2 size={15} className="loader" /> Generating…</> : <><Download size={15} /> Confirm & Download PDF</>}
                  </motion.button>
                  <motion.button id="copy-text-btn" className="btn-primary" style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.9rem' }} onClick={handleCopy} whileTap={{ scale: 0.97 }}>
                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy as Text</>}
                  </motion.button>
                  <motion.button className="btn-primary" style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.9rem', marginTop: '0.5rem', opacity: 0.6 }} onClick={() => setStep('edit')} whileTap={{ scale: 0.97 }}>
                    <ArrowLeft size={13} /> Back to Editor
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
