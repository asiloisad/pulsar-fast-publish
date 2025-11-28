# package-publish

Publish Pulsar packages via Git tags or PPM. Select a directory in tree-view and run a command.

## Installation

To install `package-publish` run `ppm install asiloisad/pulsar-package-publish` to install a package directly from the GitHub repository.

## Commands

Commands are available in `.tree-view .directory` and `atom-text-editor` scopes.

### Git Publish

Publish by bumping version in `package.json`, committing, tagging, and pushing to origin:

- `package-publish:git-major`: publish a major update
- `package-publish:git-minor`: publish a minor update
- `package-publish:git-patch`: publish a patch update
- `package-publish:git-major-if`: publish a major update (if changed since last tag)
- `package-publish:git-minor-if`: publish a minor update (if changed since last tag)
- `package-publish:git-patch-if`: publish a patch update (if changed since last tag)

### PPM Publish

Publish using Pulsar Package Manager (`ppm publish`):

- `package-publish:ppm-major`: publish a major update
- `package-publish:ppm-minor`: publish a minor update
- `package-publish:ppm-patch`: publish a patch update
- `package-publish:ppm-major-if`: publish a major update (if changed since last tag)
- `package-publish:ppm-minor-if`: publish a minor update (if changed since last tag)
- `package-publish:ppm-patch-if`: publish a patch update (if changed since last tag)

All commands are available from the context-menu of tree-view directories.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
