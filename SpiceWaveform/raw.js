/* ngspice binary RAW reader. The input ArrayBuffer stays in this browser tab. */
(function (root) {
  "use strict";

  function section(bytes) {
    const decoder = new TextDecoder("utf-8");
    let start = 0;
    const limit = Math.min(bytes.length, 1024 * 1024);
    for (let i = 0; i < limit; i++) {
      if (bytes[i] !== 10) continue;
      const line = decoder.decode(bytes.subarray(start, i)).trim();
      if (line === "Binary:" || line === "Values:") {
        return { kind: line.slice(0, -1), header: decoder.decode(bytes.subarray(0, start)), offset: i + 1 };
      }
      start = i + 1;
    }
    throw new Error("未找到 ngspice RAW 文件头（Binary: 或 Values:）。");
  }

  function field(header, name) {
    const match = header.match(new RegExp("^" + name + ":\\s*(.+)$", "im"));
    return match ? match[1].trim() : "";
  }

  function parseRaw(buffer, fileName) {
    if (!(buffer instanceof ArrayBuffer)) throw new Error("文件数据格式不正确。");
    const bytes = new Uint8Array(buffer);
    const part = section(bytes);
    if (part.kind !== "Binary") throw new Error("这个 RAW 文件使用 ASCII Values 格式；当前查看器支持 ngspice 二进制 RAW。");

    const count = Number(field(part.header, "No\\. Variables"));
    const points = Number(field(part.header, "No\\. Points"));
    if (!Number.isSafeInteger(count) || count < 2 || count > 100000 || !Number.isSafeInteger(points) || points < 1) {
      throw new Error("RAW 文件的变量数或数据点数无效。");
    }
    const flags = field(part.header, "Flags").toLowerCase();
    const complex = /\bcomplex\b/.test(flags);
    const fastAccess = /\bfastaccess\b/.test(flags);
    const bytesPerValue = complex ? 16 : 8;
    const expected = count * points * bytesPerValue;
    if (!Number.isSafeInteger(expected) || part.offset + expected > buffer.byteLength) {
      throw new Error("RAW 数据不完整，文件长度与文件头不符。");
    }

    const variableStart = part.header.search(/^Variables:\s*$/im);
    if (variableStart < 0) throw new Error("RAW 文件缺少 Variables 列表。");
    const variableLines = part.header.slice(variableStart).split(/\r?\n/).slice(1);
    const variables = [];
    for (const line of variableLines) {
      const match = line.match(/^\s*(\d+)\s+(\S+)\s+(\S+)/);
      if (match) variables.push({ index: Number(match[1]), name: match[2], type: match[3] });
      if (variables.length === count) break;
    }
    if (variables.length !== count || variables.some((item, index) => item.index !== index)) {
      throw new Error("RAW 文件的变量表不完整。");
    }

    const plotName = field(part.header, "Plotname");
    const name = (plotName || fileName).toLowerCase();
    const analysis = /ac analysis|ac\.raw|_ac/.test(name) ? "ac" : /dc transfer|dc sweep|dc\.raw|_dc/.test(name) ? "dc" : /transient|tran\.raw|_tran/.test(name) ? "tran" : "other";
    return {
      fileName, title: field(part.header, "Title") || fileName, plotName, analysis,
      points, variables, complex, fastAccess, bytesPerValue,
      offset: part.offset, dataView: new DataView(buffer), buffer, source: "raw"
    };
  }

  function readValue(dataset, point, index) {
    if (dataset.source === "demo") {
      if (index === 0) return { re: dataset.x[point], im: 0 };
      const item = dataset.demoVariables[index - 1];
      return { re: item.re[point], im: item.im ? item.im[point] : 0 };
    }
    const slot = dataset.fastAccess ? index * dataset.points + point : point * dataset.variables.length + index;
    const offset = dataset.offset + slot * dataset.bytesPerValue;
    return {
      re: dataset.dataView.getFloat64(offset, true),
      im: dataset.complex ? dataset.dataView.getFloat64(offset + 8, true) : 0
    };
  }

  function project(value, mode) {
    if (mode === "db") return 20 * Math.log10(Math.max(Math.hypot(value.re, value.im), 1e-300));
    if (mode === "magnitude") return Math.hypot(value.re, value.im);
    if (mode === "phase") return Math.atan2(value.im, value.re) * 180 / Math.PI;
    if (mode === "imag") return value.im;
    return value.re;
  }

  function getSeries(dataset, variableIndex, mode, maximumPoints) {
    const count = dataset.points;
    const x = new Float64Array(count);
    const y = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      x[i] = readValue(dataset, i, 0).re;
      y[i] = project(readValue(dataset, i, variableIndex), dataset.complex ? mode : "real");
    }
    const limit = maximumPoints || 9000;
    if (count <= limit) return { x, y };
    // Keep local extrema so narrow spikes survive plotting large files.
    const bx = [], by = [];
    const bins = Math.max(1, Math.floor((limit - 2) / 2));
    const width = Math.ceil((count - 2) / bins);
    bx.push(x[0]); by.push(y[0]);
    for (let start = 1; start < count - 1; start += width) {
      const end = Math.min(count - 1, start + width);
      let lo = start, hi = start;
      for (let j = start + 1; j < end; j++) {
        if (y[j] < y[lo]) lo = j;
        if (y[j] > y[hi]) hi = j;
      }
      const first = Math.min(lo, hi), second = Math.max(lo, hi);
      bx.push(x[first]); by.push(y[first]);
      if (second !== first) { bx.push(x[second]); by.push(y[second]); }
    }
    bx.push(x[count - 1]); by.push(y[count - 1]);
    return { x: bx, y: by };
  }

  root.RawParser = { parseRaw, getSeries, readValue };
  if (typeof module !== "undefined" && module.exports) module.exports = root.RawParser;
})(typeof window !== "undefined" ? window : globalThis);
