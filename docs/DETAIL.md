![The optimize button inside the composer tool row, left of the model chip](preview.svg)

# Prompt optimizer

One button in the composer tool row. It takes whatever you have typed, rewrites
it into a sharper instruction for the agent, and shows the result in a comparison
card just above the composer — your draft on the left, the rewrite on the right. The
composer is only changed when you accept it.

## Using it

| Gesture | Result |
| --- | --- |
| Click | Rewrite the draft, close to its original length and shape |
| Shift+click | Structured rewrite: goal, then context and constraints, then the finished result |
| Alt+click | Compress: same intent, fewer words |

The button sits just left of the model chip and is disabled while the composer
is empty, while a message is being sent, or while a rewrite is already running.
While a rewrite is waiting for you, the button shows a check mark.

### The comparison card

A finished rewrite opens a card just above the composer:

| Part | What it does |
| --- | --- |
| Left — *Your draft* | The exact text that was sent for rewriting, read-only |
| Right — *Rewrite* | The result, in a normal text field you can edit before using it |
| Chip | Which mode produced it, and how many recent messages it looked at |
| *Use this* | Writes the (possibly edited) rewrite into the composer and closes the card |
| *Copy* | Copies the rewrite to the clipboard, leaving the composer alone |
| *Dismiss* | Closes the card, leaving the composer alone |

If you edited the draft while the request was running, the card says so with a
warning chip: your newer text is never replaced behind your back.

## What the rewrite keeps

- Every intent, fact, file path, name, number, version and constraint already in
  the draft. The optimizer is not allowed to invent a requirement.
- The language of the draft: Chinese stays Chinese, English stays English.
- Code, commands, paths, URLs and quoted strings, copied verbatim.

It drops pleasantries and framing, leads with the task itself, and replaces vague
verbs with the concrete action the draft plainly wants. A draft that is already a
good prompt is left nearly alone. Only the rewritten text comes back: no
preamble, no explanation, no surrounding code fence.

## It reads the session it is rewriting for

A draft written into a running conversation is rarely self-contained: "改一下那个按钮"
means nothing without knowing which button the session has been discussing. So
each rewrite is given a bounded excerpt of the session it is about to speak into:

- the last few messages of the conversation (six at most, 600 characters each,
  roughly 2,400 characters in total),
- the session title and the active goal, when there is one,
- the workspace directory the session runs in.

The instructions that come with it are narrow on purpose: resolve what the draft
leaves implicit, keep the names and decisions the session already established,
never contradict a recorded constraint — and never restate, summarise or answer
the history. When the draft is already self-contained, the excerpt changes
nothing.

The excerpt is read, never written: the plugin adds no messages to the session,
and nothing is persisted beyond the plugin's own cache. It is only sent to the
same model that would receive the message itself. DSH exposes no cross-session
memory service to plugins, so this is the session's own history plus its goal —
not the Hindsight memory pages and not other conversations.

## Where the rewriting instructions come from

The instructions are the `user-optimize` templates of the open-source
[prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) project, not
hand-written text inside this plugin:

| Mode | Template |
| --- | --- |
| Click | User prompt basic optimization |
| Shift+click | Step-by-step planning |
| Alt+click | Basic optimization plus a brevity rule |
| `mode: "professional"` (API only) | Professional optimization |

A background check reads the author's latest GitHub release shortly after the
harness starts and then every six hours. When a new release appears, the six
templates (Chinese and English) are downloaded, validated, and cached on disk;
the next click uses them. Nothing is installed, no restart is needed, and the
plugin keeps working from its cached copy while offline — with the built-in
prompt as the last resort if there has never been a successful download.

The template supplies the method; the plugin still appends its own rules on top of
it. The draft's requirements, numbers, names, paths and acceptance criteria all
have to survive the rewrite — reorganising is allowed, dropping an item to look
tidy is not — and the mode's own shape is stated even when a template is in use,
so structured mode may still grow to twice the draft while concise mode may not.
The output budget follows the draft size and the model's own limit (16,384 tokens
at most), and a rewrite that stops at the token limit is continued once instead
of being handed back cut in half.

The cache lives in `.state/upstream.json` beside the plugin. `GET
/_prompt-optimizer/health` reports the release it is following, and `POST
/_prompt-optimizer/refresh` forces a check immediately. A download that fails
validation is discarded whole, so a format change upstream can never leave the
plugin half-updated.

## Which model runs it

The model your composer is set to submit with, so a rewrite is produced by the
same model that will act on it. When that is unavailable the plugin falls back to
the session's agent options and then to the harness default model. Reasoning
effort is pinned to the lowest level the model declares, so the thinking budget
cannot swallow the answer.

## Limits

- **Accepting replaces the whole draft.** `setDraft` writes plain text and drops
  inline reference chips; a chip showing a file becomes that file's `@path` text.
  That is why the card asks first.
- Slash commands are refused: rewriting one would break the command.
- Drafts over 12,000 characters are refused.
- One rewrite per session at a time; a second click while the first is still
  running is rejected instead of queueing.
- The host gives up after 45 seconds; the client after 90.

## Configuration

None that you have to set. The plugin serves three same-origin routes on the
harness web server — `/_prompt-optimizer/optimize`, `/_prompt-optimizer/health`
and `/_prompt-optimizer/refresh` — and follows the upstream releases on its own.
