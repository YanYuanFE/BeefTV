# Framely 本地桌面版快速开始

Framely 桌面版是无需登录的本地优先工作区。项目、画布、素材、任务记录和模型配置默认保存在本机；只有执行生成时，才会按你配置的渠道请求外部模型服务。

## 下载与首次打开

从 [官方发布页](https://github.com/glanderness/BeefTV/releases/latest) 下载对应系统的安装包。Mac 的 Apple 芯片选择 `darwin-arm64`，Intel 芯片选择 `darwin-amd64`；解压后将 `Framely.app` 放入「应用程序」。

目前 Mac 版本尚未完成 Apple 开发者签名和公证。首次打开时，如果提示「Apple 无法验证 Framely.app 是否包含恶意软件」，请先确认安装包来自官方发布页，再打开「系统设置 → 隐私与安全性」，找到 Framely 并点击「仍要打开」，按系统提示确认。受组织管理的 Mac 可能需要联系管理员。

这是 macOS 对未公证应用的检查，换一个下载地址不会消除它。无需关闭整个系统的安全检查。具体操作见 [Apple 的打开应用说明](https://support.apple.com/zh-cn/102445)。

已经能正常打开的旧版本，可在应用内检查更新；更新器会校验更新清单签名和安装包哈希。这些校验不等于 Apple 公证。

### 从 BeefTV 升级

Framely 由 BeefTV 更名而来。应用包名和更新通道都变了，已安装的 BeefTV 无法通过应用内更新升级，需要手动安装一次 Framely：

1. 退出 BeefTV。
2. 按上面的步骤安装并打开 Framely。首次启动会自动把本地数据从 `BeefTV` 数据目录迁移到 `Framely` 数据目录；BeefTV 仍在运行时，Framely 会提示先退出。
3. 确认项目和素材都在之后，可以删除旧的 `BeefTV.app`。

## 构建桌面版

环境要求：Go 1.25、Bun，以及 Wails 所需的系统组件。

在仓库根目录执行：

```bash
BEEFTV_GO_DIR=/path/to/go ./scripts/build-framely-release.sh
```

macOS 应用输出到 `backend/cmd/desktop/build/bin/Framely.app`。

Windows amd64 必须在 Windows 本机构建（需要 PATH 中的 Go、Bun，以及编译 go-sqlite3 的 GCC）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-framely-windows-release.ps1
```

输出为 `backend\cmd\desktop\build\bin\Framely.exe`，官方插件在旁边的 `plugin-packages\`。前提与数据目录见 `docs/desktop-release.md`。

首次打开后直接进入本地工作区，不需要注册或登录。

## 配置模型

首次打开需要登录账号。登录后应用会自动签发访问密钥并同步账号可用的模型，之后可在“模型配置”里重新拉取模型或调整单个模型的能力。密钥保存在本地工作区，不会写入画布、素材或任务列表。

模型请求可能访问外部供应商，但 Framely 不会把项目数据同步到 SaaS 存储。素材会先写入本地资源目录，再作为本地资源引用提交给模型渠道。

## 本地开发与验证

需要同时调试前后端时，可参考 `scripts/framely-shared-dev.sh`。验证本地发行边界：

```bash
BEEFTV_GO_DIR=/path/to/go ./scripts/verify-framely-local-release.sh
```

## 数据位置与备份

桌面运行时会在本地工作区保存 SQLite 数据库、资源文件、模型配置和迁移备份。升级迁移前会自动创建数据库备份；如需迁移或恢复，请先退出 Framely 并完整复制工作区数据目录。

云存储、团队同步和计费不属于 Framely 本地版。以本地能力契约、精简 schema 和发行门禁为准，详见 `docs/local-first-architecture.md`。
