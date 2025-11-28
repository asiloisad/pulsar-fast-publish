const { CompositeDisposable, Disposable } = require("atom");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const SelectListView = require("atom-select-list");

const execAsync = promisify(exec);

// Try to get GitShellOutStrategy from the github package for better git integration
let GitStrategy = null;
function getGitStrategy() {
  if (GitStrategy) return GitStrategy;
  try {
    const githubPkg = atom.packages.getLoadedPackage('github');
    if (githubPkg) {
      const gitShellOutStrategy = require(path.join(githubPkg.path, 'lib', 'git-shell-out-strategy'));
      GitStrategy = gitShellOutStrategy.default || gitShellOutStrategy;
    }
  } catch (e) {
    // github package not available
  }
  return GitStrategy;
}

// Remove stale git index.lock file if it exists
function removeGitLockFile(repoPath) {
  const lockFile = path.join(repoPath, '.git', 'index.lock');
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
 * Package Publish
 * Provides automated version bumping and git tagging for package releases.
 * Supports major, minor, and patch version increments.
 */
module.exports = {
  /**
   * Activates the package and registers publishing commands.
   */
  activate() {
    this.disposables = new CompositeDisposable();

    // Common publish commands definition
    const publishCommands = {
      "package-publish:git-major": (getPath) => this.publish(getPath(), "major"),
      "package-publish:git-minor": (getPath) => this.publish(getPath(), "minor"),
      "package-publish:git-patch": (getPath) => this.publish(getPath(), "patch"),
      "package-publish:git-major-if": (getPath) => this.publish(getPath(), "major-if"),
      "package-publish:git-minor-if": (getPath) => this.publish(getPath(), "minor-if"),
      "package-publish:git-patch-if": (getPath) => this.publish(getPath(), "patch-if"),
      "package-publish:ppm-major": (getPath) => this.ppmPublish(getPath(), "major"),
      "package-publish:ppm-minor": (getPath) => this.ppmPublish(getPath(), "minor"),
      "package-publish:ppm-patch": (getPath) => this.ppmPublish(getPath(), "patch"),
      "package-publish:ppm-major-if": (getPath) => this.ppmPublish(getPath(), "major-if"),
      "package-publish:ppm-minor-if": (getPath) => this.ppmPublish(getPath(), "minor-if"),
      "package-publish:ppm-patch-if": (getPath) => this.ppmPublish(getPath(), "patch-if"),
    };

    // Tree-view commands
    const treeViewCommands = {};
    for (const [cmd, fn] of Object.entries(publishCommands)) {
      treeViewCommands[cmd] = () => {
        for (const dirPath of this.treeView.selectedPaths()) {
          fn(() => dirPath);
        }
      };
    }

    // Editor commands
    const editorCommands = {};
    for (const [cmd, fn] of Object.entries(publishCommands)) {
      editorCommands[cmd] = () => {
        const dirPath = this.getEditorPackagePath();
        if (!dirPath) {
          atom.notifications.addError("Package Publish: no file open in editor");
          return;
        }
        fn(() => dirPath);
      };
    }

    // GitHub panel commands - uses current project repository
    const githubCommands = {};
    for (const [cmd, fn] of Object.entries(publishCommands)) {
      githubCommands[cmd] = () => {
        const dirPath = this.getGithubPanelPath();
        if (!dirPath) {
          atom.notifications.addError("Package Publish: no repository found");
          return;
        }
        fn(() => dirPath);
      };
    }

    this.disposables.add(
      atom.commands.add(".tree-view .directory", treeViewCommands),
      atom.commands.add("atom-text-editor:not([mini])", editorCommands),
      // GitHub panel - add commands to the git panel and commit view
      atom.commands.add(".github-Git, .github-CommitView", githubCommands)
    );

    // Inject buttons into GitHub panel
    this.injectGithubButtons();
  },

  /**
   * Deactivates the package and disposes resources.
   */
  deactivate() {
    this.disposables.dispose();
    this.hidePublishList();
    // Remove injected button
    document.querySelectorAll('.package-publish-btn').forEach(el => el.remove());
    if (this.githubObserver) {
      this.githubObserver.disconnect();
    }
  },

  /**
   * Injects publish button into the GitHub panel header.
   * Uses MutationObserver to detect when the panel is created.
   */
  injectGithubButtons() {
    const injectButton = () => {
      // Find the GitHub project header
      const header = document.querySelector('.github-Project');
      if (!header || header.querySelector('.package-publish-btn')) {
        return; // Already injected or not found
      }

      // Tag/publish icon SVG
      const tagIcon = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" class="icon">
        <path fill-rule="evenodd" d="M2.5 7.775V2.75a.25.25 0 0 1 .25-.25h5.025a.25.25 0 0 1 .177.073l6.25 6.25a.25.25 0 0 1 0 .354l-5.025 5.025a.25.25 0 0 1-.354 0l-6.25-6.25a.25.25 0 0 1-.073-.177Zm-1.5 0V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.185 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.75 1.75 0 0 1 1 7.775ZM6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"></path>
      </svg>`;

      const btn = document.createElement('button');
      btn.className = 'package-publish-btn btn btn-small';
      btn.title = 'Publish Package';
      btn.style.cssText = `
        background-color: transparent;
        background-image: none;
        border: none;
        padding: 0;
        width: 24px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      btn.innerHTML = tagIcon;

      // Style the SVG icon
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.style.cssText = `
          width: 16px;
          height: 16px;
          fill: var(--text-color);
        `;
      }

      btn.addEventListener('mouseenter', () => {
        const svg = btn.querySelector('svg');
        if (svg) svg.style.fill = 'var(--text-color-highlight)';
      });
      btn.addEventListener('mouseleave', () => {
        const svg = btn.querySelector('svg');
        if (svg) svg.style.fill = 'var(--text-color)';
      });

      btn.addEventListener('click', () => {
        this.showPublishList();
      });

      header.appendChild(btn);
    };

    // Try to inject immediately
    injectButton();

    // Watch for GitHub panel changes
    this.githubObserver = new MutationObserver(() => {
      injectButton();
    });

    this.githubObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  /**
   * Shows the publish options select list.
   */
  showPublishList() {
    const items = [
      { label: 'Git: Major', cmd: 'package-publish:git-major' },
      { label: 'Git: Minor', cmd: 'package-publish:git-minor' },
      { label: 'Git: Patch', cmd: 'package-publish:git-patch' },
      { label: 'Git: Major (if changed)', cmd: 'package-publish:git-major-if' },
      { label: 'Git: Minor (if changed)', cmd: 'package-publish:git-minor-if' },
      { label: 'Git: Patch (if changed)', cmd: 'package-publish:git-patch-if' },
      { label: 'PPM: Major', cmd: 'package-publish:ppm-major' },
      { label: 'PPM: Minor', cmd: 'package-publish:ppm-minor' },
      { label: 'PPM: Patch', cmd: 'package-publish:ppm-patch' },
      { label: 'PPM: Major (if changed)', cmd: 'package-publish:ppm-major-if' },
      { label: 'PPM: Minor (if changed)', cmd: 'package-publish:ppm-minor-if' },
      { label: 'PPM: Patch (if changed)', cmd: 'package-publish:ppm-patch-if' },
    ];

    if (this.selectList) {
      this.selectList.destroy();
    }

    this.selectList = new SelectListView({
      items,
      elementForItem: (item) => {
        const li = document.createElement('li');
        li.textContent = item.label;
        return li;
      },
      filterKeyForItem: (item) => item.label,
      didConfirmSelection: (item) => {
        this.hidePublishList();
        const target = document.querySelector('.github-Git') || document.body;
        atom.commands.dispatch(target, item.cmd);
      },
      didCancelSelection: () => {
        this.hidePublishList();
      },
    });

    this.selectListPanel = atom.workspace.addModalPanel({
      item: this.selectList.element,
    });
    this.selectList.focus();
  },

  /**
   * Hides the publish options select list.
   */
  hidePublishList() {
    if (this.selectListPanel) {
      this.selectListPanel.destroy();
      this.selectListPanel = null;
    }
    if (this.selectList) {
      this.selectList.destroy();
      this.selectList = null;
    }
  },

  /**
   * Consumes the tree-view service.
   * @param {Object} treeView - The tree-view service object
   * @returns {Disposable} Disposable to unregister the service
   */
  consumeTreeView(treeView) {
    this.treeView = treeView;
    return new Disposable(() => {
      this.treeView = null;
    });
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
        const lastTag = (await git.exec(['describe', '--tags', '--abbrev=0'])).trim();
        const diff = await git.exec(['diff', `${lastTag}..HEAD`, '--stat']);
        return diff.trim().length > 0;
      } else {
        const { stdout: lastTag } = await execAsync(`git describe --tags --abbrev=0`, { cwd });
        const { stdout: diff } = await execAsync(`git diff ${lastTag.trim()}..HEAD --stat`, { cwd });
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
        await git.exec(['add', '--all']);
        await git.exec(['commit', '--all', '-m', commitMessage]);
        await git.exec(['tag', '-a', tag, '-m', commitMessage]);
        await git.exec(['push', 'origin', '--tags']);
      } else {
        // Fallback to exec
        await execAsync(`git add --all`, { cwd });
        await execAsync(`git commit --all -m "${commitMessage}"`, { cwd });
        await execAsync(`git tag -a ${tag} -m "${commitMessage}"`, { cwd });
        await execAsync(`git push origin --tags`, { cwd });
      }
      atom.notifications.addSuccess(`Package Publish: ${pkgName} v${version} published`);
    } catch (err) {
      atom.notifications.addError(`Package Publish: failed`, { detail: err.stderr || err.stdErr || err.message, dismissable: true });
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
        atom.notifications.addInfo(`Package Publish: ${pkgName} has no changes since last tag`);
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
      atom.notifications.addInfo(`Package Publish: version updated from v${oldVersion} to v${newVersion}`);
      await this.gitPrepare(dirPath, newVersion);
    } catch (err) {
      atom.notifications.addError("Package Publish: failed", { detail: err.message, dismissable: true });
    }
  },

  /**
   * Gets the package directory from the active text editor.
   * @returns {string|null} The directory path or null if not found
   */
  getEditorPackagePath() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;
    const filePath = editor.getPath();
    if (!filePath) return null;
    return path.dirname(filePath);
  },

  /**
   * Gets the repository path from the GitHub panel context.
   * Falls back to the first project directory.
   * @returns {string|null} The repository path or null if not found
   */
  getGithubPanelPath() {
    // Try to get the repository from atom.project
    const repos = atom.project.getRepositories();
    for (const repo of repos) {
      if (repo && repo.getWorkingDirectory) {
        return repo.getWorkingDirectory();
      }
    }
    // Fallback to first project path
    const projectPaths = atom.project.getPaths();
    return projectPaths.length > 0 ? projectPaths[0] : null;
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
      atom.notifications.addSuccess(`PPM Publish: ${pkgName} published`, { detail: stdout });
      // Push commits after successful publish
      await this.gitPush(dirPath);
    } catch (err) {
      atom.notifications.addError(`PPM Publish: failed to publish ${pkgName}`, { detail: err.stderr || err.message, dismissable: true });
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
        await git.exec(['push', 'origin']);
      } else {
        await execAsync(`git push origin`, { cwd });
      }
      atom.notifications.addSuccess(`Package Publish: ${pkgName} pushed to origin`);
    } catch (err) {
      atom.notifications.addError(`Package Publish: failed to push ${pkgName}`, { detail: err.stderr || err.stdErr || err.message, dismissable: true });
    }
  },
};
