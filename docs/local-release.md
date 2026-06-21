# GitHub Actions 与本地发布方案

## 发布方式

项目提供两条互不混淆的构建路径：

```text
GitHub Actions 手动全量构建 -> 下载临时 Artifact
本机 Windows 构建完整产物 -> GitHub CLI 正式发布 Release
```

Mod 的编译依赖由 NuGet 从 BepInEx 官方包源和 nuget.org 自动恢复，不需要在开发机或 GitHub 仓库保存游戏 DLL。正式 Release 仍由本机显式发布，workflow 不会自动创建 tag 或 Release。

## GitHub Actions 全量构建

`.github/workflows/ci.yml` 在 pull request 和 `main` push 时运行前端 lint、测试与构建。手动运行 `workflow_dispatch` 时，还会在 `windows-2022` 上编译 Tauri 可执行文件、BepInEx Mod DLL，并生成完整 ZIP 和校验文件。

在 GitHub 的 `Actions -> CI -> Run workflow` 运行即可，不需要额外变量或 secret。成功后会保留 14 天的 Artifact，其中包含：

- `mystia-steward-companion-bepinex.zip`
- `checksums.txt`
- `MystiaStewardCompanion.BepInEx.dll`
- `mystia-steward-companion.exe`

## 本机要求

发布机器需要是 Windows，并预装：

- Node.js 22，启用 Corepack。
- .NET 6 SDK 或更新版本。
- Rust stable。
- Microsoft C++ Build Tools 2022 或 Visual Studio “使用 C++ 的桌面开发”组件。
- Microsoft Edge WebView2 Runtime。
- PowerShell 7。
- GitHub CLI，并完成 `gh auth login`。

## 同步版本号

发布前先同步项目内版本号。脚本会同时修改 `package.json`、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock` 和 Mod 的 `PluginVersion`：

```powershell
pwsh -ExecutionPolicy Bypass -File mods\bepinex\tools\set-version.ps1 -Version 1.0.1
```

Linux 开发环境可使用等价脚本：

```bash
bash mods/bepinex/tools/set-version.sh 1.0.1
```

版本号同步后先提交到 `dev`：

```powershell
git add package.json apps\companion\src-tauri\Cargo.toml apps\companion\src-tauri\Cargo.lock apps\companion\src-tauri\tauri.conf.json mods\bepinex\src\Plugin\MystiaStewardCompanionPlugin.cs
git commit -m "chore(release): bump version to 1.0.1"
git push origin dev
```

确认版本可发布后，再合并到 `main`，并在 `main` 上执行发布脚本。

`publish-release.ps1` 会根据 `-Tag` 校验代码版本。如果代码仍是旧版本，脚本会失败并提示先运行 `set-version.ps1`。

## Release Note 规则

发布说明只描述从上一个版本到当前版本的用户可见变化：

- 新增功能。
- 体验或性能优化。
- BUG 修复。

不要写内部重构、文档、构建脚本、版本号变更或 Git 流程调整。如果某个优化或 BUG 修复只是本版本新增功能带来的二次调整，不单独列入 Note，只在新增功能描述中体现最终交付能力。

整理 Note 前先查看上一版本 tag 到当前分支的提交记录，例如：

```powershell
git log --oneline v1.0.2..HEAD
```

## 一键构建并发布

从仓库根目录执行：

```powershell
git checkout main
git pull --ff-only origin main

pwsh -ExecutionPolicy Bypass -File mods\bepinex\tools\publish-release.ps1 `
  -Tag v1.0.1 `
  -Title "v1.0.1" `
  -Notes "版本更新说明"
```

脚本会先运行 `build-release.ps1`，然后只上传 Mod 压缩包：

- `mods/bepinex/dist/mystia-steward-companion-bepinex.zip`
- `mods/bepinex/dist/checksums.txt`

`checksums.txt` 只包含 zip 的 SHA256。Tauri setup 安装器不会上传到 Release，避免和 Mod 分发包混淆。GitHub Actions Artifact 同样生成该校验文件，但不会自动创建正式 Release。

## 只上传已有产物

如果已经构建过，只重新上传：

```powershell
pwsh -ExecutionPolicy Bypass -File mods\bepinex\tools\publish-release.ps1 `
  -Tag v1.0.0 `
  -SkipBuild `
  -Clobber
```

`-Clobber` 会覆盖同名 Release 资产。

## 注意事项

- 不要直接推送 tag 期待自动发布；全量 Actions 构建必须手动触发，且只生成 Artifact。
- 构建依赖通过锁定版本的 NuGet 包恢复，不要提交本机 DLL。
- 发布前运行 `set-version.ps1` 并提交版本号变更；发布脚本会自动校验版本一致性。
