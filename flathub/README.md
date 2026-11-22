# PneuGineer on Flathub

This folder holds everything Flathub needs to publish PneuGineer as
`io.github.bibbi88.PneuGineer`:

| File                                        | What it is                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `io.github.bibbi88.PneuGineer.yml`          | The manifest: how Flathub builds the app. It goes to Flathub.                   |
| `io.github.bibbi88.PneuGineer.metainfo.xml` | Name, description, screenshots, licence, releases - what software centres show. |
| `io.github.bibbi88.PneuGineer.desktop`      | The app menu entry; opens `.pgcl` files.                                        |
| `io.github.bibbi88.PneuGineer.mime.xml`     | The `.pgcl` file type.                                                          |
| `pneugineer.sh`                             | Starts the app inside the sandbox.                                              |
| `local-manifest.py`                         | Makes a copy of the manifest that builds from a checkout (for the check below). |

The manifest packages the Linux build of a **tagged release** (`PneuGineer-linux-x64.tar.gz`,
built by `.github/workflows/desktop.yml`) on Flathub's Electron base, and takes the files above
and the icons from the same tag. The app gets no access to the home folder: file dialogs go
through the desktop's portal, which gives it the files picked or opened, and nothing else. It
doesn't update itself - Flathub does that. The store screenshots are in `docs/screenshots/`.

## Checking it

`.github/workflows/flathub.yml` builds the Flatpak exactly as Flathub would - offline, with
Flathub's own builder - and runs Flathub's linter on the manifest, the metadata and the built
app. It runs on every push to `dev` touching `desktop/` or `flathub/`, and by hand from the
Actions tab. Its artifact `PneuGineer-flathub-test.flatpak` can be installed to try it out:

```sh
flatpak install --user PneuGineer-flathub-test.flatpak
flatpak run io.github.bibbi88.PneuGineer
```

## Versions

Builds from `main` are numbered `yy.mmdd.<build>` (`26.1119.14`), so each one is higher than
the one before - what the installed Windows and AppImage apps compare when they look for an
update (`.github/desktop-version.sh`). A release for Flathub is a tag in the same form, named
after the day it's made, ending in `.0`: `v26.1201.0`. Tagged releases get a release page of their
own, but aren't marked "latest": the download links and the apps' update check keep following
`main`.

## Releasing a version

1. Pick the version: today's date, `v<yy>.<month*100 + day>.0` - on 1 December 2026 that's
   `v26.1201.0`.
2. Add a `<release version="26.1201.0" date="2026-12-01">` entry at the top of `<releases>` in
   the metainfo file, say in a line or two what's new, and merge to `main`.
3. Tag it: `git tag v26.1201.0 && git push origin v26.1201.0`. The workflow makes a release of
   its own with `PneuGineer-linux-x64.tar.gz` (the desktop app takes the tag's version).
4. In the manifest, set the archive's `url` to that release's file and its `sha256`
   (`sha256sum PneuGineer-linux-x64.tar.gz`), and the git source's `tag` to the new tag and its
   `commit` to that tag's commit (`git rev-list -n 1 v26.1201.0`).

## Submitting to Flathub (the first time)

This has to be done from the GitHub account that owns the app ID (`io.github.bibbi88`).

1. Make a release as above (steps 1-4), so the manifest points at a real file.
2. Fork <https://github.com/flathub/flathub> **with all branches** and create a branch from
   `new-pr`.
3. Add `io.github.bibbi88.PneuGineer.yml` (this folder's manifest) at the top of that branch.
4. Open a pull request against `new-pr`, titled `Add io.github.bibbi88.PneuGineer`. Comment
   `bot, build` on it to get a test build.
5. Answer the reviewers. Once it's merged, Flathub creates
   `github.com/flathub/io.github.bibbi88.PneuGineer`, and you get write access to it.

After that, each new tagged release is picked up by Flathub's checker (the manifest's
`x-checker-data`), which opens a pull request on that repository with the new url and sha256 -
merge it, and Flathub publishes the update.

Flathub's own guide: <https://docs.flathub.org/docs/for-app-authors/submission>.
