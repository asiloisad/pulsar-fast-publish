# fast-publish

Publish Pulsar packages via Git tags or PPM. Bump version, commit, tag, and push with a single command.

## Features

- **Git publish**: Bump version, commit, tag, and push to origin.
- **PPM publish**: Publish using Pulsar Package Manager.
- **Conditional publish**: Only publish if changes exist since last tag.
- **Context menu**: Available from tree-view directories.

## Installation

To install `fast-publish` search for [fast-publish](https://web.pulsar-edit.dev/packages/fast-publish) in the Install pane of the Pulsar settings or run `ppm install fast-publish`. Alternatively, you can run `ppm install asiloisad/pulsar-fast-publish` to install a package directly from the GitHub repository.

## Commands

Commands available in `.tree-view .directory > .list-item`:

- `fast-publish:git-major`: publish a major update via Git,
- `fast-publish:git-minor`: publish a minor update via Git,
- `fast-publish:git-patch`: publish a patch update via Git,
- `fast-publish:git-major-if`: publish a major update via Git (if changed since last tag),
- `fast-publish:git-minor-if`: publish a minor update via Git (if changed since last tag),
- `fast-publish:git-patch-if`: publish a patch update via Git (if changed since last tag),
- `fast-publish:ppm-major`: publish a major update via PPM,
- `fast-publish:ppm-minor`: publish a minor update via PPM,
- `fast-publish:ppm-patch`: publish a patch update via PPM,
- `fast-publish:ppm-major-if`: publish a major update via PPM (if changed since last tag),
- `fast-publish:ppm-minor-if`: publish a minor update via PPM (if changed since last tag),
- `fast-publish:ppm-patch-if`: publish a patch update via PPM (if changed since last tag),
- `fast-publish:ppm-tag`: publish the latest git tag to PPM.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
