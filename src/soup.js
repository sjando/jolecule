import v3 from './v3'
import { getWindowUrl, inArray, getCurrentDateStr } from './util.js'
import * as glgeom from './glgeom'
import { SpaceHash } from './pairs.js'
import Store from './store.js'
import BitArray from './bitarray.js'
import * as data from './data'

let user = 'public' // will be overriden by server


function deleteNumbers (text) {
  return text.replace(/\d+/, '')
}

function pushToListInDict (dict, key, value) {
  if (!(key in dict)) {
    dict[key] = []
  }
  dict[key].push(value)
}

function getValueTableIndex (valueList, value) {
  if (!_.includes(valueList, value)) {
    valueList.push(value)
  }
  return valueList.indexOf(value)
}

function intToBool (i) {
  return i === 1
}

function boolToInt (b) {
  return b ? 1 : 0
}

function intToChar (i) {
  return i ? String.fromCharCode(i) : ''
}

function charToInt(c) {
  return c.charCodeAt(0)
}

function parsetTitleFromPdbText (text) {
  let result = ''
  let lines = text.split(/\r?\n/)
  for (let line of lines) {
    if (line.substring(0, 5) === 'TITLE') {
      result += line.substring(10)
    }
  }
  return result
}

const atomStoreFields = [
  ['x', 1, 'float32'],
  ['y', 1, 'float32'],
  ['z', 1, 'float32'],
  ['bfactor', 1, 'float32'],
  ['alt', 1, 'uint8'],
  ['iAtomType', 1, 'uint16'],
  ['iElem', 1, 'uint16'],
  ['iRes', 1, 'uint32'],
  ['iChain', 1, 'int32'],
  ['bondOffset', 1, 'uint32'],
  ['bondCount', 1, 'uint16'],
]


class AtomProxy {

  constructor (soup, iAtom) {
    this.soup = soup
    if (Number.isInteger(iAtom)) {
      this.load(iAtom)
    }
    this._pos = v3.create()
  }

  load (iAtom) {
    this.iAtom = iAtom
    return this
  }

  get pos () {
    this._pos.x = this.soup.atomStore.x[this.iAtom]
    this._pos.y = this.soup.atomStore.y[this.iAtom]
    this._pos.z = this.soup.atomStore.z[this.iAtom]
    return this._pos
  }

  get resId () {
    return this.soup.resIds[this.iRes]
  }

  get elem () {
    let iElem = this.soup.atomStore.iElem[this.iAtom]
    return this.soup.elemTable[iElem]
  }

  get bfactor () {
    return this.soup.atomStore.bfactor[this.iAtom]
  }

  get atomType () {
    let iAtomType = this.soup.atomStore.iAtomType[this.iAtom]
    return this.soup.atomTypeTable[iAtomType]
  }

  get iRes () {
    return this.soup.atomStore.iRes[this.iAtom]
  }

  get resType () {
    let iResType = this.soup.residueStore[this.iRes]
    return this.soup.resTypeTable[iResType]
  }

  get label () {
    return this.soup.resIds[this.iRes] + ' - ' + this.atomType
  }

  getBondIndices () {
    let iStart = this.soup.atomStore.bondOffset[this.iAtom]
    let n = this.soup.atomStore.bondCount[this.iAtom]
    let iEnd = iStart + n
    return _.range(iStart, iEnd)
  }

  get color () {
    if (this.elem === 'C' || this.elem === 'H') {
      let iRes = this.iRes
      let iColor = this.soup.residueStore.iColor[iRes]
      return this.soup.colorTable[iColor]
    } else if (this.elem in data.ElementColors) {
      return data.ElementColors[this.elem]
    }
    return data.darkGrey
  }

}

const residueStoreFields = [
  ['atomOffset', 1, 'uint32'],
  ['atomCount', 1, 'uint16'],
  ['iCentralAtom', 1, 'uint32'],
  ['iResType', 1, 'uint16'],
  ['iChain', 1, 'uint8'],
  ['resNum', 1, 'int32'],
  ['insCode', 1, 'uint8'],
  ['sstruc', 1, 'uint8'],
  ['iColor', 1, 'uint8'],
  ['isPolymer', 1, 'uint8'],
]

class ResidueProxy {

  constructor (soup, iRes) {
    this.soup = soup
    if (Number.isInteger(iRes)) {
      this.load(iRes)
    }
  }

  load (iRes) {
    this.iRes = iRes
    return this
  }

  get iAtom () {
    return this.soup.residueStore.iCentralAtom[this.iRes]
  }

  set iAtom(iAtom) {
    this.soup.residueStore.iCentralAtom[this.iRes] = iAtom
  }

  get iChain () {
    return this.soup.residueStore.iChain[this.iRes]
  }

  get resId () {
    return this.soup.resIds[this.iRes]
  }

  get resNum () {
    return this.soup.residueStore.resNum[this.iRes]
  }

  get insCode () {
    return intToChar(this.soup.residueStore.insCode[this.iRes])
  }

  set insCode (c) {
    return this.soup.residueStore.insCode[this.iRes] = charToInt(c)
  }

  get isPolymer () {
    return intToBool(this.soup.residueStore.isPolymer[this.iRes])
  }

  set isPolymer (v) {
    this.soup.residueStore.isPolymer[this.iRes] = boolToInt(v)
  }

  get color () {
    let iColor = this.soup.residueStore.iColor[this.iRes]
    return this.soup.colorTable[iColor]
  }

  set color(color) {
    let iColor = getValueTableIndex(this.soup.colorTable, color)
    this.soup.residueStore.iColor[this.iRes] = iColor
  }

  get selected () {
    return this.soup.residueSelect.get(this.iRes)
  }
  set selected (v) {
    if (v) {
      this.soup.residueSelect.set(this.iRes)
    } else {
      this.soup.residueSelect.clear(this.iRes)
    }
  }

  get resType () {
    let iResType = this.soup.residueStore.iResType[this.iRes]
    return this.soup.resTypeTable[iResType]
  }

  get normal () {
    let hasNormal = this.iRes in this.soup.residueNormal
    return hasNormal ? this.soup.residueNormal[this.iRes].clone() : null
  }

  get ss () {
    return intToChar(this.soup.residueStore.sstruc[this.iRes])
  }

  set ss (c) {
    this.soup.residueStore.sstruc[this.iRes] = charToInt(c)
  }

  getAtomIndices () {
    let iStart = this.soup.residueStore.atomOffset[this.iRes]
    let n = this.soup.residueStore.atomCount[this.iRes]
    let iEnd = iStart + n
    return _.range(iStart, iEnd)
  }

