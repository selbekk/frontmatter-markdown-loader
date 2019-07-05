const loaderUtils = require('loader-utils')
const frontmatter = require('front-matter')

const md = require('markdown-it')({
  html: true,
});

const stringify = (src) => JSON.stringify(src).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

let vueCompiler, vueCompilerStripWith
try {
  vueCompiler = require('vue-template-compiler')
  vueCompilerStripWith = require('vue-template-es2015-compiler')
} catch (err) {
}

module.exports = function (source) {
  if (this.cacheable) this.cacheable();

  const options = loaderUtils.getOptions(this) || {}

  if (!options.bypassed) {
    const fm = frontmatter(source)
    if (options.markdown) {
      fm.html = options.markdown(fm.body);
    } else {
      fm.html = md.render(fm.body);
    }

    const attributes = {
      ...fm.attributes,
      _meta: {
        resourcePath: this.resourcePath,
        query: this.query,
        request: this.request,
        resourceQuery: this.resourceQuery,
        src: source
      }
    };

    const req = loaderUtils.stringifyRequest(this, `frontmatter-markdown-loader?bypassed!${this.resourcePath}`);
    const vueRootClass = options.vue.root || "frontmatter-markdown";
    const reqVue = loaderUtils.stringifyRequest(this, `frontmatter-markdown-loader?bypassed&compileVue&vueRootClass=${vueRootClass}!frontmatter-markdown-loader?bypassed!${this.resourcePath}`);
    return `module.exports = {
      "attributes": ${stringify(attributes)},
      "html": require(${req}).default,
      "body": ${stringify(fm.body)},
      "originalHtml": ${stringify(fm.html)},
      "vue": require(${reqVue}).default
    };`;
  } else if (options.compileVue) {
    const html = JSON.parse(source.match(/^module.exports.default = (\".+\")$/)[1]);
    // source should be HTML
    // return Vue
    // if (!!options.vue && vueCompiler && vueCompilerStripWith) {
    const template = html
      .replace(/<(code\s.+)>/g, "<$1 v-pre>")
      .replace(/<code>/g, "<code v-pre>");
    const compiled = vueCompiler.compile(`<div class="${options.vueRootClass}">${template}</div>`)
    const render = `return ${vueCompilerStripWith(`function render() { ${compiled.render} }`)}`

    let staticRenderFns = '';
    if (compiled.staticRenderFns.length > 0) {
      staticRenderFns = `return ${vueCompilerStripWith(`[${compiled.staticRenderFns.map(fn => `function () { ${fn} }`).join(',')}]`)}`
    }

    return `module.exports.default = {
      render: ${stringify(render)},
      staticRenderFns: ${stringify(staticRenderFns)},
      component: {
        data: function () {
          return {
            templateRender: null
          }
        },
        render: function (createElement) {
          return this.templateRender ? this.templateRender() : createElement("div", "Rendering");
        },
        created: function () {
          this.templateRender = ${vueCompilerStripWith(`function render() { ${compiled.render} }`)};
          this.$options.staticRenderFns = ${vueCompilerStripWith(`[${compiled.staticRenderFns.map(fn => `function () { ${fn} }`).join(',')}]`)};
        }
      }
    }`;
    //}
  } else {
    // source should be fm markdown
    const originalHtml = source.match(/\"originalHtml\": (\".+\")/)[1];
    // return HTML
    return `module.exports.default = ${originalHtml}`;
  }
}
