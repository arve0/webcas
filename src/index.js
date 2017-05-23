const math = require('mathjs')
const { createStore } = require('redux')

global.math = math

const initialState = {
  steps: [],
  scope: {},
  focus: 0
}

function reducer (state = initialState, action) {
  switch (action.type) {
    case 'ADD STEP':
      {  // add scope to allow `let var = ` inside switch case
        let num = state.steps.length
        let input = ''
        let output = ''
        let newState = Object.assign({}, state)
        newState.steps = [...state.steps, {num, input, output}]
        newState.focus = num
        return newState
      }

    case 'STEP INPUT':
      {
        let num = action.num
        let input = action.input
        let [node, evaluated, output] = evaluateInput(input, state.scope)
        state.steps[num] = { num, input, node, evaluated, output }
        return state
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

let previousState = store.getState()
store.subscribe(() => {
  let state = store.getState()
  const _steps = document.getElementById('steps')
  if (previousState.steps.length !== state.steps.length) {
    _steps.innerHTML = ''

    state.steps.forEach(step => {
      let elm = Step(step)
      _steps.appendChild(elm)

      if (state.focus === step.num) {
        elm.childNodes[0].focus()
      }
    })
  }

  let focusedInput = document.querySelector('input:focus')
  let supposedToBeFocused = _steps.children[state.focus]
  if (focusedInput !== supposedToBeFocused) {
    supposedToBeFocused.childNodes[0].focus()
  }
  previousState = state
})

store.dispatch({ type: 'ADD STEP' })

function Step (step) {
  let elm = Elm('<div class=step></div>')

  let input = Input(step.input)

  // function onUpKey (event) {
  //   // 38 = up key
  //   if (event.keyCode !== 38) {
  //     return
  //   }
  //   Find previous input
  // }
  // TODO: tab completion?

  function onKey (event) {
    let kc = event.keyCode
    // 9 tab, 13 enter, 38 up, 40 down
    if (!(kc === 9 || kc === 13 || kc === 38 || kc === 40)) {
      return
    }
    event.preventDefault()

    store.dispatch({
      type: 'STEP INPUT',
      num: step.num,
      input: input.value
    })

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

  input.addEventListener('keydown', onKey)
  input.addEventListener('click', onClick)
  elm.appendChild(input)

  elm.appendChild(Output(step.output))

  return elm
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
  output = typeof evaluated === 'function' ? node.toString() : evaluated
  output = output === undefined ? '' : output
  output = typeof output === 'number' ? math.format(output, precision) : output
  return [ node, evaluated, output ]
}
