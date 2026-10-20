# Assembly · GLB 装配体查看器

在电脑、平板或手机的浏览器中实时查看 GLB。支持装配树、剖切、爆炸视图、测量，以及可调摄影棚光影。

## 使用

打开 GitHub Pages 网页，点击「打开模型」选择当前设备上的 GLB，也可以拖入文件。
仓库与网页均不内置私人模型。选择的模型仅在当前浏览器内解析，不会上传、保存到服务器或同步到其他设备。

| 操作 | 输入 |
| --- | --- |
| 旋转 | 左键拖动 |
| 平移 | 右键 / 中键拖动 |
| 放大 | 滚轮向后滚动 |
| 缩小 | 滚轮向前滚动 |
| 多选 | Ctrl + 左键 |
| 适合窗口 / 聚焦选中项 | F |
| 标准视图 | 空格 |
| 隐藏 / 全部显示 / 隔离 | H / Shift + H / I |
| 触屏 | 单指旋转、双指平移与缩放 |

拖动键位参考 Bambu Studio；滚轮按个人偏好反转。操作指南中可再次反转。
光影设置可切换写实摄影棚 / 经典 CAD，调整曝光，开关阴影与材质优化。

## 开发与更新网页

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm test
npm run dev
npm run build:pages
```

将代码和生成的 `docs/` 一起提交。GitHub Pages 使用 `main` 分支的 `/docs` 目录发布；
`docs/.nojekyll` 允许直接提供静态资源，所有资源使用相对路径，适用于项目子目录。
普通 `npm run build` 输出到 `dist/`。

## 项目结构

- `src/main.js`：模型加载、装配树和工具
- `src/navigation.js`：鼠标与触屏导航
- `src/lighting.js`、`src/material-look.js`：灯光与材质
- `public/draco`、`public/basis`：本地压缩解码器
- `tests/`：导航和材质恢复测试
- `docs/`：GitHub Pages 发布文件

本工具基于 Three.js 0.180.0。第三方许可见 `THIRD-PARTY-LICENSE.txt`。
它是三角网格查看器，不支持 SLDASM / SLDPRT、CAD 特征编辑或装配约束。
剖切不生成封口，测量基于三角网格。GLB 的纹理与缓冲区需嵌入文件；
大模型表现取决于设备的图形性能。
