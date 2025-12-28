# package-publish

Publish Pulsar packages via Git tags or PPM. Bump version, commit, tag, and push with a single command.

## Features

- **Git publish**: Bump version, commit, tag, and push to origin.
- **PPM publish**: Publish using Pulsar Package Manager.
- **Conditional publish**: Only publish if changes exist since last tag.
- **Context menu**: Available from tree-view directories.

## Installation

To install `package-publish` run `ppm install asiloisad/pulsar-package-publish` to install a package directly from the GitHub repository.

## Commands

Commands available in `.tree-view .directory` and `atom-text-editor`:

- `package-publish:git-major`: publish a major update via Git,
- `package-publish:git-minor`: publish a minor update via Git,
- `package-publish:git-patch`: publish a patch update via Git,
- `package-publish:git-major-if`: publish a major update via Git (if changed since last tag),
- `package-publish:git-minor-if`: publish a minor update via Git (if changed since last tag),
- `package-publish:git-patch-if`: publish a patch update via Git (if changed since last tag),
- `package-publish:ppm-major`: publish a major update via PPM,
- `package-publish:ppm-minor`: publish a minor update via PPM,
- `package-publish:ppm-patch`: publish a patch update via PPM,
- `package-publish:ppm-major-if`: publish a major update via PPM (if changed since last tag),
- `package-publish:ppm-minor-if`: publish a minor update via PPM (if changed since last tag),
- `package-publish:ppm-patch-if`: publish a patch update via PPM (if changed since last tag).

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
