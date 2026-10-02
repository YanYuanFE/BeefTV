# LibTV 前端技术分析

内部参考文档，不进入公开发行（`docs/audits/` 已被 `scripts/public-release-export.sh` 排除）。仅用于借鉴思路，不得复制对方代码或设计素材。

## 分析方法

- 对象：<https://www.liblib.tv/>，未登录状态下的首页与公开作品的只读画布（作品详情页“查看制作过程”）。
- 手段：浏览器 DOM 类名、`window` 全局变量、`performance` 资源列表，以及递归下载的全部 JS 分块（约 770 个，解压后约 46MB）中的特征字符串。
- 限制：代码已压缩，只列出有明确证据的库；登录后才加载的模块可能遗漏。Turbopack 产物中残留了部分源码路径（`apps/liblibtv/src/...`）和少量带版本的依赖路径，作为直接证据。

## 技术栈

| 领域 | 技术 | 证据 |
| --- | --- | --- |
| 框架与构建 | Next.js 16.3.4（App Router + Turbopack），pnpm monorepo，应用目录 `apps/liblibtv` | `node_modules/.pnpm/next@16.3.4`、`__next_f`、`TURBOPACK` 全局 |
| 部署 | 静态资源在阿里云 OSS/CDN，入口经 Istio Envoy | 响应头 `server: istio-envoy`、`x-oss-process` |
| 多端 | Capacitor（同一代码打包移动端 App） | `window.Capacitor` |
| UI | Mantine 为主，混用 antd（cssinjs），Tailwind CSS v4.1.18，Iconify（Lucide + 自有 `libtv` 图标集） | `mantine-*` 类名、`data-token-hash`、`tailwindcss v4.1.18`、`iconify--libtv` |
| 列表/动效 | `@tanstack/react-virtual`、react-virtuoso、Swiper、GSAP | 特征字符串 |
| 画布 | React Flow（`@xyflow/react`，DOM 节点），节点自我虚拟化 | `react-flow__*` 类名、`SelfVirtualizingNode.tsx`、`useNodeDimensionSync.ts` |
| 状态与存储 | zustand 4.5.7 + immer，按功能拆 store；IndexedDB（自封装 `idbManager` + localforage）；zod | `zustand@4.5.7`、`keyboardShortcutStore.ts`、`pictureEditStore.ts`、`utils/idb/core/idbManager.ts` |
| 3D（3D-BOX / 导演台） | Three.js + GLTFLoader + DRACOLoader + OrbitControls/TransformControls；内置“SAM 原生素体”人偶（可设骨骼姿势）；depth-anything 深度图 | `__THREE__`、`draco_decoder.wasm`、`sam_mannequin`、`useDepthMapRefResolutionPref.ts` |
| 浏览器端推理 | onnxruntime-web 1.20.1（wasm SIMD 多线程）；MediaPipe Tasks Vision `ImageSegmenter` / `InteractiveSegmenter` | `ort-wasm-simd-threaded.wasm`、`mediapipe.tasks.vision.image_segmenter` |
| 音视频 | WebCodecs（`VideoEncoder`/`VideoDecoder`）+ mediabunny；wavesurfer 波形；media-chrome 播放器；MediaRecorder 录音 | 特征字符串、`audioPeaksPrefetcher.ts`、`voiceInputTranscribeJobs.ts` |
| 自研 wasm | C++ 引擎 `mockup_engine_lib.wasm`（推测为样机/图层合成） | `lib/mockup-engine/cpp-lib/bin/` |
| 富文本 | Tiptap（ProseMirror）；另加载 CodeMirror（用途未确认） | `[tiptap warn]` |
| Agent 通道 | WebSocket（参数含 `session`、`token`、`agent_name`、`agent_version`、`team_id`）+ SSE；消息渲染 streamdown + shiki + KaTeX + mermaid | `chatCanvasAgent.ts`、`data-streamdown` |
| MCP | 对外提供 `https://mcp.liblib.tv/mcp`，外部 Agent 以连接器接入 | 引导文案字符串 |
| 监控运营 | 阿里云 ARMS RUM、GTM、Bing UET、百度转化、浩客 howxm 问卷、网易七鱼客服；html2canvas、qrcode | 全局变量与第三方脚本 |

## 接口所反映的产品能力

共提取约 600 个接口路径，与画布创作相关的分组如下。

| 模块 | 代表接口 | 含义 |
| --- | --- | --- |
| 项目与协作 | `canvas/project/access/members`、`project-space/*`、`copy-to-team`、`project/heartbeat` | 团队空间、成员权限、复制到团队、在线心跳 |
| 版本 | `project/version/{create,list,snapshot}`、`node/artifact-version/{get,save}` | 画布级与节点产物级两层版本 |
| 虚拟文件系统 | `folder/vfs/{read,scripts,script/write,script/diff,draft/push}` | 剧本以文件形式存储并支持 diff，推测供 Agent 读写 |
| 工作流 | `workflow/*`、`workflow/version/*`、`workflow/studio-stack/list` | 可版本化的工作流模板 |
| Skill | `skill/*`、`skill/draft/*`、`skill/optimize`、`skill/slash/search`、`community/skill/*` | 自定义 Skill、AI 优化、Slash 搜索、Skill 社区 |
| Agent 任务 | `task/agent-task/{budget,modes,yield/release}`、`session/approval-mode/update` | 积分预算、运行模式、逐步审批 |
| 生成任务 | `task/generation/{create,progress/batch,stop/batch,skip-queue,power/calculator}` | 批量进度、批量停止、插队、生成前积分预估 |
| 资产 | `media-asset/entity-library/*`、`media-asset/tag-tree`、`media-asset/kling/custom-voices` | 主体库、标签树、自定义音色 |
| 角色 | `character-library/*`、`user/character` | 角色库与最近使用 |
| 运镜 | `video-control/camera-motion`、`video-control/preset` | 运镜预设 |
| 社区与商业 | `project/publish`、`project/template/*`、`project/share/*`、`www/member`、`www/order`、`www/coupon`、`www/corporate-pay`、`www/teams` | 发布、模板、分享、会员、优惠券、企业支付、团队 |

## 对 Framely 的参考

1. **画布性能**：LibTV 用 React Flow 的 DOM 节点，靠节点离屏卸载重内容控制开销。Framely 为自研画布，可借鉴“节点离开视口即卸载媒体”的策略。
2. **浏览器端推理**：抠图、点选分割用 MediaPipe 在本地完成，不占后端和积分，契合 Framely 本地优先定位，也能补齐抠图能力。
3. **浏览器端合成**：WebCodecs + mediabunny 可替代部分 ffmpeg.wasm 场景，速度更快、体积更小；Framely 当前依赖 `@ffmpeg/ffmpeg`，可评估。
4. **Agent 设计**：剧本 VFS、积分预算与逐步审批、对外 MCP 服务值得参考。Framely 后端已有 `backend/internal/mcp`，对外开放成本最低。
5. **两层版本**：画布与节点产物分别版本化。Framely 已有画布保存保护与版本对比，可考虑补节点级版本。
