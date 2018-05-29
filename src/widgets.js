/**
 * Widget interface
 *
 * decorated graphical objects on top of ProteinDisplay that are a hybrid
 * of HTML DOM elements and WebGL elements such as lines, atom labels,
 * distance measures, sequence bars, z-slab control, grid controls
 *
 * this.observerReset - called after model rebuild
 * this.draw - called at every draw event
 * this.resize - called after every resize of window
 */

import $ from 'jquery'
import * as THREE from 'three'
import _ from 'lodash'
import select2 from 'select2' // eslint-disable-line no-alert

import * as data from './data'
import * as util from './util'

/**
 * LineElement
 * - instantiates a DOM object is to draw a line between (x1, y1) and
 *   (x2, y2) within a jquery div
 * - used to display the mouse tool for making distance labels
 */
class LineElement {
  constructor (display, color) {
    this.color = color

    this.div = $('<canvas>')
      .css({
        'position': 'absolute',
        'z-index': '1000',
        'display': 'none',
        'pointer-events': 'none'
      })

    this.canvas = this.div[0]
    this.context2d = this.canvas.getContext('2d')

    this.parentDiv = $(display.divTag)
    this.parentDiv.append(this.div)
  }

  hide () {
    this.div.css('display', 'none')
  }

  move (x1, y1, x2, y2) {
    let parentDivPos = this.parentDiv.position()

    let width = Math.abs(x1 - x2)
    let height = Math.abs(y1 - y2)

    let left = Math.min(x1, x2)
    let top = Math.min(y1, y2)

    this.div
      .css('display', 'block')
      .css('width', width)
      .css('height', height)
      .css('top', top + parentDivPos.top)
      .css('left', left + parentDivPos.left)

    this.canvas.width = width
    this.canvas.height = height

    this.context2d.clearRect(0, 0, width, height)
    this.context2d.beginPath()
    this.context2d.moveTo(x1 - left, y1 - top)
    this.context2d.lineTo(x2 - left, y2 - top)
    this.context2d.lineWidth = 2
    this.context2d.strokeStyle = this.color
    this.context2d.stroke()
  }
}

/**
 * CanvasWidget
 *   - abstract class to wrap a canvas2d element
 *   - instantiates an absolute div that fits the $(selector)
 *   - attaches a canvas to this div
 *   - creates methods that redirects mouse commands to that canvas
 */
class CanvasWidget {
  constructor (selector) {
    this.parentDiv = $(selector)

    this.div = $('<div>')
      .css('position', 'absolute')
      .css('z-index', 100)

    this.parentDiv.append(this.div)

    this.canvas = $('<canvas>')

    this.div.append(this.canvas)
    this.canvasDom = this.canvas[0]
    this.drawContext = this.canvasDom.getContext('2d')

    this.mousePressed = false
    const dom = this.canvasDom
    const bind = (ev, fn) => {
      dom.addEventListener(ev, fn)
    }
    bind('mousedown', e => this.mousedown(e))
    bind('mousemove', e => this.mousemove(e))
    bind('mouseup', e => this.mouseup(e))
    bind('mouseout', e => this.mouseup(e))
    bind('touchstart', e => this.mousedown(e))
    bind('touchmove', e => this.mousemove(e))
    bind('touchend', e => this.mouseup(e))
    bind('touchcancel', e => this.mouseup(e))
  }

  width () {
    return this.parentDiv.width()
  }

  height () {
    return this.parentDiv.height()
  }

  x () {
    let parentDivPos = this.parentDiv.position()
    return parentDivPos.left
  }

  y () {
    let parentDivPos = this.parentDiv.position()
    return parentDivPos.top
  }

  inside (x, y) {
    return (
      (x >= this.x()) &&
      (x <= this.x() + this.width()) &&
      (y >= this.y()) &&
      (y <= this.y() + this.height()))
  }

  update () {
  }

  resize () {
    this.canvasDom.width = this.width()
    this.canvasDom.height = this.height()
  }

  strokeRect (x, y, w, h, strokeStyle) {
    this.drawContext.strokeStyle = strokeStyle
    this.drawContext.strokeRect(x, y, w, h)
  }

  fillRect (x, y, w, h, fillStyle) {
    this.drawContext.beginPath()
    this.drawContext.fillStyle = fillStyle
    this.drawContext.fillRect(x, y, w, h)
  }