  getAtom (atomType) {
    for (let iAtom of this.getAtomIndices()) {
      this.soup.atomProxy.iAtom = iAtom
      if (this.soup.atomProxy.atomType === atomType) {
        return this.soup.atomProxy
      }
    }
    return null
  }

  checkAtomTypes (atomTypes) {
    for (let atomType of atomTypes) {
      let a = this.getAtom(atomType)
      if (a === null) {
        return false
      }
    }
    return true
  }
}


const bondStoreFields = [
  ['iAtom1', 1, 'int32'],
  ['iAtom2', 1, 'int32'],
]


class BondProxy {

  constructor (soup, iBond) {
    this.soup = soup
    if (Number.isInteger(iBond)) {
      this.load(iBond)
    }
  }

  load (iBond) {
    this.iBond = iBond
    return this
  }

  get iAtom1 () {
    return this.soup.bondStore.iAtom1[this.iBond]
  }

  get iAtom2 () {
    return this.soup.bondStore.iAtom2[this.iBond]
  }
}


/**
 * Soup
 * -------
 * The main data object that holds information
 * about the soup. This object is responsible
 * for reading the data from the PDB and turning
 * it into a suitable javascript object.
 *
 * The soup will be embedded in a SoupView
 * object that will handle all the different
 * viewing options.
 *
 * Allowable actions on the SoupView of the Soup
 * will be made via the Controller object. This
 * includes AJAX operations with the server
 * jolecule.appspot.com, and uses jQuery for the
 * i/o operations with the server.
 */
class Soup {

  constructor () {
    this.parsingError = ''
    this.default_html = ''

    this.atomStore = new Store(atomStoreFields)
    this.residueStore = new Store(residueStoreFields)
    this.bondStore = new Store(bondStoreFields)
    this.chains = []

    this.resIds = []

    this.atomProxy = new AtomProxy(this)
    this.residueProxy = new ResidueProxy(this)

    this.atomSelect = new BitArray(0)
    this.residueSelect = new BitArray(0)
    this.bondSelect = new BitArray(0)

    this.elemTable = []
    this.atomTypeTable = []
    this.resTypeTable = []
    this.colorTable = []


    this.residueNormal = {}
    this.residueConhPartners = {}
    this.residueNormals = {}

    this.grid = {
      bCutoff: 0.8,
      bMax: 2,
      bMin: 0.4,
      changed: true,
      isElem: {}
    }
  }

  load (protein_data) {

    this.pdb_id = protein_data['pdb_id']

    let title = parsetTitleFromPdbText(protein_data['pdb_text'])
    this.default_html = this.pdb_id + ': ' + title

    console.log(`Soup.load parse ${this.pdb_id}...`)

    this.makeAtomsFromPdbLines(protein_data['pdb_text'], this.pdb_id)

    this.atomSelect = new BitArray(this.getAtomCount())
    this.residueSelect = new BitArray(this.getResidueCount())

    this.assignResidueSsAndCentralAtoms()

    console.log(
      `Soup.load processed ${this.getAtomCount()} atoms, ` +
      `${this.getResidueCount()} residues`)

    console.log('Soup.load finding bonds...')
    this.calcBondsStrategic()

    console.log(`Soup.load calculated ${this.getBondCount()} bonds`)

    this.assignBondsToAtoms()

    console.log(`Soup.load assigned bonds to atoms`)

    this.calcMaxLength()

    this.findSecondaryStructure()
    console.log(`Soup.load calculated secondary-structure`)

  }

  makeAtomsFromPdbLines (pdbText, pdbId) {

    this.pdbId = pdbId

    const pdbLines = pdbText.split(/\r?\n/)

    let lines = []
    for (let line of pdbLines) {
      if ((line.slice(0, 4) === 'ATOM') ||
        (line.slice(0, 6) === 'HETATM')) {
        lines.push(line)
      }
      if (line.slice(0, 3) === 'END') {
        break
      }
    }

    if (lines.length === 0) {
      this.parsingError = 'No atom lines'
      return
    }

    for (let iLine = 0; iLine < lines.length; iLine += 1) {
      let line = lines[iLine]
      if (line.substr(0, 4) === 'ATOM' || line.substr(0, 6) === 'HETATM') {
        let x, y, z, chain, resNumIns, resType, atomType, bfactor, elem, alt, resNum, insCode
        try {
          atomType = _.trim(line.substr(12, 4))
          alt = _.trim(line.substr(16, 1))
          resType = _.trim(line.substr(17, 3))
          chain = _.trim(line[21])
          resNum = parseInt(line.substr(22, 4))
          insCode = line.substr(26, 1)
          x = parseFloat(line.substr(30, 7))
          y = parseFloat(line.substr(38, 7))
          z = parseFloat(line.substr(46, 7))
          bfactor = parseFloat(line.substr(60, 6))
          elem = deleteNumbers(_.trim(line.substr(76, 2)))
        } catch (e) {
          this.parsingError = 'line ' + iLine
          console.log(`Error: "${line}"`)
          continue
        }

        if (elem === '') {
          elem = deleteNumbers(_.trim(atomType)).substr(0, 1)
        }

        this.addAtom(x, y, z, bfactor, alt, atomType, elem, resType, resNum, insCode, chain)
      }
    }
  }

  addAtom (x, y, z, bfactor, alt, atomType, elem, resType, resNum, insCode, chain) {

    let iAtom = this.atomStore.count

    this.atomStore.increment()

    this.atomStore.x[iAtom] = x
    this.atomStore.y[iAtom] = y
    this.atomStore.z[iAtom] = z

    this.atomStore.bfactor[iAtom] = bfactor
    this.atomStore.alt[iAtom] = charToInt(alt)

    this.atomStore.bondCount[iAtom] = 0

    this.atomStore.iAtomType[iAtom] = getValueTableIndex(
      this.atomTypeTable, atomType)

    this.atomStore.iElem[iAtom] = getValueTableIndex(
      this.elemTable, elem)

    let nRes = this.getResidueCount()

    let isNewRes = false
    if (nRes === 0) {
      isNewRes = true
    } else {
      this.residueProxy.iRes = nRes - 1
      if (this.residueProxy.resNum !== resNum) {
        isNewRes = true
      } else if (this.residueProxy.insCode !== insCode) {
        isNewRes = true
      }
    }

    if (isNewRes) {
      this.addResidue(iAtom, resNum, insCode, chain, resType)
    }

    let iRes = this.getResidueCount() - 1
    this.residueStore.atomCount[iRes] += 1
    this.atomStore.iRes[iAtom] = iRes
  }

