package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestProviderConfigRecoversLastValidBackup(t *testing.T) {
	dir := t.TempDir()
	store, err := NewProviderConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveLocalModelConfig([]byte(`{"channels":[{"id":"beefapi","apiKey":"first-secret","enabled":true}]}`)); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveLocalModelConfig([]byte(`{"channels":[{"id":"beefapi","apiKey":"second-secret","enabled":true}]}`)); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, LocalProviderConfigFile), []byte(`{"schemaVersion":`), 0o600); err != nil {
		t.Fatal(err)
	}

	effective, health, err := store.LoadEffectiveModelConfig()
	if err != nil {
		t.Fatal(err)
	}
	if health != ConfigHealthRecovered {
		t.Fatalf("health = %q", health)
	}
	if got := requireEffectiveChannel(t, effective, "beefapi")["apiKey"]; got != "first-secret" {
		t.Fatalf("recovered apiKey = %#v", got)
	}
}

func TestProviderConfigCommittedRevisionOnlyAdvancesAfterValidWrite(t *testing.T) {
	store, err := NewProviderConfig(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveLocalModelConfig([]byte(`{"channels":[{"id":"beefapi","apiKey":"secret","enabled":true}]}`)); err != nil {
		t.Fatal(err)
	}
	first, _, err := store.LoadEffectiveModelConfig()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveLocalModelConfig([]byte(`{"channels":`)); err == nil {
		t.Fatal("invalid config was accepted")
	}
	second, _, err := store.LoadEffectiveModelConfig()
	if err != nil {
		t.Fatal(err)
	}
	if first.Revision != 1 || second.Revision != first.Revision {
		t.Fatalf("revisions = %d then %d", first.Revision, second.Revision)
	}
}

func requireEffectiveChannel(t *testing.T, effective EffectiveModelConfig, id string) map[string]any {
	t.Helper()
	raw, ok := effective.Config["channels"].([]any)
	if !ok {
		body, _ := json.Marshal(effective.Config["channels"])
		t.Fatalf("channels are not an array: %s", body)
	}
	for _, item := range raw {
		channel, _ := item.(map[string]any)
		if channel["id"] == id {
			return channel
		}
	}
	t.Fatalf("channel %q missing", id)
	return nil
}
