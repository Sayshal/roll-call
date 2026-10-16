/** Extra turn marker animations for core's Turn Marker settings. */
export class TurnMarkers {
  /** @type {Set<Function>} Shader classes this feature defines, to tell its animations from other modules'. */
  static #shaders = new Set();

  /** Add the animations once core initialises its combat configuration, and patch the marker so their shaders apply. */
  static register() {
    Hooks.once('initializeCombatConfiguration', (settings) => {
      for (const [id, config] of Object.entries(TurnMarkers.#animations())) settings.addTurnMarkerAnimation(id, { id, label: `ROLLCALL.TurnMarkers.${id.slice(2)}`, config });
    });
    TurnMarkers.#patchDraw();
  }

  /**
   * Animation configs by id.
   * @returns {Object<string, object>} Animation configs.
   */
  static #animations() {
    const still = { speed: 0, min: 1, max: 1 };
    return {
      rcSlowSpin: { spin: -1.5, pulse: still },
      rcFastSpin: { spin: -10, pulse: still },
      rcReverseSpin: { spin: 4, pulse: still },
      rcHeartbeat: { spin: 0, pulse: { speed: 70, min: 0.96, max: 1.08 } },
      rcBreathe: { spin: 0, pulse: { speed: 12, min: 0.86, max: 1.1 } },
      rcSpinBreathe: { spin: -3, pulse: { speed: 12, min: 0.9, max: 1.08 } },
      rcEmber: { spin: -2, pulse: still, shader: TurnMarkers.#shaderClass(TurnMarkers.#EMBER) },
      rcRipple: { spin: 0, pulse: still, shader: TurnMarkers.#shaderClass(TurnMarkers.#RIPPLE) },
      rcShimmer: { spin: -1, pulse: still, shader: TurnMarkers.#shaderClass(TurnMarkers.#SHIMMER) },
      rcPrism: { spin: -3, pulse: still, shader: TurnMarkers.#shaderClass(TurnMarkers.#PRISM) }
    };
  }

  /** @type {string} Firelight: brightness flickers around the ring and warms toward orange. */
  static #EMBER = `
    float angle = atan(centered.y, centered.x);
    float flicker = 0.8 + 0.25 * sin(time * 7.0 + angle * 5.0) * sin(time * 3.1 - dist * 20.0);
    color.rgb = mix(color.rgb, color.rgb * vec3(1.25, 0.7, 0.35), 0.5) * flicker;`;

  /** @type {string} Water: rings of distortion travel outward from the centre. */
  static #RIPPLE = `
    vec2 direction = dist > 0.0001 ? centered / dist : vec2(0.0);
    color = texture2D(sampler, vUvs + direction * sin(dist * 40.0 - time * 4.0) * 0.006);`;

  /** @type {string} Polished metal: a highlight sweeps around the ring. */
  static #SHIMMER = `
    float sweep = smoothstep(0.82, 1.0, cos(atan(centered.y, centered.x) - time * 2.0));
    color.rgb += sweep * 0.6 * color.a;`;

  /** @type {string} Arcane: colours cycle through the spectrum. */
  static #PRISM = `
    float hue = time * 0.8;
    const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
    const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
    vec3 yiq = toYIQ * color.rgb;
    yiq.yz = mat2(cos(hue), sin(hue), -sin(hue), cos(hue)) * yiq.yz;
    color.rgb = toRGB * yiq;`;

  /**
   * A marker shader running one effect snippet.
   * @param {string} effect GLSL snippet.
   * @returns {Function} Shader class.
   */
  static #shaderClass(effect) {
    const { BaseSamplerShader } = foundry.canvas.rendering.shaders;
    const shaderClass = class extends BaseSamplerShader {
      static classPluginName = null;

      /** @override */
      static _createFragmentShader() {
        return `
        precision ${PIXI.Program.defaultFragmentPrecision} float;
        uniform sampler2D sampler;
        uniform vec4 tintAlpha;
        uniform float time;
        uniform vec3 tint;
        uniform bool tinted;
        varying vec2 vUvs;

        void main() {
          vec2 centered = vUvs - 0.5;
          float dist = length(centered);
          vec4 color = texture2D(sampler, vUvs);
          ${effect}
          if ( tinted ) color.rgb = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)) * tint;
          color.rgb = clamp(color.rgb, 0.0, color.a);
          gl_FragColor = color * tintAlpha;
        }`;
      }

      /** @override */
      static get defaultUniforms() {
        return { sampler: null, tintAlpha: [1, 1, 1, 1], time: 0, tint: [1, 1, 1], tinted: false };
      }

      /** @override */
      _preRender(mesh, renderer) {
        super._preRender(mesh, renderer);
        this.uniforms.time = canvas.app.ticker.lastTime / 1000;
      }
    };
    TurnMarkers.#shaders.add(shaderClass);
    return shaderClass;
  }

  /**
   * Apply our animation's shader after core draws a marker.
   */
  static #patchDraw() {
    const proto = foundry.canvas.placeables.tokens.TokenTurnMarker.prototype;
    const draw = proto.draw;
    proto.draw = async function (...args) {
      await draw.apply(this, args);
      const shaderClass = this.animation?.shader;
      if (!this.mesh || !TurnMarkers.#shaders.has(shaderClass)) return;
      this.mesh.setShaderClass(shaderClass);
      const { document } = this.parent;
      const custom = document.turnMarker.mode === CONST.TOKEN_TURN_MARKER_MODES.CUSTOM;
      const disposition = custom ? document.turnMarker.disposition : CONFIG.Combat.settings.turnMarker.disposition;
      this.mesh.shader.uniforms.tinted = !!disposition;
      if (disposition) foundry.utils.Color.from(this.parent.getDispositionColor()).applyRGB(this.mesh.shader.uniforms.tint);
    };
  }
}
