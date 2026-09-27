# SpiceWaveform 0.1

一个无需安装、可离线使用的 ngspice 波形查看器。

## 打开

双击 `SpiceWaveform.html`，或在浏览器中使用“打开文件”选择它。这个文件包含全部代码和 Plotly，无需网络。页面第一次打开时可点“打开内置示例”；查看自己的结果时点“导入 RAW”，一次选择一个或多个 `.raw` 文件，也可直接拖入页面。

在左侧切换数据集、搜索并勾选信号。AC 波形可切换 dB、幅值、相位、实部和虚部。工具栏提供缩放、重置视图和 PNG 导出。

RAW 文件只在浏览器本地读取，不会上传。页面关闭后，导入的文件需要重新选择。`index.html`、`app.js`、`raw.js` 和 `styles.css` 是便于维护的拆分源码。

## 文件支持

- ngspice 二进制 RAW：DC、AC、瞬态；实数和复数数据；普通与 `fastaccess` 布局。
- 数据点较多时，绘图采用保留每组最小值和最大值的抽样；原始文件不会被改动。
- 暂不支持 ASCII `Values:` RAW 和其他仿真器的私有 RAW 变体。

`demo-data.js` 用简短公式生成合成的 DC、AC 和瞬态曲线，仅供预览界面，不含真实设计或仿真数据。

## 开源许可

绘图库 Plotly.js 4.1.1 由 Plotly, Inc. 提供，采用 MIT 许可证。完整版权和许可声明在 `Plotly-LICENSE.txt`，也嵌入在单文件 `SpiceWaveform.html` 的 HTML 注释中。分享这个查看器时请保留该声明。

修改拆分源码后，可运行 `python3 build.py` 重新生成单文件页面。