  line (x1, y1, x2, y2, lineWidth, color) {
    this.drawContext.beginPath()
    this.drawContext.moveTo(x1, y1)
    this.drawContext.lineTo(x2, y2)
    this.drawContext.lineWidth = lineWidth
    this.drawContext.strokeStyle = color
    this.drawContext.stroke()
  }

  text (text, x, y, font, color, align) {
    this.drawContext.fillStyle = color
    this.drawContext.font = font
    this.drawContext.textAlign = align
    this.drawContext.textBaseline = 'middle'
    this.drawContext.fillText(text, x, y)
  }

  textWidth (text, font) {
    this.drawContext.font = font
    this.drawContext.textAlign = 'center'
    return this.drawContext.measureText(text).width
  }

  mousedown (event) {
    event.preventDefault()

    this.mousePressed = true

    this.mousemove(event)
  }

  mousemove (event) {
  }

  mouseup (event) {
    event.preventDefault()
    this.mousePressed = false
  }

  getPointer (event) {
    let rect = event.target.getBoundingClientRect()
    this.pointerX = event.clientX - rect.left
    this.pointerY = event.clientY - rect.top
  }
}

/**
 * PopupText is a little blob of text with a down
 * arrow that can be displayed in a (x, y) position
 * within a parent div denoted by selector
 */
class PopupText {
  constructor (divTag) {
    this.div = $('<div>')
      .css({
        'position': 'absolute',
        'top': 0,
        'left': 0,
        'background': 'white',
        'box-sizing': 'border-box',
        'padding': '5',
        'opacity': 0.7,
        'display': 'none',
        'z-index': 1000,
        'cursor': 'pointer'
      })

    this.arrow = $('<div>')
      .css({
        'position': 'absolute',
        'top': 0,
        'left': 0,
        'width': 0,
        'height': 0,
        'box-sizing': 'border-box',
        'border-left': '5px solid transparent',
        'border-right': '5px solid transparent',
        'border-top': '50px solid white',
        'opacity': 0.7,
        'display': 'none',
        'pointer-events': 'none'
      })

    this.parentDiv = $(divTag)
    this.parentDiv.append(this.div)
    this.parentDiv.append(this.arrow)
  }

  move (x, y) {
    let parentDivPos = this.parentDiv.position()

    this.div.css({'display': 'block'})
    let rect = this.div[0].getBoundingClientRect()
    let width = rect.width
    let height = rect.height

    this.arrow.css({'display': 'block'})

    if (
      (x < 0) ||
      (x > this.parentDiv.width()) ||
      (y < 0) ||
      (y > this.parentDiv.height())) {
      this.hide()
      return
    }

    this.arrow.css({
      'top': y - 50 + parentDivPos.top,
      'left': x - 5 + parentDivPos.left,
    })

    this.div.css({
      'top': y - 50 + parentDivPos.top - height,
      'left': x + parentDivPos.left - width / 2,
    })
  }

  hide () {
    this.div.css('display', 'none')
    this.arrow.css('display', 'none')
  }

  html (text) {
    this.div.html(text)
  }

  remove () {
    this.div.remove()
    this.arrow.remove()
  }
}

/**
 * A set of pop-up text labels over specified atoms, rendered as
 * DIV text on the DOM on top of Display but using opacity
 * of the given z position of the associated atoms
 */
class AtomLabelsWidget {
  constructor (display) {
    this.display = display
    this.soupView = display.soupView
    this.controller = display.controller
    this.popups = []
  }

  removePopup (i) {
    this.controller.deleteAtomLabel(i)
    this.popups[i].remove()
    this.popups.splice(i, 1)
  }

  createPopup (i) {
    let popup = new PopupText(this.display.divTag)
    popup.i = i
    popup.div.click(() => { this.removePopup(popup.i) })
    return popup
  }

