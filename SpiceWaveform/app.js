(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { datasets: [], activeId: null, selected: new Map(), nextId: 1, toastTimer: null };
  const colors = ["#087e7b", "#e39a5a", "#5577c5", "#bd6e98", "#788d54", "#bb765d", "#508fa3", "#9279ad"];
  const labels = { ac: "AC 扫频", dc: "DC 扫描", tran: "瞬态分析", other: "波形数据" };

  function active() { return state.datasets.find((item) => item.id === state.activeId) || null; }
  function notify(message) {
    const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove("show"), 4400);
  }
  function eng(value, unit) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0 " + unit;
    const prefixes = [{ power: 9, text: "G" }, { power: 6, text: "M" }, { power: 3, text: "k" }, { power: 0, text: "" }, { power: -3, text: "m" }, { power: -6, text: "µ" }, { power: -9, text: "n" }, { power: -12, text: "p" }];
    const scale = prefixes.find((item) => Math.abs(value) >= 10 ** item.power) || prefixes[prefixes.length - 1];
    return Number((value / 10 ** scale.power).toPrecision(3)) + " " + scale.text + unit;
  }
  function shortName(name) { return name.replace(/^v\((.+)\)$/i, "$1").replace(/^i\((.+)\)$/i, "I($1)"); }
  function variablePriority(variable) {
    const name = variable.name.toLowerCase();
    if (/^v\([^.)#]+\)$/.test(name)) return 0;
    if (/^i\(/.test(name)) return 1;
    if (/#body|#dbody|#sbody/.test(name)) return 4;
    return 2;
  }
  function defaultSelection(dataset) {
    const names = dataset.variables.map((item) => item.name.toLowerCase());
    const output = names.findIndex((name) => name === "v(vout)" || name === "v(out)");
    const input = names.findIndex((name) => name === "v(vip)" || name === "v(in)");
    const selected = new Set();
    if (output > 0) selected.add(output);
    if (dataset.analysis === "tran" && input > 0) selected.add(input);
    if (!selected.size) {
      const fallback = dataset.variables.find((item, index) => index > 0 && variablePriority(item) === 0) || dataset.variables[1];
      if (fallback) selected.add(fallback.index);
    }
    return selected;
  }
  function addDataset(dataset) {
    dataset.id = state.nextId++;
    state.datasets.push(dataset);
    state.selected.set(dataset.id, defaultSelection(dataset));
    state.activeId = dataset.id;
    render();
  }
  async function importFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        if (file.size > 500 * 1024 * 1024) throw new Error("文件超过 500 MB，暂不支持在浏览器中加载。");
        const dataset = RawParser.parseRaw(await file.arrayBuffer(), file.name);
        addDataset(dataset); added++;
      } catch (error) { notify(file.name + "：" + error.message); }
    }
    if (added) notify("已导入 " + added + " 份波形文件");
  }
  function renderDatasets() {
    const list = $("datasetList"); list.replaceChildren();
    $("datasetCount").textContent = String(state.datasets.length);
    if (!state.datasets.length) { const hint = document.createElement("div"); hint.className = "signal-placeholder"; hint.textContent = "还没有导入文件"; list.append(hint); return; }
    for (const dataset of state.datasets) {
      const button = document.createElement("button"); button.type = "button"; button.className = "dataset-item" + (dataset.id === state.activeId ? " active" : "");
      const icon = document.createElement("span"); icon.className = "dataset-icon " + dataset.analysis; icon.textContent = dataset.analysis === "tran" ? "TR" : dataset.analysis.toUpperCase();
      const texts = document.createElement("span"); texts.className = "dataset-text";
      const title = document.createElement("strong"); title.textContent = dataset.fileName;
      const caption = document.createElement("small"); caption.textContent = labels[dataset.analysis] + " · " + dataset.points.toLocaleString() + " 点";
      texts.append(title, caption); button.append(icon, texts);
      button.addEventListener("click", () => { state.activeId = dataset.id; $("signalSearch").value = ""; render(); });
      list.append(button);
    }
  }
  function renderSignals() {
    const dataset = active(), list = $("signalList"); list.replaceChildren();
    if (!dataset) { const hint = document.createElement("div"); hint.className = "signal-placeholder"; hint.textContent = "导入 RAW 文件后，信号会显示在这里。"; list.append(hint); return; }
    const term = $("signalSearch").value.trim().toLowerCase();
    const signals = dataset.variables.slice(1).filter((item) => item.name.toLowerCase().includes(term)).sort((a,b) => variablePriority(a)-variablePriority(b) || a.index-b.index);
    if (!signals.length) { const hint = document.createElement("div"); hint.className = "signal-placeholder"; hint.textContent = "没有匹配的信号"; list.append(hint); return; }
    for (const variable of signals) {
      const row = document.createElement("label"); row.className = "signal-item"; row.title = variable.name;
      const input = document.createElement("input"); input.type = "checkbox"; input.checked = state.selected.get(dataset.id).has(variable.index);
      input.addEventListener("change", () => { const set = state.selected.get(dataset.id); if (input.checked) set.add(variable.index); else set.delete(variable.index); renderPlot(); });
      const text = document.createElement("span"); text.textContent = variable.name;
      const type = document.createElement("small"); type.textContent = variable.type;
      row.append(input,text,type); list.append(row);
    }
  }
  function xDisplay(dataset) {
    const start = RawParser.readValue(dataset,0,0).re;
    const end = RawParser.readValue(dataset,dataset.points-1,0).re;
    if (dataset.analysis === "ac") return { factor: 1, unit: "Hz", range: eng(start,"Hz") + " – " + eng(end,"Hz") };
    if (dataset.analysis === "tran") {
      const factor = Math.abs(end) < 1e-6 ? 1e9 : Math.abs(end) < 1e-3 ? 1e6 : Math.abs(end) < 1 ? 1e3 : 1;
      const unit = factor === 1e9 ? "ns" : factor === 1e6 ? "µs" : factor === 1e3 ? "ms" : "s";
      return { factor, unit, range: eng(start,"s") + " – " + eng(end,"s") };
    }
    return { factor:1, unit:"V", range: eng(start,"V") + " – " + eng(end,"V") };
  }
  function renderPlot() {
    const dataset = active();
    $("emptyState").hidden = Boolean(dataset);
    $("resetView").disabled = !dataset; $("exportPng").disabled = !dataset;
    if (!dataset) return;
    const selected = Array.from(state.selected.get(dataset.id));
    const mode = $("acMode").value;
    const axis = xDisplay(dataset);
    const traces = selected.map((index, position) => {
      const series = RawParser.getSeries(dataset,index,mode,9000);
      return { type:"scattergl", mode:"lines", name:shortName(dataset.variables[index].name), x:Array.from(series.x, (value) => value * axis.factor), y:series.y, line:{ width:2.1, color:colors[position % colors.length] }, hovertemplate:"%{fullData.name}<br>x: %{x:.6g}<br>y: %{y:.6g}<extra></extra>" };
    });
    const xTitle = dataset.analysis === "tran" ? "时间 ("+axis.unit+")" : dataset.analysis === "ac" ? "频率 (Hz)" : dataset.variables[0].name + " (V)";
    const yTitle = dataset.complex ? ({ db:"幅度 (dB)",magnitude:"幅值",phase:"相位 (°)",real:"实部",imag:"虚部" })[mode] : "电压 / 电流";
    const layout = {
      margin:{l:75,r:25,t:25,b:64}, paper_bgcolor:"#fff",plot_bgcolor:"#fff",font:{family:'Inter,-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif',size:11,color:"#6f8190"},
      xaxis:{title:{text:xTitle,standoff:15},type:dataset.analysis === "ac" ? "log" : "linear",showline:true,linecolor:"#cedbe0",linewidth:1,ticks:"outside",tickcolor:"#cedbe0",gridcolor:"#edf2f4",zeroline:false,automargin:true},
      yaxis:{title:{text:yTitle,standoff:12},showline:true,linecolor:"#cedbe0",linewidth:1,ticks:"outside",tickcolor:"#cedbe0",gridcolor:"#edf2f4",zeroline:false,automargin:true},
      showlegend:traces.length > 1,legend:{orientation:"h",y:1.13,x:0,font:{size:11}},hovermode:"x unified",dragmode:"zoom",uirevision:dataset.id+":"+mode+":"+selected.join(","),
      annotations:traces.length ? [] : [{text:"从左侧勾选信号以显示波形",xref:"paper",yref:"paper",x:.5,y:.5,showarrow:false,font:{size:14,color:"#9aa8b3"}}]
    };
    Plotly.react($("plot"),traces,layout,{responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:["lasso2d","select2d","autoScale2d"]});
    $("seriesCount").textContent = selected.length ? selected.length + " 条曲线" : "尚未选择信号";
    $("statSignals").textContent = String(selected.length);
  }
  function render() {
    const dataset=active(); renderDatasets(); renderSignals();
    $("analysisLabel").textContent = dataset ? labels[dataset.analysis] : "波形工作台";
    $("viewTitle").textContent = dataset ? dataset.fileName : "电路波形，一目了然。";
    $("viewSubtitle").textContent = dataset ? dataset.title : "导入 ngspice 的 .raw 文件，查看 DC、AC 与瞬态结果。";
    $("plotTitle").textContent = dataset ? (dataset.plotName || labels[dataset.analysis]) : "波形图";
    $("fileDetail").textContent = dataset ? (dataset.source === "demo" ? "内置合成示例 · 仅用于预览" : "本机文件 · 未上传") : "等待导入文件";
    $("statAnalysis").textContent = dataset ? labels[dataset.analysis] : "—";
    $("statPoints").textContent = dataset ? dataset.points.toLocaleString() : "—";
    $("statRange").textContent = dataset ? xDisplay(dataset).range : "—";
    $("statSignals").textContent = dataset ? String(state.selected.get(dataset.id).size) : "—";
    $("acMode").hidden = $("acModeLabel").hidden = !dataset || !dataset.complex;
    renderPlot();
  }
  for (const id of ["importTop","importSide","importEmpty"]) $(id).addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change",async (event) => { await importFiles(event.target.files); event.target.value=""; });
  $("signalSearch").addEventListener("input", renderSignals);
  $("clearSignals").addEventListener("click", () => { const dataset=active(); if (!dataset) return; state.selected.get(dataset.id).clear(); renderSignals(); renderPlot(); });
  $("acMode").addEventListener("change", renderPlot);
  $("resetView").addEventListener("click", () => Plotly.relayout($("plot"),{"xaxis.autorange":true,"yaxis.autorange":true}));
  $("exportPng").addEventListener("click", () => { const dataset=active(); if (dataset) Plotly.downloadImage($("plot"),{format:"png",width:1600,height:850,filename:dataset.fileName.replace(/\.raw$/i,"")+"-waveform"}); });
  $("loadDemo").addEventListener("click", () => { for (const dataset of window.WAVEFORM_DEMO || []) addDataset(dataset); if (state.datasets.length) { state.activeId=state.datasets[0].id; render(); notify("已载入内置示例"); } });
  window.addEventListener("dragover", (event) => { event.preventDefault(); $("appShell").classList.add("dragging"); });
  window.addEventListener("dragleave", (event) => { if (!event.relatedTarget) $("appShell").classList.remove("dragging"); });
  window.addEventListener("drop", (event) => { event.preventDefault(); $("appShell").classList.remove("dragging"); importFiles(event.dataTransfer.files); });
  window.addEventListener("resize", () => { if (active() && $("plot").data) Plotly.Plots.resize($("plot")); });
  render();
})();
