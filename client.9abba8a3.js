webpackJsonp([1],{146:function(t,e,n){t.exports=n(147)},147:function(t,e,n){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),function(t){function e(t){if(Array.isArray(t)){for(var e=0,n=Array(t.length);e<t.length;e++)n[e]=t[e];return n}return Array.from(t)}function s(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:v,n=arguments[1];switch(n.type){case"SET STATE":return Object.assign({},n.state);case"ADD STEP":return Object.assign({},t,{steps:[].concat(e(t.steps),[""]),focus:t.steps.length});case"INSERT STEP":return Object.assign({},t,{steps:[].concat(e(t.steps.slice(0,n.num)),[""],e(t.steps.slice(n.num)))});case"REMOVE STEP":return Object.assign({},t,{steps:t.steps.filter(function(t,e){return e!==n.num})});case"STEP INPUT":return Object.assign({},t,{steps:[].concat(e(t.steps.slice(0,n.num)),[n.input],e(t.steps.slice(n.num+1)))});case"FOCUS":return Object.assign({},t,{focus:n.num});case"FOCUS DECREMENT":var s=t.focus-1;return Object.assign({},t,{focus:s>0?s:0});case"FOCUS INCREMENT":var a=t.focus+1;return Object.assign({},t,{focus:a<t.steps.length?a:t.focus});default:return t}}function a(t,e){function n(e){var n=e.keyCode;9!==n&&13!==n&&38!==n&&40!==n||(e.preventDefault(),38===n||e.shiftKey&&9===n?m.dispatch({type:"FOCUS DECREMENT"}):13===n&&0===u.selectionStart?m.dispatch({type:"INSERT STEP",num:t}):13===n&&t===m.getState().steps.length-1?m.dispatch({type:"ADD STEP"}):9!==n&&13!==n&&40!==n||m.dispatch({type:"FOCUS INCREMENT"}))}function s(){m.dispatch({type:"FOCUS",num:t})}function a(e){var n=""===m.getState().steps[t];m.dispatch({type:"STEP INPUT",input:u.value,num:t}),!n||8!==e.keyCode&&46!==e.keyCode||1===m.getState().steps.length||(m.dispatch({type:"REMOVE STEP",num:t}),8!==e.keyCode&&m.getState().steps.length!==t||m.dispatch({type:"FOCUS DECREMENT"}))}function i(t){var e=o("<span></span>");e.innerText=t,d.innerText="Output",d.appendChild(e)}var c=o("<div class=step></div>"),r=o("<label>Input <input type=text></label>"),u=r.children[0],d=o("<div class=output>Output</div>");return u.value=e,u.addEventListener("keydown",n),u.addEventListener("keyup",a),u.addEventListener("click",s),c.appendChild(r),c.appendChild(d),{root:c,input:u,output:d,updateOutput:i}}function o(t){var e=document.createElement("div");return e.innerHTML=t,e.childNodes[0]}function i(t,e){var n=void 0,s=void 0,a=void 0;try{n=d.parse(t);try{s=n.eval(e)}catch(t){s=d.simplify(n)}}catch(t){s=t.message}switch(e._=void 0!==s?s:"",void 0===s?"undefined":u(s)){case"object":a=s.format?s.format(15):s.toString();break;case"number":a=d.format(s,15);break;case"function":a=n.toString();break;case"boolean":a=s.toString();break;default:a=s||""}return a}var c=n(543),r=(n.n(c),n(545)),u="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},d=n(148),p=n(527),l=p.createStore,f=n(544);f.component("modal",r.a),t.math=d;var v={steps:[],focus:0},m=l(s);t.store=m;var y=[];m.subscribe(function(){var t=m.getState();t.steps.length!==y.length&&(y=[],document.getElementById("steps").innerHTML=""),t.steps.forEach(function(e,n){var s=y[n];s||(s=a(n,e),y.push(s),document.getElementById("steps").appendChild(s.root)),s.scope=0===n?{}:Object.assign({},y[n-1].scope),s.updateOutput(i(e,s.scope)),t.focus!==n||s.input.activeElement||s.input.focus()})});new f({el:"#container",data:{name:"",saved:Date.now(),saveModal:!1,openModal:!1,noNameInput:!1,saves:[]},methods:{erase:function(){m.dispatch({type:"SET STATE",state:{steps:[],focus:0}}),m.dispatch({type:"ADD STEP"}),this.name=""},openSaveModal:function(){var t=this;this.saveModal=!0,setTimeout(function(){return t.$refs.saveNameInput.focus()},100)},save:function(){var t=this;if(""===this.name)return this.noNameInput=!0,void setTimeout(function(){return t.noNameInput=!1},1e3);this.saveModal=!1,localStorage.setItem("save:"+this.name,JSON.stringify(m.getState())),this.getSaves()},open:function(t){m.dispatch({type:"SET STATE",state:JSON.parse(localStorage.getItem("save:"+t))}),this.openModal=!1},getSaves:function(){this.saves=Object.keys(localStorage).filter(function(t){return t.match(/^save:/)}).map(function(t){return t.replace("save:","")})},remove:function(t){confirm('Delete "'+t+'"?')&&(localStorage.removeItem("save:"+t),this.saves=this.saves.filter(function(e){return e!==t}))},keydown:function(t){(t.ctrl||t.metaKey)&&(83===t.keyCode?(t.preventDefault(),this.saveModal?this.save():this.openSaveModal()):79===t.keyCode&&(t.preventDefault(),this.openModal=!0))}},mounted:function(){window.addEventListener("keydown",this.keydown),document.body.style.display="block",this.getSaves()},destroyed:function(){window.removeEventListener("keyup",this.keydown)}});m.dispatch({type:"ADD STEP"})}.call(e,n(43))},543:function(t,e){},545:function(t,e,n){"use strict";function s(t){n(546)}var a=n(548),o=n(549),i=n(547),c=s,r=i(a.a,o.a,c,"data-v-b4bd287c",null);e.a=r.exports},546:function(t,e){},548:function(t,e,n){"use strict";e.a={methods:{keyup:function(t){13===t.keyCode&&this.$emit("button"),27===t.keyCode&&this.$emit("close")}},mounted:function(){window.addEventListener("keyup",this.keyup)},destroyed:function(){window.removeEventListener("keyup",this.keyup)}}},549:function(t,e,n){"use strict";var s=function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("transition",{attrs:{name:"modal"}},[n("div",{staticClass:"modal-mask"},[n("div",{staticClass:"modal-wrapper",on:{click:function(e){if(e.target!==e.currentTarget)return null;t.$emit("close")}}},[n("div",{staticClass:"modal-container"},[n("div",{staticClass:"modal-header"},[n("h1",[t._t("title",[t._v("\n              default title\n            ")])],2)]),t._v(" "),n("div",{staticClass:"modal-body"},[t._t("body",[t._v("\n            default body\n          ")])],2),t._v(" "),n("div",{staticClass:"modal-footer"},[n("button",{staticClass:"modal-button",on:{click:function(e){t.$emit("button")}}},[t._t("button",[t._v("\n              Close\n            ")])],2)])])])])])},a=[],o={render:s,staticRenderFns:a};e.a=o}},[146]);
//# sourceMappingURL=client.9abba8a3.js.map