  drawFrame () {
    let labels = this.soupView.currentView.labels

    if (labels.length > this.popups.length) {
      for (let i = this.popups.length; i < labels.length; i += 1) {
        this.popups.push(this.createPopup(i))
      }
    }

    if (this.popups.length > labels.length) {
      for (let i = this.popups.length - 1; i >= labels.length; i -= 1) {
        this.removePopup(i)
      }
    }

    let atom = this.soupView.soup.getAtomProxy()
    for (let i = 0; i < labels.length; i += 1) {
      this.popups[i].i = i

      atom.iAtom = labels[i].i_atom

      this.popups[i].html(labels[i].text)

      let opacity = 0.7 * this.display.opacity(atom.pos) + 0.2
      this.popups[i].div.css('opacity', opacity)
      this.popups[i].arrow.css('opacity', opacity)

      let v = this.display.getPosXY(atom.pos)
      this.popups[i].move(v.x, v.y)

      if (!this.display.inZlab(atom.pos)) {
        this.popups[i].div.css('display', 'none')
        this.popups[i].arrow.css('display', 'none')
      }
    }
  }
}

/**
 * Collection of inter-atomic distances to be displayed
 * using a combination of opaque canvas lines and text div
 * tags
 */
class DistanceMeasuresWidget {
  constructor (display) {
    this.distanceMeasures = []
    this.scene = display.displayScene
    this.soupView = display.soupView
    this.controller = display.controller
    this.display = display
    this.parentDiv = $(this.display.divTag)
    this.divs = []
  }

  removeDistance (i) {
    this.scene.remove(this.distanceMeasures[i].line)
    this.distanceMeasures[i].div.remove()
    this.controller.deleteDistance(i)
    this.distanceMeasures.splice(i, 1)
  }

  createDistanceMeasure (i) {
    let div = $('<div>')
      .css({
        'position': 'absolute',
        'top': 0,
        'left': 0,
        'background-color': '#FFDDDD',
        'padding': '5',
        'opacity': 0.7,
        'font-family': 'sans-serif'
      })
    div.i = i
    div.click(() => { this.removeDistance(div.i) })
    this.parentDiv.append(div)

    let geometry = new THREE.Geometry()
    geometry.vertices.push(new THREE.Vector3(0, 0, 0))
    geometry.vertices.push(new THREE.Vector3(1, 1, 1))
    let material = new THREE.LineDashedMaterial({
      color: 0xFF7777,
      dashSize: 3,
      gapSize: 4,
      linewidth: 2
    })
    let line = new THREE.Line(geometry, material)
    this.scene.add(line)

    return { line, div }
  }

  drawFrame () {
    let distances = this.soupView.currentView.distances

    if (distances.length > this.distanceMeasures.length) {
      for (let i = this.distanceMeasures.length; i < distances.length; i += 1) {
        this.distanceMeasures.push(this.createDistanceMeasure(i))
      }
    }

    if (this.distanceMeasures.length > distances.length) {
      for (let i = this.distanceMeasures.length - 1; i >= distances.length; i -= 1) {
        this.removeDistance(i)
      }
    }

    let parentDivPos = this.parentDiv.position()

    let a0 = this.soupView.soup.getAtomProxy()
    let a1 = this.soupView.soup.getAtomProxy()

    for (let i = 0; i < distances.length; i += 1) {
      let distance = distances[i]
      this.distanceMeasures[i].div.i = i
      let distanceMeasure = this.distanceMeasures[i]

      let p1 = a0.load(distance.i_atom1).pos
      let p2 = a1.load(distance.i_atom2).pos

      let text = p1.distanceTo(p2).toFixed(1)
      distanceMeasure.div.text(text)

      let m = p1.clone().add(p2).multiplyScalar(0.5)
      let opacity = 0.7 * this.display.opacity(m) + 0.3

      let v = this.display.getPosXY(m)
      let x = v.x
      let y = v.y

      if ((x < 0) || (x > this.parentDiv.width()) || (y < 0) ||
        (y > this.parentDiv.height())) {
        distanceMeasure.div.hide()
        continue
      }

      let width = distanceMeasure.div.innerHeight()
      let height = distanceMeasure.div.innerWidth()
      distanceMeasure.div.css({
        'top': y - width / 2 + parentDivPos.top,
        'left': x - height / 2 + parentDivPos.left,
        'display': 'block',
        'cursor': 'pointer',
        'opacity': opacity
      })

      distanceMeasure.line.geometry.vertices[0].copy(p1)
      distanceMeasure.line.geometry.vertices[1].copy(p2)

      if (!this.display.inZlab(m)) {
        distanceMeasure.div.css('display', 'none')
      }
    }
  }
}

