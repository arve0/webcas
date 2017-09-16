<template>
  <transition name="modal">
    <div class="modal-mask">
      <div class="modal-wrapper" @click.self="$emit('close')">
        <div class="modal-container">

          <div class="modal-header">
            <h1>
              <slot name="title">
                default title
              </slot>
            </h1>
          </div>

          <div class="modal-body">
            <slot name="body">
              default body
            </slot>
          </div>

          <div class="modal-footer">
            <button class="modal-button" @click="$emit('button')">
              <slot name="button">
                Close
              </slot>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  methods: {
    keyup: function (event) {
      // 13 enter
      if (event.keyCode === 13) {
        this.$emit('button');
      }
      // 27 esc
      if (event.keyCode === 27) {
        this.$emit('close');
      }
    }
  },
  mounted: function () {
    window.addEventListener('keyup', this.keyup)
  },
  destroyed: function () {
    window.removeEventListener('keyup', this.keyup)
  }
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  z-index: 9998;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, .5);
  display: table;
  transition: opacity .3s ease;
}

.modal-wrapper {
  display: table-cell;
  vertical-align: middle;
}

.modal-container {
  width: 80%;
  margin: 0px auto;
  background-color: #fff;
  border-radius: 3px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
  transition: all .3s ease;
  font-family: Helvetica, Arial, sans-serif;
}

.modal-header, .modal-body {
  padding: 10px;
}

.modal-body {
  border-top: solid 1px #ddd;
  border-bottom: solid 1px #ddd;
}

.modal-header h1 {
  font-size: 2em;
  font-weight: normal;
  margin: 0;
}

.modal-button {
  width: 100%;
  border: none;
  background-color: inherit;
  padding: 10px;
  font-size: 1em;
}

/*
 * The following styles are auto-applied to elements with
 * transition="modal" when their visibility is toggled
 * by Vue.js.
 *
 * You can easily play with the modal transition by editing
 * these styles.
 */

.modal-enter {
  opacity: 0;
}

.modal-leave-active {
  opacity: 0;
}

.modal-enter .modal-container,
.modal-leave-active .modal-container {
  -webkit-transform: scale(1.1);
  transform: scale(1.1);
}

</style>
