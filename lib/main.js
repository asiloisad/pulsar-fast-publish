const { CompositeDisposable } = require("atom");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

// Try to get GitShellOutStrategy from the github package for better git integration
let GitStrategy = null;
function getGitStrategy() {
  if (GitStrategy) return GitStrategy;
  try {
    const githubPkg = atom.packages.getLoadedPackage("github");
    if (githubPkg) {
      const gitShellOutStrategy = require(
        path.join(githubPkg.path, "lib", "git-shell-out-strategy"),
      );
      GitStrategy = gitShellOutStrategy.default || gitShellOutStrategy;
    }
  } catch (e) {
    // github package not available
  }
  return GitStrategy;
}

// Strip ANSI color codes from string
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

// Remove stale git index.lock file if it exists
function removeGitLockFile(repoPath) {
  const lockFile = path.join(repoPath, ".git", "index.lock");
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      return true;
    }
  } catch (error) {
    // Ignore errors
  }
  return false;
}

/**
 * Fast Publish
 * Provides automated version bumping and git tagging for package releases.
 * Supports major, minor, and patch version increments.
 */
module.exports = {
  /**
   * Activates the package and registers publishing commands.
   */
  activate() {
    this.disposables = new CompositeDisposable(
      atom.commands.add(".tree-view", {
        "fast-publish:git-major": this.forSelected((p) => this.publish(p, "major")),
        "fast-publish:git-minor": this.forSelected((p) => this.publish(p, "minor")),
        "fast-publish:git-patch": this.forSelected((p) => this.publish(p, "patch")),
        "fast-publish:git-major-if": this.forSelected((p) => this.publish(p, "major-if")),
        "fast-publish:git-minor-if": this.forSelected((p) => this.publish(p, "minor-if")),
        "fast-publish:git-patch-if": this.forSelected((p) => this.publish(p, "patch-if")),
        "fast-publish:ppm-major": this.forSelected((p) => this.ppmPublish(p, "major")),
        "fast-publish:ppm-minor": this.forSelected((p) => this.ppmPublish(p, "minor")),
        "fast-publish:ppm-patch": this.forSelected((p) => this.ppmPublish(p, "patch")),
        "fast-publish:ppm-major-if": this.forSelected((p) => this.ppmPublish(p, "major-if")),
        "fast-publish:ppm-minor-if": this.forSelected((p) => this.ppmPublish(p, "minor-if")),
        "fast-publish:ppm-patch-if": this.forSelected((p) => this.ppmPublish(p, "patch-if")),
        "fast-publish:ppm-tag": this.forSelected((p) => this.ppmPublishTag(p)),
      }),
    );
  },

  forSelected(fn) {
    return (e) => {
      const entry = e.target.closest(".entry");
      if (entry && typeof entry.getPath === "function") {
        const selectedPath = entry.getPath();
        if (fs.statSync(selectedPath).isDirectory()) {
          fn(selectedPath);
        }
      }
    };
  },

  /**
   * Deactivates the package and disposes resources.
   */
  deactivate() {
    this.disposables.dispose();
  },

  /**
   * Increments a semantic version number based on the specified mode.
   * @param {string} version - The current version string (e.g., "1.2.3")
   * @param {string} mode - The increment mode: 'major', 'minor', or 'patch'
   * @returns {string} The incremented version string
   */
  increaseVersionNumber(version, mode) {
    version = version.split(".");
    if (mode === "major") {
      version[0] = parseInt(version[0]) + 1;
      version[1] = "0";
      version[2] = "0";
    } else if (mode === "minor") {
      version[1] = parseInt(version[1]) + 1;
      version[2] = "0";
    } else if (mode === "patch") {
      version[2] = parseInt(version[2]) + 1;
    }
    return version.join(".");
  },

  /**
   * Checks if there are changes since the last git tag.
   * Uses github package's git strategy when available.
   * @param {string} cwd - The working directory path
   * @returns {Promise<boolean>} True if there are changes, false otherwise
   */
  async hasChangesSinceLastTag(cwd) {
    removeGitLockFile(cwd);
    try {
      const Strategy = getGitStrategy();
      if (Strategy) {
        const git = new Strategy(cwd);
        const lastTag = (await git.exec(["describe", "--tags", "--abbrev=0"])).trim();
        const diff = await git.exec(["diff", `${lastTag}..HEAD`, "--stat"]);
        return diff.trim().length > 0;
      } else {
        const { stdout: lastTag } = await execAsync(`git describe --tags --abbrev=0`, { cwd });
        const { stdout: diff } = await execAsync(`git diff ${lastTag.trim()}..HEAD --stat`, {
          cwd,
        });
        return diff.trim().length > 0;
      }
    } catch {
      // No tags exist or other error - assume there are changes
      return true;
    }
  },

  /**
   * Prepares and executes git commands for version release.
   * Adds all files, commits, tags, and pushes to origin.
   * Uses github package's git strategy when available for better reliability.
   * @param {string} cwd - The working directory path
   * @param {string} version - The version string for the release
   */
  async gitPrepare(cwd, version) {
    const pkgName = path.basename(cwd);
    const commitMessage = `Prepare v${version} release`;
    const tag = `v${version}`;

    // Remove stale lock file before git operations
    removeGitLockFile(cwd);

    try {
      const Strategy = getGitStrategy();
      if (Strategy) {
        // Use github package's git strategy
        const git = new Strategy(cwd);
        await git.exec(["add", "--all"]);
        await git.exec(["commit", "--all", "-m", commitMessage]);
        await git.exec(["tag", "-a", tag, "-m", commitMessage]);
        await git.exec(["push", "origin", "--tags"]);
      } else {
        // Fallback to exec
        await execAsync(`git add --all`, { cwd });
        await execAsync(`git commit --all -m "${commitMessage}"`, { cwd });
        await execAsync(`git tag -a ${tag} -m "${commitMessage}"`, { cwd });
        await execAsync(`git push origin --tags`, { cwd });
      }
      atom.notifications.addSuccess(`Fast Publish: ${pkgName} v${version} published`);
    } catch (err) {
      atom.notifications.addError(`Fast Publish: failed`, {
        detail: err.stderr || err.stdErr || err.message,
        dismissable: true,
      });
    }
  },

  /**
   * Publishes a package by updating version and triggering git release.
   * @param {string} dirPath - The directory path of the package
   * @param {string} mode - The version increment mode
   */
  async publish(dirPath, mode) {
    const pkgName = path.basename(dirPath);
    if (mode.endsWith("-if")) {
      const hasChanges = await this.hasChangesSinceLastTag(dirPath);
      if (!hasChanges) {
        atom.notifications.addInfo(`Fast Publish: ${pkgName} has no changes since last tag`);
        return;
      }
      mode = mode.slice(0, -3);
    }
    const jsonPath = path.join(dirPath, "package.json");
    try {
      const content = await fs.promises.readFile(jsonPath, "utf8");
      const data = JSON.parse(content);
      const oldVersion = data.version;
      const newVersion = this.increaseVersionNumber(oldVersion, mode);
      data.version = newVersion;
      await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
      atom.notifications.addInfo(
        `Fast Publish: version updated from v${oldVersion} to v${newVersion}`,
      );
      await this.gitPrepare(dirPath, newVersion);
    } catch (err) {
      atom.notifications.addError("Fast Publish: failed", {
        detail: err.message,
        dismissable: true,
      });
    }
  },

  /**
   * Publishes a package using PPM (Pulsar Package Manager).
   * @param {string} dirPath - The directory path of the package
   * @param {string} mode - The version increment mode
   */
  async ppmPublish(dirPath, mode) {
    const pkgName = path.basename(dirPath);
    if (mode.endsWith("-if")) {
      const hasChanges = await this.hasChangesSinceLastTag(dirPath);
      if (!hasChanges) {
        atom.notifications.addInfo(`PPM Publish: ${pkgName} has no changes since last tag`);
        return;
      }
      mode = mode.slice(0, -3);
    }
    // Remove stale lock file before ppm publish (which uses git internally)
    removeGitLockFile(dirPath);
    atom.notifications.addInfo(`PPM Publish: publishing ${pkgName} as ${mode}...`);
    try {
      const { stdout } = await execAsync(`ppm publish ${mode}`, { cwd: dirPath });
      atom.notifications.addSuccess(`PPM Publish: ${pkgName} published`, {
        detail: stripAnsi(stdout),
      });
      await this.gitPush(dirPath);
    } catch (err) {
      atom.notifications.addError(`PPM Publish: failed to publish ${pkgName}`, {
        detail: stripAnsi(err.stderr || err.message),
        dismissable: true,
      });
      // ppm may have committed and tagged locally before failing; push to keep git in sync
      await this.gitPushWithTags(dirPath);
      const tag = await this.getLatestTag(dirPath);
      if (tag) {
        atom.notifications.addInfo(
          `PPM Publish: use "PPM Publish > last Tag" to retry publishing ${tag}`,
        );
      }
    }
  },

  /**
   * Gets the latest git tag for the repository.
   * @param {string} cwd - The working directory path
   * @returns {Promise<string|null>} The latest tag or null if none exists
   */
  async getLatestTag(cwd) {
    removeGitLockFile(cwd);
    try {
      const Strategy = getGitStrategy();
      if (Strategy) {
        const git = new Strategy(cwd);
        return (await git.exec(["describe", "--tags", "--abbrev=0"])).trim();
      } else {
        const { stdout } = await execAsync(`git describe --tags --abbrev=0`, { cwd });
        return stdout.trim();
      }
    } catch {
      return null;
    }
  },

  /**
   * Publishes the latest git tag to PPM.
   * @param {string} dirPath - The directory path of the package
   */
  async ppmPublishTag(dirPath) {
    const pkgName = path.basename(dirPath);
    const tag = await this.getLatestTag(dirPath);
    if (!tag) {
      atom.notifications.addError(`PPM Publish Tag: ${pkgName} has no git tags`);
      return;
    }
    removeGitLockFile(dirPath);
    atom.notifications.addInfo(`PPM Publish Tag: publishing ${pkgName} tag ${tag}...`);
    try {
      const { stdout } = await execAsync(`ppm publish --tag ${tag}`, { cwd: dirPath });
      atom.notifications.addSuccess(`PPM Publish Tag: ${pkgName} ${tag} published`, {
        detail: stripAnsi(stdout),
      });
    } catch (err) {
      atom.notifications.addError(`PPM Publish Tag: failed to publish ${pkgName}`, {
        detail: stripAnsi(err.stderr || err.message),
        dismissable: true,
      });
    }
  },

  /**
   * Pushes commits and tags to origin (used for recovery after ppm failure).
   * @param {string} cwd - The working directory path
   */
  async gitPushWithTags(cwd) {
    removeGitLockFile(cwd);
    try {
      const Strategy = getGitStrategy();
      if (Strategy) {
        const git = new Strategy(cwd);
        await git.exec(["push", "origin", "--tags"]);
      } else {
        await execAsync(`git push origin --tags`, { cwd });
      }
    } catch {
      // Ignore push errors during recovery
    }
  },

  /**
   * Pushes commits to origin.
   * @param {string} cwd - The working directory path
   */
  async gitPush(cwd) {
    const pkgName = path.basename(cwd);
    removeGitLockFile(cwd);
    try {
      const Strategy = getGitStrategy();
      if (Strategy) {
        const git = new Strategy(cwd);
        await git.exec(["push", "origin"]);
      } else {
        await execAsync(`git push origin`, { cwd });
      }
      atom.notifications.addSuccess(`Fast Publish: ${pkgName} pushed to origin`);
    } catch (err) {
      atom.notifications.addError(`Fast Publish: failed to push ${pkgName}`, {
        detail: err.stderr || err.stdErr || err.message,
        dismissable: true,
      });
    }
  },
};
