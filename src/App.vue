<template>
  <div>
    <h1>WebCAS</h1>

    <div id="menu">
      <button @click="erase"><img src="file.svg"> New</button>
      <button @click="openSaveModal"><img src="save.svg"> Save</button>
      <button @click="openModal = true"><img src="folder.svg"> Open</button>
    </div>

    <div class="steps">
      <div class="step" v-for="(step, i) in steps" :key="step.i">
        <step-input
          v-model="step.input"
          :i="step.i"
          :focus="i === focus && !saveModal"
          :last="step.i === (steps.length - 1)"
          @add="addStep"
          @remove="removeStep"
          @focus="setFocus"
          :setFocus="setFocus"
          >
        </step-input>
        <div class="output">Output <span>{{ outputs[step.i] }}</span></div>
      </div>
    </div>

    <modal v-if="saveModal" @close="saveModal = false" @button="save(name)">
      <span slot="title">Save</span>
      <span slot="body">
        <input
          placeholder="Input a name"
          type="text"
          v-model="name"
          ref="saveNameInput"
          @keyup.enter="save(name)"
          :class="{ bounce: noNameInput }">
      </span>
      <span slot="button">Save</span>
    </modal>

    <modal v-if="openModal" @close="openModal = false" @button="openModal = false">
      <span slot="title">Open</span>
      <span slot="body">
        <p v-if="saves.length === 0">No saves found.</p>
        <ul class="openList">
          <li v-for="save in saves" @click.self="open(save)">
            {{ save }}
            <img src="x.svg" @click="removeSave(save)" title="Delete">
          </li>
        </ul>
      </span>
    </modal>
  </div>
</template>

<script>
import math from 'mathjs'


import Modal from './Modal.vue'
import StepInput from './StepInput.vue'

export default {
  data: function () {
    let defaultState = {
      name: '',
      saveModal: false,
      openModal: false,
      noNameInput: false,
      saves: [],
      steps: [{ input: '', scope: {}, i: 0 }],
      focus: 0
    }
    let state
    try {
      state = Object.assign(
        defaultState,
        JSON.parse(localStorage.getItem('default'))
      );
    } catch (e) { }
    return state || defaultState;
  },
  computed: {
    outputs: function () {
      return this.steps.map((step, i) => {
        let prev = this.steps[i - 1];
        step.scope = Object.assign({}, prev && prev.scope);
        return this.evaluateInput(step)
      });
    }
  },
  components: {
    'modal': Modal,
    'step-input': StepInput
  },
  methods: {
    addStep: function (num) {
      let scope = num === 0 ? {} : Object.assign({}, this.steps[num - 1].scope);
      this.steps = [
        ...this.steps.slice(0, num),
        { scope, i: num, input: '' },
        ...this.steps.slice(num)
      ]
      this.steps.forEach((step, i) => step.i = i)
    },
    removeStep: function (num) {
      if (this.steps.length > 1) {
        this.steps = this.steps.filter((s, i) => i !== num)
        this.steps.forEach((step, i) => step.i = i)
      }
    },
    setFocus: function (num) {
      let l = this.steps.length
      this.focus = (num + l) % l
    },
    openSaveModal: function () {
      this.saveModal = true;
      setTimeout(() => this.$refs.saveNameInput.focus(), 100);
    },
    erase: function () {
      if (confirm(`This will delete all steps, are you sure?`)) {
        this.steps = [{ input: '', scope: {}, i: 0 }];
        this.name = '';
        this.rerender();
      }
    },
    save: function (saveName) {
      if (!saveName || saveName === '') {
        // bounce input field
        this.noNameInput = true;
        // remove animation class
        setTimeout(() => this.noNameInput = false, 1000);
        return;
      }
      this.saveModal = false;
      // prefix saves through UI with save:
      saveName = saveName === 'default' ? saveName : 'save:' + saveName;
      localStorage.setItem(saveName, JSON.stringify(this.$data));
      this.getSaves()
    },
    open: function (saveName) {
      saveName = saveName === 'default' ? saveName : 'save:' + saveName;
      let savedState = JSON.parse(localStorage.getItem(saveName));
      for (let key in savedState) {
        if (key === 'steps' && savedState.steps.length && typeof savedState.steps[0] === 'string') {
          // steps are [''], convert to new format [{input: '', scope: {}, i: 0}]
          this[key] = savedState.steps.map((input, i) => ({ input, i, scope: {} }))
        } else {
          this[key] = savedState[key];
        }
      }
      this.openModal = false;
      this.getSaves();
      this.rerender();
    },
    getSaves: function () {
      this.saves = Object.keys(localStorage)
        .filter(s => s.match(/^save:/))
        .map(s => s.replace('save:', ''));
    },
    removeSave: function (saveName) {
      if (confirm(`Delete "${saveName}"?`)) {
        localStorage.removeItem('save:' + saveName);
        this.saves = this.saves.filter(s => s !== saveName);
      }
    },
    rerender: function () {
      let steps = this.steps;
      this.steps = [];
      // force rerender of all inputs
      this.$nextTick(function () {
        this.steps = steps;
      });
    },
    keydown: function (event) {
      this.$nextTick(function () {
        if (!this.saveModal) {
          this.save('default')
        }
      })
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (event.keyCode === 83) {
        // 83 s -> save
        event.preventDefault()
        if (this.saveModal) {
          this.save(this.name)
        } else {
          this.openSaveModal()
        }
      } else if (event.keyCode === 79) {
        // 79 o -> open
        event.preventDefault()
        this.openModal = true;
      }
    },
    evaluateInput: function ({ input, scope }) {
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
  },
  mounted: function () {
    window.addEventListener('keydown', this.keydown)
    this.getSaves();
  },
  destroyed: function () {
    window.removeEventListener('keydown', this.keydown)
  }
}
</script>

<style src="./style.css"></style>
