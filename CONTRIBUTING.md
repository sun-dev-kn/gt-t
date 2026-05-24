# Contributing to DotGit

**TL;DR:** bug fixes and improvements to existing checks are welcome. New file type checks probably aren't. No HTTP request spamming. If you want to extend it heavily, fork it.

---

Thanks for your interest in contributing. Before opening a pull request, please read this; it will save us both time.

## What DotGit is (and isn't)

DotGit was built specifically to detect exposed `.git` directories. The `.env`, `.hg`, `.svn`, and a few other checks were added because they're high-impact and broadly relevant. The goal has always been a focused, low-noise background tool, not a comprehensive web vulnerability scanner.

## What I'm likely to accept

- Bug fixes
- Performance improvements
- Compatibility fixes (Chrome/Firefox/FF Android)
- Improvements to existing checks

## What I'm unlikely to accept

**New file type checks:** PRs to add checks for `Thumbs.db`, `composer.json`, `Dockerfile`, `docker-compose.yml`, and similar have come in before. I appreciate the idea, but I'm not going to keep adding one-off checks indefinitely. Each new check:

- Adds more requests per page visit, which I actively don't want
- Makes the codebase harder to maintain
- Adds marginal value for most users

If you want to check for many different file types, the right answer is a proper refactor that introduces a **template system**; something along the lines of how [Nuclei](https://github.com/projectdiscovery/nuclei) works, where users define their own checks declaratively. That's a significant architectural change, and honestly I'm not looking to turn this into a "Nuclei browser extension". I built this for myself, made it public, and I'm happy to maintain it, but I'm not going to sink the time a full refactor would require.

## No HTTP request spamming

The extension must remain low-noise. It should not fire multiple requests per site beyond what's strictly necessary. PRs that add parallel or eager probing (fetching N URLs to check if something exists) will not be accepted as-is. If a feature requires probing, it should happen lazily and on user demand only.

## Forks are welcome

DotGit is open source and you're free to fork it, extend it however you like, and publish it to the browser store. If you do, I just ask that:

1. **The license remains open:** don't lock it down.
2. **It's clear it's a fork:** change the icon, the name, or add a visible note like "Fork of DotGit with X added". Don't make users think they're installing the original.

I'm happy to maintain DotGit as it is. I'm not going to merge everything; that's what forks are for.