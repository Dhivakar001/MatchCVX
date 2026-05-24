import { useState, useCallback, useRef } from 'react';
import type { AnalysisResponse } from './api';
import { analyzeResume } from './api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  PlusCircle,
  AlertCircle,
  BarChart3,
  Target,
  Brain,
  Hash,
  Lightbulb,
  RefreshCcw,
  ArrowRight,
  Zap,
  TrendingUp,
  Award,
  Wand2,
} from 'lucide-react';
import ResumeBuilder from './ResumeBuilder';
import './index.css';

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const countWords = (text: string): number =>
  text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--success)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
};

const priorityIcon = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Zap size={18} style={{ color: 'var(--danger)' }} />;
    case 'medium':
      return <TrendingUp size={18} style={{ color: 'var(--warning)' }} />;
    default:
      return <Award size={18} style={{ color: 'var(--success)' }} />;
  }
};

/* ------------------------------------------------------------------ */
/*  animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const tagPop = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 20 } },
};

/* ------------------------------------------------------------------ */
/*  skill tab type                                                     */
/* ------------------------------------------------------------------ */

type SkillTab = 'matched' | 'missing' | 'extra';

/* ------------------------------------------------------------------ */
/*  APP COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function App() {
  /* state */
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<SkillTab>('matched');
  const [showBuilder, setShowBuilder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* handlers */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') setResumeFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setResumeFile(file);
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jdText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeResume(resumeFile, jdText);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setResumeFile(null);
    setJdText('');
    setActiveTab('matched');
    setShowBuilder(false);
  };

  const canSubmit = resumeFile !== null && jdText.trim().length > 0 && !loading;

  /* skill-tab data helper */
  const skillsForTab = () => {
    if (!result) return [];
    const map = {
      matched: result.skill_comparison.matched_skills,
      missing: result.skill_comparison.missing_skills,
      extra: result.skill_comparison.extra_skills,
    };
    return map[activeTab];
  };

  const tabClass = (tab: SkillTab) => (tab === activeTab ? 'tag-matched' : 'tag-extra');

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ==================== HEADER ==================== */}
      <header style={{ textAlign: 'center', padding: '2.5rem 0 1.5rem' }}>
        <motion.h1
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          id="app-title"
        >
          <Sparkles size={32} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          MatchCVX
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', textWrap: 'balance' }}
        >
          Smart ATS Resume Analyzer — AI-Powered Career Intelligence
        </motion.p>
      </header>

      {/* ==================== MAIN ==================== */}
      <main style={{ flex: 1 }}>
        {/* error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              id="error-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: 'var(--danger)',
              }}
            >
              <AlertCircle size={20} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ================== INPUT SECTION ================== */}
          {!result && (
            <motion.section
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              id="input-section"
            >
              <div className="grid-2">
                {/* LEFT: resume upload */}
                <div className="glass-card">
                  <h2>
                    <FileText size={22} /> Resume (PDF)
                  </h2>
                  <div
                    id="resume-dropzone"
                    className={`file-upload ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      id="resume-file-input"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    {resumeFile ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <CheckCircle2 size={36} color="var(--success)" />
                        <span style={{ fontWeight: 600 }}>{resumeFile.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {formatBytes(resumeFile.size)}
                        </span>
                      </motion.div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Upload size={36} color="var(--text-muted)" />
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Drag &amp; drop your PDF or <strong>click to browse</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: JD textarea */}
                <div className="glass-card">
                  <h2>
                    <Target size={22} /> Job Description
                  </h2>
                  <textarea
                    id="jd-textarea"
                    placeholder="Paste the full job description here…"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                  <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    {countWords(jdText)} words
                  </div>
                </div>
              </div>

              {/* analyse button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                <motion.button
                  id="analyze-btn"
                  className="btn-primary"
                  style={{ maxWidth: 340, fontSize: '1.1rem', padding: '1rem 2rem' }}
                  disabled={!canSubmit}
                  onClick={handleAnalyze}
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? (
                    <>
                      <span className="loader" /> Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} /> Compute AI Match <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </div>

              {loading && (
                <motion.p
                  className="pulsing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '1rem' }}
                >
                  Running deep ATS analysis — this takes a few seconds…
                </motion.p>
              )}
            </motion.section>
          )}

          {/* ================== RESUME BUILDER ================== */}
          {result && showBuilder && resumeFile && (
            <ResumeBuilder
              key="builder"
              result={result}
              originalPdf={resumeFile}
              jdText={jdText}
              onBack={() => setShowBuilder(false)}
            />
          )}

          {/* ================== RESULTS DASHBOARD ================== */}
          {result && !showBuilder && (
            <motion.section
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              id="results-section"
            >
              {/* action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <motion.button
                  id="improve-resume-btn"
                  className="btn-primary"
                  style={{ maxWidth: 240 }}
                  onClick={() => setShowBuilder(true)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Wand2 size={18} /> Improve Resume
                </motion.button>
                <motion.button
                  id="reset-btn"
                  className="btn-primary"
                  style={{ maxWidth: 220 }}
                  onClick={handleReset}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCcw size={18} /> New Analysis
                </motion.button>
              </div>

              {/* ---- A. SCORE OVERVIEW ---- */}
              <motion.div
                className="glass-card"
                style={{ marginBottom: '2rem' }}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <div className="grid-2" style={{ alignItems: 'center' }}>
                  {/* score circle */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <motion.div
                      className="score-circle"
                      style={{ borderColor: result.score_color || scoreColor(result.ats_score) }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.15 }}
                    >
                      <motion.span
                        className="score-value"
                        style={{ color: result.score_color || scoreColor(result.ats_score) }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        {result.ats_score}
                      </motion.span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {result.score_label}
                      </span>
                    </motion.div>
                  </div>

                  {/* score breakdown */}
                  <div>
                    <h2>
                      <BarChart3 size={22} /> Score Breakdown
                    </h2>
                    {[
                      { label: 'Skill Match', value: result.matching_scores.skill_score, weight: '40%', icon: <Target size={16} /> },
                      { label: 'Semantic AI', value: result.matching_scores.sbert_score, weight: '30%', icon: <Brain size={16} /> },
                      { label: 'Keyword TF-IDF', value: result.matching_scores.tfidf_score, weight: '30%', icon: <Hash size={16} /> },
                    ].map((item, i) => (
                      <div key={item.label} style={{ marginBottom: '1rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.88rem',
                            marginBottom: 4,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {item.icon} {item.label} ({item.weight})
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.value.toFixed(1)}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden',
                          }}
                        >
                          <motion.div
                            style={{
                              height: '100%',
                              borderRadius: 8,
                              background: 'var(--accent-gradient)',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(item.value, 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.3 + i * 0.15, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* ---- B. STATS ROW ---- */}
              <motion.div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {[
                  {
                    label: 'Matched Skills',
                    value: result.skill_comparison.matched_skills.length,
                    color: 'var(--success)',
                    icon: <CheckCircle2 size={22} />,
                  },
                  {
                    label: 'Missing Skills',
                    value: result.skill_comparison.missing_skills.length,
                    color: 'var(--danger)',
                    icon: <XCircle size={22} />,
                  },
                  {
                    label: 'Extra Skills',
                    value: result.skill_comparison.extra_skills.length,
                    color: 'var(--accent-secondary)',
                    icon: <PlusCircle size={22} />,
                  },
                  {
                    label: 'Resume Words',
                    value: result.resume_word_count,
                    color: 'var(--text-primary)',
                    icon: <FileText size={22} />,
                  },
                ].map((stat) => (
                  <motion.div
                    key={stat.label}
                    className="glass-card"
                    style={{ textAlign: 'center', padding: '1.25rem' }}
                    variants={fadeUp}
                    custom={1}
                  >
                    <div style={{ color: stat.color, marginBottom: 6 }}>{stat.icon}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>

              {/* ---- C. SKILLS TABS ---- */}
              <motion.div
                className="glass-card"
                style={{ marginBottom: '2rem' }}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2}
              >
                <h2>
                  <Sparkles size={22} /> Skills Analysis
                </h2>

                {/* tab bar */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  {(
                    [
                      { key: 'matched' as SkillTab, label: 'Matched ✅', count: result.skill_comparison.matched_skills.length },
                      { key: 'missing' as SkillTab, label: 'Missing ❌', count: result.skill_comparison.missing_skills.length },
                      { key: 'extra' as SkillTab, label: 'Extra ➕', count: result.skill_comparison.extra_skills.length },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      id={`tab-${tab.key}`}
                      className={`skill-tag ${tabClass(tab.key)}`}
                      style={{ cursor: 'pointer', fontSize: '0.9rem', padding: '0.45rem 1rem' }}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* tag cloud */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', minHeight: 40 }}
                  >
                    {skillsForTab().length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No skills in this category.</span>
                    ) : (
                      skillsForTab().map((skill) => (
                        <motion.span
                          key={`${activeTab}-${skill.name}`}
                          className={`skill-tag tag-${activeTab}`}
                          variants={tagPop}
                        >
                          {skill.name}
                          <span style={{ opacity: 0.55, fontSize: '0.75rem', marginLeft: 4 }}>{skill.category}</span>
                        </motion.span>
                      ))
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* ---- D. CATEGORY SCORES ---- */}
              {Object.keys(result.skill_comparison.category_scores).length > 0 && (
                <motion.div
                  className="glass-card"
                  style={{ marginBottom: '2rem' }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={3}
                >
                  <h2>
                    <BarChart3 size={22} /> Category Scores
                  </h2>
                  {Object.entries(result.skill_comparison.category_scores).map(([category, score], i) => (
                    <div key={category} style={{ marginBottom: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.88rem',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{category}</span>
                        <span style={{ fontWeight: 600, color: scoreColor(score) }}>{score.toFixed(0)}%</span>
                      </div>
                      <div
                        style={{
                          height: 10,
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        <motion.div
                          style={{
                            height: '100%',
                            borderRadius: 8,
                            background: scoreColor(score),
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(score, 100)}%` }}
                          transition={{ duration: 0.7, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ---- E. SUGGESTIONS ---- */}
              {result.suggestions.length > 0 && (
                <motion.div
                  className="glass-card"
                  style={{ marginBottom: '2rem' }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={4}
                >
                  <h2>
                    <Lightbulb size={22} /> Suggestions
                  </h2>
                  {[...result.suggestions]
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.priority] - order[b.priority];
                    })
                    .map((sug, i) => (
                      <motion.div
                        key={`${sug.category}-${i}`}
                        className={`suggestion-box priority-${sug.priority}`}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.08 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: 4,
                            fontWeight: 600,
                          }}
                        >
                          {priorityIcon(sug.priority)} {sug.title}
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              fontWeight: 500,
                              color: 'var(--text-muted)',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {sug.category} · {sug.priority}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                          {sug.description}
                        </p>
                      </motion.div>
                    ))}
                </motion.div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer
        style={{
          textAlign: 'center',
          padding: '2rem 0 1.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          borderTop: '1px solid var(--border-color)',
          marginTop: '2rem',
        }}
      >
        <span style={{ fontWeight: 600 }}>MatchCVX</span> · Smart ATS Resume Analyzer
      </footer>
    </div>
  );
}