  addResidue (iFirstAtomInRes, resNum, insCode, chain, resType) {
    let iRes = this.getResidueCount()
    this.residueStore.increment()

    let resId = this.pdbId + ':'
    if (chain) {
      resId += chain + ':'
    }
    resId += resNum + _.trim(insCode)

    this.resIds.push(resId)

    let iChain = getValueTableIndex(this.chains, chain)
    this.residueStore.iChain[iRes] = iChain

    this.residueStore.resNum[iRes] = resNum
    this.residueStore.insCode[iRes] = charToInt(insCode)

    this.residueStore.iResType[iRes] = getValueTableIndex(
      this.resTypeTable, resType)

    this.residueStore.atomOffset[iRes] = iFirstAtomInRes
    this.residueStore.atomCount[iRes] = 0
  }

  getCentralAtomProxy () {
    let atomIndices = _.range(this.getAtomCount())
    let center = this.getCenter(atomIndices)
    let iAtom = this.getIAtomClosest(center, atomIndices)
    return this.getAtomProxy(iAtom)
  }

  assignResidueSsAndCentralAtoms () {
    let res = this.getResidueProxy()
    for (let iRes = 0; iRes < this.getResidueCount(); iRes += 1) {

      res.iRes = iRes

      if (this.hasProteinBackbone(iRes)) {
        res.iAtom = res.getAtom('CA').iAtom
        res.ss = 'C'
        res.isPolymer = true
      } else if (this.hasSugarBackbone(iRes)) {
        res.iAtom = res.getAtom('C3\'').iAtom
        res.ss = 'D'
        res.isPolymer = true
      } else {
        res.isPolymer = false
        if (res.resType === 'HOH') {
          // water
          res.ss = 'W'
        } else if (res.resType === 'XXX') {
          // grid atom
          res.ss = 'G'
        } else {
          res.ss = '-'
        }
        let center = this.getCenter(res.getAtomIndices())
        res.iAtom = this.getIAtomClosest(center, res.getAtomIndices())
      }
    }
  }

  getIAtomClosest (pos, atomIndices) {
    let iAtomClosest = null
    let min_d = 1E6
    let atom = this.getAtomProxy()
    for (let iAtom of atomIndices) {
      if (iAtomClosest === null) {
        iAtomClosest = iAtom
      } else {
        atom.iAtom = iAtom
        let d = v3.distance(pos, atom.pos)
        if (d < min_d) {
          iAtomClosest = iAtom
          min_d = d
        }
      }
    }
    return iAtomClosest
  }

  getCenter (atomIndices) {
    let result = v3.create(0, 0, 0)
    let atom = this.getAtomProxy()
    for (let iAtom of atomIndices) {
      result = v3.sum(result, atom.load(iAtom).pos)
    }
    result.divideScalar(atomIndices.length)
    return result
  }

  /**
   * TODO: replace with bounding box?
   */
  calcMaxLength () {
    let maxima = [0.0, 0.0, 0.0]
    let minima = [0.0, 0.0, 0.0]
    let spans = [0.0, 0.0, 0.0]

    function comp (v, i) {
      if (i === 0) return v.x
      if (i === 1) return v.y
      if (i === 2) return v.z
    }

    let atom = this.getAtomProxy()
    for (let iDim = 0; iDim < 3; iDim++) {
      for (let iAtom = 0; iAtom < this.getAtomCount(); iAtom += 1) {
        let pos = atom.load(iAtom).pos
        if (minima[iDim] > comp(pos, iDim)) {
          minima[iDim] = comp(pos, iDim)
        }
        if (maxima[iDim] < comp(pos, iDim)) {
          maxima[iDim] = comp(pos, iDim)
        }
      }
      spans[iDim] = maxima[iDim] - minima[iDim]
    }
    this.maxLength = Math.max(spans[0], spans[1], spans[2])
  }

  calcBondsStrategic () {
    this.bondStore.count = 0

    const small_cutoff_sq = 1.2 * 1.2
    const medium_cutoff_sq = 1.9 * 1.9
    const large_cutoff_sq = 2.4 * 2.4
    const CHONPS = ['C', 'H', 'O', 'N', 'P', 'S']

    function isBonded(atom1, atom2) {
      // don't include bonds between different alt positions
      if ((atom1.alt !== '') && (atom2.alt !== '')) {
        if (atom1.alt !== atom2.alt) {
          return false
        }
      }

      let cutoff_sq
      if ((atom1.elem === 'H') || (atom2.elem === 'H')) {
        cutoff_sq = small_cutoff_sq
      } else if (
        inArray(atom1.elem, CHONPS) &&
        inArray(atom2.elem, CHONPS)) {
        cutoff_sq = medium_cutoff_sq
      } else {
        cutoff_sq = large_cutoff_sq
      }

      let diff_x = atom1.pos.x - atom2.pos.x
      let diff_y = atom1.pos.y - atom2.pos.y
      let diff_z = atom1.pos.z - atom2.pos.z
      let dist_sq = diff_x * diff_x + diff_y * diff_y + diff_z * diff_z
      return dist_sq <= cutoff_sq
    }

    let residue1 = this.getResidueProxy()
    let nRes = this.getResidueCount()
    let atom1 = this.getAtomProxy()
    let atom2 = this.getAtomProxy()

    for (let iRes1 = 0; iRes1 < nRes; iRes1++) {
      residue1.iRes = iRes1

      // cycle through all atoms within a residue
      for (let iAtom1 of residue1.getAtomIndices()) {
        for (let iAtom2 of residue1.getAtomIndices()) {
          atom1.iAtom = iAtom1
          atom2.iAtom = iAtom2

          if (isBonded(atom1, atom2)) {
            let iBond = this.getBondCount()
            this.bondStore.increment()
            this.bondStore.iAtom1[iBond] = atom1.iAtom
            this.bondStore.iAtom2[iBond] = atom2.iAtom

            iBond = this.getBondCount()
            this.bondStore.increment()
            this.bondStore.iAtom1[iBond] = atom2.iAtom
            this.bondStore.iAtom2[iBond] = atom1.iAtom
          }
        }
      }
    }

    this.bondSelect = new BitArray(this.getBondCount())
  }

