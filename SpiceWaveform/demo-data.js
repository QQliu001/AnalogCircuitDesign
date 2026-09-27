/* Deterministic synthetic waveforms for previewing the viewer UI. */
(function () {
  const make = (fileName, plotName, analysis, xName, x, variables, complex) => ({
    fileName, title: "演示曲线 · 合成数据，仅用于预览", plotName, analysis,
    points: x.length,
    variables: [{ index: 0, name: xName, type: analysis === "ac" ? "frequency" : analysis === "tran" ? "time" : "voltage" },
      ...variables.map((item, index) => ({ index: index + 1, name: item.name, type: item.type || (item.name.startsWith("i(") ? "current" : "voltage") }))],
    complex, source: "demo", x,
    demoVariables: variables.map((item) => ({ re: item.re, im: item.im || null }))
  });

  const transientX = Array.from({ length: 501 }, (_, i) => i * 20e-9);
  const transientVip = transientX.map((t) => t < 1e-6 ? 0.9 : 0.901);
  const transientOut = transientX.map((t) => {
    if (t < 1e-6) return 1.2;
    const dt = t - 1e-6;
    return 1.2 - 0.5 * (1 - Math.exp(-dt / 0.9e-6)) + 0.035 * Math.exp(-dt / 0.32e-6) * Math.sin(2 * Math.PI * dt / 0.55e-6);
  });

  const dcX = Array.from({ length: 41 }, (_, i) => 0.8 + i * 0.005);
  const dcOut = dcX.map((vin) => 1.15 - 0.48 * Math.tanh((vin - 0.9) / 0.028));

  const acX = Array.from({ length: 161 }, (_, i) => 10 ** (i * 8 / 160));
  const pole = 12e3;
  const acOutRe = acX.map((f) => 32 / (1 + (f / pole) ** 2));
  const acOutIm = acX.map((f) => -32 * (f / pole) / (1 + (f / pole) ** 2));

  window.WAVEFORM_DEMO = [
    make("example-tran.raw · 示例", "Transient Analysis · 示例", "tran", "time", transientX,
      [{ name: "v(vout)", re: transientOut }, { name: "v(vip)", re: transientVip }], false),
    make("example-dc.raw · 示例", "DC Sweep · 示例", "dc", "v(v-sweep)", dcX,
      [{ name: "v(vout)", re: dcOut }], false),
    make("example-ac.raw · 示例", "AC Analysis · 示例", "ac", "frequency", acX,
      [{ name: "v(vout)", re: acOutRe, im: acOutIm }, { name: "v(vip)", re: acX.map(() => 1), im: acX.map(() => 0) }], true)
  ];
})();
