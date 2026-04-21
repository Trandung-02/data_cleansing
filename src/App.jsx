import { useState, useCallback, useRef } from 'react'
import styles from './App.module.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract email (segment after the last `|`) for comparison */
const getEmail = (line) => {
  const idx = line.lastIndexOf('|')
  return idx === -1
    ? line.trim().toLowerCase()
    : line.slice(idx + 1).trim().toLowerCase()
}

const parseLines = (text) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean)

/**
 * Chunked async loop — yields to the event loop every `size` items
 * so the browser stays responsive with large datasets (1M+ lines).
 */
const chunkAsync = (items, size, fn, onProgress) =>
  new Promise((resolve) => {
    let i = 0
    const tick = () => {
      const end = Math.min(i + size, items.length)
      for (; i < end; i++) fn(items[i])
      onProgress(i / items.length)
      if (i < items.length) setTimeout(tick, 0)
      else resolve()
    }
    tick()
  })

// ── Sub-components ───────────────────────────────────────────────────────────

function PanelHeader({ title, badgeClass, count, text, filename, onClear }) {
  const copy = () => navigator.clipboard.writeText(text)
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className={styles.ph}>
      <span className={styles.phTitle}>
        {title}
        <span className={`${styles.badge} ${styles[badgeClass]}`}>
          {count.toLocaleString('vi-VN')}
        </span>
      </span>
      <div className={styles.phActions}>
        <button className={styles.iconBtn} onClick={copy} title="Copy">
          📋 Copy
        </button>
        <button className={styles.iconBtn} onClick={download} title="Tải xuống .txt">
          ⬇
        </button>
        {onClear && (
          <button className={styles.iconBtn} onClick={onClear} title="Xóa">
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

function SchemaStrip() {
  return (
    <div className={styles.schema}>
      <b>Tên Page</b>
      <span className={styles.schemaSep}>|</span>
      <b>Email</b>
      &nbsp;·&nbsp;So sánh theo <b>Email</b>
    </div>
  )
}

function Toast({ msg, type }) {
  return <div className={`${styles.toast} ${styles[type]}`}>{msg}</div>
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = (msg, type = 'ok') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const lA = textA ? parseLines(textA).length : 0
  const lB = textB ? parseLines(textB).length : 0
  const lR = result ? parseLines(result).length : 0

  // Main operation
  const run = useCallback(async () => {
    if (!textB.trim()) {
      showToast('⚠ Danh sách B đang trống!', 'err')
      return
    }

    setBusy(true)
    setProgress(0)
    setResult('')

    // Phase 1: build email Set from A
    const linesA = parseLines(textA)
    const emailsA = new Set()
    await chunkAsync(
      linesA,
      50_000,
      (l) => emailsA.add(getEmail(l)),
      (p) => setProgress(p * 0.5)
    )

    // Phase 2: filter B — keep only lines whose email is NOT in A
    const linesB = parseLines(textB)
    const out = []
    await chunkAsync(
      linesB,
      50_000,
      (l) => { if (!emailsA.has(getEmail(l))) out.push(l) },
      (p) => setProgress(0.5 + p * 0.5)
    )

    setProgress(1)
    setResult(out.join('\n'))
    setBusy(false)
    showToast(
      `✅ Xong! ${out.length.toLocaleString('vi-VN')} dòng trong B không có trong A`
    )
  }, [textA, textB])

  const clearAll = () => { setTextA(''); setTextB(''); setResult('') }

  return (
    <div className={styles.app}>

      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <div className={styles.logo}>
          ⚙ Data<span>Filter</span>
        </div>
        <div className={styles.sep} />
        <button className={styles.btnRun} onClick={run} disabled={busy}>
          {busy ? `⏳ ${Math.round(progress * 100)}%…` : '▶  Lọc B không có A'}
        </button>
        <button className={styles.btnGhost} onClick={clearAll}>
          🗑 Xóa tất cả
        </button>
        <span className={styles.hint}>
          Cấu trúc: Tên Page | Email · So sánh theo Email
        </span>
      </header>

      {/* ── Progress bar ── */}
      <div className={styles.progWrap}>
        <div
          className={styles.progBar}
          style={{
            width: `${Math.round(progress * 100)}%`,
            opacity: busy ? 1 : 0,
          }}
        />
      </div>

      {/* ── 3 Panels ── */}
      <main className={styles.panels}>

        {/* List A */}
        <div className={styles.panel}>
          <PanelHeader
            title="Danh sách A"
            badgeClass="badgeA"
            count={lA}
            text={textA}
            filename="list_a.txt"
            onClear={() => setTextA('')}
          />
          <SchemaStrip />
          <textarea
            className={styles.ta}
            value={textA}
            onChange={(e) => setTextA(e.target.value)}
            placeholder={'Shop ABC|abc@gmail.com\nCửa hàng XYZ|xyz@gmail.com\n...'}
            spellCheck={false}
          />
        </div>

        {/* List B */}
        <div className={styles.panel}>
          <PanelHeader
            title="Danh sách B"
            badgeClass="badgeB"
            count={lB}
            text={textB}
            filename="list_b.txt"
            onClear={() => setTextB('')}
          />
          <SchemaStrip />
          <textarea
            className={styles.ta}
            value={textB}
            onChange={(e) => setTextB(e.target.value)}
            placeholder={'Shop Mới|new@gmail.com\nPage Test|test@gmail.com\n...'}
            spellCheck={false}
          />
        </div>

        {/* Output */}
        <div className={styles.panel}>
          <PanelHeader
            title="Có B — không có A"
            badgeClass="badgeOut"
            count={lR}
            text={result}
            filename="b_not_in_a.txt"
          />
          <SchemaStrip />
          <textarea
            className={`${styles.ta} ${styles.taOut}`}
            value={result}
            readOnly
            placeholder={'Kết quả hiện ở đây\nsau khi nhấn ▶ Lọc B không có A…'}
            spellCheck={false}
          />
        </div>

      </main>

      {/* ── Status bar ── */}
      <footer className={styles.statusbar}>
        <span className={styles.statusLeft}>
          <span className={`${styles.dot} ${busy ? styles.dotBusy : ''}`} />
          {busy ? 'Đang xử lý…' : 'Sẵn sàng'}
        </span>
        <span>A: <b className={styles.stVal}>{lA.toLocaleString('vi-VN')}</b></span>
        <span>B: <b className={styles.stVal}>{lB.toLocaleString('vi-VN')}</b></span>
        {lR > 0 && (
          <span>Kết quả: <b className={styles.stVal}>{lR.toLocaleString('vi-VN')}</b></span>
        )}
        <span className={styles.statusRight}>
          Set O(1) · chunk 50k/tick · không giới hạn dòng
        </span>
      </footer>

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
