/**
 * dsh-session-prompt-optimizer — client half.
 *
 * Adds one compact button to the composer tool row, right before the model
 * chip. Clicking it posts the draft to the host half; the rewrite is NOT written
 * back on its own. It lands in a comparison card floating above the composer,
 * with the original on the left and the rewrite (editable) on the right, so the
 * message the user actually sends is the one they approved.
 */

window.__ModuleLoader__.load({
  id: 'dsh-session-prompt-optimizer',
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')
    const React = react.default !== undefined ? react.default : react
    const createElement = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useRef = React.useRef

    const PACKAGE = 'dsh-session-prompt-optimizer'
    const BUTTON_SLOT = 'conversation.input.right'
    // Full-width entries ABOVE the composer card, stacked in the composer flex
    // column: the card takes its own row, so it needs no absolute positioning
    // and cannot be clipped by an anchor strip. Order 40 keeps it below the
    // shipped goal/queue cards but above the thin cost strip.
    const PANEL_SLOT = 'conversation.input.dock'
    const PANEL_ID = 'prompt-optimizer-card'
    const PANEL_ORDER = 40
    const ENDPOINT = '/_prompt-optimizer/optimize'
    const STYLE_ID = PACKAGE + '/styles.css'
    const CLIENT_TIMEOUT_MS = 90000
    const ERROR_WINDOW_MS = 8000
    const COPIED_WINDOW_MS = 1600

    const STRINGS = {
      en: {
        idle: 'Optimize prompt',
        hint: 'Rewrite the draft into a sharper prompt · Shift+click: structured · Alt+click: compress',
        working: 'Optimizing…',
        ready: 'The rewrite is ready above the composer',
        panelTitle: 'Prompt optimizer',
        originalLabel: 'Your draft',
        optimizedLabel: 'Rewrite — edit before using',
        apply: 'Use this',
        copy: 'Copy',
        copied: 'Copied',
        dismiss: 'Dismiss',
        contextUsed: '{n} recent messages in view',
        draftChanged: 'the draft changed meanwhile',
        modeAuto: 'balanced',
        modeStructured: 'structured',
        modeConcise: 'compact',
        modeProfessional: 'professional',
        truncated: 'the rewrite may be cut off',
        errors: {
          network: 'Could not reach the DSH service',
          internal: 'The rewrite failed',
          'bad-request': 'The request was rejected',
          'draft-empty': 'The composer is empty',
          'draft-too-long': 'This draft is too long to rewrite',
          'slash-command': 'A slash command cannot be rewritten',
          'no-model': 'No model is selected for this session',
          'llm-unavailable': 'The LLM service is not available',
          busy: 'A rewrite is already running for this session',
          'model-timeout': 'The model took too long',
          'model-error': 'The model call failed',
          'model-empty': 'The model returned nothing usable',
        },
      },
      zh: {
        idle: '优化提示词',
        hint: '把草稿重写成更清晰的提示词 · Shift+点击：结构化 · Alt+点击：压缩精炼',
        working: '正在优化…',
        ready: '优化结果在上方，确认后再写入',
        panelTitle: '提示词优化',
        originalLabel: '你的原文',
        optimizedLabel: '优化后（可直接改）',
        apply: '用这一版',
        copy: '复制',
        copied: '已复制',
        dismiss: '关闭',
        contextUsed: '已参考最近 {n} 条上下文',
        draftChanged: '草稿已改动',
        modeAuto: '平衡',
        modeStructured: '结构化',
        modeConcise: '精简',
        modeProfessional: '专业',
        truncated: '结果可能被截断',
        errors: {
          network: '无法连接 DSH 服务',
          internal: '优化失败',
          'bad-request': '请求被拒绝',
          'draft-empty': '输入框是空的',
          'draft-too-long': '草稿太长，无法优化',
          'slash-command': '斜杠命令不能优化',
          'no-model': '当前会话没有选择模型',
          'llm-unavailable': 'LLM 服务不可用',
          busy: '这个会话正在优化中',
          'model-timeout': '模型响应超时',
          'model-error': '模型调用失败',
          'model-empty': '模型没有返回可用的内容',
        },
      },
    }

    const CSS = `
.dpo-optimize {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 999px;
  corner-shape: round;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
@media (hover: hover) {
  .dpo-optimize:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-brand-primary);
  }
}
.dpo-optimize:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dpo-optimize:disabled {
  opacity: 0.4;
  cursor: default;
}
.dpo-optimize[data-status='busy'] {
  color: var(--dsw-alias-brand-primary);
}
.dpo-optimize[data-status='busy']:disabled {
  opacity: 1;
  cursor: progress;
}
.dpo-optimize[data-status='ready'] {
  color: var(--dsw-alias-state-success-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dpo-optimize[data-status='error'] {
  color: var(--dsw-alias-state-error-primary);
}
.dpo-optimize > svg {
  display: block;
}
.dpo-spin {
  animation: dpo-spin 900ms linear infinite;
  transform-origin: 50% 50%;
}
@keyframes dpo-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dpo-spin {
    animation-duration: 2400ms;
  }
}
.dpo-panel {
  /* In-flow entry of conversation.input.dock: a full-width row stacked above
     the composer card, so it never needs absolute positioning. The width pair
     copies the shipped dock cards' column (GoalBar/Todo): card cap minus the
     dock insets, centered. */
  box-sizing: border-box;
  width: calc(
    100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) -
      var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset)
  );
  max-width: calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(52vh, 420px);
  overflow: auto;
  padding: 10px 12px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-specific-menu);
  color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-panel);
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
}
.dpo-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dpo-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
}
.dpo-chip {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}
.dpo-chip[data-tone='warn'] {
  color: var(--dsw-alias-state-warn-primary);
}
.dpo-grow {
  flex: 1;
  min-width: 0;
}
.dpo-close {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
@media (hover: hover) {
  .dpo-close:hover {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
}
.dpo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-width: 0;
}
@media (max-width: 720px) {
  .dpo-grid {
    grid-template-columns: 1fr;
  }
}
.dpo-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.dpo-label {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}
.dpo-text {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: min(40vh, 320px);
  overflow: auto;
}
.dpo-original {
  color: var(--dsw-alias-label-secondary);
}
.dpo-edited {
  min-height: 96px;
  resize: vertical;
  color: var(--dsw-alias-label-primary);
  outline: none;
}
.dpo-edited:focus {
  border-color: var(--dsw-alias-brand-primary);
}
.dpo-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.dpo-action {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
@media (hover: hover) {
  .dpo-action:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.dpo-action:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dpo-action:disabled {
  opacity: 0.45;
  cursor: default;
}
.dpo-primary {
  border-color: transparent;
  background: var(--dsw-alias-button-info-fill);
  color: var(--dsw-alias-label-on-color);
}
@media (hover: hover) {
  .dpo-primary:hover:not(:disabled) {
    background: var(--dsw-alias-button-info-hover);
  }
}
.dpo-note {
  margin-left: auto;
  font-size: 11px;
  color: var(--dsw-alias-state-warn-primary);
}
`

    /** Rewrites waiting for the user, one per session. The button writes it, the
     * card above the composer reads it, and nothing else in the app sees it. */
    const store = {
      entries: new Map(),
      listeners: new Set(),
      get(sessionId) {
        return this.entries.has(sessionId) ? this.entries.get(sessionId) : null
      },
      set(sessionId, entry) {
        this.entries.set(sessionId, entry)
        this.emit()
      },
      clear(sessionId) {
        if (this.entries.delete(sessionId)) this.emit()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => {
          this.listeners.delete(listener)
        }
      },
      emit() {
        for (const listener of Array.from(this.listeners)) {
          try {
            listener()
          } catch {
            // A broken subscriber must not break the others.
          }
        }
      },
    }

    function useEntry(sessionId) {
      const [, bump] = useState(0)
      useEffect(() => store.subscribe(() => bump((value) => value + 1)), [])
      return typeof sessionId === 'string' && sessionId !== '' ? store.get(sessionId) : null
    }

    function stringsFor(ctx) {
      let active = ''
      try {
        const snapshot = ctx.locale !== undefined && typeof ctx.locale.getLocale === 'function' ? ctx.locale.getLocale() : undefined
        if (snapshot !== undefined && snapshot !== null && typeof snapshot.active === 'string') active = snapshot.active
      } catch {
        active = ''
      }
      if (active === '') {
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') active = navigator.language
        } catch {
          active = ''
        }
      }
      return /^zh/iu.test(active) ? STRINGS.zh : STRINGS.en
    }

    function ensureStyles() {
      const existing = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')
      if (existing !== null) {
        if (existing.textContent !== CSS) existing.textContent = CSS
        return null
      }
      const tag = document.createElement('style')
      tag.dataset.plugin = PACKAGE
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return tag
    }

    function icon(children) {
      return createElement(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          'aria-hidden': 'true',
          focusable: 'false',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        children,
      )
    }

    function glyph(status) {
      if (status === 'busy') {
        return createElement(
          'svg',
          {
            viewBox: '0 0 16 16',
            width: 16,
            height: 16,
            className: 'dpo-spin',
            'aria-hidden': 'true',
            focusable: 'false',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
          },
          createElement('circle', { key: 'track', cx: 8, cy: 8, r: 5.4, strokeOpacity: 0.25 }),
          createElement('path', { key: 'arc', d: 'M8 2.6A5.4 5.4 0 0 1 13.4 8' }),
        )
      }
      if (status === 'ready') {
        return icon([createElement('path', { key: 'ok', d: 'M3.4 8.4 6.4 11.3 12.6 4.9' })])
      }
      if (status === 'error') {
        return icon([
          createElement('circle', { key: 'c', cx: 8, cy: 8, r: 5.4 }),
          createElement('path', { key: 'a', d: 'M8 5.2v3.4' }),
          createElement('path', { key: 'b', d: 'M8 10.9h.01' }),
        ])
      }
      return createElement(
        'svg',
        { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false', fill: 'currentColor' },
        createElement('path', { key: 'big', d: 'M6.4 1.9 7.55 4.75 10.4 5.9 7.55 7.05 6.4 9.9 5.25 7.05 2.4 5.9l2.85-1.15z' }),
        createElement('path', {
          key: 'small',
          opacity: 0.72,
          d: 'M11.9 9.6l.72 1.78 1.78.72-1.78.72-.72 1.78-.72-1.78-1.78-.72 1.78-.72z',
        }),
      )
    }

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      render() {
        return this.state.failed === true ? null : this.props.children
      }
    }

    /**
     * The model the composer is set to submit with, so a rewrite runs on the
     * same model. Read once per render: hooks cannot be called from a handler.
     */
    function readRoute(props) {
      try {
        if (typeof props.useProjection !== 'function') return undefined
        const snapshot = props.useProjection('modelSelection', (value) => value)
        if (snapshot === undefined || snapshot === null) return undefined
        const pending = snapshot.next !== undefined && snapshot.next !== null ? snapshot.next : snapshot.lastUsed
        const candidate = pending !== undefined && pending !== null ? pending : snapshot
        if (
          typeof candidate.provider === 'string' &&
          typeof candidate.model === 'string' &&
          candidate.provider !== '' &&
          candidate.model !== ''
        ) {
          return { provider: candidate.provider, model: candidate.model }
        }
        return undefined
      } catch {
        return undefined
      }
    }

    function modeLabel(strings, mode) {
      if (mode === 'structured') return strings.modeStructured
      if (mode === 'concise') return strings.modeConcise
      if (mode === 'professional') return strings.modeProfessional
      return strings.modeAuto
    }

    function makeButton(ctx) {
      return function PromptOptimizerButton(props) {
        const input = props.useInput((state) => state)
        const actions = props.inputActions
        const route = readRoute(props)
        const strings = stringsFor(ctx)
        const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
        const entry = useEntry(sessionId)

        const [status, setStatus] = useState('idle')
        const [note, setNote] = useState('')
        const busyRef = useRef(false)
        const timerRef = useRef(null)

        useEffect(() => {
          return () => {
            if (timerRef.current !== null) {
              clearTimeout(timerRef.current)
              timerRef.current = null
            }
          }
        }, [])

        function clearTimer() {
          if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
        }

        function schedule(run, delay) {
          clearTimer()
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            run()
          }, delay)
        }

        const draft = typeof input.draft === 'string' ? input.draft : ''
        const phase = typeof input.phase === 'string' ? input.phase : 'plain'
        const empty = draft.trim() === ''
        const disabled = actions === undefined || phase !== 'plain' || status === 'busy' || empty
        const shown = status !== 'idle' ? status : entry !== null ? 'ready' : 'idle'

        async function optimize(mode) {
          const source = draft
          if (source.trim() === '' || busyRef.current || actions === undefined) return
          busyRef.current = true
          clearTimer()
          setStatus('busy')
          setNote('')

          const controller = typeof AbortController === 'function' ? new AbortController() : undefined
          const guard =
            controller === undefined
              ? undefined
              : setTimeout(() => {
                  controller.abort()
                }, CLIENT_TIMEOUT_MS)

          try {
            const body = { text: source, mode }
            if (sessionId !== '') body.sessionId = sessionId
            if (route !== undefined) {
              body.provider = route.provider
              body.model = route.model
            }
            const response = await fetch(ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              ...(controller === undefined ? {} : { signal: controller.signal }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok || payload === null || payload.ok !== true) {
              const code = payload !== null && typeof payload.code === 'string' ? payload.code : ''
              const fallback =
                payload !== null && typeof payload.error === 'string' && payload.error !== ''
                  ? payload.error
                  : strings.errors.network
              throw new Error(strings.errors[code] !== undefined ? strings.errors[code] : fallback)
            }
            const optimized = typeof payload.text === 'string' ? payload.text : ''
            if (optimized.trim() === '') throw new Error(strings.errors['model-empty'])

            // Never overwrite: the rewrite waits above the composer until the user
            // accepts it. Applying is one click away, but it is their click.
            if (sessionId !== '') {
              store.set(sessionId, {
                original: source,
                optimized: optimized.trim(),
                mode,
                truncated: payload.truncated === true,
                context: payload.context !== undefined && payload.context !== null ? payload.context : null,
              })
              setStatus('idle')
              setNote(strings.ready)
              schedule(() => setNote(''), ERROR_WINDOW_MS)
            } else {
              actions.setDraft(optimized.trim())
              setStatus('ready')
              schedule(() => {
                setStatus('idle')
                setNote('')
              }, ERROR_WINDOW_MS)
            }
          } catch (error) {
            setStatus('error')
            setNote(errorText(error, strings))
            schedule(() => {
              setStatus('idle')
              setNote('')
            }, ERROR_WINDOW_MS)
          } finally {
            busyRef.current = false
            if (guard !== undefined) clearTimeout(guard)
          }
        }

        function onClick(event) {
          if (status === 'busy') return
          void optimize(event.shiftKey ? 'structured' : event.altKey ? 'concise' : 'auto')
        }

        const title = note !== '' ? note : shown === 'ready' ? strings.ready : shown === 'idle' ? strings.hint : strings.working

        return createElement(
          'button',
          {
            type: 'button',
            className: 'dpo-optimize',
            'data-status': shown,
            'aria-label': strings.idle,
            'aria-busy': shown === 'busy' ? 'true' : undefined,
            title,
            disabled,
            // Keep the caret in the editor: taking focus would close the composer's
            // selection before the click lands.
            onMouseDown: (event) => event.preventDefault(),
            onClick,
          },
          glyph(shown),
        )
      }
    }

    function makePanel(ctx) {
      return function PromptOptimizerPanel(props) {
        const strings = stringsFor(ctx)
        const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
        const input = props.useInput((state) => state)
        const actions = props.inputActions
        const entry = useEntry(sessionId)

        const [draftText, setDraftText] = useState('')
        const [copied, setCopied] = useState(false)
        const copiedTimer = useRef(null)

        useEffect(() => {
          if (entry !== null) setDraftText(entry.optimized)
          setCopied(false)
        }, [entry])

        useEffect(() => {
          return () => {
            if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
          }
        }, [])

        if (entry === null) return null

        const current = typeof input.draft === 'string' ? input.draft : ''
        const phase = typeof input.phase === 'string' ? input.phase : 'plain'
        const changed = current !== entry.original
        const editable = phase === 'plain' && actions !== undefined
        const canApply = editable && draftText.trim() !== ''
        const contextTurns = entry.context !== null && typeof entry.context.turns === 'number' ? entry.context.turns : 0

        function dismiss() {
          store.clear(sessionId)
        }

        function apply() {
          if (!canApply) return
          actions.setDraft(draftText)
          store.clear(sessionId)
        }

        function copy() {
          const text = draftText
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
              void navigator.clipboard.writeText(text)
              setCopied(true)
              if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
              copiedTimer.current = setTimeout(() => {
                copiedTimer.current = null
                setCopied(false)
              }, COPIED_WINDOW_MS)
            }
          } catch {
            setCopied(false)
          }
        }

        return createElement(
          'section',
          { className: 'dpo-panel', 'aria-label': strings.panelTitle },
          createElement(
            'div',
            { className: 'dpo-head' },
            createElement('span', { className: 'dpo-title' }, strings.panelTitle),
            createElement('span', { className: 'dpo-chip' }, modeLabel(strings, entry.mode)),
            contextTurns > 0
              ? createElement('span', { key: 'ctx', className: 'dpo-chip' }, strings.contextUsed.replace('{n}', String(contextTurns)))
              : null,
            changed ? createElement('span', { key: 'chg', className: 'dpo-chip', 'data-tone': 'warn' }, strings.draftChanged) : null,
            createElement('span', { className: 'dpo-grow' }),
            createElement(
              'button',
              { type: 'button', className: 'dpo-close', 'aria-label': strings.dismiss, title: strings.dismiss, onClick: dismiss },
              '×',
            ),
          ),
          createElement(
            'div',
            { className: 'dpo-grid' },
            createElement(
              'div',
              { className: 'dpo-col' },
              createElement('div', { className: 'dpo-label' }, strings.originalLabel),
              createElement('pre', { className: 'dpo-text dpo-original' }, entry.original),
            ),
            createElement(
              'div',
              { className: 'dpo-col' },
              createElement('div', { className: 'dpo-label' }, strings.optimizedLabel),
              createElement('textarea', {
                className: 'dpo-text dpo-edited',
                value: draftText,
                spellCheck: false,
                readOnly: !editable,
                onChange: (event) => setDraftText(event.target.value),
              }),
            ),
          ),
          createElement(
            'div',
            { className: 'dpo-foot' },
            createElement(
              'button',
              { type: 'button', className: 'dpo-action dpo-primary', disabled: !canApply, onClick: apply },
              strings.apply,
            ),
            createElement('button', { type: 'button', className: 'dpo-action', onClick: copy }, copied ? strings.copied : strings.copy),
            createElement('button', { type: 'button', className: 'dpo-action', onClick: dismiss }, strings.dismiss),
            entry.truncated === true ? createElement('span', { className: 'dpo-note' }, strings.truncated) : null,
          ),
        )
      }
    }

    function errorText(error, strings) {
      if (error !== null && typeof error === 'object') {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') return strings.errors['model-timeout']
        // fetch rejects with a TypeError when the service cannot be reached.
        if (error.name === 'TypeError') return strings.errors.network
        if (typeof error.message === 'string' && error.message !== '') return error.message
      }
      return strings.errors.network
    }

    function guarded(component) {
      return function PromptOptimizerSlot(props) {
        return createElement(ErrorBoundary, null, createElement(component, props))
      }
    }

    const inject = ['slots']

    function apply(ctx) {
      ctx.effect(
        () => {
          const tag = ensureStyles()
          return () => {
            if (tag !== null && tag.parentNode !== null) tag.parentNode.removeChild(tag)
          }
        },
        PACKAGE + ': styles',
      )

      ctx.effect(
        () => {
          const dispose = ctx.slots.inject(BUTTON_SLOT, () =>
            ctx.slots.register({ name: BUTTON_SLOT, id: PACKAGE, order: 0 }, guarded(makeButton(ctx))),
          )
          return () => {
            if (typeof dispose === 'function') dispose()
          }
        },
        PACKAGE + ': composer button',
      )

      ctx.effect(
        () => {
          const dispose = ctx.slots.inject(PANEL_SLOT, () =>
            ctx.slots.register({ name: PANEL_SLOT, id: PANEL_ID, order: PANEL_ORDER }, guarded(makePanel(ctx))),
          )
          return () => {
            if (typeof dispose === 'function') dispose()
          }
        },
        PACKAGE + ': comparison card',
      )
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
