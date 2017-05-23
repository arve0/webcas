const math = require('mathjs')
const { createStore } = require('redux')

global.math = math

const initialState = {
  steps: [],
  focus: 0
}

function reducer (state = initialState, action) {
  switch (action.type) {
    case 'ADD STEP':
      return Object.assign({}, state, {
        steps: [...state.steps, ''],
        focus: state.steps.length
      })

    case 'INSERT STEP':
      return Object.assign({}, state, {
        steps: [...state.steps.slice(0, action.num), '', ...state.steps.slice(action.num)]
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

store.dispatch({ type: 'ADD STEP' })

function Step (num, inputValue) {
  let root = Elm('<div class=step></div>')
  let input = Elm(`<input type=text>`)
  let output = Elm(`<div class=output></div>`)

  input.value = inputValue

  function keyDown (event) {
    let kc = event.keyCode
    // 9 tab, 13 enter, 38 up, 40 down
    if (!(kc === 9 || kc === 13 || kc === 38 || kc === 40)) {
      return
    }
    event.preventDefault()

    if (kc === 38 || (event.shiftKey && kc === 9)) {
      // up or tab shift
      store.dispatch({ type: 'FOCUS DECREMENT' })
    } else if (kc === 13 && num === store.getState().steps.length - 1) {
      // enter on last input
      store.dispatch({ type: 'ADD STEP' })
    } else if (kc === 13 && input.selectionStart === 0) {
      // enter and marker in beginning of input field
      // -> insert input and shift steps down
      store.dispatch({ type: 'INSERT STEP', num })
    } else if (kc === 9 || kc === 13 || kc === 40) {
      // tab, enter or down
      store.dispatch({ type: 'FOCUS INCREMENT' })
    }
  }

  function onClick () {
    store.dispatch({ type: 'FOCUS', num })
  }

  function keyUp () {
    store.dispatch({
      type: 'STEP INPUT',
      input: input.value,
      num
    })
  }

  input.addEventListener('keydown', keyDown)
  input.addEventListener('keyup', keyUp)
  input.addEventListener('click', onClick)

  root.appendChild(input)
  root.appendChild(output)

  function updateOutput (str) {
    output.innerText = str
  }

  return { root, input, output, updateOutput }
}

function Elm (html) {
  let div = document.createElement('div')
  div.innerHTML = html
  return div.childNodes[0]
}

function evaluateInput (input, scope) {
  const precision = 8
  let node, evaluated, output
  try {
    node = math.parse(input)
    try {
      evaluated = node.eval(scope)
    } catch (err) {
      evaluated = math.simplify(node)
    }
  } catch (err) {
    output = err.message
  }
  scope._ = evaluated || ''
  output = typeof evaluated === 'function' ? node.toString() : evaluated
  output = output === undefined ? '' : output
  output = typeof output === 'number' ? math.format(output, precision) : output
  return output
}