/**
 * SequenceWidget
 *   - creates a dual band across the top of the selected div
 *     for glProteinDisplay
 *   - the first band is a sequence bar widget
 *   - the second band is a sequence text widget
 *   - these two are integrated so that they share state
 */
class SequenceWidget extends CanvasWidget {
  constructor (display) {
    super(display.divTag)

    this.display = display
    this.soupView = display.soupView
    this.soup = display.soup
    this.controller = display.controller
    this.traces = display.traces
    this.display.addObserver(this)

    this.offsetY = 4
    this.heightBar = 16
    this.spacingY = 13
    this.backColor = '#CCC'
    this.selectColor = '#FFF'
    this.highlightColor = 'red'
    this.borderColor = '#888'

    this.div.attr('id', 'sequence-widget')
    this.div.css({
      'width': this.parentDiv.width(),
      'height': this.height(),
      'top': this.y(),
      'background-color': '#CCC',
      'border-bottom': '1px solid #AAA'
    })

    this.charWidth = 14
    this.charHeight = 16

    this.textXOffset = 0

    this.residues = []
    this.iRes = null
    this.iStartChar = null
    this.iEndChar = null

    this.resize()
  }

  width () {
    return this.parentDiv.width()
  }

  height () {
    return this.offsetY + this.heightBar + this.spacingY * 6 - 5
  }

  resize () {
    super.resize()
    this.div.css('width', this.parentDiv.width())
  }

  xToI (x) {
    return parseInt((x - this.textXOffset) * this.nResidue / this.textWidth())
  }

  iToX (iRes) {
    return parseInt(iRes / this.nResidue * this.textWidth()) + this.textXOffset
  }

  textWidth () {
    return this.width() - this.textXOffset
  }

  xToIChar (x) {
    return parseInt((x - this.textXOffset) * this.nChar / this.textWidth()) + this.iStartChar
  }

  iCharToX (iRes) {
    return parseInt(
      (iRes - this.iStartChar) /
      this.nChar *
      this.textWidth() +
      this.textXOffset)
  }

  rebuild () {
    this.residues.length = 0
    let residue = this.soup.getResidueProxy()
    let iChain = -1
    let iStructure = 0
    let nRes = this.soup.getResidueCount()
    let nPadRes = 0.02*nRes
    for (let iRes of _.range(nRes)) {
      residue.iRes = iRes
      if (!residue.isPolymer) {
        continue
      }
      if ((iStructure !== residue.iStructure) || (iChain !== residue.iChain)) {
        iChain = residue.iChain
        iStructure = residue.iStructure
        this.residues.push({iChain, iStructure, c: '', start: true, ss: ''})
        for (let i of _.range(nPadRes)) {
          this.residues.push({iChain, iStructure, c: '', start: false, ss: ''})
        }
      }

      let entry = {
        iStructure,
        iChain,
        iRes,
        start: false,
        ss: residue.ss,
        resId: residue.resId,
        iAtom: residue.iAtom,
      }

      let resType = residue.resType
      if (resType in data.resToAa) {
        entry.c = data.resToAa[resType]
      } else {
        entry.c = '.'
      }

      this.residues.push(entry)
    }

    this.nResidue = this.residues.length

    this.iRes = this.nChar / 2
    this.iStartChar = 0
  }

