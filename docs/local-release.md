# GitHub Actions 与本地发布方案

## 发布方式

项目提供两条互不混淆的构建路径：

```text
GitHub Actions 手动全量构建 -> 下载临时 Artifact
本机 Windows 构建完整产物 -> GitHub CLI 正式发布 Release
```

Mod 编译依赖 BepInEx、Il2CppInterop 和 Unity interop DLL。这些 DLL 不提交到当前仓库，也不会包含在构建产物中。GitHub Actions 从单独的私有仓库 Release 下载引用包并校验 SHA256；正式 Release 仍由本机显式发布，workflow 不会自动创建 tag 或 Release。

## GitHub Actions 全量构建

`.github/workflows/ci.yml` 在 pull request 和 `main` push 时运行前端 lint、测试与构建。手动运行 `workflow_dispatch` 时，还会在 `windows-2022` 上编译 Tauri 可执行文件、BepInEx Mod DLL，并生成完整 ZIP 和校验文件。

准备一个只有维护者可读的私有 GitHub 仓库，在其 `build-references` Release 中上传 `mystia-build-references.zip`。ZIP 根目录必须直接包含：

```text
BepInEx.Core.dll
BepInEx.Unity.IL2CPP.dll
0Harmony.dll
Il2CppInterop.Runtime.dll
Il2Cppmscorlib.dll
UnityEngine.CoreModule.dll
UnityEngine.InputLegacyModule.dll
```

在当前仓库的 Actions 配置中添加：

- Repository variable `MYSTIA_REFERENCE_REPOSITORY`：私有引用仓库，格式为 `owner/repository`。
- Repository variable `MYSTIA_REFERENCE_BUNDLE_SHA256`：引用 ZIP 的 64 位 SHA256。
- Actions secret `MYSTIA_REFERENCE_TOKEN`：仅授予该私有引用仓库 Contents read 权限的 fine-grained token。

Windows 上可用以下命令取得校验值：

```powershell
(Get-FileHash -Algorithm SHA256 .\mystia-build-references.zip).Hash.ToLowerInvariant()
```

配置完成后，在 GitHub 的 `Actions -> CI -> Run workflow` 运行。默认读取 `build-references` tag，也可以在触发时指定另一个引用 Release tag。成功后会保留 14 天的 Artifact，其中包含：

- `mystia-steward-companion-bepinex.zip`
- `checksums.txt`
- `MystiaStewardCompanion.BepInEx.dll`
- `mystia-steward-companion.exe`

引用 DLL 只作为编译输入，不得上传到当前项目的 Artifact 或公开 Release。上传前应确认这些文件的许可条款允许存放在所选私有仓库中。

## 本机要求

发布机器需要是 Windows，并预装：

- Node.js 22，启用 Corepack。
- .NET 6 SDK 或更新版本。
- Rust stable。
- Microsoft C++ Build Tools 2022 或 Visual Studio “使用 C++ 的桌面开发”组件。
- Microsoft Edge WebView2 Runtime。
- PowerShell 7。
- GitHub CLI，并完成 `gh auth login`。

`mods/bepinex/References/` 需要包含：

```text
BepInEx.Core.dll
BepInEx.Unity.IL2CPP.dll
0Harmony.dll
Il2CppInterop.Runtime.dll
Il2Cppmscorlib.dll
UnityEngine.CoreModule.dll
UnityEngine.InputLegacyModule.dll
```

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

如果引用 DLL 不在 `mods\bepinex\References`，传入同一个目录：

```powershell
pwsh -ExecutionPolicy Bypass -File mods\bepinex\tools\publish-release.ps1 `
  -Tag v1.0.1 `
  -Title "v1.0.1" `
  -Notes "版本更新说明" `
  -ReferenceDir "D:\path\to\mystia-steward-companion-references"
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
- 构建引用 DLL 只留在本机 `References/`，不要提交。
- 发布前运行 `set-version.ps1` 并提交版本号变更；发布脚本会自动校验版本一致性。