  calcBondsBruteForce () {

    this.bondStore.count = 0

    const small_cutoff = 1.2
    const medium_cutoff = 1.9
    const large_cutoff = 2.4
    const CHONPS = ['C', 'H', 'O', 'N', 'P', 'S']

    let atom1 = this.getAtomProxy()
    let atom2 = this.getAtomProxy()
    let nAtom = this.getAtomCount()

    let vertices = []
    for (let iAtom = 0; iAtom < nAtom; iAtom += 1) {
      atom1.iAtom = iAtom
      vertices.push([atom1.pos.x, atom1.pos.y, atom1.pos.z])
    }

    let spaceHash = new SpaceHash(vertices)
    for (let pair of spaceHash.getClosePairs()) {

      let iAtom1 = pair[0]
      let iAtom2 = pair[1]

      if (iAtom1 === iAtom2) {
        continue
      }

      atom1.iAtom = iAtom1
      atom2.iAtom = iAtom2

      // HACK: to avoid the water grid bond calculation
      // step that kills the rendering
      if ((atom1.resType === 'XXX') || (atom2.resType === 'XXX')) {
        continue
      }

      if ((atom1.alt !== '') && (atom2.alt !== '')) {
        if (atom1.alt !== atom2.alt) {
          continue
        }
      }

      let cutoff
      if ((atom1.elem === 'H') || (atom2.elem === 'H')) {
        cutoff = small_cutoff
      } else if (
        inArray(atom1.elem, CHONPS) &&
        inArray(atom2.elem, CHONPS)) {
        cutoff = medium_cutoff
      } else {
        cutoff = large_cutoff
      }

      if (v3.distance(atom1.pos, atom2.pos) <= cutoff) {
        let iBond = this.getBondCount()
        this.bondStore.increment()
        this.bondStore.iAtom1[iBond] = atom1.iAtom
        this.bondStore.iAtom2[iBond] = atom2.iAtom

        iBond = this.getBondCount()
        this.bondStore.increment()
        this.bondStore.iAtom1[iBond] = atom2.iAtom
        this.bondStore.iAtom2[iBond] = atom1.iAtom
      }
    }
    this.bondSelect = new BitArray(this.getBondCount())

  }

  assignBondsToAtoms () {

    let iAtom1Array = this.bondStore.iAtom1
    this.bondStore.sort((i, j) => iAtom1Array[i] - iAtom1Array[j])

    for (let iAtom = 0; iAtom < this.getAtomCount(); iAtom += 1) {
      this.atomStore.bondCount[iAtom] = 0
    }

    let bond = this.getBondProxy()

    let iAtom1 = null
    for (let iBond = 0; iBond < this.getBondCount(); iBond +=1) {
      bond.iBond = iBond
      if (iAtom1 !== bond.iAtom1) {
        iAtom1 = bond.iAtom1
        this.atomStore.bondOffset[iAtom1] = iBond
      }
      this.atomStore.bondCount[iAtom1] += 1
    }
  }

  hasProteinBackbone (iRes) {
    return this.getCurrentResidueProxy(iRes).checkAtomTypes(['CA', 'N', 'C'])
  }

  hasSugarBackbone (iRes) {
    return this.getCurrentResidueProxy(iRes).checkAtomTypes([
      'C3\'', 'O3\'', 'C5\'', 'O4\'', 'C1\''])
  }

  /**
   * Detect phosphate sugar bond
   */
  isSugarPhosphateConnected (iRes0, iRes1) {
    if (this.hasSugarBackbone(iRes0) &&
        this.hasSugarBackbone(iRes1) &&
        this.getCurrentResidueProxy(iRes1).checkAtomTypes(['P'])) {
      let o3 = this.getCurrentResidueProxy(iRes0).getAtom('O3\'').pos.clone()
      let p = this.getCurrentResidueProxy(iRes1).getAtom('P').pos.clone()
      if (v3.distance(o3, p) < 2.5) {
        return true
      }
    }
    return false
  }

  /**
   * Detect peptide bond
   * @returns {boolean}
   */
  isPeptideConnected (iRes0, iRes1) {
    if (this.hasProteinBackbone(iRes0) &&
        this.hasProteinBackbone(iRes1)) {
      let c = this.getCurrentResidueProxy(iRes0).getAtom('C').pos.clone()
      let n = this.getCurrentResidueProxy(iRes1).getAtom('N').pos.clone()
      if (v3.distance(c, n) < 2) {
        return true
      }
    }
    return false
  }

  isPolymerConnected (iRes0, iRes1) {
    let peptideConnect = this.isPeptideConnected(iRes0, iRes1)
    let nucleotideConnect = this.isSugarPhosphateConnected(iRes0, iRes1)
    return peptideConnect || nucleotideConnect
  }

  getNucleotideNormal (iRes) {
    let c3 = this.getCurrentResidueProxy(iRes).getAtom('C3\'').pos.clone()
    let c5 = this.getCurrentResidueProxy(iRes).getAtom('C5\'').pos.clone()
    let c1 = this.getCurrentResidueProxy(iRes).getAtom('C1\'').pos.clone()
    let forward = v3.diff(c3, c5)
    let up = v3.diff(c1, c3)
    return v3.crossProduct(forward, up)
  }

  /**
   * Methods to calculate secondary-structure using Kabsch-Sanders
   */

  /**
   * Find backbone hydrogen bonds
   */
  findBackboneHbonds () {
    let vertices = []
    let atomIndices  = []

    let residue = this.getResidueProxy()

    // Collect backbone O and N atoms
    for (let iRes = 0; iRes < this.getResidueCount(); iRes += 1) {
      residue.iRes = iRes
      if (residue.isPolymer) {
        for (let aTypeName of ['O', 'N']) {
          let a = residue.getAtom(aTypeName)
          if (a !== null) {
            vertices.push([a.pos.x, a.pos.y, a.pos.z])
            atomIndices.push(a.iAtom)
          }
        }
      }
    }

    let a0 = this.getAtomProxy()
    let a1 = this.getAtomProxy()

    let cutoff = 3.5
    let spaceHash = new SpaceHash(vertices)
    for (let pair of spaceHash.getClosePairs()) {
      a0.iAtom = atomIndices[pair[0]]
      a1.iAtom = atomIndices[pair[1]]
      if ((a0.elem === 'O') && (a1.elem === 'N')) {
        [a0, a1] = [a1, a0]
      }
      if (!((a0.elem === 'N') && (a1.elem === 'O'))) {
        continue
      }
      let iRes0 = a0.iRes
      let iRes1 = a1.iRes
      if (iRes0 === iRes1) {
        continue
      }
      if (v3.distance(a0.pos, a1.pos) <= cutoff) {
        pushToListInDict(this.residueConhPartners, iRes0, iRes1)
      }
    }
  }