  update () {
    if (!util.exists(this.soupView)) {
      return
    }

    if (this.residues.length === 0) {
      return
    }

    this.nChar = Math.ceil(this.width() / this.charWidth)

    this.iEndChar = this.iStartChar + this.nChar
    if (this.iEndChar > this.residues.length) {
      this.iEndChar = this.residues.length
    }
    if (this.iStartChar < 0) {
      this.iStartChar = 0
    }

    // draw background
    this.fillRect(
      0, 0, this.width(), this.height(), this.backColor)

    let yTopMid = this.offsetY + this.spacingY + this.charHeight / 2
    let x1 = this.iToX(this.iStartChar)
    let x2 = this.iToX(this.iEndChar)

    // draw sequence bar background
    this.fillRect(
      this.textXOffset, this.offsetY + this.heightBar + this.spacingY * 2,
      this.textWidth(), this.charHeight + this.spacingY * 2, this.selectColor)

    // draw border around sequence bar
    this.line(
      this.textXOffset - 3,
      this.offsetY + this.heightBar + this.spacingY * 2,
      this.textXOffset - 3 + this.textWidth(),
      this.offsetY + this.heightBar + this.spacingY * 2,
      this.borderColor)
    this.line(
      this.textXOffset - 3,
      this.offsetY + this.heightBar + this.spacingY * 2 + this.charHeight + this.spacingY * 2,
      this.textXOffset - 3 + this.textWidth(),
      this.offsetY + this.heightBar + this.spacingY * 2 + this.charHeight + this.spacingY * 2,
      this.borderColor)

    // draw selected part of structure bar
    this.fillRect(
      x1, this.offsetY, x2 - x1, this.heightBar + this.spacingY * 2 + 3,
      1, this.selectColor)

    // draw line through structure bar
    this.line(0, yTopMid, this.width(), yTopMid, 1, '#999')

    // draw structure color bars
    let ss = this.residues[0].ss
    let iStart = 0
    let iEnd = 0
    while (iEnd < this.nResidue) {
      iEnd += 1
      if (iEnd === this.nResidue || this.residues[iEnd].ss !== ss) {
        let x1 = this.iToX(iStart)
        let x2 = this.iToX(iEnd)
        let yTop = this.offsetY + this.spacingY
        let h = this.heightBar
        if (ss !== '') {
          let color = data.getSsColor(ss).getStyle()
          if (ss !== 'C') {
            yTop -= 4
            h += 2*4
          }
          this.fillRect(
            x1,
            yTop,
            x2 - x1,
            h,
            color)
        }
        if (iEnd <= this.nResidue - 1) {
          iStart = iEnd
          ss = this.residues[iEnd].ss
        }
      }
    }

    let iAtom = this.soupView.currentView.iAtom
    let iResSelect = this.soupView.soup.getAtomProxy(iAtom).iRes

    // draw characters for sequence
    let y = this.offsetY + this.heightBar + this.spacingY * 3
    let yMid = y + this.charHeight / 2

    // draw line through sequence bar
    this.line(0, yMid, this.width(), yMid, 1, '#999')
    for (let iChar = this.iStartChar; iChar < this.iEndChar; iChar += 1) {
      let residue = this.residues[iChar]
      if (residue.c === '') {
        continue
      }
      let x1 = this.iCharToX(iChar)
      let colorStyle = data.getSsColor(residue.ss).getStyle()
      let yTop = y
      let h = this.charHeight
      if (residue.ss !== 'C') {
        yTop -= 4
        h += 2*4
      }
      this.fillRect(
        x1, yTop, this.charWidth, h, colorStyle)
      this.text(
        residue.c,
        x1 + this.charWidth / 2, y + this.charHeight / 2,
        '8pt Monospace', 'white', 'center')

      // draw highlight res box
      if ((iResSelect >= 0) && (iResSelect === residue.iRes)) {
        this.strokeRect(
          x1,
          yTop - 3,
          this.charWidth,
          h + 6,
          this.highlightColor)
      }
    }

    // draw black box around selected region in structure bar
    this.line(
      x1,
      this.offsetY,
      x2,
      this.offsetY,
      1,
      this.borderColor)
    this.line(
      x1,
      this.offsetY,
      x1,
      this.offsetY + this.heightBar + this.spacingY * 2 + 1,
      1,
      this.borderColor)
    this.line(
      x2,
      this.offsetY,
      x2,
      this.offsetY + this.heightBar + this.spacingY * 2 + 1,
      1,
      this.borderColor)

    // draw structure names
    let iChar = 0
    while (iChar < this.nResidue) {
      if (this.residues[iChar].start) {
        let x1 = this.iToX(iChar)
        let res = this.residues[iChar]
        let text = this.soup.structureIds[res.iStructure]
        text += '-' + this.soup.chains[res.iChain]
        this.text(text, x1, 10, '8pt Monospace', '#666', 'left')
      }
      iChar += 1
    }

  }

  getCurrIAtom () {
    return this.residues[this.iRes].iAtom
  }

