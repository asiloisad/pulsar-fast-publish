'use babel'

import { CompositeDisposable, Disposable } from 'atom'
import { exec } from "child_process"
import fs from 'fs'
import path from 'path'

export default {

  activate () {
    this.disposables = new CompositeDisposable()
    this.disposables.add(atom.commands.add('.tree-view .directory', {
      'git-publish:major': () => this.publishTreeView('major'),
      'git-publish:minor': () => this.publishTreeView('minor'),
      'git-publish:patch': () => this.publishTreeView('patch'),
    }))
  },

  deactivate () {
    this.disposables.dispose()
  },

  consumeTreeView(treeView) {
    this.treeView = treeView
    return new Disposable( () => { this.treeView = null })
  },

  increaseVersionNumber(version, mode) {
    version = version.split('.')
    if (mode==='major') {
      version[0] = parseInt(version[0])+1
      version[1] = '0'
      version[2] = '0'
    } else if (mode==='minor') {
      version[1] = parseInt(version[1])+1
      version[2] = '0'
    } else if (mode==='patch') {
      version[2] = parseInt(version[2])+1
    }
    return version.join('.')
  },

  gitPrepare(cwd, version) {
    exec(`git add --all`, {cwd:cwd}, (error, stdout, stderr) => {
      if (error) {console.log('error: git-add', stderr) ; return} else {console.log('pass: git-add', stdout)}
      exec(`git commit --all -m v${version}`, {cwd:cwd}, (error, stdout, stderr) => {
        if (error) {console.log('error: git-commit', stderr) ; return} else {console.log('pass: git-commit', stdout)}
        exec(`git tag -a v${version} -m "Prepare v${version} release"`, {cwd:cwd}, (error, stdout, stderr) => {
          if (error) {console.log('error: git-tag', stderr) ; return} else {console.log('pass: git-tag', stdout)}
          exec(`git push origin --tags`, {cwd:cwd}, (error, stdout, stderr) => {
            if (error) {console.log('error: git-push', stderr) ; return} else {console.log('pass: git-push', stdout)}
            console.log('pass: package has been commited, tagged and pushed')
          })
        })
      })
    })
  },

  publish(dirPath, mode) {
    console.log('===== Publish Package =====')
    if (!this.treeView) { return console.log('error: tree-view is not available') }
    let jsonPath = path.join(dirPath, 'package.json')
    if (!fs.existsSync(jsonPath)) { return console.log('error: cannot read package.json file', jsonPath) }
    let data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    let oldVersion = data.version
    let newVersion = this.increaseVersionNumber(oldVersion, mode)
    data.version = newVersion
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), {encoding:'utf8'})
    console.log('pass: package version updated has been updated from v'+oldVersion+' to v'+newVersion)
    this.gitPrepare(dirPath, newVersion)
  },

  publishTreeView(mode) {
    for (let dirPath of this.treeView.selectedPaths()) {
      this.publish(dirPath, mode)
    }
  },
}