  /**
   * Find Secondary Structure:
   * - H - alpha-helix/3-10-helix
   * - E - beta-sheet
   * - C - coil
   * - - - ligand
   * - W - water
   * - D - DNA or RNA
   * - R - non-standard nucleotide
   */
  findSecondaryStructure () {
    this.findBackboneHbonds()

    let nRes = this.getResidueCount()

    let residue0 = this.getResidueProxy()
    let residue1 = this.getResidueProxy()

    let atom0 = this.getAtomProxy()
    let atom1 = this.getAtomProxy()

    let display = this

    function isCONHBonded (iRes0, iRes1) {
      if ((iRes1 < 0) || (iRes1 >= nRes)) {
        return false
      }
      if ((iRes0 < 0) || (iRes0 >= nRes)) {
        return false
      }
      return _.includes(display.residueConhPartners[iRes1], iRes0)
    }

    function vecBetweenResidues (iRes0, iRes1) {
      let pos0 = atom0.load(residue0.load(iRes0).iAtom).pos.clone()
      let pos1 = atom1.load(residue1.load(iRes1).iAtom).pos.clone()
      return v3.diff(pos0, pos1)
    }

    for (let iRes1 = 0; iRes1 < nRes; iRes1 += 1) {

      if (_.includes('DR', this.getCurrentResidueProxy(iRes1).ss)) {
        pushToListInDict(
          this.residueNormals, iRes1, this.getNucleotideNormal(iRes1))
      }

      // alpha-helix
      if (isCONHBonded(iRes1, iRes1 + 4) &&
        isCONHBonded(iRes1 + 1, iRes1 + 5)) {
        let normal1 = vecBetweenResidues(iRes1, iRes1 + 4)
        let normal2 = vecBetweenResidues(iRes1 + 1, iRes1 + 5)
        for (let iRes2 = iRes1 + 1; iRes2 < iRes1 + 5; iRes2 += 1) {
          this.getCurrentResidueProxy(iRes2).ss = 'H'
          pushToListInDict(this.residueNormals, iRes2, normal1)
          pushToListInDict(this.residueNormals, iRes2, normal2)
        }
      }

      // 3-10 helix
      if (isCONHBonded(iRes1, iRes1 + 3) &&
        isCONHBonded(iRes1 + 1, iRes1 + 4)) {
        let normal1 = vecBetweenResidues(iRes1, iRes1 + 3)
        let normal2 = vecBetweenResidues(iRes1 + 1, iRes1 + 4)
        for (let iRes2 = iRes1 + 1; iRes2 < iRes1 + 4; iRes2 += 1) {
          this.getCurrentResidueProxy(iRes2).ss = 'H'
          pushToListInDict(this.residueNormals, iRes2, normal1)
          pushToListInDict(this.residueNormals, iRes2, normal2)
        }
      }

      for (let iRes2 = iRes1 + 1; iRes2 < nRes; iRes2 += 1) {

        if ((Math.abs(iRes1 - iRes2) <= 5)) {
          continue
        }

        let betaResidueIndices = []

        // parallel beta sheet pairs
        if (isCONHBonded(iRes1, iRes2 + 1) &&
          isCONHBonded(iRes2 - 1, iRes1)) {
          betaResidueIndices = betaResidueIndices.concat([iRes1, iRes2])
        }
        if (isCONHBonded(iRes1 - 1, iRes2) &&
          isCONHBonded(iRes2, iRes1 + 1)) {
          betaResidueIndices = betaResidueIndices.concat([iRes1, iRes2])
        }

        // anti-parallel hbonded beta sheet pairs
        if (isCONHBonded(iRes1, iRes2) &&
          isCONHBonded(iRes2, iRes1)) {
          betaResidueIndices = betaResidueIndices.concat([iRes1, iRes2])
          let normal = vecBetweenResidues(iRes1, iRes2)
          pushToListInDict(this.residueNormals, iRes1, normal)
          pushToListInDict(this.residueNormals, iRes2, v3.scaled(normal, -1))
        }

        // anti-parallel non-hbonded beta sheet pairs
        if (isCONHBonded(iRes1 - 1, iRes2 + 1) &&
          isCONHBonded(iRes2 - 1, iRes1 + 1)) {
          betaResidueIndices = betaResidueIndices.concat([iRes1, iRes2])
          let normal = vecBetweenResidues(iRes1, iRes2)
          pushToListInDict(this.residueNormals, iRes1, v3.scaled(normal, -1))
          pushToListInDict(this.residueNormals, iRes2, normal)
        }

        for (let iRes of betaResidueIndices) {
          this.getCurrentResidueProxy(iRes).ss = 'E'
        }
      }
    }

    // average residueNormals to make a nice average
    for (let iRes = 0; iRes < nRes; iRes += 1) {
      if ((iRes in this.residueNormals) && (this.residueNormals[iRes].length > 0)) {
        let normalSum = v3.create(0, 0, 0)
        for (let normal of this.residueNormals[iRes]) {
          normalSum = v3.sum(normalSum, normal)
        }
        this.residueNormal[iRes] = v3.normalized(normalSum)
      }
    }

    // flip every second beta-strand normal so they are
    // consistently pointing in the same direction
    for (let iRes = 1; iRes < nRes; iRes += 1) {
      residue0.iRes = iRes - 1
      if ((residue0.ss === 'E') && residue0.normal) {
        residue1.iRes = iRes
        if ((residue1.ss === 'E') && residue1.normal) {
          if (residue1.normal.dot(residue0.normal) < 0) {
            this.residueNormal[iRes].negate()
          }
        }
      }
    }

  }

  getAtomProxy (iAtom) {
    return new AtomProxy(this, iAtom)
  }

  getCurrentAtomProxy (iAtom) {
    return this.atomProxy.load(iAtom)
  }

  getAtomCount () {
    return this.atomStore.count
  }

  getResidueProxy (iRes) {
    return new ResidueProxy(this, iRes)
  }

  getCurrentResidueProxy (iRes) {
    return this.residueProxy.load(iRes)
  }

  getBondProxy (iBond) {
    return new BondProxy(this, iBond)
  }

  getBondCount () {
    return this.bondStore.count
  }

  getResidueCount () {
    return this.residueStore.count
  }

  clearSelectedResidues () {
    this.residueSelect.clearBits()
  }

  areCloseResidues (iRes0, iRes1) {
    let atom0 = this.getAtomProxy()
    let atom1 = this.getAtomProxy()

    let res0 = this.getResidueProxy(iRes0)
    let pos0 = atom0.load(res0.iAtom).pos.clone()
    let atomIndices0 = res0.getAtomIndices()

    let res1 = this.getResidueProxy(iRes1)
    let pos1 = atom1.load(res1.iAtom).pos.clone()
    let atomIndices1 = res1.getAtomIndices()

    if (v3.distance(pos0, pos1) > 17) {
      return false
    }

    for (let iAtom0 of atomIndices0) {
      for (let iAtom1 of atomIndices1) {
        if (v3.distance(atom0.load(iAtom0).pos, atom1.load(iAtom1).pos) < 4) {
          return true
        }
      }
    }
    return false
  }

