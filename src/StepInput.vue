<template>
<label>Input
  <input
    type="text"
    v-focus="focus"
    v-model="input"
    ref="input"
    @input="$emit('input', $event.target.value)"
    @keydown.enter.prevent="addStep"
    @keyup.delete="removeStep"
    @keydown.tab.prevent="setFocus(i + 1)"
    @keydown.down.prevent="setFocus(i + 1)"
    @keydown.shift.tab.prevent="setFocus(i - 1)"
    @keydown.up.tab.prevent="setFocus(i - 1)"
    @click="setFocus(i)">
</label>
</template>

<script>
export default {
  props: ['value', 'i', 'last', 'focus', 'setFocus'],
  data: function () {
    return {
      input: this.value,
      empty: false
    }
  },
  directives: {
    focus: function (el, binding) {
      // <element v-focus="true"> will focus element
      if (binding.value) {
        el.focus();
      }
    }
  },
  mounted: function () {
    if (this.focus) {
      this.$refs.input.focus();
    }
  },
  methods: {
    addStep: function (event) {
      if (event.target.selectionStart === 0) {
        // enter and marker in beginning of input field
        // -> insert new input and shift rest of steps down
        this.$emit('add', this.i)
      } else if (this.last) {
        // add step at bottom, increment focus
        this.$emit('add', this.i + 1)
        this.$emit('focus', this.i + 1)
      } else {
        // enter on input in the middle
        this.$emit('focus', this.i + 1)
      }
    },
    removeStep: function (event) {
      if (!this.empty && this.input === '') {
        this.empty = true;
      } else if (this.empty) {
        this.$emit('remove', this.i)
        if (event.keyCode !== 46 || this.last) {
          // backspace key or in end
          // delete key keeps focus on same input
          this.$emit('focus', this.i - 1)
        }
      }
    }
  }
}
</script>
