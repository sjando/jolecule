import { EmbedJolecule, defaultArgs } from './embed-widget.js'
import { FullPageWidget } from './full-page-widget.js'
import { AquariaAlignment } from './aquaria.js'
import _ from 'lodash'
import $ from 'jquery'

/**
 *
 * @param args = {
 *   divTag: '',
 *   viewHeight: 170,
 *   isViewTextShown: false,
 *   isEditable: true,
 *   animateState: 'none',
 *   onload: onload,
 *   isGrid: false
 * }
 * @returns {EmbedJolecule}
 */
function initEmbedJolecule(args) {
  return new EmbedJolecule(_.merge(defaultArgs, args))
}

/**
 * @param proteinDisplayTag
 * @param viewsDisplayTag
 * @param params
 */
function initFullPageJolecule(...args) {
  return new FullPageWidget(...args)
}

/**
 * @param pdbId: Str - id of RCSB protein structure
 * @param userId: Str - optional id of user on http://jolecule.com;
 *                      default: ''
 * @param isReadOnly: Bool - prevents save/delete to server
 * @param saveUrl: Str - base URL of views server (e.g. "http://jolecule.com")
 * @param isLoadViews: bool - if false: creates dummy view get methods
 * @returns DataServer object
 */
function makeDataServer(
  pdbId,
  userId = null,
  isReadOnly = false,
  saveUrl = '',
  isLoadViews = true,
  biounit = 0,
  viewId = ''
) {
  return {
    // Id of structure accessed by this DataServer
    pdbId: pdbId,

    // getProteinPromise: getProteinPromise,

    /**
     * @param asyncCallback - function that takes a dictionary {
     *   pdbId: Str - id/name of protein structure
     *   pdbText: Str - text in PDB format of a protein structure
     * }
     */
    getProteinData: function(asyncCallback) {
      let url
      if (pdbId.length === 4) {
        if (!biounit) {
          // 0, null or undefined
          url = `https://files.rcsb.org/download/${pdbId}.pdb`
        } else {
          url = `https://files.rcsb.org/download/${pdbId}.pdb${biounit}`
        }
      } else {
        url = `${saveUrl}/pdb/${pdbId}.txt`
      }
      $.get(url)
        .done(pdbText => {
          let result = { pdbId: pdbId, pdbText: pdbText }
          console.log(
            `makeDataServer.getProteinData success ${url} biounit:${biounit}`
          )
          asyncCallback(result)
        })
        .fail(() => {
          console.log(
            `makeDataServer.getProteinData fail ${url} biounit:${biounit}`
          )
          asyncCallback({ pdbId: pdbId, pdbText: '' })
        })
    },

    /**
     * @param callback - function that takes a
     *  - list [ View dictionary as defined by View.getDict() ]
     *  - initViewId
     */
    getViews: function(callback) {
      if (!isLoadViews) {
        callback([])
        return
      }
      let url = `${saveUrl}/pdb/${pdbId}.views.json`
      if (userId) {
        url += `?user_id=${userId}`
      }
      $.getJSON(url)
        .done(views => {
          console.log('makeDataServer.getViews', url, views)
          callback(views, viewId)
        })
        .fail(() => {
          console.log('makeDataServer.getViews fail', url)
          callback([])
        })
    },

    /**
     * @param views - list of View.dicts to be saved
     * @param callback(Boolean) - that is triggered on successful save
     */
    saveViews: function(views, callback) {
      if (isReadOnly) {
        callback()
        return
      }
      $.post(`${saveUrl}/save/views`, JSON.stringify(views))
        .done(() => {
          console.log('makeDataServer.saveViews success', '/save/views', views)
          callback(true)
        })
        .fail(() => {
          console.log('makeDataServer.saveViews fail', '/save/views', views)
          callback(false)
        })
    },

    /**
     * @param viewId - Str: id of view to be deleted
     * @param callback(Boolean) - that is triggered on successful delete with
     */
    deleteView: function(viewId, callback) {
      if (isReadOnly) {
        callback()
        return
      }
      $.post(`${saveUrl}/delete/view`, JSON.stringify({ pdbId, viewId }))
        .done(() => {
          console.log('makeDataServer.deleteView success', viewId)
          callback(true)
        })
        .fail(() => {
          console.log('makeDataServer.deleteView fail', viewId)
          callback(false)
        })
    }
  }
}

export {
  initEmbedJolecule,
  initFullPageJolecule,
  makeDataServer,
  AquariaAlignment
}
