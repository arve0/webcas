import Vue from 'vue'
import App from './App.vue'
import './polyfills.js'

new Vue({  // eslint-disable-line
  el: '#container',
  render: h => h(App)
})