  clearSelectedResidues () {
    let residue = this.getResidueProxy()
    for (let iRes = 0; iRes < this.getResidueCount(); iRes += 1) {
      residue.load(iRes).selected = false
    }
  }

  selectResidues (residueIndices, select) {
    let residue = this.getResidueProxy()
    for (let iRes of residueIndices) {
      residue.load(iRes).selected = select
    }
  }

  selectNeighbourResidues (iRes, selected) {
    let indices = [iRes]
    for (let jRes = 0; jRes < this.getResidueCount(); jRes += 1) {
      if (this.areCloseResidues(jRes, iRes)) {
        indices.push(jRes)
      }
    }
    this.selectResidues(indices, selected)
  }

  /**
   * Searches autodock grid atoms for B-factor limits
   */
  findGridLimits () {
    let residue = this.getResidueProxy()
    let atom = this.getAtomProxy()
    for (let iRes = 0; iRes < this.getResidueCount(); iRes += 1) {
      residue.iRes = iRes
      if (residue.ss === 'G') {
        atom.iAtom = residue.iAtom
        if (!(atom.elem in this.grid.isElem)) {
          this.grid.isElem[atom.elem] = true
        }
        if (this.grid.bMin === null) {
          this.grid.bMin = atom.bfactor
          this.grid.bMax = atom.bfactor
        } else {
          if (atom.bfactor > this.grid.bMax) {
            this.grid.bMax = atom.bfactor
          }
          if (atom.bfactor < this.grid.bMin) {
            this.grid.bMin = atom.bfactor
          }
        }
      }
    }

    if (this.grid.bMin === null) {
      this.grid.bMin = 0
    }
    if (this.grid.bMax === null) {
      this.grid.bMin = 0
    }
    this.grid.bCutoff = this.grid.bMin
  }

}

/**
 *
 * View
 * ----
 * A view includes all pertinent viewing options
 * needed to render the soup in the way
 * for the user.
 *
 * JolyCamera stores information about
 * the direction and zoom that a soup
 * should be viewed
 *
 * Inside a view are two cameras as a camera is
 * defined in terms of an existing frame of
 * reference. The first camera refers to the
 * current_view camera.
 *
 * The absolute camera is expressed with respect
 * to the original frame of coordinate of the PDB.
 *
 * Converts JolyCamera to Target, the view structure for
 * Display
 *
 * JolyCamera {
 *    pos: soupView center, camera focus
 *    up: gives the direction of the y vector from pos
 *    in: gives the positive z-axis direction
 *    zFront: clipping plane in front of the camera focus
 *    zBack: clipping plane behind the camera focus
 * }
 *
 * camera {
 *    focus: position that camera is looking at
 *    position: position of camera - distance away gives zoom
 *    up: vector direction denoting the up direction of camera
 *    zFront: clipping plane in front of the camera focus
 *    zBack: clipping plane behind the camera focus
 * }
 *
 * Coordinates
 * - JolyCamera
 *     - soupView is from 0 to positive z; since canvasjolecule draws +z into screen
 *     - as opengl +z is out of screen, need to flip z direction
 *     - in opengl, the box is -1 to 1 that gets projected on screen + perspective
 *     - by adding a i distance to move the camera further into -z
 *     - z_front and z_back define cutoffs
 * - opengl:
 *     - x right -> left
 *     - y bottom -> top (inverse of classic 2D coordinate)
 *     - z far -> near
 *     - that is positive Z direction is out of the screen
 *     - box -1to +1
 */
class View {

  constructor () {
    this.id = 'view:000000'
    this.i_atom = -1
    this.order = 1
    this.camera = {
      focus: v3.create(0, 0, 0),
      position: v3.create(0, 0, -1),
      up: v3.create(0, 1, 0),
      zFront: 0,
      zBack: 0,
      zoom: 1
    }
    this.selected = []
    this.labels = []
    this.distances = []
    this.text = 'Default view of PDB file'
    this.creator = ''
    this.url = getWindowUrl()
    this.show = {
      sidechain: true,
      peptide: true,
      hydrogen: false,
      water: false,
      ligands: true,
      trace: false,
      all_atom: false,
      ribbon: true
    }
  }

  setCamera (camera) {
    this.camera = camera
  }

  makeDefaultOfSoup (soup) {
    let atom = soup.getCentralAtomProxy()
    this.i_atom = atom.iAtom

    this.show.sidechain = false

    this.camera.zFront = -soup.maxLength / 2
    this.camera.zBack = soup.maxLength / 2
    this.camera.zoom = Math.abs(soup.maxLength) * 1.75
    this.camera.up = v3.create(0, 1, 0)
    this.camera.focus.copy(atom.pos)
    this.camera.position = v3
      .create(0, 0, -this.camera.zoom).add(atom.pos)

    this.order = 0
    this.text = soup.default_html
    this.pdb_id = soup.pdb_id
  }

  getViewTranslatedTo (pos) {
    let view = this.clone()
    let disp = pos.clone().sub(view.camera.focus)
    view.camera.focus.copy(pos)
    view.camera.position.add(disp)
    return view
  }

  clone () {
    let v = new View()
    v.id = this.id
    v.i_atom = this.i_atom
    v.selected = this.selected
    v.labels = _.cloneDeep(this.labels)
    v.distances = _.cloneDeep(this.distances)
    v.order = this.order
    v.text = this.text
    v.time = this.time
    v.url = this.url
    v.camera = _.cloneDeep(this.camera)
    v.show = _.cloneDeep(this.show)
    return v
  }

  getDict () {

    let cameraDir = this.camera.focus.clone()
      .sub(this.camera.position)
    let zoom = cameraDir.length()
    cameraDir.normalize()
    let pos = this.camera.focus
    let in_v = pos.clone().add(cameraDir)
    let up_v = pos.clone().sub(this.camera.up)

    return {
      version: 2,
      view_id: this.id,
      creator: this.creator,
      pdb_id: this.pdb_id,
      order: this.order,
      show: this.show,
      text: this.text,
      i_atom: this.i_atom,
      labels: this.labels,
      selected: this.selected,
      distances: this.distances,
      camera: {
        slab: {
          z_front: this.camera.zFront,
          z_back: this.camera.zBack,
          zoom: zoom
        },
        pos: [pos.x, pos.y, pos.z],
        up: [up_v.x, up_v.y, up_v.z],
        in: [in_v.x, in_v.y, in_v.z]
      }
    }
  }