  mousemove (event) {
    if (!this.mousePressed) {
      return
    }
    this.getPointer(event)
    if (this.pointerY < (this.heightBar + this.spacingY * 2)) {
      this.iRes = this.xToI(this.pointerX)
      if (this.residues[this.iRes].c === '') {
        return
      }
      // observerReset sequence window
      this.iStartChar = Math.max(this.iRes - 0.5 * this.nChar, 0)
      this.iStartChar = Math.min(this.iStartChar, this.nResidue - this.nChar)
      this.iStartChar = parseInt(this.iStartChar)

      this.controller.setTargetViewByIAtom(this.getCurrIAtom())
      this.update()
    } else {
      this.iRes = this.xToIChar(this.pointerX)
      if (this.residues[this.iRes].c === '') {
        return
      }
      this.controller.setTargetViewByIAtom(this.getCurrIAtom())
      this.update()
    }
  }
}

/**
 * ZSlabWidget
 */
class ZSlabWidget extends CanvasWidget {
  constructor (display, selector) {
    super(selector)
    this.soupView = display.soupView
    this.controller = display.controller
    display.addObserver(this)
    this.maxZLength = 0.0
    this.div.css('box-sizing', 'border-box')
    this.backColor = 'rgb(150, 150, 150)'
    this.zBackColor = 'rgb(100, 70, 70)'
    this.zFrontColor = 'rgb(150, 90, 90)'
  }

  resize () {
    this.div.css({
      'width': this.width(),
      'height': this.height(),
    })
    super.resize()
    this.update()
  }

  x () {
    return 0
  }

  y () {
    return 0
  }

  width () {
    let box = this.parentDiv[0].getBoundingClientRect()
    return box.width - 20
  }

  height () {
    return this.parentDiv.height()
  }

  xToZ (x) {
    let fraction = x / this.width()
    return (0.5 - fraction) * this.maxZLength
  }

  zToX (z) {
    let fraction = z / this.maxZLength
    return (0.5 - fraction) * this.width()
  }

  update () {
    let soup = this.soupView.soup
    let cameraParams = this.soupView.currentView.cameraParams
    this.maxZLength = 2 * soup.maxLength

    let xBack = this.zToX(cameraParams.zBack)
    let xFront = this.zToX(cameraParams.zFront)
    let xMid = this.zToX(0)
    let yMid = this.height() / 2

    // background
    this.fillRect(0, 0, this.width(), this.height(), '#999')

    // middle track
    this.fillRect(0, yMid - 3, this.width(), 6, '#AAB')

    this.fillRect(xMid, yMid - 3, xBack - xMid, 6, this.zFrontColor)
    this.fillRect(xBack - 5, 0, 4, this.height(), '#333')

    this.fillRect(xFront, yMid - 3, xMid - xFront, 6, this.zFrontColor)
    this.fillRect(xFront + 1, 0, 4, this.height(), '#333')

    // halfway marker
    this.line(xMid, 0, xMid, this.height(), 1, '#444')
  }

  getZ (event) {
    this.getPointer(event)
    this.z = this.xToZ(this.pointerX)
  }

  mousedown (event) {
    this.getZ(event)

    if (this.z > 0) {
      this.back = true
      this.front = false
    } else {
      this.front = true
      this.back = false
    }

    super.mousedown(event)
  }

  mousemove (event) {
    event.preventDefault()

    if (!this.mousePressed) {
      return
    }

    this.getZ(event)

    let cameraParams = this.soupView.currentView.cameraParams
    let zBack = cameraParams.zBack
    let zFront = cameraParams.zFront
    if (this.back) {
      this.controller.setZoom(Math.max(2, this.z), zFront)
    } else if (this.front) {
      this.controller.setZoom(zBack, Math.min(-2, this.z))
    }
    this.update()
  }
}

class GridToggleButtonWidget {
  constructor (display, selector, elem, x, y, color) {
    this.soupView = display.soupView
    this.controller = display.controller
    this.elem = elem
    this.color = color
    this.div = $(selector)
      .text(elem)
      .addClass('jolecule-button')
      .css('position', 'absolute')
      .css('top', y + 'px')
      .css('left', x + 'px')
      .css('height', '15px')
      .css('width', '20px')
      .on('click touch', (e) => {
        e.preventDefault()
        this.toggle()
      })
    this.update()
    display.addObserver(this)
  }

  getToggle () {
    return this.soupView.soup.grid.isElem[this.elem]
  }

  toggle () {
    this.controller.toggleGridElem(this.elem)
    this.update()
  }

