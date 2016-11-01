'use strict'
const path = require('path')
const fs = require('fs')
const createBundleRenderer = require('vue-server-renderer').createBundleRenderer
const lru = require('lru-cache')

function createRenderer(bundle) {
  return createBundleRenderer(bundle, {
    cache: lru({
      max: 1000,
      maxAge: 1000 * 60 * 15
    })
  })
}

export default function (instance, {bundlePath}) {
  const req = instance.request
  const res = instance.response
  process.env.VUE_ENV = 'server'
  let renderer = createRenderer(fs.readFileSync(bundlePath, 'utf-8'))

  return new Promise((resolve, reject) => {
    instance.state.$vue = instance.state.$vue || {}

    const s = Date.now()
    const context = {url: req.url}
    const renderStream = renderer.renderToStream(context)
    let firstChunk = true
    let ret = {html: ''}
    renderStream.on('data', chunk => {
      if (firstChunk) {
        if (context.initialState) {
          ret.initialState = context.initialState
        }
        firstChunk = false
      }
      ret.html += chunk
    })

    renderStream.on('end', () => {
      console.log(`whole request: ${Date.now() - s}ms`)
      resolve(ret)
      instance.state.$vue.initialState = ret.initialState || {}
      instance.state.$vue.html = ret.html || ''
    })

    renderStream.on('error', err => {
      res.status(500).end('Internal Error 500')
      console.error(`error during render : ${req.url}`)
      rejcect()
    })
  })
}
