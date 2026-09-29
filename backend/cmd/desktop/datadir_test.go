package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigrateLegacyDataDirMovesPreRenameData(t *testing.T) {
	root := t.TempDir()
	legacy, current := filepath.Join(root, "BeefTV"), filepath.Join(root, "Framely")
	if err := os.MkdirAll(filepath.Join(legacy, "resources"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacy, "canvas.db"), []byte("data"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := migrateLegacyDataDir(legacy, current, func() bool { return false }); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if body, err := os.ReadFile(filepath.Join(current, "canvas.db")); err != nil || string(body) != "data" {
		t.Fatalf("migrated db = %q, %v", body, err)
	}
	if _, err := os.Stat(filepath.Join(current, "resources")); err != nil {
		t.Fatalf("migrated subdir missing: %v", err)
	}
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		t.Fatalf("legacy dir should be gone after rename, stat err = %v", err)
	}
}

func TestMigrateLegacyDataDirKeepsExistingCurrentData(t *testing.T) {
	root := t.TempDir()
	legacy, current := filepath.Join(root, "BeefTV"), filepath.Join(root, "Framely")
	for _, dir := range []string{legacy, current} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(current, "canvas.db"), []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := migrateLegacyDataDir(legacy, current, func() bool { t.Fatal("running check must not run once migrated"); return false }); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if body, _ := os.ReadFile(filepath.Join(current, "canvas.db")); string(body) != "new" {
		t.Fatalf("current data overwritten: %q", body)
	}
	if _, err := os.Stat(legacy); err != nil {
		t.Fatalf("legacy dir must be left alone when current exists: %v", err)
	}
}

func TestMigrateLegacyDataDirRefusesWhileLegacyAppRuns(t *testing.T) {
	root := t.TempDir()
	legacy, current := filepath.Join(root, "BeefTV"), filepath.Join(root, "Framely")
	if err := os.MkdirAll(legacy, 0o755); err != nil {
		t.Fatal(err)
	}
	err := migrateLegacyDataDir(legacy, current, func() bool { return true })
	if err == nil || !strings.Contains(err.Error(), "BeefTV") {
		t.Fatalf("expected refusal naming the running legacy app, got %v", err)
	}
	if _, statErr := os.Stat(legacy); statErr != nil {
		t.Fatalf("legacy data must stay in place: %v", statErr)
	}
	if _, statErr := os.Stat(current); !os.IsNotExist(statErr) {
		t.Fatalf("current dir must not be created, stat err = %v", statErr)
	}
}

func TestMigrateLegacyDataDirFreshInstallIsNoop(t *testing.T) {
	root := t.TempDir()
	if err := migrateLegacyDataDir(filepath.Join(root, "BeefTV"), filepath.Join(root, "Framely"), func() bool { return true }); err != nil {
		t.Fatalf("fresh install: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "Framely")); !os.IsNotExist(err) {
		t.Fatalf("fresh install must not create dirs, stat err = %v", err)
	}
}
