const _ = require('lodash')
const path = require('path')
const fs = require('fs-extra')

const config = require('./config')
const dbmodel = require('./dbmodel')
const conn = require('./conn')

/**
 *
 * handlers.js - this module holds all the functions that are accessible
 * to the web-client in the JSON-RPC api. It binds the database to the
 * binary-tree search functions
 *
 * Any functions defined in the module exports can be accessed by the
 * corresponding `rpc` module in the client. These are accessed by their
 * names, where a name starting with public are publicly accessible
 * API. All other functions need the user to have already logged-in.
 *
 * The functions must return a promise that returns a JSON-literal.
 * For security, all returned functions must be wrapped in a dictionary.
 *
 * Functions that handle file-uploads from the client start with
 * upload, and the first parameter will be a filelist object that
 * determines the names and locations of the uploaded files on the
 * server.
 *
 * User handlers
 *
 */

async function publicRegisterUser (user) {
  let errors = []
  if (!user.name) {
    errors.push('no user name')
  }
  if (!user.email) {
    errors.push('no email')
  }
  if (!user.password) {
    errors.push('no Password')
  }

  if (errors.length > 0) {
    throw errors.join(', ').join(errors)
  }

  let values = {
    name: user.name,
    email: user.email,
    password: user.password
  }

  try {
    await dbmodel.createUser(values)
    return {success: true}
  } catch (e) {
    throw 'Couldn\'t register, is your email already in use?'
  }
}

/**
 * Updates user where the id field is used to identify the user.
 * @param {Object} user
 * @promise {User}
 */
async function loginUpdateUser (user) {
  const keys = ['id', 'name', 'email', 'password']
  let values = {}
  for (let key of keys) {
    if (user[key]) {
      values[key] = user[key]
    }
  }
  if (!values) {
    throw 'No values to draw'
  }
  if (!values.id) {
    throw 'No user.id to identify user'
  }

  try {
    console.log('>> handlers.updateUser', values)
    await dbmodel.updateUser(values)
    return {success: true}
  } catch (err) {
    throw 'Couldn\'t draw user - ' + err.toString()
  }
}

async function publicResetPassword (tokenId, password) {
  let values  = {
    id: tokenId,
    password
  }
  if (!values.id) {
    throw 'No user.id to identify user'
  }

  try {
    console.log('>> handlers.publicResetPassword', values)
    await dbmodel.updateUser(values)
    return {success: true}
  } catch (err) {
    throw `Update failure ${err}`
  }
}

// TODO: adminGetUsers, adminDeleteUsers

// user defined


async function updateDatabaseOnInit () {
}

updateDatabaseOnInit()

/**
 * Specific handlers - promises that return a JSON literal
 */

async function publicGetText() {
  return {
    "text": "Example text from local webserver",
    "isRunning": true
  }
}

async function publicDownloadGetReadme () {
  payload = {
    "filename": path.resolve("readme.md"),
    "data": { "success": true}
  }
  console.log("> publicGetReadme", payload)
  return payload
}

async function publicUploadFiles (fileList) {
  const timestampDir = String(new Date().getTime())
  const fullDir = path.join(config.filesDir, timestampDir)
  fs.ensureDirSync(fullDir)
  let targetPaths = [] //
  for (let file of fileList) {
    let basename = path.basename(file.originalname)
    let targetPath = path.join(timestampDir, basename)
    let fullTargetPath = path.join(config.filesDir, targetPath)
    fs.renameSync(file.path, fullTargetPath)
    targetPaths.push('/file/' + targetPath)
  }
  console.log("> publicUploadFiles", targetPaths)
  return { files: targetPaths }
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

function isDirectory (f) {
  try {
    return fs.statSync(f).isDirectory()
  } catch (e) {
  }
  return false
}

async function publicGetInit () {
  let payload = {
    initDir: conn.initDir,
    initFile: conn.initFile,
  }
  console.log('publicGetInit', payload)
  return payload
}

async function publicGetFiles (dirname) {
  let files = fs.readdirSync(dirname)
  let payload = {
    dirname,
    files: [],
    directories: [],
    time: ''
  }
  payload.directories.push('..')
  for (let filename of files) {
    if (isDirectory(path.join(dirname, filename))) {
      payload.directories.push(filename)
    } else if (_.endsWith(filename, '.pdb')) {
      try {
        const pdbText = fs.readFileSync(path.join(dirname, filename), 'utf8')
        payload.files.push({
          title: parsetTitleFromPdbText(pdbText),
          filename: path.join(dirname, filename),
          name: filename
        })
      } catch (error) {}
    }
  } 
  return payload
}

async function publicGetProteinText(pdb) {
  const pdbText = fs.readFileSync(pdb, 'utf8')
  return { pdbText}
}

async function publicGetViewDicts (pdb) {
  let viewJson = getViewsJson(pdb)
  let views = {}
  let text = ''
  if (fs.existsSync(viewJson)) {
    text = fs.readFileSync(viewJson, 'utf8')
    views = JSON.parse(text)
  }
  return {views}
}

async function publicSaveViewDicts(pdb, views) {
  let viewJson = getViewsJson(pdb)
  fs.writeFileSync(viewJson, JSON.stringify(views, null, 2))
  return {success: True}
}

async function publicDeleteView(pdb, viewId) {
  let viewJson = getViewsJson(pdb)
  if (fs.existsSync(viewJson)) {
    let text = fs.readFileSync(viewJson, 'utf8')
    let views = JSON.parse(text)
    _.remove(views, v => v.view_id === viewId)
    fs.writeFileSync(viewJson, JSON.stringify(views, null, 2))
  }
  return {success: True}
}


module.exports = {
  publicRegisterUser,
  loginUpdateUser,
  publicGetText,
  publicDownloadGetReadme,
  publicUploadFiles,
  publicGetInit,
  publicGetFiles,
  publicGetProteinText,
  publicGetViewDicts,
  publicSaveViewDicts,
  publicDeleteView
}
