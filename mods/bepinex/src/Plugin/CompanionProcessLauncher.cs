using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using BepInEx.Logging;

namespace MystiaStewardCompanion.Plugin;

internal static class CompanionProcessLauncher
{
    private const int ControlPort = 32146;
    private const string ControlShow = "mystia-steward-companion:show";
    private const string ControlToggle = "mystia-steward-companion:toggle";
    private const string ControlExit = "mystia-steward-companion:exit";
    private const string ControlVersionPrefix = "mystia-steward-companion:version=";
    private static readonly object RequestLock = new();
    private static DateTime _lastRequestUtc = DateTime.MinValue;

    public static void TryAutoLaunch(StewardPluginConfig config, ManualLogSource log, string localApiToken)
    {
        if (!config.CompanionAutoLaunch.Value) return;
        TryShowOrLaunch(config, log, localApiToken);
    }

    public static void TryLaunchOrFocus(StewardPluginConfig config, ManualLogSource log, string localApiToken)
    {
        TryShowOrLaunch(config, log, localApiToken);
    }

    public static void TryShowOrLaunch(StewardPluginConfig config, ManualLogSource log, string localApiToken)
    {
        if (TryActivateCompatibleCompanion(ControlShow, log)) return;
        TryLaunch(config, log, localApiToken);
    }

    public static void TryToggleOrLaunch(StewardPluginConfig config, ManualLogSource log, string localApiToken)
    {
        if (IsRequestThrottled()) return;
        if (TryActivateCompatibleCompanion(ControlToggle, log)) return;
        TryLaunch(config, log, localApiToken);
    }

    public static void TryNotifyExit()
    {
        SendControlMessage(ControlExit);
    }

    private static bool TryActivateCompatibleCompanion(string message, ManualLogSource log)
    {
        var peerStatus = SendControlMessage(message);
        if (peerStatus == ControlPeerStatus.Compatible) return true;
        if (peerStatus == ControlPeerStatus.Unavailable) return false;

        log.LogInfo("Replacing an outdated companion process with the packaged version.");
        SendControlMessage(ControlExit);
        WaitForControlServerExit();
        return false;
    }

    private static void TryLaunch(StewardPluginConfig config, ManualLogSource log, string localApiToken)
    {
        try
        {
            RecordRequestTime();
            var executablePath = ResolveExecutablePath(config.CompanionExecutablePath.Value);
            if (string.IsNullOrWhiteSpace(executablePath))
            {
                log.LogInfo("Companion launch skipped: companion executable was not found.");
                return;
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = executablePath,
                WorkingDirectory = Path.GetDirectoryName(executablePath) ?? "",
                UseShellExecute = false,
            };
            startInfo.ArgumentList.Add($"--api=http://127.0.0.1:{Math.Clamp(config.LocalApiPort.Value, 1024, 65535)}");
            startInfo.ArgumentList.Add($"--game-pid={Process.GetCurrentProcess().Id}");
            if (!string.IsNullOrWhiteSpace(localApiToken))
            {
                startInfo.ArgumentList.Add($"--token={localApiToken}");
            }

            Process.Start(startInfo);
            log.LogInfo($"Companion launch/focus requested: {executablePath}");
        }
        catch (Exception ex)
        {
            log.LogWarning($"Companion launch failed: {ex.Message}");
        }
    }

    private static ControlPeerStatus SendControlMessage(string message)
    {
        var didConnect = false;
        try
        {
            using var client = new TcpClient();
            if (!client.ConnectAsync("127.0.0.1", ControlPort).Wait(TimeSpan.FromMilliseconds(180)))
            {
                return ControlPeerStatus.Unavailable;
            }
            didConnect = true;

            var bytes = Encoding.UTF8.GetBytes(BuildControlMessage(message));
            using var stream = client.GetStream();
            stream.ReadTimeout = 250;
            stream.Write(bytes, 0, bytes.Length);
            stream.Flush();
            using var reader = new StreamReader(stream, Encoding.UTF8, false, 128, leaveOpen: true);
            var response = reader.ReadLine()?.Trim() ?? "";
            var expectedVersion = ControlVersionPrefix + MystiaStewardCompanionPlugin.PluginVersion;
            return string.Equals(response, expectedVersion, StringComparison.Ordinal)
                ? ControlPeerStatus.Compatible
                : ControlPeerStatus.Incompatible;
        }
        catch
        {
            return didConnect
                ? ControlPeerStatus.Incompatible
                : ControlPeerStatus.Unavailable;
        }
    }

    private static void WaitForControlServerExit()
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                using var client = new TcpClient();
                if (!client.ConnectAsync("127.0.0.1", ControlPort).Wait(TimeSpan.FromMilliseconds(50))) return;
            }
            catch
            {
                return;
            }

            Thread.Sleep(50);
        }
    }

    private static string BuildControlMessage(string message)
    {
        return $"{message}\n--game-pid={Process.GetCurrentProcess().Id}\n";
    }

    private enum ControlPeerStatus
    {
        Unavailable,
        Compatible,
        Incompatible,
    }

    private static bool IsRequestThrottled()
    {
        lock (RequestLock)
        {
            var now = DateTime.UtcNow;
            if (now - _lastRequestUtc < TimeSpan.FromMilliseconds(800))
            {
                return true;
            }

            _lastRequestUtc = now;
            return false;
        }
    }

    private static void RecordRequestTime()
    {
        lock (RequestLock)
        {
            _lastRequestUtc = DateTime.UtcNow;
        }
    }

    private static string ResolveExecutablePath(string configuredPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            var expanded = Environment.ExpandEnvironmentVariables(configuredPath.Trim());
            if (File.Exists(expanded)) return Path.GetFullPath(expanded);
        }

        var pluginDirectory = Path.GetDirectoryName(typeof(MystiaStewardCompanionPlugin).Assembly.Location);
        if (string.IsNullOrWhiteSpace(pluginDirectory)) return "";

        var candidates = OperatingSystem.IsWindows()
            ? new[]
            {
                Path.Combine("companion", "mystia-steward-companion.exe"),
                "mystia-steward-companion.exe",
            }
            : new[]
            {
                Path.Combine("companion", "mystia-steward-companion"),
                "mystia-steward-companion",
            };

        return candidates
            .Select(candidate => Path.Combine(pluginDirectory, candidate))
            .FirstOrDefault(File.Exists) ?? "";
    }

}