  setCameraFromJolyCamera (jolyCamera) {
    let focus = v3.clone(jolyCamera.pos)

    let cameraDirection = v3
      .clone(jolyCamera.in_v)
      .sub(focus)
      .multiplyScalar(jolyCamera.zoom)
      .negate()

    let position = v3
      .clone(focus).add(cameraDirection)

    let up = v3
      .clone(jolyCamera.up_v)
      .sub(focus)
      .negate()

    this.camera = {
      focus: focus,
      position: position,
      up: up,
      zFront: jolyCamera.z_front,
      zBack: jolyCamera.z_back,
      zoom: jolyCamera.zoom
    }
  }

  setFromDict (flat_dict) {
    this.id = flat_dict.view_id
    this.view_id = flat_dict.view_id
    this.pdb_id = flat_dict.pdb_id
    this.lock = flat_dict.lock
    this.text = flat_dict.text
    this.creator = flat_dict.creator
    this.order = flat_dict.order
    this.res_id = flat_dict.res_id
    this.i_atom = flat_dict.i_atom

    this.labels = flat_dict.labels
    this.selected = flat_dict.selected
    this.distances = flat_dict.distances

    this.show = flat_dict.show
    if (!(this.show.all_atom || this.show.trace || this.show.ribbon)) {
      this.show.ribbon = true
    }

    let jolyCamera = {
      pos: v3.create(0, 0, 0),
      up_v: v3.create(0, 1, 0),
      in_v: v3.create(0, 0, 1),
      zoom: 1.0,
      z_front: 0.0,
      z_back: 0.0
    }
    jolyCamera.pos.x = flat_dict.camera.pos[0]
    jolyCamera.pos.y = flat_dict.camera.pos[1]
    jolyCamera.pos.z = flat_dict.camera.pos[2]
    jolyCamera.up_v.x = flat_dict.camera.up[0]
    jolyCamera.up_v.y = flat_dict.camera.up[1]
    jolyCamera.up_v.z = flat_dict.camera.up[2]
    jolyCamera.in_v.x = flat_dict.camera.in[0]
    jolyCamera.in_v.y = flat_dict.camera.in[1]
    jolyCamera.in_v.z = flat_dict.camera.in[2]
    jolyCamera.z_front = flat_dict.camera.slab.z_front
    jolyCamera.z_back = flat_dict.camera.slab.z_back
    jolyCamera.zoom = flat_dict.camera.slab.zoom

    this.setCameraFromJolyCamera(jolyCamera)
  }

}

function interpolateCameras (oldCamera, futureCamera, t) {

  let oldCameraDirection = oldCamera.position.clone()
    .sub(oldCamera.focus)
  let oldZoom = oldCameraDirection.length()
  oldCameraDirection.normalize()

  let futureCameraDirection =
    futureCamera.position.clone().sub(futureCamera.focus)

  let futureZoom = futureCameraDirection.length()
  futureCameraDirection.normalize()

  let cameraDirRotation = glgeom.getUnitVectorRotation(
    oldCameraDirection, futureCameraDirection)

  let partialRotatedCameraUp = oldCamera.up.clone()
    .applyQuaternion(cameraDirRotation)

  let fullCameraUpRotation = glgeom
    .getUnitVectorRotation(partialRotatedCameraUp, futureCamera.up)
    .multiply(cameraDirRotation)
  let cameraUpRotation = glgeom.getFractionRotation(
    fullCameraUpRotation, t)

  let focusDisp = futureCamera.focus.clone()
    .sub(oldCamera.focus)
    .multiplyScalar(t)

  let focus = oldCamera.focus.clone().add(focusDisp)

  let zoom = glgeom.fraction(oldZoom, futureZoom, t)

  let focusToPosition = oldCameraDirection.clone()
    .applyQuaternion(cameraUpRotation)
    .multiplyScalar(zoom)

  return {
    focus: focus,
    position: focus.clone().add(focusToPosition),
    up: oldCamera.up.clone().applyQuaternion(cameraUpRotation),
    zFront: glgeom.fraction(oldCamera.zFront, futureCamera.zFront, t),
    zBack: glgeom.fraction(oldCamera.zBack, futureCamera.zBack, t),
    zoom: zoom
  }
}

/**
 * The SoupView contains a soup and a list of
 * views of the soup, including the current
 * view, and a target view for animation
 */
class SoupView {

  constructor (soup) {

    // the soup data for the soupView
    this.soup = soup

    // stores the current camera, display
    // options, distances, labels, selected
    // residues
    this.current_view = new View()

    // stores other views that can be reloaded
    this.saved_views_by_id = {}
    this.saved_views = []
    this.i_last_view = 0

    // stores a target view for animation
    this.target_view = null
    // timing counter that is continually decremented
    // until it becomes negative
    this.n_update_step = -1
    // this is to set the time between transitions of views
    this.max_update_step = 20

    this.updateSelection = false
    this.updateView = true
  }

  set_target_view (view) {
    this.n_update_step = this.max_update_step
    this.target_view = view.clone()
    this.updateView = true
  }

  centered_atom () {
    let i = this.current_view.i_atom
    return this.soup.getAtomProxy(i)
  }

  get_i_saved_view_from_id (id) {
    for (let j = 0; j < this.saved_views.length; j += 1) {
      if (this.saved_views[j].id === id) {
        return j
      }
    }
    return -1
  }

  insert_view (j, new_id, new_view) {
    this.saved_views_by_id[new_id] = new_view
    if (j >= this.saved_views.length) {
      this.saved_views.push(new_view)
    } else {
      this.saved_views.splice(j, 0, new_view)
    }
    this.i_last_view = j
    for (let i = 0; i < this.saved_views.length; i++) {
      this.saved_views[i].order = i
    }
  }

  remove_saved_view (id) {
    let i = this.get_i_saved_view_from_id(id)
    if (i < 0) {
      return
    }
    this.saved_views.splice(i, 1)
    delete this.saved_views_by_id[id]
    for (let j = 0; j < this.saved_views.length; j++) {
      this.saved_views[j].order = j
    }
    if (this.i_last_view >= this.saved_views.length) {
      this.i_last_view = this.saved_views.length - 1
    }
    this.changed = true
  }

  save_view (view) {
    this.saved_views_by_id[view.id] = view
    this.saved_views.push(view)
  }

}

/**
 * The Controller for SoupView. All mutations
 * to a Soup and its Views go through here.
 */
class Controller {

  constructor (scene) {
    this.soup = scene.soup
    this.soupView = scene
  }

  delete_dist (i) {
    this.soupView.current_view.distances.splice(i, 1)
    this.soupView.changed = true
  }

