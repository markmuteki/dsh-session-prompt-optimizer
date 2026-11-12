# Releasing

The plugin ships two ways, and they have to be kept in step:

| Channel | What users run | Update arrives when |
| --- | --- | --- |
| npm | `dsh plugin --profile web add dsh-session-prompt-optimizer` | a new version is published to npm |
| GitHub | `dsh plugin --profile web add github:markmuteki/dsh-session-prompt-optimizer` | a new commit is on `main` **and** they re-run `add` / upgrade (the github source is locked to a commit) |

Nothing is published automatically. A change is visible to other people only after the steps below.

## Checklist

1. **Bump the version in `package.json`.** npm rejects a re-publish of an existing
   version, and dsh-m only offers an upgrade when the version number changes.
   Patch for fixes, minor for behaviour changes.

2. **Run the local gates.**

   ```sh
   node scripts/manifest-check.mjs
   node _prompt_check.mjs          # 45 checks, needs network for the upstream templates
   ```

3. **Commit and push.**

   ```sh
   git add -A
   git commit -m "Release vX.Y.Z"
   git push
   ```

   Pushes go over the repository deploy key:

   ```sh
   GIT_SSH_COMMAND="ssh -i ~/.ssh/github_markmuteki -o IdentitiesOnly=yes" git push
   ```

4. **Publish to npm** from this directory:

   ```sh
   npm publish --access public
   ```

   Publishing is asynchronous: the registry answers `202`, prints
   `Your package is being processed`, and the version appears a few minutes later.
   During that window the web page shows a `0.0.0-stage` placeholder and a second
   `npm publish` fails with `409 Cannot publish over previously staged version`.
   Both are normal — wait, then confirm:

   ```sh
   npm view dsh-session-prompt-optimizer version
   ```

5. **The marketplace listing needs no change.** `data/plugins/markmuteki__dsh-session-prompt-optimizer.yml`
   points at the repository; the catalog rebuild picks up new versions on its own.
   Only touch that entry if the description or category stops being accurate — and
   that goes through a new pull request.

## Credentials

`npm publish` authenticates with a granular access token in `~/.npmrc`
(`//registry.npmjs.org/:_authToken=...`), created on npmjs.com as
**Read and write (publish and stage)** with **Bypass 2FA** checked. npm requires an
interactive 2FA challenge to create tokens, so a new one has to be made in the browser;
it cannot be minted from the CLI.

The current token is named `dsh-publish` and expires 30 days after 2026-11-12.
When it expires the publish fails with `E401`/`E403` — create a fresh token and
replace the line in `~/.npmrc`.

Note that npm is deprecating direct publishing with bypass-2FA tokens for
January 2027. When that lands, publishing moves to `npm stage publish` plus an
approval (`npm stage approve <stage-id>`) or to a trusted publisher configured on
npmjs.com; the approval step always needs 2FA.
