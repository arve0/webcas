const math = require('mathjs')
const { createStore } = require('redux')

// POI extracts styles into html template in production build
import './style.css';

const Vue = require('vue/dist/vue.common.js')

import Modal from './modal.vue'

Vue.component('modal', Modal)

global.math = math

const initialState = {
  steps: [],
  focus: 0
}

function reducer (state = initialState, action) {
  switch (action.type) {
    case 'SET STATE':
      return Object.assign({}, action.state)
    case 'ADD STEP':
      return Object.assign({}, state, {
        steps: [...state.steps, ''],
        focus: state.steps.length
      })

    case 'INSERT STEP':
      return Object.assign({}, state, {
        steps: [...state.steps.slice(0, action.num), '', ...state.steps.slice(action.num)]
      })

    case 'REMOVE STEP':
      return Object.assign({}, state, {
        steps: state.steps.filter((s, i) => i !== action.num)
      })

    case 'STEP INPUT':
      return Object.assign({}, state, {
        steps: [...state.steps.slice(0, action.num), action.input, ...state.steps.slice(action.num + 1)]
      })

    case 'FOCUS':
      return Object.assign({}, state, { focus: action.num })

    case 'FOCUS DECREMENT':
      {  // add scope to allow `let f = ` inside several cases
        let f = state.focus - 1
        return Object.assign({}, state, {
          focus: f > 0 ? f : 0
        })
      }

    case 'FOCUS INCREMENT':
      {
        let f = state.focus + 1
        return Object.assign({}, state, {
          focus: f < state.steps.length ? f : state.focus
        })
      }

    default:
      return state
  }
}

const store = createStore(reducer)
global.store = store

let _steps = []  // keep track of steps in DOM, TODO: react?
store.subscribe(() => {
  let state = store.getState()

  if (state.steps.length !== _steps.length) {
    // inserted or added steps
    // -> re-render all steps (we do not know if new step is inserted or added)
    _steps = []
    document.getElementById('steps').innerHTML = ''
  }
  state.steps.forEach((step, i) => {
    let _step = _steps[i]

    if (!_step) {
      _step = Step(i, step)
      _steps.push(_step)
      document.getElementById('steps').appendChild(_step.root)
    }

    // calculate
    // scope can be mutated in math.eval, the mutated scope is saved to current step
    // first step: create new scope
    // else: copy previous scope
    _step.scope = i === 0 ? {} : Object.assign({}, _steps[i - 1].scope)
    _step.updateOutput(evaluateInput(step, _step.scope))

    if (state.focus === i && !_step.input.activeElement) {
      _step.input.focus()
    }
  })
})

const app = new Vue({
  el: '#container',
  data: {
    name: '',
    saved: Date.now(),
    saveModal: false,
    openModal: false,
    noNameInput: false,
    saves: []
  },
  methods: {
    openSaveModal: function () {
      this.saveModal = true;
      setTimeout(() => this.$refs.saveNameInput.focus(), 100);
    },
    save: function () {
      if (this.name === '') {
        this.noNameInput = true;
        setTimeout(() => this.noNameInput = false, 1000);
        return;
      }
      this.saveModal = false;
      localStorage.setItem('save:' + this.name, JSON.stringify(store.getState()));
      this.getSaves()
    },
    open: function (saveName) {
      store.dispatch({
        type: 'SET STATE',
        state: JSON.parse(localStorage.getItem('save:' + saveName))
      })
      this.openModal = false;
    },
    getSaves: function () {
      this.saves = Object.keys(localStorage)
        .filter(s => s.match(/^save:/))
        .map(s => s.replace('save:', ''));
    },
    remove: function (saveName) {
      if (confirm(`Delete "${saveName}"?`)) {
        localStorage.removeItem('save:' + saveName);
        this.saves = this.saves.filter(s => s !== saveName);
      }
    }
  },
  mounted: function () {
   // avoid template rendering, hide until loaded
   document.body.style.display = 'block';
   this.getSaves();
  }
})

store.dispatch({ type: 'ADD STEP' })

function Step (num, inputValue) {
  let root = Elm('<div class=step></div>')
  let inputWithLabel = Elm(`<label>Input <input type=text></label>`)
  let input = inputWithLabel.children[0]
  let output = Elm(`<div class=output>Output</div>`)

  input.value = inputValue

  function keyDown (event) {
    let kc = event.keyCode
    // 9 tab, 13 enter, 38 up, 40 down
    if (!(kc === 9 || kc === 13 || kc === 38 || kc === 40)) {
      return
    }

    // tab on last field -> avoid address bar
    // arrows -> avoid going to start/end of input field
    event.preventDefault()

    if (kc === 38 || (event.shiftKey && kc === 9)) {
      // up or tab shift
      store.dispatch({ type: 'FOCUS DECREMENT' })
    } else if (kc === 13 && input.selectionStart === 0) {
      // enter and marker in beginning of input field
      // -> insert input and shift steps down
      store.dispatch({ type: 'INSERT STEP', num })
    } else if (kc === 13 && num === store.getState().steps.length - 1) {
      // enter on last input
      store.dispatch({ type: 'ADD STEP' })
    } else if (kc === 9 || kc === 13 || kc === 40) {
      // tab, enter or down
      store.dispatch({ type: 'FOCUS INCREMENT' })
    }
  }

  function onClick () {
    store.dispatch({ type: 'FOCUS', num })
  }

  function keyUp (event) {
    let wasEmpty = store.getState().steps[num] === ''

    store.dispatch({
      type: 'STEP INPUT',
      input: input.value,
      num
    })

    // 8 backspace, 46 delete
    if (wasEmpty && (event.keyCode === 8 || event.keyCode === 46) && store.getState().steps.length !== 1) {
      // no value and backspace/delete -> delete step
      // must be on key up, or else erases character in newly focused field when key released (preventDefault gets nasty)
      store.dispatch({ type: 'REMOVE STEP', num })
      if (event.keyCode === 8  || store.getState().steps.length === num) {
        // move focus one up on backspace
        // keep focus same num on delete (focus to input below deleted input)
        // if we are in last step and delete it, move focus one up
        store.dispatch({ type: 'FOCUS DECREMENT' })
      }
    }
  }

  input.addEventListener('keydown', keyDown)
  input.addEventListener('keyup', keyUp)
  input.addEventListener('click', onClick)

  root.appendChild(inputWithLabel)
  root.appendChild(output)

  function updateOutput (str) {
    let outputSpan = Elm('<span></span>')
    outputSpan.innerText = str

    output.innerText = 'Output'
    output.appendChild(outputSpan)
  }

  return { root, input, output, updateOutput }
}

function Elm (html) {
  let div = document.createElement('div')
  div.innerHTML = html
  return div.childNodes[0]
}

function evaluateInput (input, scope) {
  const precision = 15
  let node, evaluated, output
  try {
    node = math.parse(input)
    try {
      evaluated = node.eval(scope)
    } catch (err) {
      evaluated = math.simplify(node)
    }
  } catch (err) {
    evaluated = err.message
  }
  scope._ = evaluated !== undefined ? evaluated : ''

  switch (typeof evaluated) {
    case 'object':
      output = evaluated.format ? evaluated.format(precision) : evaluated.toString()
      break

    case 'number':
      output = math.format(evaluated, precision)
      break

    case 'function':
      output = node.toString()
      break

    case 'boolean':
      output = evaluated.toString()
      break

    default:
      // error in input? set output empty
      output = evaluated || ''
      break
  }

  return output
}
