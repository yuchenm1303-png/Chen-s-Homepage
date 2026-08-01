(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  const LegacyEngine = window.BlogLegacyGlassEngine;
  if (!BaseRenderer || !LegacyEngine) return;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  /*
   * GlassBorderStyle() plus latestOpenGlDefaultBorderStyle().
   * These are the current finalized App defaults, not the older lab snapshot.
   */
  const CURRENT_SHELL_STYLE = Object.freeze({
    intensity: 1.35,
    visibility: 20,
    maxAlpha: 1,
    outputBrightness: 1.8115207,
    basePull: 0,
    pull: 0,
    concentration: 10,
    extraDistance: 200,
    reach: 180,
    dark: 1.6,
    bodyWidth: 1.250599,
    bodyCurve: 0.2,
    bodyGain: 12.442396,
    bodyBrightness: 0.5451613,
    shoulderWidth: 21.716216,
    shoulderCapture: 96,
    shoulderAngle: 89.5,
    shoulderFalloff: 0,
    shoulderMaterial: 1.5,
    shoulderFlow: 0,
    dispersionStrength: 1.5,
    dispersionDistance: 3.272,
    dispersionEdgeWidth: 54.324,
    dispersionConcentration: 3.33,
    blurAmount: 1.22,
  });

  class IntegratedBlogGlassRenderer extends BaseRenderer {
    constructor(canvas) {
      super(canvas);
      this.legacyEngine = new LegacyEngine();
      this.legacyReady = false;
    }

    initialise() {
      const shellReady = super.initialise();
      if (!shellReady) return false;
      this.legacyReady = this.legacyEngine.initialise();
      return true;
    }

    bind(mainElement, controlElements) {
      super.bind(mainElement, controlElements);
      if (this.legacyReady) {
        this.legacyEngine.bind(controlElements, () => this.requestRender());
      }
    }

    stop() {
      if (this.legacyReady) this.legacyEngine.detach();
      super.stop();
    }

    tick(time) {
      this.frame = 0;
      if (!this.running || document.hidden) return;
      const delta = Math.min(0.05, Math.max(0.001, (time - this.lastFrameTime) / 1000));
      this.lastFrameTime = time;
      const shellActive = this.updateStateAnimations(this.shellState, time, delta);
      const legacyActive = this.legacyReady ? this.legacyEngine.update(time, delta) : false;
      this.applyShellTransform();
      const active = shellActive || legacyActive;
      if (this.dirty || active) {
        this.dirty = false;
        this.renderAll();
      }
      if (active || this.dirty) this.frame = requestAnimationFrame(this.boundTick);
    }

    rebuildBackdrop() {
      super.rebuildBackdrop();
      if (this.legacyReady) this.legacyEngine.textureSource = null;
    }

    renderGlassElement(element, dynamicShell) {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > innerHeight) return;
      const width = Math.max(1, Math.round(rect.width * this.dpr));
      const height = Math.max(1, Math.round(rect.height * this.dpr));
      this.setCanvasSize(this.glCanvas, width, height);

      const gl = this.gl;
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.locations.aPosition);
      gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);

      const dynamic = dynamicShell ? this.dynamicSnapshot() : {
        openGlPress: 0,
        centerX: 0.5,
        centerY: 0.5,
        intensityScale: 1,
      };
      const radiusCss = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 44;
      const radius = Math.min(radiusCss * this.dpr, Math.min(width, height) * 0.5);
      const opticalScale = clamp(Math.min(rect.width, rect.height) / 160, 0.28, 1);
      const intensity = clamp(CURRENT_SHELL_STYLE.intensity * dynamic.intensityScale, 0.35, 1.35);

      gl.uniform2f(this.locations.uResolution, width, height);
      gl.uniform2f(this.locations.uCardOrigin, rect.left * this.dpr, rect.top * this.dpr);
      gl.uniform2f(this.locations.uRootResolution, this.rootWidth, this.rootHeight);
      gl.uniform4f(this.locations.uRect, 0, 0, width, height);
      gl.uniform1f(this.locations.uRadius, radius);
      gl.uniform1f(this.locations.uIntensity, intensity);
      gl.uniform4f(this.locations.uPress, dynamic.openGlPress, dynamic.centerX, dynamic.centerY, 0);
      gl.uniform1f(this.locations.uTextureReady, 1);
      gl.uniform1f(this.locations.uBlurAmount, CURRENT_SHELL_STYLE.blurAmount);
      gl.uniform1f(this.locations.uOpticalScale, opticalScale);
      gl.uniform4f(
        this.locations.uMaterial,
        CURRENT_SHELL_STYLE.visibility,
        CURRENT_SHELL_STYLE.maxAlpha,
        CURRENT_SHELL_STYLE.outputBrightness,
        0,
      );
      gl.uniform4f(
        this.locations.uBodyLensA,
        CURRENT_SHELL_STYLE.basePull * this.dpr,
        CURRENT_SHELL_STYLE.pull * this.dpr,
        CURRENT_SHELL_STYLE.concentration,
        0,
      );
      gl.uniform4f(
        this.locations.uBodyLensB,
        CURRENT_SHELL_STYLE.extraDistance * this.dpr,
        CURRENT_SHELL_STYLE.reach * this.dpr,
        CURRENT_SHELL_STYLE.dark,
        0,
      );
      gl.uniform4f(
        this.locations.uBody,
        CURRENT_SHELL_STYLE.bodyWidth,
        CURRENT_SHELL_STYLE.bodyCurve,
        CURRENT_SHELL_STYLE.bodyGain,
        CURRENT_SHELL_STYLE.bodyBrightness,
      );
      gl.uniform4f(
        this.locations.uShoulder,
        CURRENT_SHELL_STYLE.shoulderWidth * this.dpr,
        CURRENT_SHELL_STYLE.shoulderAngle,
        CURRENT_SHELL_STYLE.shoulderFalloff,
        CURRENT_SHELL_STYLE.shoulderMaterial,
      );
      gl.uniform2f(
        this.locations.uShoulderFlow,
        CURRENT_SHELL_STYLE.shoulderCapture * this.dpr,
        CURRENT_SHELL_STYLE.shoulderFlow,
      );
      gl.uniform4f(
        this.locations.uDispersion,
        CURRENT_SHELL_STYLE.dispersionStrength,
        CURRENT_SHELL_STYLE.dispersionDistance * this.dpr,
        CURRENT_SHELL_STYLE.dispersionEdgeWidth * this.dpr,
        CURRENT_SHELL_STYLE.dispersionConcentration,
      );
      this.textures.forEach((texture, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.output.drawImage(
        this.glCanvas,
        Math.round(rect.left * this.dpr),
        Math.round(rect.top * this.dpr),
        width,
        height,
      );
    }

    renderAll() {
      super.renderAll();
      if (this.legacyReady) {
        this.legacyEngine.render(
          this.output,
          this.dpr,
          this.rootWidth,
          this.rootHeight,
          this.mediumCanvas,
        );
      }
    }
  }

  window.BlogGlassRenderer = IntegratedBlogGlassRenderer;
})();
