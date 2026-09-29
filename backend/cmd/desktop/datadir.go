package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// legacyAppName is the product name before the Framely rename; its data dir is migrated once.
const legacyAppName = "BeefTV"

// migrateLegacyDataDir moves the pre-rename data dir to the current location on first launch.
// It never touches existing current data and refuses to move files the legacy app may still be writing.
func migrateLegacyDataDir(legacy, current string, legacyRunning func() bool) error {
	if _, err := os.Stat(current); err == nil {
		return nil
	} else if !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("检查应用数据目录: %w", err)
	}
	info, err := os.Stat(legacy)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("检查旧版应用数据目录: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("旧版应用数据路径不是目录：%s", legacy)
	}
	if legacyRunning() {
		return fmt.Errorf("检测到 %s 仍在运行，请先退出 %s 再启动 Framely，以便迁移本地数据", legacyAppName, legacyAppName)
	}
	if err := os.Rename(legacy, current); err != nil {
		return fmt.Errorf("迁移旧版应用数据（%s → %s）: %w", legacy, current, err)
	}
	return nil
}

// legacyAppProcessRunning reports whether the pre-rename desktop app is running.
// A failed check counts as not running so a missing tool never blocks startup.
func legacyAppProcessRunning() bool {
	if runtime.GOOS == "windows" {
		out, err := exec.Command("tasklist", "/FI", "IMAGENAME eq "+legacyAppName+".exe", "/NH").Output()
		return err == nil && strings.Contains(strings.ToLower(string(out)), strings.ToLower(legacyAppName)+".exe")
	}
	return exec.Command("pgrep", "-x", legacyAppName).Run() == nil
}

// showStartupAlert surfaces a fatal startup error before any window exists (macOS only; best effort).
func showStartupAlert(err error) {
	if runtime.GOOS != "darwin" {
		return
	}
	message := strings.ReplaceAll(err.Error(), `"`, `'`)
	_ = exec.Command("osascript", "-e", `display alert "Framely 无法启动" message "`+message+`" as critical`).Run()
}