  update () {
    if (this.getToggle()) {
      if (this.color) {
        this.div.css('background-color', this.color)
      } else {
        this.div.addClass('jolecule-button-toggle-on')
      }
    } else {
      if (this.color) {
        this.div.css('background-color', '')
      } else {
        this.div.removeClass('jolecule-button-toggle-on')
      }
    }
  }
}

/**
 * GridControlWidget
 */
class GridControlWidget extends CanvasWidget {
  constructor (display) {
    super(display.divTag)

    this.display = display
    this.soupView = display.soupView
    this.controller = display.controller
    display.addObserver(this)

    this.backgroundColor = '#999'
    this.buttonHeight = 40
    this.sliderHeight = this.buttonHeight * 6 - 30
    this.isGrid = display.isGrid

    if (!this.isGrid) {
      this.div.css('display', 'none')
    }
    this.div.attr('id', 'grid-control')
    this.div.css('height', this.height())
    this.div.addClass('jolecule-residue-selector')
    this.buttonsDiv = $('<div id="grid-control-buttons">')
    this.div.append(this.buttonsDiv)
  }

  rebuild () {
    if (!this.isGrid) {
      return
    }

    this.buttonsDiv.empty()

    let y = 10
    for (let elem of _.keys(this.soupView.soup.grid.isElem)) {
      this.makeElemButton(elem, y)
      y += this.buttonHeight
    }

    if (_.keys(this.soupView.soup.grid.isElem).length === 0) {
      this.div.hide()
    } else {
      this.div.show()
    }
  }

  makeElemButton (elem, y) {
    let color = data.ElementColors[elem]
    let colorHexStr = '#' + color.getHexString()
    let id = 'grid-button-' + elem.toLowerCase()
    let selector = `#${id}`
    this.buttonsDiv.append($(`<div id="${id}">`))
    new GridToggleButtonWidget(
      this.display, selector, elem, 50, y, colorHexStr)
  }

  resize () {
    if (!this.isGrid) {
      return
    }
    this.div.css({
      'width': this.width(),
      'height': this.height(),
      'top': this.y(),
      'left': this.x()
    })
    this.canvasDom.width = this.width()
    this.canvasDom.height = this.height()
  }

  width () {
    return 84
  }

  height () {
    return this.buttonHeight * 6 + 10
  }

  x () {
    let parentDivPos = this.parentDiv.position()
    return parentDivPos.left + 5
  }

  y () {
    let parentDivPos = this.parentDiv.position()
    return parentDivPos.top + 65
  }

  yToZ (y) {
    let fraction = (y - 20) / this.sliderHeight
    let grid = this.soupView.soup.grid
    let diff = grid.bMax - grid.bMin
    let z = fraction * diff + grid.bMin
    if (z < this.soupView.soup.grid.bMin) {
      z = this.soupView.soup.grid.bMin
    }
    if (z > this.soupView.soup.grid.bMax) {
      z = this.soupView.soup.grid.bMax
    }
    return z
  }

  zToY (z) {
    let grid = this.soupView.soup.grid
    let diff = grid.bMax - grid.bMin
    return (z - grid.bMin) / diff * this.sliderHeight + 20
  }

  update () {
    if (!this.isGrid) {
      return
    }

    this.fillRect(0, 0, this.width(), this.height(), this.backgroundColor)

    let xm = 20

    let dark = 'rgb(100, 100, 100)'
    let yTop = this.zToY(this.soupView.soup.grid.bMin)
    let yBottom = this.zToY(this.soupView.soup.grid.bMax)

    // middle track
    this.fillRect(xm - 3, yTop, 6, yBottom - yTop, '#AAB')


    let font = '10px sans-serif'
    let textColor = '#333'

    let y = this.zToY(this.soupView.soup.grid.bCutoff)
    let text = this.soupView.soup.grid.convertB(this.soupView.soup.grid.bCutoff).toFixed(2)

    // fill to bottom
    this.fillRect(xm - 3, y, 6, yBottom - y, 'rgb(150, 90, 90)')

    // slider
    this.fillRect(5, y, 30, 5, textColor)
    this.text(text, xm, y - 8, font, textColor, 'center')

    // bottom marker
    this.line(5, yBottom, 35, yBottom, 1, '#666')

    text = this.soupView.soup.grid.convertB(this.soupView.soup.grid.bMax).toFixed(2)
    this.text(text, xm, yBottom + 6, font, textColor, 'center')

  }

