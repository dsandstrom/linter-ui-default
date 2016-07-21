/* @flow */
/** @jsx React.h */

import * as React from 'preact'
import filter from 'lodash.filter'
import { Range } from 'atom'
import { Emitter, CompositeDisposable } from 'sb-event-kit'
import type { Disposable } from 'sb-event-kit'
import type { Panel as Atom$Panel } from 'atom'
import Messages from './elements/messages' // eslint-disable-line no-unused-vars
import { getMessagesOnRangeOrPoint } from './helpers'
import type { LinterMessage, Config$ShowIssues } from './types'

export default class Panel {
  panel: Atom$Panel;
  emitter: Emitter;
  messages: Array<LinterMessage>;
  subscriptions: CompositeDisposable;
  showIssuesFrom: Config$ShowIssues;
  messageTypesToIgnoreInPanel: Set<string>;

  constructor() {
    this.emitter = new Emitter()
    this.messages = []
    this.subscriptions = new CompositeDisposable()

    const element = document.createElement('linter-panel')
    this.panel = atom.workspace.addBottomPanel({
      item: element,
      visible: true,
      priority: 500,
    })
    React.render(<Messages panel={this} />, element)

    this.subscriptions.add(this.emitter)
    this.subscriptions.add(atom.config.observe('linter-ui-default.showIssuesFrom', showIssuesFrom => {
      this.showIssuesFrom = showIssuesFrom
    }))
    this.subscriptions.add(atom.config.observe('linter-ui-default.messageTypesToIgnoreInPanel', messageTypesToIgnoreInPanel => {
      const old = this.messageTypesToIgnoreInPanel
      this.messageTypesToIgnoreInPanel = new Set(messageTypesToIgnoreInPanel)
      if (old) {
        this.apply()
      }
    }))
    this.subscriptions.add(atom.workspace.observeActivePaneItem(paneItem => {
      if (atom.workspace.isTextEditor(paneItem)) {
        this.panel.show()
      } else {
        this.panel.hide()
      }
      this.apply()
    }))
  }
  apply(messages: ?Array<LinterMessage> = null) {
    if (messages) {
      this.messages = messages
    } else {
      messages = this.messages
    }

    let filteredMessages = messages
    if (this.showIssuesFrom === 'All Files') {
      /* No filtering required */
    } else if (this.showIssuesFrom === 'Current File') {
      const activeEditor = atom.workspace.getActiveTextEditor()
      const activePath = (activeEditor && activeEditor.getPath()) || NaN
      filteredMessages = filter(messages, function(message) {
        if (message.version === 1) {
          return message.filePath === activePath
        }
        return message.location.file === activePath
      })
    } else if (this.showIssuesFrom === 'Current Line') {
      const activeEditor = atom.workspace.getActiveTextEditor()
      if (activeEditor) {
        const activePath = activeEditor.getPath() || NaN
        const editorPosition = activeEditor.getCursorBufferPosition()
        filteredMessages = getMessagesOnRangeOrPoint(messages, activePath, Range.fromObject([[editorPosition.row, 0], [editorPosition.row, Infinity]]))
      } else filteredMessages = []
    }
    if (this.messageTypesToIgnoreInPanel) {
      filteredMessages = filter(filteredMessages, message => !this.messageTypesToIgnoreInPanel.has(message.type))
    }
    this.emitter.emit('did-update-messages', filteredMessages)
  }
  observeMessages(callback: Function): Disposable {
    callback(this.messages)
    return this.onDidUpdateMessages(callback)
  }
  onDidUpdateMessages(callback: Function): Disposable {
    return this.emitter.on('did-update-messages', callback)
  }
  dispose() {
    this.subscriptions.dispose()
    if (this.panel) {
      this.panel.destroy()
    }
  }
}