  make_dist (iAtom1, iAtom2) {
    this.soupView.current_view.distances.push(
      {'i_atom1': iAtom1, 'i_atom2': iAtom2})
    this.soupView.changed = true
  }

  make_label (iAtom, text) {
    this.soupView.current_view.labels.push({
      'i_atom': iAtom, 'text': text,
    })
    this.soupView.changed = true
  }

  delete_label (iLabel) {
    this.soupView.current_view.labels.splice(iLabel, 1)
    this.soupView.changed = true
  }

  set_target_view (view) {
    this.soupView.set_target_view(view)
  }

  set_target_view_by_id (viewId) {
    let view = this.soupView.saved_views_by_id[viewId]
    this.soupView.i_last_view = this.soupView.saved_views_by_id[viewId].order
    this.set_target_view(view)
  }

  set_target_view_by_atom (iAtom) {
    let atom = this.soup.getAtomProxy(iAtom)
    let view = this.soupView.current_view.getViewTranslatedTo(atom.pos)
    view.i_atom = iAtom
    this.set_target_view(view)
  }

  set_target_prev_residue () {
    let iAtom = this.soupView.current_view.i_atom
    let iRes = this.soup.getAtomProxy(iAtom).iRes
    if (iRes <= 0) {
      iRes = this.soup.getResidueCount() - 1
    } else {
      iRes -= 1
    }
    iAtom = this.soup.getResidueProxy(iRes).iAtom
    this.set_target_view_by_atom(iAtom)
  }

  set_target_next_residue () {
    let iAtom = this.soupView.current_view.i_atom
    let iRes = this.soup.getAtomProxy(iAtom).iRes
    if (iRes >= this.soup.getResidueCount() - 1) {
      iRes = 0
    } else {
      iRes += 1
    }
    iAtom = this.soup.getResidueProxy(iRes).iAtom
    this.set_target_view_by_atom(iAtom)
  }

  set_target_prev_view () {
    let scene = this.soupView
    scene.i_last_view -= 1
    if (scene.i_last_view < 0) {
      scene.i_last_view = scene.saved_views.length - 1
    }
    let id = scene.saved_views[scene.i_last_view].id
    this.set_target_view_by_id(id)
    return id
  }

  set_target_next_view () {
    let scene = this.soupView
    scene.i_last_view += 1
    if (scene.i_last_view >= scene.saved_views.length) {
      scene.i_last_view = 0
    }
    let id = scene.saved_views[scene.i_last_view].id
    this.set_target_view_by_id(id)
    return id
  }

  swapViews (i, j) {
    this.soupView.saved_views[j].order = i
    this.soupView.saved_views[i].order = j
    let dummy = this.soupView.saved_views[j]
    this.soupView.saved_views[j] = this.soupView.saved_views[i]
    this.soupView.saved_views[i] = dummy
  }

  get_view_dicts () {
    let view_dicts = []
    for (let i = 1; i < this.soupView.saved_views.length; i += 1) {
      view_dicts.push(this.soupView.saved_views[i].getDict())
    }
    return view_dicts
  }

  make_selected () {
    let result = []
    let residue = this.soup.getResidueProxy()
    for (let i = 0; i < this.soup.getResidueCount(); i += 1) {
      if (residue.load(i).selected) {
        result.push(i)
      }
    }
    return result
  }

  clear_selected () {
    this.soup.clearSelectedResidues()
    this.soupView.current_view.selected = this.make_selected()
    this.soupView.changed = true
  }

  select_residue (i, v) {
    this.soup.getResidueProxy(i).selected = v
    this.soupView.current_view.selected = this.make_selected()
    this.soupView.changed = true
  }

  toggle_neighbors () {
    let iAtom = this.soupView.current_view.i_atom
    let iRes = this.soup.getAtomProxy(iAtom).iRes
    let b
    if (this.lastNeighborIRes === iRes) {
      b = false
      this.lastNeighborIRes = null
    } else {
      b = true
      this.lastNeighborIRes = iRes
    }
    this.soup.selectNeighbourResidues(iRes, b)
    this.soupView.current_view.selected = this.make_selected()
    this.soupView.changed = true
    this.soupView.updateSelection = true
  }

  save_current_view (new_id) {
    let j = this.soupView.i_last_view + 1
    let new_view = this.soupView.current_view.clone()
    new_view.text = 'Click edit to change this text.'
    new_view.pdb_id = this.soup.pdb_id
    let time = getCurrentDateStr()
    if (user === '' || typeof user === 'undefined') {
      new_view.creator = '~ [public] @' + time
    } else {
      new_view.creator = '~ ' + user + ' @' + time
    }
    new_view.id = new_id
    new_view.selected = this.make_selected()
    this.soupView.insert_view(j, new_id, new_view)
    return j
  }

  delete_view (id) {
    this.soupView.remove_saved_view(id)
  }

  sort_views_by_order () {
    function order_sort (a, b) {
      return a.order - b.order
    }

    this.soupView.saved_views.sort(order_sort)
    for (let i = 0; i < this.soupView.saved_views.length; i += 1) {
      this.soupView.saved_views[i].order = i
    }
  }

  load_views_from_flat_views (view_dicts) {
    for (let i = 0; i < view_dicts.length; i += 1) {
      let view = new View()
      view.setFromDict(view_dicts[i])
      if (view.id === 'view:000000') {
        continue
      }
      this.soupView.save_view(view)
    }
    this.sort_views_by_order()
  }

  set_backbone_option (option) {
    this.soupView.current_view.show.all_atom = false
    this.soupView.current_view.show.trace = false
    this.soupView.current_view.show.ribbon = false
    this.soupView.current_view.show[option] = true
    this.soupView.changed = true
  }

  set_show_option (option, bool) {
    console.log('Controller.set_show_option', option, bool)
    this.soupView.current_view.show[option] = bool
    if (option === 'sidechain') {
      this.soupView.updateSelection = true
    }
    this.soupView.changed = true
  }

  get_show_option (option) {
    return this.soupView.current_view.show[option]
  }

  toggle_show_option (option) {
    let val = this.get_show_option(option)
    this.set_show_option(option, !val)
  }

  flag_changed () {
    this.soupView.changed = true
  }

  set_current_view (view) {
    this.soupView.current_view = view.clone()
    let atom = this.soup.getAtomProxy(view.i_atom)
    this.soupView.soup.clearSelectedResidues()
    this.soupView.soup.selectResidues(view.selected, true)
    this.soupView.changed = true
  }

}

export {
  Soup,
  Controller,
  interpolateCameras,
  SoupView
}