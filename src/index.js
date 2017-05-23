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
      {  // add scope to allow `let var = ` inside switch case
        let num = state.steps.length
        let input = ''
        let output = ''
        let scope = {}
        let newState = Object.assign({}, state)
        newState.steps = [...state.steps, {num, input, output, scope}]
        newState.focus = num
        return newState
      }

    case 'STEP INPUT':
      {
        let num = action.num
        let input = action.input
        let newState = Object.assign({}, state, {
          steps: [...state.steps]
        })
        // copy previous scope or create new (first step)
        // scope can be mutated in math.eval, and the mutated scope is saved to current step
        let scope = num > 0 ? Object.assign({}, state.steps[num - 1].scope) : {}
        let [node, evaluated, output] = evaluateInput(input, scope)
        newState.steps[num] = { num, input, node, evaluated, output, scope }
        return newState
      }

    case 'FOCUS':
      state.focus = action.num
      return state

    case 'FOCUS DECREMENT':
      {
        let f = state.focus - 1
        state.focus = f > 0 ? f : 0
        return state
      }

    case 'FOCUS INCREMENT':
      {
        let f = state.focus + 1
        state.focus = f < state.steps.length ? f : state.focus
        return state
      }

    default:
      return state
  }
}

const store = createStore(reducer)
global.store = store

let _steps = []  // keep track of steps, TODO: react?
store.subscribe(() => {
  let state = store.getState()

  state.steps.forEach((step, i) => {
    let _step = _steps[i]
    if (!_step) {
      _step = Step(step)
      _steps.push(_step)
      document.getElementById('steps').appendChild(_step.root)
    } else {
      _step.updateOutput(step.output)
    }
    if (state.focus === step.num && !_step.input.activeElement) {
      _step.input.focus()
    }
  })
})

store.dispatch({ type: 'ADD STEP' })

function Step (step) {
  let root = Elm('<div class=step></div>')

  let input = Input(step.input)
  let output = Output(step.output)

  function keyDown (event) {
    let kc = event.keyCode
    // 9 tab, 13 enter, 38 up, 40 down
    if (!(kc === 9 || kc === 13 || kc === 38 || kc === 40)) {
      return
    }
    event.preventDefault()

    if (kc === 38 || (event.shiftKey && kc === 9)) {  // up or tab shift
      store.dispatch({ type: 'FOCUS DECREMENT' })
    } else if (kc === 13 && step.num === store.getState().steps.length - 1) {  // enter on last input
      store.dispatch({ type: 'ADD STEP' })
    } else if (kc === 9 || kc === 13 || kc === 40) {  // tab, enter or down
      store.dispatch({ type: 'FOCUS INCREMENT' })
    }
  }

  function onClick () {
    store.dispatch({ type: 'FOCUS', num: step.num })
  }

  function keyUp () {
    store.dispatch({
      type: 'STEP INPUT',
      num: step.num,
      input: input.value
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

function Input (value) {
  let elm = Elm(`<input type=text>`)
  elm.value = value
  return elm
}

function Output (str) {
  return Elm(`<div class=output>${str}</div>`)
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
  return [ node, evaluated, output ]
}
