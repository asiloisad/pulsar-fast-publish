const { CompositeDisposable, Disposable } = require("atom");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

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
    this.disposables.add(
      atom.commands.add(".tree-view .directory", {
        "package-publish:major": () => this.publishTreeView("major"),
        "package-publish:minor": () => this.publishTreeView("minor"),
        "package-publish:patch": () => this.publishTreeView("patch"),
        "package-publish:major-if": () => this.publishTreeView("major-if"),
        "package-publish:minor-if": () => this.publishTreeView("minor-if"),
        "package-publish:patch-if": () => this.publishTreeView("patch-if"),
        "ppm-publish:major": () => this.ppmPublishTreeView("major"),
        "ppm-publish:minor": () => this.ppmPublishTreeView("minor"),
        "ppm-publish:patch": () => this.ppmPublishTreeView("patch"),
        "ppm-publish:major-if": () => this.ppmPublishTreeView("major-if"),
        "ppm-publish:minor-if": () => this.ppmPublishTreeView("minor-if"),
        "ppm-publish:patch-if": () => this.ppmPublishTreeView("patch-if"),
      }),
      atom.commands.add("atom-text-editor:not([mini])", {
        "package-publish:major": () => this.publishEditor("major"),
        "package-publish:minor": () => this.publishEditor("minor"),
        "package-publish:patch": () => this.publishEditor("patch"),
        "package-publish:major-if": () => this.publishEditor("major-if"),
        "package-publish:minor-if": () => this.publishEditor("minor-if"),
        "package-publish:patch-if": () => this.publishEditor("patch-if"),
        "ppm-publish:major": () => this.ppmPublishEditor("major"),
        "ppm-publish:minor": () => this.ppmPublishEditor("minor"),
        "ppm-publish:patch": () => this.ppmPublishEditor("patch"),
        "ppm-publish:major-if": () => this.ppmPublishEditor("major-if"),
        "ppm-publish:minor-if": () => this.ppmPublishEditor("minor-if"),
        "ppm-publish:patch-if": () => this.ppmPublishEditor("patch-if"),
      })
    );
  },

  /**
   * Deactivates the package and disposes resources.
   */
  deactivate() {
    this.disposables.dispose();
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
   * @param {string} cwd - The working directory path
   * @returns {Promise<boolean>} True if there are changes, false otherwise
   */
  async hasChangesSinceLastTag(cwd) {
    try {
      const { stdout: lastTag } = await execAsync(`git describe --tags --abbrev=0`, { cwd });
      const { stdout: diff } = await execAsync(`git diff ${lastTag.trim()}..HEAD --stat`, { cwd });
      return diff.trim().length > 0;
    } catch {
      // No tags exist or other error - assume there are changes
      return true;
    }
  },

  /**
   * Prepares and executes git commands for version release.
   * Adds all files, commits, tags, and pushes to origin.
   * @param {string} cwd - The working directory path
   * @param {string} version - The version string for the release
   */
  async gitPrepare(cwd, version) {
    const pkgName = path.basename(cwd);
    try {
      await execAsync(`git add --all`, { cwd });
      await execAsync(`git commit --all -m "Prepare v${version} release"`, { cwd });
      await execAsync(`git tag -a v${version} -m "Prepare v${version} release"`, { cwd });
      await execAsync(`git push origin --tags`, { cwd });
      atom.notifications.addSuccess(`Package Publish: ${pkgName} v${version} published`);
    } catch (err) {
      atom.notifications.addError(`Package Publish: failed`, { detail: err.stderr || err.message, dismissable: true });
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
   * Publishes selected packages from the tree-view.
   * @param {string} mode - The version increment mode
   */
  publishTreeView(mode) {
    for (const dirPath of this.treeView.selectedPaths()) {
      this.publish(dirPath, mode);
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
   * Publishes a package from the active text editor.
   * @param {string} mode - The version increment mode
   */
  publishEditor(mode) {
    const dirPath = this.getEditorPackagePath();
    if (!dirPath) {
      atom.notifications.addError("Package Publish: no file open in editor");
      return;
    }
    this.publish(dirPath, mode);
  },

  /**
   * Publishes a package from the active text editor using PPM.
   * @param {string} mode - The version increment mode
   */
  ppmPublishEditor(mode) {
    const dirPath = this.getEditorPackagePath();
    if (!dirPath) {
      atom.notifications.addError("PPM Publish: no file open in editor");
      return;
    }
    this.ppmPublish(dirPath, mode);
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
    atom.notifications.addInfo(`PPM Publish: publishing ${pkgName} as ${mode}...`);
    try {
      const { stdout } = await execAsync(`ppm publish ${mode}`, { cwd: dirPath });
      atom.notifications.addSuccess(`PPM Publish: ${pkgName} published`, { detail: stdout });
    } catch (err) {
      atom.notifications.addError(`PPM Publish: failed to publish ${pkgName}`, { detail: err.stderr || err.message, dismissable: true });
    }
  },

  /**
   * Publishes selected packages from the tree-view using PPM.
   * @param {string} mode - The version increment mode
   */
  ppmPublishTreeView(mode) {
    for (let dirPath of this.treeView.selectedPaths()) {
      this.ppmPublish(dirPath, mode);
    }
  },
};