  getZ (event) {
    this.getPointer(event)

    this.z = this.yToZ(this.pointerY)
  }

  mousedown (event) {
    event.preventDefault()

    this.getZ(event)

    this.mousePressed = true

    this.mousemove(event)
  }

  mousemove (event) {
    event.preventDefault()

    if (!this.mousePressed) {
      return
    }

    this.getZ(event)
    this.controller.setGridCutoff(this.z)
    this.update()

  }

  mouseup (event) {
    event.preventDefault()

    this.mousePressed = false
  }
}

class ResidueSelectorWidget {
  constructor (display, selector) {
    this.scene = display.displayScene
    this.controller = display.controller
    this.soupView = display.soupView
    this.display = display
    this.display.addObserver(this)

    this.div = $(selector)
    this.divTag = '#residue-select'
    let $elem = $('<select id="residue-select">')
    this.div.append($elem)
    $elem.select2()
  }

  change () {
    let iRes = parseInt(this.$elem.select2('val'))
    let residue = this.soupView.soup.getResidueProxy(iRes)
    this.controller.setTargetViewByIAtom(residue.iAtom)
  }

  rebuild () {
    // clear selector
    this.$elem = $(this.divTag)
    this.$elem.empty()

    // rebuild selector
    this.soup = this.soupView.soup
    let residue = this.soup.getResidueProxy()
    for (let iRes of _.range(this.soup.getResidueCount())) {
      residue.iRes = iRes
      if (_.includes(['HOH', 'XXX'], residue.resType)) {
        continue
      }
      let text = residue.resId + '-' + residue.resType
      this.$elem.append(new Option(text, `${iRes}`))
    }

    // observerReset using select2
    this.$elem.select2({width: '150px'})
    this.$elem.on('select2:select', () => { this.change() })
  }

  update () {
    if (this.$elem) {
      let iAtom = this.soupView.currentView.iAtom
      let iRes = this.soupView.soup.getAtomProxy(iAtom).iRes
      this.$elem.val(`${iRes}`).trigger('change')
    }
  }
}

class ToggleButtonWidget {
  constructor (display, selector, option) {
    this.controller = display.controller
    this.display = display
    if (option) {
      this.option = option
    }
    this.div = $(selector)
      .attr('href', '')
      .html(_.capitalize(option))
      .addClass('jolecule-button')
      .on('click touch', (e) => {
        e.preventDefault()
        this.callback()
      })
    this.display.addObserver(this)
  }

  callback () {
    let newOptionVal = !this.controller.getShowOption(this.option)
    this.controller.setShowOption(this.option, newOptionVal)
    if ((this.option === 'sidechains') && (newOptionVal === false)) {
      this.controller.clearSidechainResidues()
    }
    this.update()
  }

  update () {
    if (this.controller.getShowOption(this.option)) {
      if (!this.div.hasClass('jolecule-button-toggle-on')) {
        this.div.addClass('jolecule-button-toggle-on')
      }
    } else {
      if (this.div.hasClass('jolecule-button-toggle-on')) {
        this.div.removeClass('jolecule-button-toggle-on')
      }
    }
  }
}

class TogglePlayButtonWidget {
  constructor (display, selector) {
    this.controller = display.controller
    this.display = display
    this.div = $(selector)
      .attr('href', '')
      .html('Play')
      .addClass('jolecule-button')
      .on('click touch', (e) => { this.callback(e) })
    this.display.addObserver(this)
  }

  callback (e) {
    e.preventDefault()
    this.controller.setLoop(!this.controller.getLoop())
  }

  update () {
    if (this.controller.getLoop()) {
      if (!this.div.hasClass('jolecule-button-toggle-on')) {
        this.div.addClass('jolecule-button-toggle-on')
      }
    } else {
      if (this.div.hasClass('jolecule-button-toggle-on')) {
        this.div.removeClass('jolecule-button-toggle-on')
      }
    }
  }
}

export default {
  LineElement,
  PopupText,
  AtomLabelsWidget,
  DistanceMeasuresWidget,
  SequenceWidget,
  ZSlabWidget,
  GridControlWidget,
  ResidueSelectorWidget,
  ToggleButtonWidget,
  TogglePlayButtonWidget
}
